import React, { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Loading, Empty, Badge, ErrorBox } from "../components/ui.jsx";
import { ModuleHeader, Panel } from "../components/DiagnosisParts.jsx";
import { getHistory } from "../api";
import { useVehicle } from "../VehicleContext.jsx";
import "./DiagnosisPages.css";
import "./DataPages.css";

const errMsg = (e) => e?.response?.data?.detail || e.message;

export default function HistoryPage() {
  const { vehicleId, dataSource } = useVehicle();
  const isUpload = dataSource?.mode === "upload";
  const scopeKey = isUpload ? "UPLOADED" : vehicleId;
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [scope, setScope] = useState("vehicle");
  const reqId = useRef(0);

  // The request id stops a slow older response from replacing the current scope's rows.
  const load = () => {
    // wait until the active vehicle is known instead of fetching every vehicle's history first
    if (scope === "vehicle" && !scopeKey) return Promise.resolve();
    const id = ++reqId.current;
    setError(null);
    return getHistory(scope === "vehicle" ? scopeKey : undefined, 50)
      .then(d => { if (id === reqId.current) setRows(d.history); })
      .catch(e => { if (id === reqId.current) setError(errMsg(e)); });
  };
  useEffect(() => { setRows(null); load(); return () => { reqId.current += 1; }; }, [scopeKey, scope]);

  // Summary numbers are plain arithmetic on the returned rows.
  const scores = rows ? rows.map(r => Number(r.health_score)).filter(Number.isFinite) : [];
  const latest = rows && rows.length ? rows[0] : null;

  return (
    <div className="page dgx-page">
      <ModuleHeader eyebrow="System / analysis history" title="History" source={<span className="dp-chip">Stored in app_history.db</span>}>
        <p>Every analysis run is persisted to SQLite (<span className="mono">app_history.db</span>) as it happens.</p>
      </ModuleHeader>

      <div className="dp-toolbar">
        <div className="dp-seg" role="group" aria-label="History scope">
          <button type="button" className={scope === "vehicle" ? "is-active" : ""} aria-pressed={scope === "vehicle"} onClick={() => setScope("vehicle")}>Current vehicle</button>
          <button type="button" className={scope === "all" ? "is-active" : ""} aria-pressed={scope === "all"} onClick={() => setScope("all")}>All vehicles</button>
        </div>
        <button type="button" className="btn btn-sm" onClick={load}><RefreshCw size={13} aria-hidden="true" /> Refresh</button>
      </div>

      {error && (
        <div className="dgx-error">
          <ErrorBox message={`Could not load history: ${error}`} />
          <button type="button" className="btn btn-sm" onClick={load}>Try again</button>
        </div>
      )}
      {rows === null && !error && <Loading label="Loading history…" />}
      {rows && rows.length === 0 && <Empty label="No analysis history yet — visit the Dashboard to generate some." />}

      {rows && rows.length > 0 && (
        <>
          <section className="dp-stats" aria-label="History summary">
            <article className="dp-stat"><h2>RUNS SHOWN</h2><div className="dp-stat-value">{rows.length}</div><div className="dp-cap">Most recent 50 at most</div></article>
            <article className="dp-stat"><h2>LATEST HEALTH SCORE</h2><div className="dp-stat-value">{latest.health_score}</div><div className="dp-cap">{new Date(latest.created_at * 1000).toLocaleString()}</div></article>
            <article className="dp-stat"><h2>HEALTH RANGE</h2><div className="dp-stat-value">{scores.length ? `${Math.min(...scores)}–${Math.max(...scores)}` : "—"}</div><div className="dp-cap">Lowest to highest in these runs</div></article>
            <article className="dp-stat"><h2>SCOPE</h2><div className="dp-stat-value dp-stat-sm mono">{scope === "vehicle" ? (isUpload ? dataSource.filename : scopeKey) : "All vehicles"}</div><div className="dp-cap">{scope === "vehicle" ? "Runs for the active vehicle" : "Runs for every vehicle"}</div></article>
          </section>

          <Panel title="Analysis runs" sub="Newest first, as stored by the backend">
            <ul className="dp-table dp-table-6" aria-label="Analysis runs">
              <li className="dp-table-head" aria-hidden="true"><span>Time</span><span>Vehicle</span><span>Health</span><span>Anomaly</span><span>Diagnosis</span><span>Severity</span></li>
              {rows.map(r => (
                <li key={r.id} className="dp-table-row">
                  <span className="dp-cell mono" data-label="Time">{new Date(r.created_at * 1000).toLocaleString()}</span>
                  <span className="dp-cell mono" data-label="Vehicle">{r.vehicle_id}</span>
                  <span className="dp-cell mono" data-label="Health">{r.health_score}</span>
                  <span className="dp-cell" data-label="Anomaly"><Badge status={r.anomaly_status} /></span>
                  <span className="dp-cell" data-label="Diagnosis">{r.diagnosis_label || "—"}</span>
                  <span className="dp-cell" data-label="Severity">{r.severity ? <Badge status={r.severity === "NONE" ? "NORMAL" : r.severity} /> : "—"}</span>
                </li>
              ))}
            </ul>
            <p className="dgx-cap">Each row is one analysis run. A diagnosis and severity appear only for runs where a fault-diagnosis result was stored.</p>
          </Panel>
        </>
      )}
    </div>
  );
}