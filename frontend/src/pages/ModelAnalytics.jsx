import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Loading, ErrorBox, InfoBox } from "../components/ui.jsx";
import { ModuleHeader, Panel } from "../components/DiagnosisParts.jsx";
import { getModelMetrics } from "../api";
import "./DiagnosisPages.css";
import "./DataPages.css";

const num = (v, d = 4) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(d) : "—");
const int = (v) => (typeof v === "number" ? v.toLocaleString() : "—");

function Metric({ label, value, unit }) {
  return <div><dt>{label}</dt><dd className="mono">{value}{unit && <small> {unit}</small>}</dd></div>;
}

function ModelCard({ task, model, dataset, children, note }) {
  return (
    <Panel title={task} sub={model} className="dp-model">
      <div className="dp-dataset"><span className="dp-label">EVALUATION DATASET</span><span className="mono">{dataset || "—"}</span></div>
      <dl className="dp-kv dp-kv-metrics">{children}</dl>
      {note && <p className="dgx-cap">{note}</p>}
    </Panel>
  );
}

function CompareTable({ cols, rows, best }) {
  return (
    <ul className="dp-table" style={{ "--cols": cols.length + 1 }} aria-label="Model comparison">
      <li className="dp-table-head dp-table-cols" aria-hidden="true"><span>Model</span>{cols.map(c => <span key={c.label}>{c.label}</span>)}</li>
      {rows.map(([name, r]) => (
        <li key={name} className={`dp-table-row dp-table-cols${name === best ? " is-best" : ""}`}>
          <span className="dp-cell dp-cell-name">{name}{r.trained_on_subsample ? " *" : ""}{name === best && <em>selected</em>}</span>
          {cols.map(c => <span key={c.label} className="dp-cell mono" data-label={c.label}>{num(r[c.key], c.d)}</span>)}
        </li>
      ))}
    </ul>
  );
}

