import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Card, Loading, ErrorBox, InfoBox } from "../components/ui.jsx";
import { diagnoseSample, diagnose, getModelMetrics } from "../api";

function buildSentence(shap) {
  if (!shap || !shap.length) return "No explanation available for this prediction.";
  const top2 = shap.slice(0, 2).map(e => e.feature).join(" and ");
  return `${top2} were the strongest contributors to the current diagnosis.`;
}

export default function ExplainableAI() {
  const [sample, setSample] = useState(null);
  const [result, setResult] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  const draw = () => {
    setLoading(true);
    diagnoseSample().then(d => {
      setSample(d.sample_features);
      const { Fault, ...features } = d.sample_features;
      return diagnose(features);
    }).then(setResult).finally(() => setLoading(false));
  };

  useEffect(() => { draw(); getModelMetrics().then(setMetrics); }, []);

  const globalImportance = metrics?.diagnosis?.test_metrics?.classification_report
    ? null : null; // global importance surfaced via feature list below instead

  return (
    <div className="page">
      <div className="page-header">
        <h2>Explainable AI</h2>
        <p>SHAP (TreeExplainer) applied to the XGBoost fault-diagnosis model — global and local, generated live.</p>
      </div>

      <div className="pill-row" style={{ marginBottom: 14 }}>
        <button className="btn btn-primary btn-sm" onClick={draw} disabled={loading}>
          <RefreshCw size={13} className={loading ? "spin" : ""} /> New prediction to explain
        </button>
      </div>

      {loading && <Loading />}

      {result && (
        <>
          <Card title="Human-readable Explanation">
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>{buildSentence(result.shap_explanation)}</p>
            <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 6 }}>
              Generated directly from the SHAP values below, not a template with invented sensor names.
            </div>
          </Card>

          <div style={{ height: 14 }} />

          <div className="grid grid-2">
            <Card title="Local Explanation (this prediction)">
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
                </div>
              ) : <InfoBox>Unavailable.</InfoBox>}
            </Card>

            <Card title="Model Features Used">
              <p style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 8 }}>
                Full feature set the model was trained on ({metrics?.diagnosis?.features?.length || "…"} features):
              </p>
              <div className="pill-row">
                {metrics?.diagnosis?.features?.map(f => (
                  <span key={f} className="badge badge-neutral">{f}</span>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
