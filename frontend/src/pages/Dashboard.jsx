import React, { useEffect, useRef, useState } from "react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Wrench, UploadCloud, Sparkles, Cpu, ArrowRight } from "lucide-react";
import { Card, Badge, Loading, ErrorBox, Gauge, InfoBox } from "../components/ui.jsx";
import { useAnalysis } from "../useAnalysis.js";
import { useVehicle } from "../VehicleContext.jsx";
import { getModelMetrics } from "../api";

function UploadCTA() {
  const { doUpload, uploading } = useVehicle();
  const fileRef = useRef(null);
  return (
    <Card title="Analyze Your Own Vehicle" right={<UploadCloud size={13} color="var(--text-2)" />}>
      <p style={{ fontSize: 12.5, color: "var(--text-1)", lineHeight: 1.6, marginBottom: 12 }}>
        Everything on this dashboard is currently a synthetic demo scenario. Upload your own
        telemetry CSV and this page — plus Vehicle Health, Anomaly Analysis, Sensor Analytics,
        Digital Twin and Data Quality — will switch to show your vehicle's real numbers instead.
      </p>
      <button className="btn btn-primary btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
        <UploadCloud size={13} /> {uploading ? "Analyzing…" : "Upload CSV"}
      </button>
      <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }}
             onChange={e => e.target.files[0] && doUpload(e.target.files[0])} />
    </Card>
  );
}

function ModelSnapshot() {
  const [m, setM] = useState(null);
  useEffect(() => { getModelMetrics().then(setM); }, []);
  if (!m) return <Card title="Live Model Snapshot"><Loading /></Card>;
  return (
    <Card title="Live Model Snapshot" right={<Cpu size={13} color="var(--text-2)" />}>
      <div className="kv-list">
        <div className="kv-row"><span className="k">Diagnosis model</span><span className="v">{m.diagnosis.best_model} · F1 {m.diagnosis.test_metrics.test_f1_macro.toFixed(2)}</span></div>
        <div className="kv-row"><span className="k">RUL model</span><span className="v">{m.rul.best_model} · MAE {m.rul.test_metrics.test_mae.toFixed(1)}c</span></div>
        <div className="kv-row"><span className="k">Anomaly model</span><span className="v">{m.anomaly.best_model} · F1 {m.anomaly.model_comparison[m.anomaly.best_model].f1.toFixed(2)}</span></div>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 10 }}>
        Pulled live from <span className="mono">/api/model-metrics</span> — see Model Analytics for the full breakdown.
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { data, loading, error, vehicleId, isUpload } = useAnalysis();

  return (
    <div className="page">
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>
          {isUpload
            ? <>Live pipeline output for your uploaded vehicle <span className="mono">{vehicleId}</span> — every figure below comes from the running anomaly, data-quality and health-scoring models.</>
            : <>Live pipeline output for demo scenario <span className="mono">{vehicleId}</span> — every figure below comes from the running anomaly, data-quality and health-scoring models, not a static mock.</>}
        </p>
      </div>

      {loading && <Loading label="Running diagnostic pipeline…" />}
      {error && <ErrorBox message={error} />}

      {!isUpload && !loading && (
        <>
          <div className="grid grid-2">
            <UploadCTA />
            <ModelSnapshot />
          </div>
          <div style={{ height: 14 }} />
        </>
      )}

      {data && (
        <>
          <InfoBox>{data.source_disclaimer}</InfoBox>
          <div style={{ height: 14 }} />

          <div className="grid grid-4">
            <Card title="Overall Health Score">
              <Gauge value={data.health.health_score} band={data.health.band} />
            </Card>

            <Card title="Anomaly Status">
              <div className="card-hero"><span className="value">{(data.anomaly.anomaly_ratio * 100).toFixed(0)}</span><span className="unit">% of window flagged</span></div>
              <div style={{ marginTop: 10 }}><Badge status={data.anomaly.status} /></div>
              <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--text-2)" }}>Model: {data.anomaly.model_used}</div>
            </Card>

            <Card title="Sensor Reliability">
              <div className="card-hero">
                <span className="value" style={{ fontSize: 20 }}>{data.sensor_fault.verdict === "LIKELY_SENSOR_FAULT" ? "Flagged" : "OK"}</span>
              </div>
              <div style={{ marginTop: 10 }}>
                <Badge status={data.sensor_fault.verdict === "LIKELY_SENSOR_FAULT" ? "WARNING" : "NORMAL"}>
                  {data.sensor_fault.flagged_sensors.length ? data.sensor_fault.flagged_sensors.join(", ") : "No sensor faults"}
                </Badge>
              </div>
            </Card>

            <Card title="Data Quality">
              <div className="card-hero"><span className="value">{data.data_quality.data_quality_score}</span><span className="unit">/ 100</span></div>
              <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--text-2)" }}>
                {data.data_quality.n_rows} rows · {data.data_quality.duplicate_rows} dup · {data.data_quality.total_outliers} outliers
              </div>
            </Card>
          </div>

          <div style={{ height: 14 }} />

          <div className="grid grid-3">
            <Card title="Anomaly Intensity Timeline" style={{ gridColumn: "span 2" }}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.anomaly.timeline_scores.map((v, i) => ({ i, v }))}>
                  <CartesianGrid stroke="var(--line-soft)" vertical={false} />
                  <XAxis dataKey="i" hide />
                  <YAxis width={28} tick={{ fill: "var(--text-2)", fontSize: 10 }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: "var(--bg-2)", border: "1px solid var(--line)", fontSize: 12 }} />
                  <Line type="monotone" dataKey="v" stroke="var(--accent)" dot={false} strokeWidth={1.6} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Top Contributing Sensors">
              <div className="fault-list">
                {data.anomaly.top_contributors.map(c => (
                  <div className="fault-row" key={c.sensor}>
                    <span className="mono" style={{ fontSize: 12 }}>{c.sensor}</span>
                    <div className="bar-bg"><div className="bar-fill" style={{ width: `${Math.min(100, c.z_score * 40)}%` }} /></div>
                    <span className="mono" style={{ fontSize: 11, color: "var(--text-2)" }}>{c.z_score}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div style={{ height: 14 }} />

          <div className="grid grid-2">
            <Card title="Health Score Contributors">
              <div className="kv-list">
                {Object.entries(data.health.contributions).map(([k, v]) => (
                  <div className="kv-row" key={k}>
                    <span className="k">{k.replace(/_/g, " ")}</span>
                    <span className="v" style={{ color: v < 0 ? "var(--crit)" : "var(--text-1)" }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 10.5, color: "var(--text-2)", fontFamily: "var(--mono)" }}>{data.health.formula}</div>
            </Card>

            <Card title="Maintenance Priority" right={<Wrench size={13} color="var(--text-2)" />}>
              {data.maintenance.length === 0 ? (
                <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>No maintenance action indicated right now.</div>
              ) : (
                <div className="fault-list">
                  {data.maintenance.slice(0, 3).map((m, i) => (
                    <div className="fault-row" key={i} style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                      <strong style={{ fontSize: 12.5 }}>{m.category} — {m.subcategory}</strong>
                      <span style={{ fontSize: 11.5, color: "var(--text-2)" }}>{m.symptoms?.join(", ")}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
