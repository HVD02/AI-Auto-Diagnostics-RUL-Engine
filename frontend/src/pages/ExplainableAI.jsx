import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Card, Loading, ErrorBox, InfoBox, Badge } from "../components/ui.jsx";
import { ShapBars } from "../components/DiagnosisParts.jsx";
import { diagnoseSample, diagnose, getModelMetrics } from "../api";
import "./DiagnosisPages.css";

function buildSentence(shap) {
  if (!shap || !shap.length) return "No explanation available for this prediction.";
  const top2 = shap.slice(0, 2).map(e => e.feature).join(" and ");
  return `${top2} were the strongest contributors to the current diagnosis.`;
}

export default function ExplainableAI() {
  const [result, setResult] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [metricsFailed, setMetricsFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const draw = () => {
    setLoading(true);
    setError(null);
    diagnoseSample().then(d => {
      const { Fault, ...features } = d.sample_features;
      return diagnose(features);
    }).then(setResult)
      .catch(e => setError(e?.response?.data?.detail || e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    draw();
    getModelMetrics().then(setMetrics).catch(() => setMetricsFailed(true));
  }, []);

  const features = metrics?.diagnosis?.features;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Explainable AI</h2>
        <p>
          SHAP (TreeExplainer) applied to the XGBoost fault-diagnosis model. A local explanation is
          generated live for each sampled EngineFaultDB row, and the model's full feature set is listed
          for context.
        </p>
      </div>

      <div className="dgx-note">
        <InfoBox>
          SHAP values explain how the trained model reached this prediction. They are not proof of a
          physical cause. Fault classes 1–3 are unnamed in the source dataset.
        </InfoBox>
      </div>

      <div className="pill-row dgx-toolbar">
        <button className="btn btn-primary btn-sm" onClick={draw} disabled={loading}>
          <RefreshCw size={13} className={loading ? "spin" : ""} aria-hidden="true" /> New prediction to explain
        </button>
      </div>

      {loading && <Loading />}
      {error && <div role="alert"><ErrorBox message={error} /></div>}

      {result && (
        <div className="dgx-stack">
          <Card title="Human-readable Explanation" className="dgx-hero">
            <p className="dgx-callout">{buildSentence(result.shap_explanation)}</p>
            <div className="pill-row" style={{ marginTop: 12 }}>
              <Badge status="info">{result.predicted_label}</Badge>
              <Badge status="neutral">{(result.confidence * 100).toFixed(1)}% confidence</Badge>
            </div>
            <p className="dgx-cap">
              Generated directly from the SHAP values below, not a template with invented sensor names.
            </p>
          </Card>

          <div className="grid grid-2">
            <Card title="Local Explanation (this prediction)">
              {result.shap_explanation
                ? <ShapBars items={result.shap_explanation} legend />
                : <InfoBox>Unavailable.</InfoBox>}
            </Card>

            <Card title="Model Features Used">
              {features ? (
                <>
                  <p className="dgx-cap" style={{ marginTop: 0, marginBottom: 10 }}>
                    Full feature set the model was trained on ({features.length} features):
                  </p>
                  <div className="dgx-chips">
                    {features.map(f => (
                      <span key={f} className="badge badge-neutral">{f}</span>
                    ))}
                  </div>
                </>
              ) : metricsFailed ? (
                <p className="dgx-cap" style={{ margin: 0 }}>Feature list unavailable right now.</p>
              ) : (
                <Loading />
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}