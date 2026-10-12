import React, { useEffect, useState } from "react";
import { Card, Loading, Empty, Badge } from "../components/ui.jsx";
import { getHistory } from "../api";
import { useVehicle } from "../VehicleContext.jsx";

export default function HistoryPage() {
  const { vehicleId, dataSource } = useVehicle();
  const isUpload = dataSource?.mode === "upload";
  const scopeKey = isUpload ? "UPLOADED" : vehicleId;
  const [rows, setRows] = useState(null);
  const [scope, setScope] = useState("vehicle");

  const load = () => {
    getHistory(scope === "vehicle" ? scopeKey : undefined, 50).then(d => setRows(d.history));
  };

  useEffect(() => { load(); }, [scopeKey, scope]);

  return (
    <div className="page">
      <div className="page-header">
        <h2>History</h2>
        <p>Every analysis run is persisted to SQLite (<span className="mono">app_history.db</span>) as it happens.</p>
      </div>

      <div className="pill-row" style={{ marginBottom: 14 }}>
        <button className={`btn btn-sm ${scope === "vehicle" ? "btn-primary" : ""}`} onClick={() => setScope("vehicle")}>Current vehicle</button>
        <button className={`btn btn-sm ${scope === "all" ? "btn-primary" : ""}`} onClick={() => setScope("all")}>All vehicles</button>
      </div>

      {rows === null && <Loading />}
      {rows && rows.length === 0 && <Empty label="No analysis history yet — visit the Dashboard to generate some." />}

      {rows && rows.length > 0 && (
        <Card title="Analysis Runs" className="scroll-x">
          <table className="data-table">
            <thead><tr><th>Time</th><th>Vehicle</th><th>Health</th><th>Anomaly</th><th>Diagnosis</th><th>Severity</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>{new Date(r.created_at * 1000).toLocaleString()}</td>
                  <td>{r.vehicle_id}</td>
                  <td>{r.health_score}</td>
                  <td><Badge status={r.anomaly_status} /></td>
                  <td>{r.diagnosis_label || "—"}</td>
                  <td>{r.severity ? <Badge status={r.severity === "NONE" ? "NORMAL" : r.severity} /> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
