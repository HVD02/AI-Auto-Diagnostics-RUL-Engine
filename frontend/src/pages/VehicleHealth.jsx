import React from "react";
import { Card, Loading, ErrorBox, Gauge, InfoBox, Badge } from "../components/ui.jsx";
import { useAnalysis } from "../useAnalysis.js";

export default function VehicleHealth() {
  const { data, loading, error, isUpload } = useAnalysis();
  return (
    <div className="page">
      <div className="page-header">
        <h2>Vehicle Health</h2>
        <p>A documented, weighted-formula health score — no hidden weights, no arbitrary thresholds.</p>
      </div>
      {loading && <Loading />}
      {error && <ErrorBox message={error} />}
      {data && (
        <>
          <div className="grid grid-2">
            <Card title="Health Score">
              <Gauge value={data.health.health_score} band={data.health.band} />
              <div style={{ textAlign: "center", marginTop: 12 }}>
                <Badge status={data.health.band === "EXCELLENT" || data.health.band === "GOOD" ? "GOOD" : data.health.band} />
              </div>
            </Card>
            <Card title="Scoring Methodology">
              <p style={{ fontSize: 12.5, color: "var(--text-1)", lineHeight: 1.6 }}>
                Health starts at 100 and is penalized by four measured factors: the anomaly-model's
                flagged-window ratio, the data-quality score, a fixed penalty when a sensor fault is
                detected (readings become unreliable), and a fault-diagnosis severity penalty when
                applicable. No factor is invented — each comes from a model output computed earlier
                in the pipeline for this vehicle.
              </p>
              <div className="hr" />
              <div className="mono" style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.7 }}>
                {data.health.formula}
              </div>
            </Card>
          </div>

          <div style={{ height: 14 }} />

          <div className="grid grid-3">
            <Card title="Anomaly Contribution">
              <div className="card-hero"><span className="value">{data.health.contributions.anomaly}</span><span className="unit">points</span></div>
              <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 6 }}>
                Anomaly ratio: {(data.anomaly.anomaly_ratio * 100).toFixed(1)}%
              </div>
            </Card>
            <Card title="Data Quality Contribution">
              <div className="card-hero"><span className="value">{data.health.contributions.data_quality}</span><span className="unit">points</span></div>
              <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 6 }}>
                Quality score: {data.data_quality.data_quality_score}/100
              </div>
            </Card>
            <Card title="Sensor Reliability Contribution">
              <div className="card-hero"><span className="value">{data.health.contributions.sensor_reliability}</span><span className="unit">points</span></div>
              <div style={{ fontSize: 11.5, color: "var(--text-2)", marginTop: 6 }}>
                {data.sensor_fault.verdict}
              </div>
            </Card>
          </div>

          <div style={{ height: 14 }} />
          <InfoBox>
            {isUpload
              ? "Health scoring, anomaly detection and sensor-fault flags are computed from your uploaded telemetry."
              : "Health scoring, anomaly detection and sensor-fault flags are computed from synthetic demo telemetry in this mode. Real EngineAD fleet data would plug into the same pipeline unchanged."}
          </InfoBox>
        </>
      )}
    </div>
  );
}
