import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { UploadCloud, CheckCircle2, ArrowRight, FileText, Wrench } from "lucide-react";
import { ErrorBox, InfoBox, Badge, Gauge, Loading } from "../components/ui.jsx";
import { ModuleHeader, Panel } from "../components/DiagnosisParts.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";
import { useVehicle } from "../VehicleContext.jsx";
import pkg from "../../package.json";
import "./DiagnosisPages.css";
import "./DataPages.css";

const REQUIRED = "coolant_temp_c, oil_pressure_kpa, rpm, engine_load_pct, intake_temp_c, fuel_rate_lph, throttle_pos_pct, vibration_g, battery_voltage_v, speed_kph";

function UploadResult({ result }) {
  const an = result.anomaly;
  const dq = result.data_quality;
  const sf = result.sensor_fault;
  const health = result.health;
  const flagged = sf.verdict === "LIKELY_SENSOR_FAULT";
  const series = an.timeline_scores.map((v, i) => ({ i, v }));

  return (
    <div className="dp-body">
      <p className="dp-ok"><CheckCircle2 size={16} aria-hidden="true" /> {result.filename} — {result.n_rows || dq.n_rows} rows analyzed</p>

      <section className="dp-stats" aria-label="Upload result summary">
        <article className="dp-stat">
          <h2>OVERALL HEALTH SCORE</h2>
          <Gauge value={health.health_score} band={health.band} />
        </article>
        <article className="dp-stat">
          <h2>ANOMALY STATUS</h2>
          <div className="dp-stat-value">{(an.anomaly_ratio * 100).toFixed(0)}<small>% flagged</small></div>
          <div className="dp-stat-foot"><Badge status={an.status} /></div>
          <div className="dp-cap">Model: {an.model_used}</div>
        </article>
        <article className="dp-stat">
          <h2>SENSOR RELIABILITY</h2>
          <div className="dp-stat-value dp-stat-sm">{flagged ? "Flagged" : "OK"}</div>
          <div className="dp-stat-foot">
            <Badge status={flagged ? "WARNING" : "NORMAL"}>{sf.flagged_sensors.length ? sf.flagged_sensors.join(", ") : "No sensor faults"}</Badge>
          </div>
        </article>
        <article className="dp-stat">
          <h2>DATA QUALITY</h2>
          <div className="dp-stat-value">{dq.data_quality_score}<small>/ 100</small></div>
          <div className="dp-cap">{dq.n_rows} rows · {dq.duplicate_rows} dup · {dq.total_outliers} outliers</div>
        </article>
      </section>

      <div className="dp-row">
        <Panel title="Anomaly intensity timeline" sub="Relative intensity across the uploaded window">
          <div className="dp-chart dp-chart-sm" role="img" aria-label={`Anomaly intensity over ${series.length} samples of the uploaded file`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--line-soft)" strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="i" hide />
                <YAxis width={30} tick={{ fill: "var(--text-1)", fontSize: 10 }} domain={[0, 100]} tickLine={false} axisLine={false} />
                <Tooltip content={({ active, payload }) => active && payload && payload.length ? (
                  <div className="dp-tip"><div className="dp-tip-row"><span>Sample {payload[0].payload.i}</span><span>{payload[0].payload.v.toFixed(1)}</span></div></div>
                ) : null} />
                <Line type="monotone" dataKey="v" stroke="var(--accent)" dot={false} strokeWidth={1.6} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Top contributing sensors" sub="Anomaly z-scores (not SHAP values)">
          <ul className="dp-bars">
            {an.top_contributors.map(c => (
              <li key={c.sensor}>
                <span className="mono dp-bars-name">{c.sensor}</span>
                <span className="dp-bars-track" aria-hidden="true"><i style={{ width: `${Math.min(100, c.z_score * 40)}%` }} /></span>
                <span className="mono dp-bars-val">{c.z_score}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="dp-row dp-row-eq">
        <Panel title="Data quality detail">
          <dl className="dp-kv">
            <div><dt>Missing data</dt><dd className="mono">{dq.missing_pct}%</dd></div>
            <div><dt>Duplicate rows</dt><dd className="mono">{dq.duplicate_rows}</dd></div>
            <div><dt>Total outliers</dt><dd className="mono">{dq.total_outliers}</dd></div>
            <div><dt>Timestamps monotonic</dt><dd className="mono">{String(dq.timestamp_monotonic)}</dd></div>
          </dl>
        </Panel>
        <Panel title="Maintenance priority" sub="Reference checks, not a confirmed diagnosis" right={<Wrench size={14} color="var(--text-2)" aria-hidden="true" />}>
          {result.maintenance && result.maintenance.length ? (
            <ul className="dp-flags dp-flags-plain">
              {result.maintenance.slice(0, 3).map((m, i) => (
                <li key={i}><strong>{m.category} — {m.subcategory}</strong><span>{m.symptoms?.join(", ")}</span></li>
              ))}
            </ul>
          ) : <p className="dp-copy">No maintenance action indicated right now.</p>}
        </Panel>
      </div>

      <InfoBox>{result.source_disclaimer}</InfoBox>

      <Panel title="This file is now your active vehicle">
        <p className="dp-copy">
          Every telemetry-driven page — Dashboard, Vehicle Health, Anomaly Analysis, Sensor Analytics, Digital Twin, Data Quality,
          Maintenance Center, Reports and History — now reflects <span className="mono">{result.filename}</span> instead of demo data.
          Switch back to a demo scenario anytime from the vehicle selector in the top bar.
        </p>
        <div className="dp-actions">
          <Link className="btn btn-primary btn-sm" to="/dashboard"><ArrowRight size={13} aria-hidden="true" /> Go to Dashboard</Link>
          <Link className="btn btn-sm" to="/sensors">View Sensor Charts</Link>
          <Link className="btn btn-sm" to="/reports"><FileText size={13} aria-hidden="true" /> Generate PDF Report</Link>
        </div>
      </Panel>
    </div>
  );
}

export default function About() {
  const { doUpload, uploading, uploadError, setUploadError, dataSource } = useVehicle();
  const [file, setFile] = useState(null);
  const fileRef = useRef(null);

  const onUpload = (f) => {
    setFile(f);
    setUploadError(null);
    // doUpload stores failures in uploadError (shown below); the catch only avoids an unhandled rejection.
    const p = doUpload(f);
    if (p && typeof p.catch === "function") p.catch(() => {});
  };

  const currentResult = dataSource?.mode === "upload" ? dataSource.analysis : null;

  return (
    <div className="page dgx-page">
      <ModuleHeader eyebrow="System / settings & about" title="Settings / About" source={<span className="dp-chip">Version {pkg.version}</span>}>
        <p>Upload your own vehicle's CSV telemetry — schema-validated and run through the real pipeline — or read about the project's dataset boundaries.</p>
      </ModuleHeader>

      <Panel title="Upload mode — analyze your own vehicle" sub="CSV only. The file is validated against the required schema before analysis.">
        <button type="button" className="dp-drop" onClick={() => fileRef.current?.click()} disabled={uploading}>
          <UploadCloud size={22} aria-hidden="true" />
          <strong>{uploading ? "Uploading & analyzing…" : file ? `Selected: ${file.name}` : "Click to choose a CSV file"}</strong>
          <span>Required columns: {REQUIRED}</span>
        </button>
        <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }}
               onChange={e => { const f = e.target.files[0]; if (f) onUpload(f); e.target.value = ""; }} />

        {uploading && <div className="dp-gap"><Loading label="Running data quality, sensor-fault and anomaly pipeline…" /></div>}
        {uploadError && !uploading && (
          <div className="dp-gap">
            <ErrorBox message={uploadError.message} />
            {uploadError.missing_columns && (
              <p className="dgx-cap">
                Missing: <span className="mono">{uploadError.missing_columns.join(", ")}</span><br />
                Found instead: <span className="mono">{uploadError.found_columns?.join(", ")}</span>
              </p>
            )}
          </div>
        )}
        <p className="dgx-cap">Upload only data you are authorized to use, and avoid personal or sensitive information.</p>
      </Panel>

      {currentResult && <UploadResult result={currentResult} />}

      <div className="dp-row dp-row-eq">
        <Panel title="About this project" sub="AI Auto-Diagnostics & RUL Engine">
          <p className="dp-copy">
            AI Auto-Diagnostics &amp; RUL Engine integrates real anomaly detection, fault diagnosis, RUL/prognostics, explainable AI and a
            diagnostic knowledge layer into one platform. It does not claim to have invented any of these techniques — its contribution is the
            integration and the honest handling of dataset boundaries. See <span className="mono">docs/</span> in the project for full
            architecture, methodology, limitations and research-gap documentation.
          </p>
        </Panel>
        <Panel title="Dataset boundaries" sub="Each dataset is used only for the task it supports">
          <ul className="dp-notes">
            <li>Anomaly module runs on <b>your uploaded telemetry</b> once you upload a CSV, or synthetic demo data otherwise.</li>
            <li>Diagnosis module runs on <b>real EngineFaultDB</b> samples (separate schema — see Diagnostics page).</li>
            <li>RUL module runs on <b>real NASA C-MAPSS</b> turbofan data (not automotive).</li>
            <li>Maintenance knowledge is retrieved from the <b>real Automotive Faults</b> dataset.</li>
          </ul>
        </Panel>
      </div>

      <div className="dp-row dp-row-eq">
        <Panel title="Application" sub="Appearance and version">
          <dl className="dp-kv">
            <div><dt>Frontend version</dt><dd className="mono">{pkg.version}</dd></div>
            <div><dt>Theme</dt><dd><ThemeToggle /></dd></div>
          </dl>
          <p className="dgx-cap">The theme choice is saved in this browser and follows your system setting until you choose one.</p>
        </Panel>
        <Panel title="Methodology & responsible use" sub="How to read the results">
          <ul className="dp-notes">
            <li>The health score is a documented weighted formula over model outputs; it is shown with its breakdown.</li>
            <li>SHAP explains the fault-diagnosis model on one sample. Anomaly z-scores are a different quantity and are never SHAP values.</li>
            <li>Maintenance retrieval returns documented checks by keyword match. It does not confirm a fault.</li>
            <li>Benchmark metrics describe each model on its own dataset, not live vehicle confidence.</li>
            <li>Educational and research demonstration. It does not replace inspection by a qualified technician and must not be the sole basis for a safety-critical maintenance decision.</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}