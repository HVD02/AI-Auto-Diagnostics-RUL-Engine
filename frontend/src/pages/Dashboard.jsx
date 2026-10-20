import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { Wrench, UploadCloud, Cpu, FileText, ShieldCheck, ExternalLink } from "lucide-react";
import { Card, Badge, Loading, Empty, ErrorBox, Gauge, InfoBox } from "../components/ui.jsx";
import { useAnalysis } from "../useAnalysis.js";
import { useVehicle } from "../VehicleContext.jsx";
import { getModelMetrics } from "../api";
import "./Dashboard.css";

const SENSOR_FAULT = "LIKELY_SENSOR_FAULT";

function fmt(value, digits = 1) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function humanize(key) {
  return String(key).replace(/_/g, " ");
}

function flowchartUrl(file) {
  // main.py mounts the Automotive_Faults data folder at /static/flowcharts
  // and vite.config.js proxies /static to the backend.
  return `/static/flowcharts/${encodeURIComponent(file)}`;
}

function flagReasons(flags, sensor) {
  const f = flags && flags[sensor];
  if (!f) return [];
  const reasons = [];
  if (f.stuck) reasons.push("stuck signal");
  if (f.out_of_physical_range) reasons.push("outside physical range");
  return reasons;
}

/* ------------------------------------------------------------------ */
/* Upload call-to-action (demo mode only) — same workflow as before    */
/* ------------------------------------------------------------------ */
function UploadCTA() {
  const { doUpload, uploading } = useVehicle();
  const fileRef = useRef(null);

  const onPick = (e) => {
    const file = e.target.files[0];
    // doUpload already stores failures in uploadError (shown by App's banner);
    // the catch only prevents an unhandled promise rejection in the console.
    if (file) doUpload(file).catch(() => {});
    e.target.value = "";
  };

  return (
    <Card
      title="Analyze Your Own Vehicle"
      right={<UploadCloud size={13} color="var(--text-2)" />}
      className="dv2-card dv2-upload"
    >
      <p className="dv2-copy">
        Everything on this dashboard is currently a synthetic demo scenario. Upload your own
        telemetry CSV and this page — plus Vehicle Health, Anomaly Analysis, Sensor Analytics,
        Digital Twin and Data Quality — will switch to show your vehicle's real numbers instead.
      </p>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
      >
        <UploadCloud size={13} /> {uploading ? "Analyzing…" : "Upload CSV"}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        style={{ display: "none" }}
        onChange={onPick}
      />
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Model snapshot — live from /api/model-metrics                       */
/* ------------------------------------------------------------------ */
function ModelRow({ label, value, dataset }) {
  return (
    <div className="dv2-model-row">
      <div className="kv-row">
        <span className="k">{label}</span>
        <span className="v">{value}</span>
      </div>
      <div className="dv2-model-data">{dataset}</div>
    </div>
  );
}

function ModelSnapshot() {
  const [m, setM] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getModelMetrics()
      .then(d => { if (!cancelled) setM(d); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);

  if (failed) {
    return (
      <Card title="Live Model Snapshot" className="dv2-card dv2-models">
        <ErrorBox message="Model metrics could not be loaded from /api/model-metrics." />
      </Card>
    );
  }
  if (!m) {
    return (
      <Card title="Live Model Snapshot" className="dv2-card dv2-models">
        <Loading />
      </Card>
    );
  }

  const an = m.anomaly;
  const anomalyF1 = an?.model_comparison?.[an?.best_model]?.f1;

  return (
    <Card
      title="Live Model Snapshot"
      right={<Cpu size={13} color="var(--text-2)" />}
      className="dv2-card dv2-models"
    >
      <div className="kv-list">
        <ModelRow
          label="Diagnosis model"
          value={`${m.diagnosis?.best_model ?? "—"} · F1 ${fmt(m.diagnosis?.test_metrics?.test_f1_macro, 2)}`}
          dataset="Trained on EngineFaultDB"
        />
        <ModelRow
          label="RUL model"
          value={`${m.rul?.best_model ?? "—"} · MAE ${fmt(m.rul?.test_metrics?.test_mae, 1)} cycles`}
          dataset="Trained on NASA C-MAPSS FD001 — aircraft turbofan engine data, not passenger-car data"
        />
        <ModelRow
          label="Anomaly model"
          value={`${an?.best_model ?? "—"} · F1 ${fmt(anomalyF1, 2)}`}
          dataset="Benchmarked on synthetic demo telemetry"
        />
      </div>
      <p className="dv2-cap">
        Pulled live from <span className="mono">/api/model-metrics</span>. These scores describe each
        model on its own dataset, not its accuracy on your vehicle.{" "}
        <Link className="dv2-inline-link" to="/models">Model Analytics</Link> has the full breakdown.
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Timeline tooltip                                                    */
/* ------------------------------------------------------------------ */
function TimelineTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="dv2-tip">
      <div className="dv2-tip-time">{p.t !== undefined && p.t !== null ? String(p.t) : `Sample ${p.i}`}</div>
      <div className="dv2-tip-row"><span>Sample</span><span>{p.i}</span></div>
      <div className="dv2-tip-row"><span>Relative intensity</span><span>{fmt(p.v, 1)}</span></div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Data limitations & safety                                           */
/* ------------------------------------------------------------------ */
function Limitations({ isUpload }) {
  return (
    <Card
      title="Data Limitations & Safety"
      right={<ShieldCheck size={13} color="var(--text-2)" />}
      className="dv2-card dv2-limits"
    >
      <ul className="dv2-limit-list">
        {isUpload ? (
          <li>
            Your uploaded telemetry is analysed by the same pipeline as the demo scenarios. Results
            depend on how closely your sensors match the demo telemetry schema.
          </li>
        ) : (
          <li>Demo telemetry is synthetic demonstration data, not real vehicle data.</li>
        )}
        <li>
          The anomaly model was trained on synthetic demo telemetry (real EngineAD fleet data is not
          included), so results on real vehicles are indicative only.
        </li>
        <li>
          RUL estimates use NASA C-MAPSS FD001, which is aircraft turbofan engine data, not
          passenger-car data. The RUL model has not been validated on passenger cars.
        </li>
        <li>
          The anomaly timeline and sensor contributor scores are relative to the analysed window,
          not absolute limits. Sensor-fault verdicts are heuristic plausibility checks.
        </li>
        <li>
          Maintenance entries are retrieved from the Automotive Faults dataset by keyword match.
          They are documented checks, not a diagnosis of this vehicle.
        </li>
        <li>
          This is a diagnostic aid for demonstration and education. It does not replace inspection
          by a certified technician, and should not be the sole basis for a safety-critical
          maintenance decision.
        </li>
      </ul>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard page                                                      */
/* ------------------------------------------------------------------ */
export default function Dashboard() {
  const { data, loading, error, vehicleId, isUpload } = useAnalysis();

  const timeline = useMemo(() => {
    const scores = data?.anomaly?.timeline_scores;
    if (!Array.isArray(scores)) return [];
    const stamps = data.anomaly.timestamps;
    return scores.map((v, i) => ({
      i,
      v,
      t: Array.isArray(stamps) ? stamps[i] : undefined,
    }));
  }, [data]);

  const health = data?.health;
  const an = data?.anomaly;
  const sf = data?.sensor_fault;
  const dq = data?.data_quality;
  const maintenance = data?.maintenance || [];

  const sensorFlagged = sf?.verdict === SENSOR_FAULT;
  const flaggedSensors = sf?.flagged_sensors || [];

  return (
    <div className={`page dv2${loading ? " dv2-busy" : ""}`} aria-busy={loading}>
      <header className="dv2-head">
        <div className="dv2-head-text">
          <h2 className="dv2-title">Dashboard</h2>
          <p className="dv2-sub">
            {isUpload
              ? <>Live pipeline output for your uploaded vehicle <span className="mono">{vehicleId}</span> — every figure below comes from the running anomaly, data-quality and health-scoring models.</>
              : <>Live pipeline output for demo scenario <span className="mono">{vehicleId}</span> — every figure below comes from the running anomaly, data-quality and health-scoring models, not a static mock.</>}
          </p>
        </div>
        <div className="dv2-head-side">
          <span className={`dv2-source ${isUpload ? "dv2-source-upload" : "dv2-source-demo"}`}>
            <span className="dv2-source-dot" aria-hidden="true" />
            {isUpload ? "Your uploaded telemetry" : "Synthetic demo telemetry"}
          </span>
          <Link className="btn btn-sm" to="/reports">
            <FileText size={13} /> Reports
          </Link>
        </div>
      </header>

      {loading && <Loading label="Running diagnostic pipeline…" />}
      {error && <ErrorBox message={error} />}

      {data && (
        <div className="dv2-body">
          <InfoBox>{data.source_disclaimer}</InfoBox>

          <section className="grid grid-4 dv2-metrics" aria-label="Key metrics">
            <Card title="Overall Health Score" className="dv2-card dv2-metric">
              <Gauge value={health.health_score} band={health.band} />
              <p className="dv2-cap dv2-cap-center">Documented weighted formula — see breakdown below.</p>
            </Card>

            <Card title="Anomaly Status" className="dv2-card dv2-metric">
              <div className="card-hero">
                <span className="value">{fmt(an.anomaly_ratio * 100, 0)}</span>
                <span className="unit">% of window flagged</span>
              </div>
              <div className="dv2-badge-row"><Badge status={an.status} /></div>
              <p className="dv2-cap">Model: {an.model_used}</p>
            </Card>

            <Card title="Sensor Reliability" className="dv2-card dv2-metric">
              <div className="card-hero">
                <span className="value dv2-value-sm">{sensorFlagged ? "Flagged" : "OK"}</span>
              </div>
              <div className="dv2-badge-row">
                <Badge status={sensorFlagged ? "WARNING" : "NORMAL"}>
                  {flaggedSensors.length ? flaggedSensors.join(", ") : "No sensor faults"}
                </Badge>
              </div>
              {sensorFlagged && (
                <ul className="dv2-flags">
                  {flaggedSensors.map(s => (
                    <li className="dv2-flag" key={s}>
                      <span className="dv2-flag-sensor mono">{s}</span>
                      <span className="dv2-flag-why">{flagReasons(sf.sensor_flags, s).join(", ") || "flagged"}</span>
                    </li>
                  ))}
                </ul>
              )}
              {sensorFlagged && typeof sf.confidence === "number" && (
                <p className="dv2-cap">Heuristic confidence {fmt(sf.confidence, 2)}</p>
              )}
              {typeof sf.note === "string" && <p className="dv2-cap">{sf.note}</p>}
            </Card>

            <Card title="Data Quality" className="dv2-card dv2-metric">
              <div className="card-hero">
                <span className="value">{dq.data_quality_score}</span>
                <span className="unit">/ 100</span>
              </div>
              <p className="dv2-cap">
                {dq.n_rows} rows · {dq.duplicate_rows} duplicate · {dq.total_outliers} outliers
              </p>
              <p className="dv2-cap">
                {fmt(dq.missing_pct, 2)}% missing · timestamps {dq.timestamp_monotonic ? "in order" : "out of order"}
              </p>
            </Card>
          </section>

          <section className="dv2-split" aria-label="Anomaly analysis">
            <Card
              title="Anomaly Intensity Timeline"
              right={<span className="mono dv2-card-meta">{timeline.length} samples</span>}
              className="dv2-card dv2-timeline"
            >
              {timeline.length === 0 ? (
                <Empty label="No timeline data in this analysis." />
              ) : (
                <>
                  <div className="dv2-chart">
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={timeline} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id="dv2-timeline-fill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" style={{ stopColor: "var(--accent)", stopOpacity: 0.28 }} />
                            <stop offset="100%" style={{ stopColor: "var(--accent)", stopOpacity: 0.02 }} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="var(--line-soft)" vertical={false} />
                        <XAxis
                          dataKey="i"
                          tick={{ fill: "var(--text-1)", fontSize: 10 }}
                          tickLine={false}
                          axisLine={{ stroke: "var(--line)" }}
                          minTickGap={48}
                        />
                        <YAxis
                          width={30}
                          domain={[0, 100]}
                          ticks={[0, 25, 50, 75, 100]}
                          tick={{ fill: "var(--text-1)", fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          content={<TimelineTooltip />}
                          cursor={{ stroke: "var(--accent)", strokeOpacity: 0.4 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="v"
                          stroke="var(--accent)"
                          strokeWidth={1.6}
                          fill="url(#dv2-timeline-fill)"
                          dot={false}
                          activeDot={{ r: 3, fill: "var(--accent)", stroke: "var(--bg-0)" }}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="dv2-cap">
                    Relative intensity, scaled 0–100 within this window (x-axis: sample index). It is not
                    an absolute fault level, so even a healthy window spans the full range.
                  </p>
                </>
              )}
            </Card>

            <Card title="Top Contributing Sensors" className="dv2-card dv2-contrib">
              <div className="fault-list">
                {(an.top_contributors || []).map(c => (
                  <div className="fault-row" key={c.sensor}>
                    <span className="mono dv2-contrib-name">{c.sensor}</span>
                    <div className="bar-bg">
                      <div className="bar-fill" style={{ width: `${Math.min(100, c.z_score * 40)}%` }} />
                    </div>
                    <span className="mono dv2-contrib-val">{c.z_score}</span>
                  </div>
                ))}
              </div>
              <p className="dv2-cap">Mean absolute z-score of each sensor within the analysed window.</p>
            </Card>
          </section>

          <section className="grid grid-2 dv2-split-even" aria-label="Health breakdown and maintenance">
            <Card title="Health Score Breakdown" className="dv2-card dv2-breakdown">
              <div className="kv-list">
                <div className="kv-row">
                  <span className="k">Starting score</span>
                  <span className="v">100</span>
                </div>
                {Object.entries(health.contributions || {}).map(([k, v]) => (
                  <div className="kv-row" key={k}>
                    <span className="k">
                      {humanize(k)}
                      {k === "fault_diagnosis" && !data.diagnosis && (
                        <span className="dv2-hint"> · not run for this analysis</span>
                      )}
                    </span>
                    <span className={`v${Number(v) < 0 ? " dv2-neg" : ""}`}>{fmt(Number(v), 1)}</span>
                  </div>
                ))}
                <div className="kv-row dv2-total">
                  <span className="k">Health score</span>
                  <span className="v">{fmt(health.health_score, 1)} · {health.band}</span>
                </div>
              </div>
              <div className="dv2-formula mono">{health.formula}</div>
            </Card>

            <Card
              title="Maintenance Recommendations"
              right={<Wrench size={13} color="var(--text-2)" />}
              className="dv2-card dv2-maint"
            >
              {maintenance.length === 0 ? (
                <>
                  <Empty icon={Wrench} label="No maintenance action indicated right now." />
                  <p className="dv2-cap dv2-cap-center">
                    Entries are retrieved only for a WARNING or CRITICAL anomaly status, or when a sensor
                    fault is flagged.
                  </p>
                </>
              ) : (
                <>
                  <p className="dv2-cap dv2-cap-top">
                    Reference entries retrieved from the Automotive Faults dataset by keyword match on the
                    anomaly context and top sensors. They are documented checks, not a diagnosis of this
                    vehicle.
                  </p>
                  <ul className="dv2-maint-list">
                    {maintenance.map((m, i) => {
                      const symptoms = Array.isArray(m.symptoms) ? m.symptoms : [];
                      const steps = Array.isArray(m.diagnosis_steps) ? m.diagnosis_steps : [];
                      return (
                        <li className="dv2-maint-item" key={`${m.category}|${m.subcategory}|${i}`}>
                          <div className="dv2-maint-head">
                            <span className="dv2-maint-cat">{m.category}</span>
                            <span className="dv2-maint-sub">{m.subcategory}</span>
                          </div>
                          {symptoms.length > 0 && (
                            <p className="dv2-maint-symptoms">
                              <span className="dv2-label">Symptoms</span> {symptoms.join(" · ")}
                            </p>
                          )}
                          {steps.length > 0 && (
                            <details className="dv2-steps">
                              <summary>Diagnostic steps ({steps.length})</summary>
                              <ol className="dv2-steps-list">
                                {steps.map((s, si) => (
                                  <li key={si}>
                                    <span className="dv2-step-text">{s.step}</span>
                                    {Array.isArray(s.result) && s.result.length > 0 && (
                                      <span className="dv2-step-out">Outcomes: {s.result.join(" / ")}</span>
                                    )}
                                  </li>
                                ))}
                              </ol>
                            </details>
                          )}
                          {m.flowchart && (
                            <a
                              className="dv2-flow"
                              href={flowchartUrl(m.flowchart)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Open flowchart <ExternalLink size={12} aria-hidden="true" />
                            </a>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </Card>
          </section>
        </div>
      )}

      <div className="grid grid-2 dv2-bottom">
        <ModelSnapshot />
        {!isUpload && !loading && <UploadCTA />}
      </div>

      <Limitations isUpload={isUpload} />
    </div>
  );
}