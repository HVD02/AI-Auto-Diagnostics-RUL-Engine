import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Database, Cpu, BarChart3, FileText, ArrowUpRight } from "lucide-react";
import { Badge, Loading, ErrorBox, InfoBox, Empty } from "../components/ui.jsx";
import { ModuleHeader, Pipeline, Panel } from "../components/DiagnosisParts.jsx";
import { diagnoseSample, diagnose, getModelMetrics } from "../api";
import "./DiagnosisPages.css";

const errMsg = (e) => e?.response?.data?.detail || e.message;

function severityTone(severity) {
  if (severity === "NONE") return "ok";
  if (severity === "MILD") return "warn";
  if (severity === "MODERATE") return "mod";
  if (severity === "SEVERE") return "crit";
  return "neutral";
}

function fmtPct(p, digits = 1) {
  return typeof p === "number" && Number.isFinite(p) ? `${(p * 100).toFixed(digits)}%` : "—";
}

// Exact backend text for a SHAP value, with an explicit "+" for positive numbers.
function shapText(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `+${value}` : String(value);
}

// Axis label for the symmetric scale (display only).
function axisNum(n) {
  return String(parseFloat(Number(n).toPrecision(3)));
}

export default function ExplainableAI() {
  const [sample, setSample] = useState(null);
  const [result, setResult] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [metricsFailed, setMetricsFailed] = useState(false);
  // idle | sampling | analysing | done | error  (real progress of the request chain)
  const [phase, setPhase] = useState("idle");
  const [failedAt, setFailedAt] = useState(null);
  const [error, setError] = useState(null);
  // A request id makes sure a slow, older response can never overwrite a newer one.
  const reqId = useRef(0);

  // Draw a new EngineFaultDB row, then run the diagnosis model (and its SHAP explanation) on it.
  const draw = async () => {
    const id = ++reqId.current;
    setError(null);
    setFailedAt(null);
    setPhase("sampling");
    let at = "sampling";
    try {
      const d = await diagnoseSample();
      if (id !== reqId.current) return;
      at = "analysing";
      setPhase("analysing");
      const { Fault, ...features } = d.sample_features;
      const r = await diagnose(features);
      if (id !== reqId.current) return;
      // stored together so the explanation always belongs to the sample shown
      setSample(d.sample_features);
      setResult(r);
      setPhase("done");
    } catch (e) {
      if (id !== reqId.current) return;
      setError(errMsg(e));
      setFailedAt(at);
      setPhase("error");
    }
  };

  useEffect(() => {
    draw();
    let cancelled = false;
    getModelMetrics()
      .then(m => { if (!cancelled) setMetrics(m); })
      .catch(() => { if (!cancelled) setMetricsFailed(true); });
    return () => { cancelled = true; reqId.current += 1; };
  }, []);

  const busy = phase === "sampling" || phase === "analysing";
  const diag = metrics?.diagnosis;
  const f1 = diag?.test_metrics?.test_f1_macro;

  // ----- SHAP rows: exact backend values, ordered by absolute value -----
  const shapRaw = Array.isArray(result?.shap_explanation) ? result.shap_explanation : null;
  const rows = useMemo(() => {
    if (!shapRaw) return [];
    return shapRaw
      .map(e => ({ feature: e.feature, raw: e.shap_value, n: Number(e.shap_value) }))
      .filter(r => Number.isFinite(r.n))
      .sort((a, b) => Math.abs(b.n) - Math.abs(a.n));
  }, [shapRaw]);
  const hasShap = rows.length > 0;
  const maxAbs = hasShap ? Math.max(...rows.map(r => Math.abs(r.n))) || 1 : 1;
  const toward = rows.filter(r => r.n > 0);
  const away = rows.filter(r => r.n < 0);
  const sumToward = toward.reduce((s, r) => s + r.n, 0);
  const sumAway = away.reduce((s, r) => s + r.n, 0);
  const top = rows[0];
  const label = result?.predicted_label;
  const tone = severityTone(result?.severity);
  const explained = new Set(rows.map(r => r.feature));

  // class -> display name, taken from the model's own ranked output (never invented)
  const classNames = {};
  (Array.isArray(result?.top3) ? result.top3 : []).forEach(t => { classNames[String(t.class)] = t.label; });
  const report = diag?.test_metrics?.classification_report;
  const classRows = report
    ? Object.keys(report).filter(k => /^\d+$/.test(k) && typeof report[k]?.["f1-score"] === "number")
        .sort((a, b) => Number(a) - Number(b))
        .map(k => ({ key: k, name: classNames[k] || `Class ${k}`, f1: report[k]["f1-score"] }))
    : [];

  // ----- workflow strip -----
  const stepState = (i) => {
    if (phase === "error") {
      const failIndex = failedAt === "sampling" ? 0 : 1;
      if (i < failIndex) return "done";
      return i === failIndex ? "error" : "idle";
    }
    if (phase === "sampling") return i === 0 ? "active" : "idle";
    if (phase === "analysing") return i === 0 ? "done" : (i === 1 ? "active" : "idle");
    if (phase === "done") {
      if (i >= 2 && !hasShap) return i === 2 ? "error" : "idle";
      return "done";
    }
    return "idle";
  };
  const featureCount = sample ? Object.keys(sample).filter(k => k !== "Fault").length : 0;
  const steps = [
    { key: "sample", label: "SAMPLE", icon: Database, state: stepState(0),
      detail: stepState(0) === "done" && sample ? `EngineFaultDB row · ${featureCount} features` : "EngineFaultDB row" },
    { key: "pred", label: "PREDICTION", icon: Cpu, state: stepState(1),
      detail: stepState(1) === "done" && result ? `${result.model_used} · ${label}` : "Fault classifier" },
    { key: "shap", label: "SHAP EXPLANATION", icon: BarChart3, state: stepState(2),
      detail: phase === "done" && !hasShap ? "Unavailable"
        : (stepState(2) === "done" ? `${rows.length} feature contributions` : "Per-feature contributions") },
    { key: "read", label: "INTERPRETATION", icon: FileText, state: stepState(3),
      detail: stepState(3) === "done" ? "Plain-language summary" : "What influenced the output" },
  ];

  return (
    <div className="page dgx-page">
      <ModuleHeader
        eyebrow="Investigate / model interpretability"
        title="Explainable AI"
        source={
          <span className="dgx-source">
            <span className="dgx-source-dot" aria-hidden="true" />
            SHAP · local explanation
          </span>
        }
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={draw} disabled={busy}>
            <RefreshCw size={13} className={busy ? "spin" : undefined} aria-hidden="true" />
            {busy ? "Explaining…" : "New prediction to explain"}
          </button>
        }
      >
        <p>
          SHAP (TreeExplainer) applied to the {diag?.best_model || "XGBoost"} fault-diagnosis model. A local
          explanation is generated live for each sampled EngineFaultDB row, showing how each input feature
          moved the model's output.
          {typeof f1 === "number" && <> Model macro-F1 on the held-out test set: {f1.toFixed(2)}.</>}
        </p>
      </ModuleHeader>

      <InfoBox>
        SHAP values explain how the trained model reached this prediction. They are not proof of a physical
        cause. Fault classes 1–3 are unnamed in the source dataset.
      </InfoBox>

      <Pipeline steps={steps} label="Explanation pipeline" />

      {phase === "sampling" && <Loading label="Drawing a sample from EngineFaultDB…" />}
      {phase === "analysing" && <Loading label="Running the model and computing SHAP values…" />}
      {error && (
        <div className="dgx-error">
          <ErrorBox message={error} />
          <button type="button" className="btn btn-sm" onClick={draw} disabled={busy}>
            <RefreshCw size={13} aria-hidden="true" /> Try again
          </button>
        </div>
      )}

      {!result && !busy && !error && <Empty label="No explanation yet. Draw a sample to explain the model's prediction." />}

      {result && sample && (
        <div className={`dx-results${busy ? " is-busy" : ""}`} aria-busy={busy}>
          {/* ---------- context + main chart ---------- */}
          <div className="dx-row xa-row-a">
            <Panel title="Diagnosis context" sub="The prediction being explained" className={`xa-context dgx-tint-${tone}`}>
              <div className="dx-label">{label}</div>
              <div className="pill-row">
                <Badge status={result.severity === "NONE" ? "NORMAL" : result.severity}>{result.severity}</Badge>
                <Badge status="info">{fmtPct(result.confidence, 1)} confidence</Badge>
              </div>
              <dl className="dx-facts">
                <div><dt>Model</dt><dd className="mono">{result.model_used}</dd></div>
                <div><dt>Sample</dt><dd>EngineFaultDB row · {featureCount} features</dd></div>
                {sample.Fault !== undefined && (
                  <div><dt>Ground-truth label of this row</dt><dd className="mono">Class {sample.Fault}</dd></div>
                )}
              </dl>
              <p className="dgx-cap">
                This is one operating-point snapshot, not live data from your vehicle.
              </p>
            </Panel>

            <Panel
              title="SHAP contributions"
              sub="Each bar is one feature's SHAP value for this prediction"
              right={<span className="dgx-chip-label">SHAP VALUE</span>}
            >
              {hasShap ? (
                <>
                  <div className="xa-legend" aria-hidden="true">
                    <span><i className="xa-sw xa-pos" /> + pushes toward {label}</span>
                    <span><i className="xa-sw xa-neg" /> − pushes away from {label}</span>
                  </div>

                  <div className="xa-axis" aria-hidden="true">
                    <span className="xa-axis-name" />
                    <span className="xa-axis-scale">
                      <b>−{axisNum(maxAbs)}</b><b>0</b><b>+{axisNum(maxAbs)}</b>
                    </span>
                    <span className="xa-axis-val" />
                  </div>

                  <ul className="xa-bars" aria-label="SHAP value of each feature, ordered by absolute value">
                    {rows.map(r => {
                      const w = (Math.abs(r.n) / maxAbs) * 50;
                      const pos = r.n > 0;
                      const neg = r.n < 0;
                      return (
                        <li className="xa-bar-row" key={r.feature}>
                          <span className="xa-name mono">{r.feature}</span>
                          <span className="xa-track" aria-hidden="true">
                            <i className={`xa-fill ${pos ? "xa-pos" : neg ? "xa-neg" : ""}`}
                               style={pos ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }} />
                          </span>
                          <span className="xa-num mono">
                            {shapText(r.raw)}
                            <span className="dgx-sr">
                              {pos ? " pushes toward the predicted class" : neg ? " pushes away from the predicted class" : " no push"}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="dgx-cap">
                    Bars are centred on zero. Their length is relative to the largest absolute SHAP value in this
                    explanation (±{axisNum(maxAbs)}). The numbers beside each bar are the exact values returned by
                    the model's explainer.
                  </p>
                </>
              ) : (
                <InfoBox>SHAP explanation unavailable for this prediction.</InfoBox>
              )}
            </Panel>
          </div>

          {/* ---------- ranking + interpretation ---------- */}
          {hasShap && (
            <div className="dx-row dx-row-b">
              <Panel title="Feature importance ranking" sub="Strongest contributors first, by absolute SHAP value">
                <div className="xa-stats">
                  <div><dt>Strongest</dt><dd className="mono">{top.feature}</dd></div>
                  <div><dt>Toward · sum</dt><dd className="mono">{toward.length ? `+${sumToward.toFixed(3)}` : "—"}</dd></div>
                  <div><dt>Away · sum</dt><dd className="mono">{away.length ? sumAway.toFixed(3) : "—"}</dd></div>
                </div>
                <ol className="xa-rank">
                  {rows.map((r, i) => {
                    const pos = r.n > 0;
                    const neg = r.n < 0;
                    const rel = Math.round((Math.abs(r.n) / maxAbs) * 100);
                    return (
                      <li className="xa-rank-row" key={r.feature}>
                        <span className="xa-rank-n mono" aria-hidden="true">{i + 1}</span>
                        <span className="xa-rank-main">
                          <span className="xa-rank-name mono">{r.feature}</span>
                          <span className={`xa-dir ${pos ? "xa-dir-pos" : neg ? "xa-dir-neg" : ""}`}>
                            {pos ? "toward" : neg ? "away" : "no push"}
                          </span>
                        </span>
                        <span className="xa-rank-bar" aria-hidden="true">
                          <i className={pos ? "xa-pos" : neg ? "xa-neg" : ""} style={{ width: `${rel}%` }} />
                        </span>
                        <span className="xa-rank-val">
                          <b className="mono">{shapText(r.raw)}</b>
                          <small>{rel}% of strongest</small>
                        </span>
                      </li>
                    );
                  })}
                </ol>
                <p className="dgx-cap">
                  Rank, direction and "% of strongest" are derived from the returned values. The sums add only the{" "}
                  {rows.length} contributions returned; features not returned are not included.
                </p>
              </Panel>

              <Panel title="Interpretation" sub="What the explanation says, in plain terms">
                <ul className="dx-notes">
                  <li>
                    For this sample the model predicted <b>{label}</b> with {fmtPct(result.confidence, 1)} confidence
                    (severity: {result.severity}).
                  </li>
                  <li>
                    The largest contribution came from <span className="mono">{top.feature}</span> (SHAP{" "}
                    <span className="mono">{shapText(top.raw)}</span>), which{" "}
                    {top.n > 0 ? <>pushes the prediction <b>toward</b></> : top.n < 0 ? <>pushes the prediction <b>away from</b></> : <>does not move the output for</>}{" "}
                    {label}.
                  </li>
                  <li>
                    {toward.length
                      ? <>Pushing toward {label}: <span className="mono">{toward.map(r => `${r.feature} (${shapText(r.raw)})`).join(", ")}</span>.</>
                      : <>No returned feature pushes toward {label}.</>}
                  </li>
                  <li>
                    {away.length
                      ? <>Pushing away from {label}: <span className="mono">{away.map(r => `${r.feature} (${shapText(r.raw)})`).join(", ")}</span>.</>
                      : <>No returned feature pushes away from {label}.</>}
                  </li>
                </ul>
                <p className="dgx-cap">
                  This describes how the model weighted the inputs of this one sample. It does not show why the
                  vehicle condition arose, and it is not a confirmed diagnosis.
                </p>
                <div className="xa-links">
                  <Link className="btn btn-sm" to="/whatif">Test changes in the What-If Simulator <ArrowUpRight size={13} aria-hidden="true" /></Link>
                  <Link className="btn btn-sm" to="/diagnostics">Open Diagnostics <ArrowUpRight size={13} aria-hidden="true" /></Link>
                </div>
              </Panel>
            </div>
          )}

          {/* ---------- methodology + model features ---------- */}
          <div className="dx-row dx-row-b">
            <Panel title="Methodology & limitations" sub="How to read this explanation">
              <ul className="dx-notes">
                <li>SHAP (TreeExplainer) attributes the model's output for this sample to its input features. It explains the behaviour of the trained model.</li>
                <li>A SHAP contribution is not proof of physical causality. A feature can push the model toward a class without being the mechanical cause.</li>
                <li>The explanation belongs to the selected sample only. A different row can be explained differently.</li>
                <li>The model's limitations still apply. Fault classes 1–3 are unnamed in the source dataset, so no mechanical cause is implied.</li>
                <li>These are SHAP values from the fault-diagnosis model. They are different from the Dashboard's anomaly feature contributions, which are z-scores of telemetry sensors.</li>
              </ul>
              {classRows.length > 0 && (
                <div className="xa-f1">
                  <div className="dx-meter-head"><span>MODEL F1 BY CLASS · HELD-OUT TEST SET</span></div>
                  <ul>
                    {classRows.map(c => (
                      <li key={c.key} className={c.name === label ? "is-predicted" : undefined}>
                        <span>{c.name}{c.name === label && <em> · predicted here</em>}</span>
                        <span className="xa-f1-track" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(1, c.f1)) * 100}%` }} /></span>
                        <b className="mono">{c.f1.toFixed(2)}</b>
                      </li>
                    ))}
                  </ul>
                  <p className="dgx-cap">
                    Per-class F1 comes from the stored model evaluation, not from this sample. Lower F1 means
                    predictions for that class are less reliable, whatever the explanation shows.
                  </p>
                </div>
              )}
            </Panel>

            <Panel title="Model features used" sub={diag?.features ? `${diag.features.length} features the model was trained on` : "Full feature set"}>
              {diag?.features ? (
                <>
                  <div className="dgx-chips">
                    {diag.features.map(f => (
                      <span key={f} className={`badge badge-neutral xa-chip${explained.has(f) ? " is-used" : ""}`}>{f}</span>
                    ))}
                  </div>
                  <p className="dgx-cap">
                    Highlighted features appear in this explanation. The others were inputs to the model but are
                    not among the contributions returned for this sample.
                  </p>
                </>
              ) : metricsFailed ? (
                <p className="dgx-meta">Feature list unavailable right now.</p>
              ) : (
                <Loading />
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}