export default function ModelAnalytics() {
  const [m, setM] = useState(null);
  const [error, setError] = useState(null);
  const load = () => {
    setError(null);
    getModelMetrics().then(setM).catch(e => setError(e?.response?.data?.detail || e.message));
  };
  useEffect(() => { load(); }, []);

  const diag = m?.diagnosis, rul = m?.rul, anom = m?.anomaly;
  const best = anom?.model_comparison?.[anom?.best_model];
  const report = diag?.test_metrics?.classification_report;
  const classRows = report ? Object.keys(report).filter(k => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b)) : [];

  return (
    <div className="page dgx-page">
      <ModuleHeader eyebrow="System / evaluation" title="Model Analytics" source={<span className="dp-chip">model_metrics.json</span>}>
        <p>Real evaluation metrics loaded from <span className="mono">model_metrics.json</span>, produced at training time — never hardcoded here.</p>
      </ModuleHeader>

      <InfoBox>
        Each score describes one model on its own dataset. They are benchmark results, not confidence about a specific vehicle,
        and they do not guarantee real-world performance. RUL is evaluated on aircraft turbofan data (NASA C-MAPSS), and the
        anomaly benchmark uses synthetic demo telemetry.
      </InfoBox>

      {error && (
        <div className="dgx-error">
          <ErrorBox message={`Could not load model metrics: ${error}`} />
          <button type="button" className="btn btn-sm" onClick={load}><RefreshCw size={13} aria-hidden="true" /> Try again</button>
        </div>
      )}
      {!m && !error && <Loading label="Loading model metrics…" />}

      {m && (
        <div className="dp-body">
          <div className="dp-cards-3">
            {diag?.test_metrics && (
              <ModelCard task="Fault diagnosis" model={diag.best_model} dataset={diag.dataset}
                note={`Trained on ${int(diag.n_train)} rows, validated on ${int(diag.n_val)}, tested on ${int(diag.n_test)}. Fault classes 1–3 are unnamed in the source dataset.`}>
                <Metric label="Test accuracy" value={num(diag.test_metrics.test_accuracy)} />
                <Metric label="Precision (macro)" value={num(diag.test_metrics.test_precision_macro)} />
                <Metric label="Recall (macro)" value={num(diag.test_metrics.test_recall_macro)} />
                <Metric label="F1 (macro)" value={num(diag.test_metrics.test_f1_macro)} />
                <Metric label="ROC-AUC (OvR)" value={num(diag.test_metrics.test_roc_auc_ovr)} />
              </ModelCard>
            )}
            {rul?.test_metrics && (
              <ModelCard task="Remaining useful life" model={rul.best_model} dataset={rul.dataset}
                note={rul.split_strategy ? `Split: ${rul.split_strategy}. RUL values are capped at ${rul.rul_cap ?? "—"} cycles.` : undefined}>
                <Metric label="Test MAE" value={num(rul.test_metrics.test_mae)} unit="cycles" />
                <Metric label="Test RMSE" value={num(rul.test_metrics.test_rmse)} unit="cycles" />
                <Metric label="Test R²" value={num(rul.test_metrics.test_r2)} />
                <Metric label="Test units" value={int(rul.test_metrics.n_test_units)} />
              </ModelCard>
            )}
            {anom && (
              <ModelCard task="Anomaly detection" model={anom.best_model} dataset={anom.dataset} note={anom.note}>
                <Metric label="F1" value={num(best?.f1)} />
                <Metric label="Precision" value={num(best?.precision)} />
                <Metric label="Recall" value={num(best?.recall)} />
                <Metric label="Samples" value={int(anom.n_samples)} />
              </ModelCard>
            )}
          </div>

          {diag?.model_comparison && (
            <Panel title="Diagnosis model comparison" sub="Validation metrics on the EngineFaultDB split">
              <CompareTable best={diag.best_model} rows={Object.entries(diag.model_comparison)} cols={[
                { label: "Val Acc", key: "val_accuracy", d: 4 }, { label: "Val F1 (macro)", key: "val_f1_macro", d: 4 },
                { label: "CV F1 mean", key: "cv_f1_macro_mean", d: 4 }, { label: "CV F1 std", key: "cv_f1_macro_std", d: 4 }]} />
              <p className="dgx-cap">* trained on a random subsample for tractable runtime; evaluated on the full validation/test sets.</p>
            </Panel>
          )}

          {classRows.length > 0 && (
            <Panel title="Diagnosis per-class results" sub="Held-out test set. Classes are shown as in the source dataset.">
              <ul className="dp-table" style={{ "--cols": 5 }} aria-label="Per-class test results">
                <li className="dp-table-head dp-table-cols" aria-hidden="true"><span>Class</span><span>Precision</span><span>Recall</span><span>F1</span><span>Support</span></li>
                {classRows.map(k => (
                  <li key={k} className="dp-table-row dp-table-cols">
                    <span className="dp-cell dp-cell-name">Class {k}</span>
                    <span className="dp-cell mono" data-label="Precision">{num(report[k].precision, 3)}</span>
                    <span className="dp-cell mono" data-label="Recall">{num(report[k].recall, 3)}</span>
                    <span className="dp-cell mono" data-label="F1">{num(report[k]["f1-score"], 3)}</span>
                    <span className="dp-cell mono" data-label="Support">{int(report[k].support)}</span>
                  </li>
                ))}
              </ul>
              <p className="dgx-cap">Lower F1 for a class means predictions for that class are less reliable.</p>
            </Panel>
          )}

          {rul?.model_comparison && (
            <Panel title="RUL model comparison" sub="Validation metrics on NASA C-MAPSS FD001 (aircraft turbofan, not passenger cars)">
              <CompareTable best={rul.best_model} rows={Object.entries(rul.model_comparison)} cols={[
                { label: "Val MAE", key: "val_mae", d: 2 }, { label: "Val RMSE", key: "val_rmse", d: 2 }, { label: "Val R²", key: "val_r2", d: 3 }]} />
            </Panel>
          )}

          {anom?.model_comparison && (
            <Panel title="Anomaly model comparison" sub="Benchmark on synthetic demo telemetry (real EngineAD fleet data is not included)">
              <CompareTable best={anom.best_model} rows={Object.entries(anom.model_comparison)} cols={[
                { label: "F1", key: "f1", d: 3 }, { label: "Precision", key: "precision", d: 3 }, { label: "Recall", key: "recall", d: 3 }]} />
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}