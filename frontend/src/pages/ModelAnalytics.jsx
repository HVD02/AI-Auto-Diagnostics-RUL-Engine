import React, { useEffect, useState } from "react";
import { Card, Loading } from "../components/ui.jsx";
import { getModelMetrics } from "../api";

function MetricRow({ label, value }) {
  return <div className="kv-row"><span className="k">{label}</span><span className="v">{typeof value === "number" ? value.toFixed(4) : String(value)}</span></div>;
}

export default function ModelAnalytics() {
  const [m, setM] = useState(null);
  useEffect(() => { getModelMetrics().then(setM); }, []);

  if (!m) return <div className="page"><Loading /></div>;

  const diag = m.diagnosis;
  const rul = m.rul;
  const anom = m.anomaly;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Model Analytics</h2>
        <p>Real evaluation metrics loaded from <span className="mono">model_metrics.json</span>, produced at training time — never hardcoded here.</p>
      </div>

      <div className="grid grid-3">
        <Card title={`Diagnosis — ${diag.best_model}`}>
          <div className="kv-list">
            <MetricRow label="Test Accuracy" value={diag.test_metrics.test_accuracy} />
            <MetricRow label="Precision (macro)" value={diag.test_metrics.test_precision_macro} />
            <MetricRow label="Recall (macro)" value={diag.test_metrics.test_recall_macro} />
            <MetricRow label="F1 (macro)" value={diag.test_metrics.test_f1_macro} />
            <MetricRow label="ROC-AUC (OvR)" value={diag.test_metrics.test_roc_auc_ovr} />
          </div>
        </Card>
        <Card title={`RUL — ${rul.best_model}`}>
          <div className="kv-list">
            <MetricRow label="Test MAE (cycles)" value={rul.test_metrics.test_mae} />
            <MetricRow label="Test RMSE (cycles)" value={rul.test_metrics.test_rmse} />
            <MetricRow label="Test R²" value={rul.test_metrics.test_r2} />
            <MetricRow label="Test units" value={rul.test_metrics.n_test_units} />
          </div>
        </Card>
        <Card title={`Anomaly — ${anom.best_model}`}>
          <div className="kv-list">
            <MetricRow label="F1" value={anom.model_comparison[anom.best_model].f1} />
            <MetricRow label="Precision" value={anom.model_comparison[anom.best_model].precision} />
            <MetricRow label="Recall" value={anom.model_comparison[anom.best_model].recall} />
          </div>
        </Card>
      </div>

      <div style={{ height: 14 }} />

      <Card title="Diagnosis Model Comparison">
        <table className="data-table">
          <thead><tr><th>Model</th><th>Val Acc</th><th>Val F1 (macro)</th><th>CV F1 mean</th><th>CV F1 std</th></tr></thead>
          <tbody>
            {Object.entries(diag.model_comparison).map(([name, r]) => (
              <tr key={name}>
                <td>{name}{r.trained_on_subsample ? " *" : ""}</td>
                <td>{r.val_accuracy.toFixed(4)}</td>
                <td>{r.val_f1_macro.toFixed(4)}</td>
                <td>{r.cv_f1_macro_mean.toFixed(4)}</td>
                <td>{r.cv_f1_macro_std.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 10.5, color: "var(--text-2)", marginTop: 6 }}>* trained on a random subsample for tractable runtime; evaluated on the full validation/test sets.</div>
      </Card>

      <div style={{ height: 14 }} />

      <Card title="RUL Model Comparison">
        <table className="data-table">
          <thead><tr><th>Model</th><th>Val MAE</th><th>Val RMSE</th><th>Val R²</th></tr></thead>
          <tbody>
            {Object.entries(rul.model_comparison).map(([name, r]) => (
              <tr key={name}>
                <td>{name}</td><td>{r.val_mae.toFixed(2)}</td><td>{r.val_rmse.toFixed(2)}</td><td>{r.val_r2.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div style={{ height: 14 }} />

      <Card title="Anomaly Model Comparison">
        <table className="data-table">
          <thead><tr><th>Model</th><th>F1</th><th>Precision</th><th>Recall</th></tr></thead>
          <tbody>
            {Object.entries(anom.model_comparison).map(([name, r]) => (
              <tr key={name}>
                <td>{name}</td><td>{r.f1.toFixed(3)}</td><td>{r.precision.toFixed(3)}</td><td>{r.recall.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
