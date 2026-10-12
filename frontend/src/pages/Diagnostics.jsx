import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Card, Loading, ErrorBox, Badge, InfoBox } from "../components/ui.jsx";
import { diagnoseSample, diagnose } from "../api";

export default function Diagnostics() {
  const [sample, setSample] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const draw = () => {
    setLoading(true);
    setError(null);
    diagnoseSample().then(d => {
      setSample(d.sample_features);
      const { Fault, ...features } = d.sample_features;
      return diagnose(features);
    }).then(setResult).catch(e => setError(e?.response?.data?.detail || e.message)).finally(() => setLoading(false));
  };

  useEffect(() => { draw(); }, []);

  return (
    <div className="page">
      <div className="page-header">
        <h2>Diagnostics</h2>
        <p>Fault classification trained on EngineFaultDB (55,999 real operating-point samples, 4 fault classes) — <span className="mono">XGBoost</span>, macro-F1 ≈ 0.76 on held-out test set.</p>
      </div>

      <div className="pill-row" style={{ marginBottom: 14 }}>
        <button className="btn btn-primary btn-sm" onClick={draw} disabled={loading}>
          <RefreshCw size={13} className={loading ? "spin" : ""} /> Draw new sample from EngineFaultDB
        </button>
      </div>

      {loading && <Loading label="Running diagnosis model…" />}
      {error && <ErrorBox message={error} />}

      {result && sample && (
        <>
          <div className="grid grid-3">
            <Card title="Primary Diagnosis">
              <div className="card-hero"><span className="value" style={{ fontSize: 20 }}>{result.predicted_label}</span></div>
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <Badge status={result.severity === "NONE" ? "NORMAL" : result.severity}>{result.severity}</Badge>
                <Badge status="info">{(result.confidence * 100).toFixed(1)}% confidence</Badge>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-2)" }}>Model: {result.model_used}</div>
              {sample.Fault !== undefined && (
                <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-2)" }}>
                  Ground-truth label for this sampled row: <span className="mono">Class {sample.Fault}</span>
                </div>
              )}
            </Card>

            <Card title="Top 3 Possible Faults">
              <div className="fault-list">
                {result.top3.map(t => (
                  <div className="fault-row" key={t.class}>
                    <span style={{ fontSize: 12 }}>{t.label}</span>
                    <div className="bar-bg"><div className="bar-fill" style={{ width: `${t.probability * 100}%` }} /></div>
                    <span className="mono" style={{ fontSize: 11 }}>{(t.probability * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Recommended Inspection">
              {result.maintenance && result.maintenance.length ? (
                <div className="fault-list">
                  {result.maintenance.slice(0, 2).map((m, i) => (
                    <div key={i} className="fault-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 3 }}>
                      <strong style={{ fontSize: 12.5 }}>{m.category} — {m.subcategory}</strong>
                      <span style={{ fontSize: 11.5, color: "var(--text-2)" }}>{m.symptoms?.join(", ")}</span>
                    </div>
                  ))}
                </div>
              ) : <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>No specific inspection retrieved.</div>}
            </Card>
          </div>

          <div style={{ height: 14 }} />

          <div className="grid grid-2">
            <Card title="Supporting Sensor Evidence (input snapshot)">
              <table className="data-table">
                <thead><tr><th>Feature</th><th>Value</th></tr></thead>
                <tbody>
                  {Object.entries(sample).filter(([k]) => k !== "Fault").map(([k, v]) => (
                    <tr key={k}><td>{k}</td><td>{typeof v === "number" ? v.toFixed(3) : v}</td></tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card title="Diagnostic Evidence (SHAP)">
              {result.shap_explanation ? (
                <div className="fault-list">
                  {result.shap_explanation.map(e => (
                    <div className="fault-row" key={e.feature}>
                      <span className="mono" style={{ fontSize: 12 }}>{e.feature}</span>
                      <div className="bar-bg">
                        <div className="bar-fill" style={{
                          width: `${Math.min(100, Math.abs(e.shap_value) * 20)}%`,
                          background: e.shap_value >= 0 ? "var(--crit)" : "var(--ok)",
                        }} />
                      </div>
                      <span className="mono" style={{ fontSize: 11 }}>{e.shap_value}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 4 }}>
                    Red = pushes toward the predicted class, green = pushes away. Values are true SHAP contributions from the trained XGBoost model.
                  </div>
                </div>
              ) : <InfoBox>SHAP explanation unavailable for this prediction.</InfoBox>}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
