import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Card, Loading, ErrorBox, Badge, InfoBox } from "../components/ui.jsx";
import { TopFaults, ShapBars } from "../components/DiagnosisParts.jsx";
import { diagnoseSample, diagnose, getModelMetrics } from "../api";
import "./DiagnosisPages.css";

export default function Diagnostics() {
  const [sample, setSample] = useState(null);
  const [result, setResult] = useState(null);
  const [metrics, setMetrics] = useState(null);
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

  // Header metrics come live from /api/model-metrics (the same source as the landing page and Dashboard).
  useEffect(() => {
    let cancelled = false;
    getModelMetrics().then(m => { if (!cancelled) setMetrics(m); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const model = metrics?.diagnosis?.best_model;
  const f1 = metrics?.diagnosis?.test_metrics?.test_f1_macro;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Diagnostics</h2>
        <p>
          Fault classification trained on EngineFaultDB (real operating-point snapshots).{" "}
          {model && typeof f1 === "number" && (
            <><span className="mono">{model}</span> · macro-F1 {f1.toFixed(2)} on the held-out test set.</>
          )}
        </p>
      </div>

      <div className="dgx-note">
        <InfoBox>
          Each sample is a single operating-point snapshot drawn from EngineFaultDB, not live data from your
          vehicle. Fault classes 1–3 are not named in the source dataset, so they are reported as Fault
          Class 1/2/3 and no mechanical cause is implied.
        </InfoBox>
      </div>

      <div className="pill-row dgx-toolbar">
        <button className="btn btn-primary btn-sm" onClick={draw} disabled={loading}>
          <RefreshCw size={13} className={loading ? "spin" : ""} aria-hidden="true" /> Draw new sample from EngineFaultDB
        </button>
      </div>

      {loading && <Loading label="Running diagnosis model…" />}
      {error && <div role="alert"><ErrorBox message={error} /></div>}

      {result && sample && (
        <div className="dgx-stack">
          <div className="grid grid-3">
            <Card title="Primary Diagnosis">
              <div className="dgx-primary">{result.predicted_label}</div>
              <div className="pill-row">
                <Badge status={result.severity === "NONE" ? "NORMAL" : result.severity}>{result.severity}</Badge>
                <Badge status="info">{(result.confidence * 100).toFixed(1)}% confidence</Badge>
              </div>
              <p className="dgx-meta">Model: {result.model_used}</p>
              {sample.Fault !== undefined && (
                <p className="dgx-meta">
                  Ground-truth label for this sampled row: <span className="mono">Class {sample.Fault}</span>
                </p>
              )}
            </Card>

            <Card title="Top 3 Possible Faults">
              <TopFaults items={result.top3} />
            </Card>

            <Card title="Recommended Inspection">
              {result.maintenance && result.maintenance.length ? (
                <>
                  <ul className="fault-list dgx-list">
                    {result.maintenance.slice(0, 2).map((m, i) => (
                      <li key={i} className="fault-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 3 }}>
                        <strong style={{ fontSize: 12.5 }}>{m.category} — {m.subcategory}</strong>
                        <span className="dgx-meta" style={{ margin: 0 }}>{m.symptoms?.join(", ")}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="dgx-cap">
                    Reference checks retrieved by keyword match from the Automotive Faults dataset. They are
                    not a confirmed diagnosis.
                  </p>
                </>
              ) : <p className="dgx-meta" style={{ margin: 0 }}>No specific inspection retrieved.</p>}
            </Card>
          </div>

          <div className="grid grid-2">
            <Card title="Supporting Sensor Evidence (input snapshot)">
              <table className="data-table">
                <thead><tr><th scope="col">Feature</th><th scope="col" className="dgx-num">Value</th></tr></thead>
                <tbody>
                  {Object.entries(sample).filter(([k]) => k !== "Fault").map(([k, v]) => (
                    <tr key={k}><td>{k}</td><td className="dgx-num">{typeof v === "number" ? v.toFixed(3) : v}</td></tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card title="Diagnostic Evidence (SHAP)">
              {result.shap_explanation
                ? <ShapBars items={result.shap_explanation} legend />
                : <InfoBox>SHAP explanation unavailable for this prediction.</InfoBox>}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}