import React, { useRef, useState } from "react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { UploadCloud, CheckCircle2, ArrowRight, FileText, Wrench } from "lucide-react";
import { Card, ErrorBox, InfoBox, Badge, Gauge, Loading } from "../components/ui.jsx";
import { useVehicle } from "../VehicleContext.jsx";
import { Link } from "react-router-dom";

function UploadResult({ result }) {
  const an = result.anomaly;
  const dq = result.data_quality;
  const sf = result.sensor_fault;
  const health = result.health;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <CheckCircle2 size={16} color="var(--ok)" />
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          {result.filename} — {result.n_rows || dq.n_rows} rows analyzed
        </span>
      </div>

      <div className="grid grid-4">
        <Card title="Overall Health Score">
          <Gauge value={health.health_score} band={health.band} />
        </Card>
        <Card title="Anomaly Status">
          <div className="card-hero"><span className="value">{(an.anomaly_ratio * 100).toFixed(0)}</span><span className="unit">% flagged</span></div>
          <div style={{ marginTop: 10 }}><Badge status={an.status} /></div>
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-2)" }}>Model: {an.model_used}</div>
        </Card>
        <Card title="Sensor Reliability">
          <div className="card-hero"><span className="value" style={{ fontSize: 20 }}>
            {sf.verdict === "LIKELY_SENSOR_FAULT" ? "Flagged" : "OK"}
          </span></div>
          <div style={{ marginTop: 10 }}>
            <Badge status={sf.verdict === "LIKELY_SENSOR_FAULT" ? "WARNING" : "NORMAL"}>
              {sf.flagged_sensors.length ? sf.flagged_sensors.join(", ") : "No sensor faults"}
            </Badge>
          </div>
        </Card>
        <Card title="Data Quality">
          <div className="card-hero"><span className="value">{dq.data_quality_score}</span><span className="unit">/ 100</span></div>
          <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--text-2)" }}>
            {dq.n_rows} rows · {dq.duplicate_rows} dup · {dq.total_outliers} outliers
          </div>
        </Card>
      </div>

      <div style={{ height: 14 }} />

      <div className="grid grid-3">
        <Card title="Anomaly Intensity Timeline" style={{ gridColumn: "span 2" }}>
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={an.timeline_scores.map((v, i) => ({ i, v }))}>
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
            {an.top_contributors.map(c => (
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
        <Card title="Data Quality Detail">
          <div className="kv-list">
            <div className="kv-row"><span className="k">Missing data</span><span className="v">{dq.missing_pct}%</span></div>
            <div className="kv-row"><span className="k">Duplicate rows</span><span className="v">{dq.duplicate_rows}</span></div>
            <div className="kv-row"><span className="k">Total outliers</span><span className="v">{dq.total_outliers}</span></div>
            <div className="kv-row"><span className="k">Timestamps monotonic</span><span className="v">{String(dq.timestamp_monotonic)}</span></div>
          </div>
        </Card>
        <Card title="Maintenance Priority" right={<Wrench size={13} color="var(--text-2)" />}>
          {result.maintenance && result.maintenance.length ? (
            <div className="fault-list">
              {result.maintenance.slice(0, 3).map((m, i) => (
                <div className="fault-row" key={i} style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                  <strong style={{ fontSize: 12.5 }}>{m.category} — {m.subcategory}</strong>
                  <span style={{ fontSize: 11.5, color: "var(--text-2)" }}>{m.symptoms?.join(", ")}</span>
                </div>
              ))}
            </div>
          ) : <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>No maintenance action indicated right now.</div>}
        </Card>
      </div>

      <div style={{ height: 14 }} />
      <InfoBox>{result.source_disclaimer}</InfoBox>

      <div style={{ height: 14 }} />
      <Card title="This file is now your active vehicle">
        <p style={{ fontSize: 12.5, color: "var(--text-1)", marginBottom: 12 }}>
          Every telemetry-driven page — Dashboard, Vehicle Health, Anomaly Analysis, Sensor Analytics,
          Digital Twin, Data Quality, Maintenance Center, Reports and History — now reflects{" "}
          <span className="mono">{result.filename}</span> instead of demo data. Switch back to a demo
          scenario anytime from the vehicle selector in the top bar.
        </p>
        <div className="pill-row">
          <Link className="btn btn-primary btn-sm" to="/dashboard"><ArrowRight size={13} /> Go to Dashboard</Link>
          <Link className="btn btn-sm" to="/sensors">View Sensor Charts</Link>
          <Link className="btn btn-sm" to="/reports"><FileText size={13} /> Generate PDF Report</Link>
        </div>
      </Card>
    </>
  );
}

export default function About() {
  const { doUpload, uploading, uploadError, setUploadError, dataSource } = useVehicle();
  const [file, setFile] = useState(null);
  const fileRef = useRef(null);

  const onUpload = (f) => {
    setFile(f);
    setUploadError(null);
    doUpload(f);
  };

  const currentResult = dataSource?.mode === "upload" ? dataSource.analysis : null;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Settings / About</h2>
        <p>Upload your own vehicle's CSV telemetry — schema-validated and run through the real pipeline — or read about the project's dataset boundaries.</p>
      </div>

      <Card title="Upload Mode — analyze your own vehicle">
        <label className="upload-drop" style={{ display: "block" }} onClick={() => fileRef.current?.click()}>
          <UploadCloud size={22} style={{ marginBottom: 8 }} />
          <div>{uploading ? "Uploading & analyzing…" : file ? `Selected: ${file.name}` : "Click to choose a CSV file"}</div>
          <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 6 }}>
            Required columns: coolant_temp_c, oil_pressure_kpa, rpm, engine_load_pct, intake_temp_c,
            fuel_rate_lph, throttle_pos_pct, vibration_g, battery_voltage_v, speed_kph
          </div>
        </label>
        <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }}
               onChange={e => e.target.files[0] && onUpload(e.target.files[0])} />

        {uploading && <div style={{ marginTop: 12 }}><Loading label="Running data quality, sensor-fault and anomaly pipeline…" /></div>}

        {uploadError && !uploading && (
          <div style={{ marginTop: 12 }}>
            <ErrorBox message={uploadError.message} />
            {uploadError.missing_columns && (
              <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--text-2)" }}>
                Missing: <span className="mono">{uploadError.missing_columns.join(", ")}</span><br />
                Found instead: <span className="mono">{uploadError.found_columns?.join(", ")}</span>
              </div>
            )}
          </div>
        )}
      </Card>

      <div style={{ height: 14 }} />

      {currentResult && <UploadResult result={currentResult} />}

      <div style={{ height: 14 }} />

      <div className="grid grid-2">
        <Card title="About this project">
          <p style={{ fontSize: 12.5, color: "var(--text-1)", lineHeight: 1.7 }}>
            AI Auto-Diagnostics &amp; RUL Engine integrates real anomaly detection, fault diagnosis,
            RUL/prognostics, explainable AI and a diagnostic knowledge layer into one platform. It does
            not claim to have invented any of these techniques — its contribution is the integration
            and the honest handling of dataset boundaries. See <span className="mono">docs/</span> in
            the project for full architecture, methodology, limitations and research-gap documentation.
          </p>
        </Card>
        <Card title="Dataset Boundaries">
          <ul style={{ fontSize: 12.5, color: "var(--text-1)", lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
            <li>Anomaly module runs on <b>your uploaded telemetry</b> once you upload a CSV, or synthetic demo data otherwise.</li>
            <li>Diagnosis module runs on <b>real EngineFaultDB</b> samples (separate schema — see Diagnostics page).</li>
            <li>RUL module runs on <b>real NASA C-MAPSS</b> turbofan data (not automotive).</li>
            <li>Maintenance knowledge is retrieved from the <b>real Automotive Faults</b> dataset.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
