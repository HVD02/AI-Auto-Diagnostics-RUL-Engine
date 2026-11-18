import React, { useEffect, useRef, useState } from "react";
import { RefreshCw, RotateCw, Database, Cpu, Stethoscope, CheckCircle2 } from "lucide-react";
import { Badge, Loading, ErrorBox, InfoBox, Empty } from "../components/ui.jsx";
import { TopFaults, ShapBars, ModuleHeader, Pipeline, Panel } from "../components/DiagnosisParts.jsx";
import { diagnoseSample, diagnose, getModelMetrics } from "../api";
import "./DiagnosisPages.css";

const errMsg = (e) => e?.response?.data?.detail || e.message;

// Severity -> visual tone. Names come straight from the backend ("NONE" is shown as a normal state).
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

export default function Diagnostics() {
  const [sample, setSample] = useState(null);
  const [result, setResult] = useState(null);
  const [metrics, setMetrics] = useState(null);
  // idle | sampling | analysing | done | error  (real progress of the request chain)
  const [phase, setPhase] = useState("idle");
  const [failedAt, setFailedAt] = useState(null);
  const [error, setError] = useState(null);
  // Every request gets an id so a slow, older response can never overwrite a newer one.
  const reqId = useRef(0);

  // Draw a new EngineFaultDB row, then run the diagnosis model on it (same chain as before).
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
      // sample and result are stored together, so they can never belong to different rows
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

  // Run the model again on the sample that is already on screen.
  const rerun = async () => {
    if (!sample) return;
    const id = ++reqId.current;
    setError(null);
    setFailedAt(null);
    setPhase("analysing");
    try {
      const { Fault, ...features } = sample;
      const r = await diagnose(features);
      if (id !== reqId.current) return;
      setResult(r);
      setPhase("done");
    } catch (e) {
      if (id !== reqId.current) return;
      setError(errMsg(e));
      setFailedAt("analysing");
      setPhase("error");
    }
  };

  useEffect(() => { draw(); return () => { reqId.current += 1; }; }, []);

  // Header metrics come live from /api/model-metrics (the same source as the landing page and Dashboard).
  useEffect(() => {
    let cancelled = false;
    getModelMetrics().then(m => { if (!cancelled) setMetrics(m); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const model = metrics?.diagnosis?.best_model;
  const f1 = metrics?.diagnosis?.test_metrics?.test_f1_macro;
  const busy = phase === "sampling" || phase === "analysing";

  // ----- workflow strip: INPUT -> MODEL ANALYSIS -> DIAGNOSIS -> RESULT -----
  const stepState = (i) => {
    if (phase === "error") {
      const failIndex = failedAt === "sampling" ? 0 : 1;
      if (i < failIndex) return "done";
      return i === failIndex ? "error" : "idle";
    }
    if (phase === "sampling") return i === 0 ? "active" : "idle";
    if (phase === "analysing") return i === 0 ? "done" : (i === 1 ? "active" : "idle");
    if (phase === "done") return "done";
    return "idle";
  };
  const featureCount = sample ? Object.keys(sample).filter(k => k !== "Fault").length : 0;
  const steps = [
    { key: "input", label: "INPUT", icon: Database, state: stepState(0),
      detail: stepState(0) === "done" && sample ? `EngineFaultDB sample · ${featureCount} features` : "EngineFaultDB sample" },
    { key: "model", label: "MODEL ANALYSIS", icon: Cpu, state: stepState(1),
      detail: stepState(1) === "done" && result?.model_used ? result.model_used : "Fault classifier" },
    { key: "diag", label: "DIAGNOSIS", icon: Stethoscope, state: stepState(2),
      detail: stepState(2) === "done" && result ? result.predicted_label : "Predicted fault class" },
    { key: "result", label: "RESULT", icon: CheckCircle2, state: stepState(3),
      detail: stepState(3) === "done" && result ? `${result.severity} · ${fmtPct(result.confidence, 1)}` : "Severity and confidence" },
  ];

  // ----- derived values (plain arithmetic on backend numbers) -----
  const top3 = Array.isArray(result?.top3) ? result.top3 : [];
  const runnerUp = top3[1];
  const margin = top3[0] && runnerUp ? (top3[0].probability - runnerUp.probability) * 100 : null;
  const shap = Array.isArray(result?.shap_explanation) ? result.shap_explanation : null;
  const tone = severityTone(result?.severity);
  const confPct = typeof result?.confidence === "number" ? Math.max(0, Math.min(100, result.confidence * 100)) : 0;

  return (
    <div className="page dgx-page">
      <ModuleHeader
        eyebrow="Investigate / fault diagnosis"
        title="Diagnostics"
        source={
          <span className="dgx-source">
            <span className="dgx-source-dot" aria-hidden="true" />
            EngineFaultDB · real snapshots
          </span>
        }
        actions={
          <>
            <button type="button" className="btn btn-sm" onClick={rerun} disabled={busy || !sample}>
              <RotateCw size={13} aria-hidden="true" /> Re-run model
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={draw} disabled={busy}>
              <RefreshCw size={13} className={busy ? "spin" : undefined} aria-hidden="true" />
              {busy ? "Running…" : "Draw sample & run diagnosis"}
            </button>
          </>
        }
      >
        <p>
          Fault classification trained on EngineFaultDB (real operating-point snapshots).{" "}
          {model && typeof f1 === "number" && (
            <><span className="mono">{model}</span> · macro-F1 {f1.toFixed(2)} on the held-out test set.</>
          )}
        </p>
      </ModuleHeader>

      <InfoBox>
        Each sample is a single operating-point snapshot drawn from EngineFaultDB, not live data from your
        vehicle. Fault classes 1–3 are not named in the source dataset, so they are reported as Fault
        Class 1/2/3 and no mechanical cause is implied.
      </InfoBox>

      <Pipeline steps={steps} label="Diagnosis pipeline" />

      {phase === "sampling" && <Loading label="Drawing a sample from EngineFaultDB…" />}
      {phase === "analysing" && <Loading label="Running diagnosis model…" />}
      {error && (
        <div className="dgx-error">
          <ErrorBox message={error} />
          <button type="button" className="btn btn-sm" onClick={draw} disabled={busy}>
            <RefreshCw size={13} aria-hidden="true" /> Try again
          </button>
        </div>
      )}

      {!result && !busy && !error && <Empty label="No diagnosis yet. Draw a sample to run the model." />}

      {result && sample && (
        <div className={`dx-results${busy ? " is-busy" : ""}`} aria-busy={busy}>
          <div className="dx-row dx-row-a">
            <Panel title="Primary diagnosis" sub="Predicted class for this snapshot" className={`dx-hero dgx-tint-${tone}`}>
              <div className="dx-label">{result.predicted_label}</div>
              <div className="pill-row">
                <Badge status={result.severity === "NONE" ? "NORMAL" : result.severity}>{result.severity}</Badge>
                <Badge status="info">{fmtPct(result.confidence, 1)} confidence</Badge>
              </div>

              <div
                className="dx-meter"
                role="meter"
                aria-label="Model confidence"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(confPct)}
              >
                <div className="dx-meter-head">
                  <span>MODEL CONFIDENCE</span>
                  <b className="mono">{fmtPct(result.confidence, 1)}</b>
                </div>
                <div className="dx-meter-track"><i style={{ width: `${confPct}%` }} /></div>
              </div>

              <dl className="dx-facts">
                <div><dt>Model</dt><dd className="mono">{result.model_used}</dd></div>
                {sample.Fault !== undefined && (
                  <div><dt>Ground-truth label of this row</dt><dd className="mono">Class {sample.Fault}</dd></div>
                )}
              </dl>
            </Panel>

            <Panel title="Top 3 possible faults" sub="Ranked class probabilities from the model">
              {top3.length ? <TopFaults items={top3} /> : <p className="dgx-meta">No class ranking returned.</p>}
              {margin !== null && (
                <p className="dgx-cap">
                  Margin between the top two classes: <b className="mono">{margin.toFixed(1)} percentage points</b>.
                </p>
              )}
            </Panel>
          </div>

          <div className="dx-row dx-row-b">
            <Panel title="Interpretation" sub="What the model returned, in plain terms">
              <ul className="dx-notes">
                <li>
                  The model classified this snapshot as <b>{result.predicted_label}</b> with{" "}
                  {fmtPct(result.confidence, 1)} confidence (severity: {result.severity}).
                </li>
                {runnerUp && (
                  <li>
                    The next most likely class was <b>{runnerUp.label}</b> at {fmtPct(runnerUp.probability, 1)}.
                  </li>
                )}
                {shap && shap.length > 0 && (
                  <li>
                    The strongest SHAP contributors were{" "}
                    <span className="mono">{shap.slice(0, 2).map(e => e.feature).join(" and ")}</span>.
                  </li>
                )}
                {sample.Fault !== undefined && (
                  <li>This sampled row is labelled <span className="mono">Class {sample.Fault}</span> in EngineFaultDB.</li>
                )}
              </ul>
              <p className="dgx-cap">
                Fault classes 1–3 are unnamed in the source dataset, so no mechanical cause is implied.
                Confidence and probabilities describe the model's output for this snapshot; they are not a
                guarantee about a vehicle.
              </p>
            </Panel>

            <Panel title="Recommended inspection" sub="Reference checks, not a confirmed diagnosis">
              {result.maintenance && result.maintenance.length ? (
                <>
                  <ul className="dx-checks">
                    {result.maintenance.slice(0, 2).map((m, i) => (
                      <li key={i}>
                        <strong>{m.category} <span className="dx-sep">/</span> {m.subcategory}</strong>
                        {m.symptoms && m.symptoms.length > 0 && <span>{m.symptoms.join(", ")}</span>}
                      </li>
                    ))}
                  </ul>
                  <p className="dgx-cap">
                    Reference checks retrieved by keyword match from the Automotive Faults dataset. They are
                    not a confirmed diagnosis.
                  </p>
                </>
              ) : (
                <p className="dgx-meta">No specific inspection retrieved.</p>
              )}
            </Panel>
          </div>

          <div className="dx-row dx-row-c">
            <Panel title="Diagnostic evidence (SHAP)" sub="Feature contributions to this prediction">
              {shap
                ? <ShapBars items={shap} legend />
                : <InfoBox>SHAP explanation unavailable for this prediction.</InfoBox>}
              <p className="dgx-cap">
                These are SHAP values from the fault-diagnosis model. They are different from the Dashboard's
                anomaly feature contributions, which are z-scores of telemetry sensors.
              </p>
            </Panel>

            <Panel title="Supporting sensor evidence" sub={`Input snapshot · ${featureCount} features`}>
              <dl className="dx-inputs">
                {Object.entries(sample).filter(([k]) => k !== "Fault").map(([k, v]) => (
                  <div className="dx-input" key={k}>
                    <dt>{k}</dt>
                    <dd>{typeof v === "number" ? v.toFixed(3) : v}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}