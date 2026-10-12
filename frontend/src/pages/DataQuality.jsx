import React from "react";
import { Card, Loading, ErrorBox, Badge } from "../components/ui.jsx";
import { useAnalysis } from "../useAnalysis.js";

export default function DataQuality() {
  const { data, loading, error } = useAnalysis();
  return (
    <div className="page">
      <div className="page-header">
        <h2>Data Quality</h2>
        <p>Automated data-quality checks computed on the raw telemetry window before any modeling happens.</p>
      </div>
      {loading && <Loading />}
      {error && <ErrorBox message={error} />}
      {data && (
        <>
          <div className="grid grid-4">
            <Card title="Quality Score">
              <div className="card-hero"><span className="value">{data.data_quality.data_quality_score}</span><span className="unit">/ 100</span></div>
            </Card>
            <Card title="Missing Data">
              <div className="card-hero"><span className="value">{data.data_quality.missing_pct}</span><span className="unit">%</span></div>
            </Card>
            <Card title="Duplicate Rows">
              <div className="card-hero"><span className="value">{data.data_quality.duplicate_rows}</span></div>
            </Card>
            <Card title="Timestamp Integrity">
              <Badge status={data.data_quality.timestamp_monotonic ? "NORMAL" : "CRITICAL"}>
                {data.data_quality.timestamp_monotonic ? "Monotonic" : "Out of order"}
              </Badge>
            </Card>
          </div>

          <div style={{ height: 14 }} />

          <Card title="Outliers by Sensor (IQR × 3 method)">
            <table className="data-table">
              <thead><tr><th>Sensor</th><th>Outlier Count</th></tr></thead>
              <tbody>
                {Object.entries(data.data_quality.outlier_counts).map(([k, v]) => (
                  <tr key={k}><td>{k}</td><td>{v}</td></tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div style={{ height: 14 }} />

          <Card title="Sensor Consistency">
            <p style={{ fontSize: 12.5, color: "var(--text-1)" }}>
              {data.sensor_fault.verdict === "LIKELY_SENSOR_FAULT"
                ? `Cross-sensor consistency check flagged: ${data.sensor_fault.flagged_sensors.join(", ")}.`
                : "No cross-sensor consistency issues detected in this window."}
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
