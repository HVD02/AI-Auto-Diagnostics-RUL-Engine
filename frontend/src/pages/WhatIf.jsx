import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  RefreshCw, RotateCcw, Play, ArrowUp, Flame, Wind, Database, SlidersHorizontal, Cpu, ArrowLeftRight,
} from "lucide-react";
import { Badge, Loading, ErrorBox, InfoBox } from "../components/ui.jsx";
import { ModuleHeader, Pipeline, Panel } from "../components/DiagnosisParts.jsx";
import { diagnoseSample, diagnose, whatIfDiagnosis } from "../api";
import "./DiagnosisPages.css";

// Slider constraints: unchanged from the original page.
const FEATURE_RANGES = {
  MAP: [10, 250], TPS: [0, 100], Force: [0, 5000], Power: [0, 300],
  RPM: [500, 6000], "Consumption L/H": [0, 40], "Consumption L/100KM": [0, 25],
  Speed: [0, 220], CO: [0, 5], HC: [0, 1000], CO2: [0, 20], O2: [0, 10],
  Lambda: [0.5, 1.5], AFR: [8, 20],
};

// Presets: unchanged calculations from the original page.
const PRESETS = [
  {
    label: "High Emissions", icon: Flame,
    apply: (v) => ({ ...v, CO: Math.min(5, v.CO * 3 + 1), HC: Math.min(1000, v.HC * 3 + 100), CO2: Math.min(20, v.CO2 * 1.4) }),
  },
  {
    label: "Lean Mixture", icon: Wind,
    apply: (v) => ({ ...v, AFR: Math.min(20, v.AFR * 1.3), O2: Math.min(10, v.O2 * 2 + 1), Lambda: Math.min(1.5, v.Lambda * 1.2) }),
  },
  {
    label: "High Load / RPM", icon: ArrowUp,
    apply: (v) => ({ ...v, RPM: Math.min(6000, v.RPM * 1.6), Power: Math.min(300, v.Power * 1.5), Force: Math.min(5000, v.Force * 1.4) }),
  },
];

const SEV_RANK = { NONE: 0, MILD: 1, MODERATE: 2, SEVERE: 3 };

const errMsg = (e) => e?.response?.data?.detail || e.message;
const rangeOf = (k, v) => FEATURE_RANGES[k] || [0, v * 2 || 100];
const num = (v, d = 2) => (Number.isFinite(Number(v)) && v !== null && v !== undefined ? Number(v).toFixed(d) : "—");
const signed = (n, d = 2) => (n > 0 ? "+" : "") + n.toFixed(d);
const fmtPct = (p, d = 1) => (typeof p === "number" && Number.isFinite(p) ? `${(p * 100).toFixed(d)}%` : "—");
const sevBadge = (s) => (s === "NONE" ? "NORMAL" : s);

// One slider with baseline context.
function Control({ name, baseVal, value, active, onChange, onReset }) {
  const [lo, hi] = rangeOf(name, baseVal);
  const span = hi - lo;
  const pct = (x) => (span > 0 ? Math.max(0, Math.min(100, ((Number(x) - lo) / span) * 100)) : 0);
  const changed = value !== baseVal;
  const delta = Number(value) - Number(baseVal);
  const id = `wi-ctl-${name.replace(/[^a-z0-9]+/gi, "-")}`;
  const outside = baseVal < lo || baseVal > hi;
  return (
    <div className={`wi-ctl${changed ? " is-changed" : ""}`}>
      <div className="wi-ctl-head">
        <label htmlFor={id} className={active ? "is-active" : undefined}>{name}</label>
        <span className="wi-ctl-val mono">{num(value)}</span>
      </div>
      <div className="wi-range" style={{ "--b": `${pct(baseVal)}%` }}>
        <input
          id={id}
          type="range"
          min={lo}
          max={hi}
          step={(hi - lo) / 200}
          value={value}
          style={{ "--p": `${pct(value)}%` }}
          onChange={e => onChange(name, parseFloat(e.target.value))}
          aria-describedby={`${id}-meta`}
        />
        <i className="wi-tick" aria-hidden="true" />
      </div>
      <div className="wi-ctl-foot mono" id={`${id}-meta`}>
        <span>{lo}</span>
        <span className="wi-ctl-base">baseline {num(baseVal)}</span>
        <span>{hi}</span>
      </div>
      {changed && (
        <div className="wi-ctl-changed">
          <span className="wi-chip-changed">Modified {Number.isFinite(delta) ? signed(delta) : ""}</span>
          <button type="button" className="wi-link" onClick={() => onReset(name)}>
            <RotateCcw size={11} aria-hidden="true" /> Reset
          </button>
        </div>
      )}
      {outside && <div className="wi-ctl-note">Baseline is outside this slider's range.</div>}
    </div>
  );
}

export default function WhatIf() {
  const [base, setBase] = useState(null);
  const [values, setValues] = useState({});
  const [truth, setTruth] = useState(undefined);
  const [baseline, setBaseline] = useState(null);       // diagnose(base) result
  const [baselineError, setBaselineError] = useState(null);
  const [result, setResult] = useState(null);            // { before, after } from /whatif/diagnosis
  const [ranChanged, setRanChanged] = useState(null);    // the exact changed_features that were sent
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [sampleError, setSampleError] = useState(null);
  const [runError, setRunError] = useState(null);
  const [lastChanged, setLastChanged] = useState(null);
  const [live, setLive] = useState(false);
  // Separate request ids: a slow, older response can never overwrite a newer one.
  const sampleId = useRef(0);
  const runId = useRef(0);

  const drawSample = async () => {
    const id = ++sampleId.current;
    runId.current += 1;
    setLoading(true);
    setSampleError(null);
    setRunError(null);
    setBaselineError(null);
    setRunning(false);
    setResult(null);
    setRanChanged(null);
    setBaseline(null);
    setLastChanged(null);
    try {
      const d = await diagnoseSample();
      if (id !== sampleId.current) return;
      const { Fault, ...features } = d.sample_features;
      setBase(features);
      setValues(features);
      setTruth(Fault);
      setLoading(false);
      try {
        const b = await diagnose(features);
        if (id !== sampleId.current) return;
        setBaseline(b);
      } catch (e) {
        if (id === sampleId.current) setBaselineError(errMsg(e));
      }
    } catch (e) {
      if (id !== sampleId.current) return;
      setSampleError(errMsg(e));
      setLoading(false);
    }
  };

  useEffect(() => {
    drawSample();
    return () => { sampleId.current += 1; runId.current += 1; };
  }, []);

  // Only the inputs that differ from the baseline are sent, exactly as before.
  const changedOf = (vals) => {
    const out = {};
    Object.keys(vals).forEach(k => { if (vals[k] !== base[k]) out[k] = vals[k]; });
    return out;
  };
  const changed = useMemo(() => (base ? changedOf(values) : {}), [base, values]);
  const changedKeys = Object.keys(changed);

  const run = (changedFeatures) => {
    if (!base) return;
    const id = ++runId.current;
    setRunning(true);
    setRunError(null);
    whatIfDiagnosis(base, changedFeatures)
      .then(r => {
        if (id !== runId.current) return;
        setResult({ before: r.before, after: r.after });
        setRanChanged(changedFeatures);
      })
      .catch(e => { if (id === runId.current) setRunError(errMsg(e)); })
      .finally(() => { if (id === runId.current) setRunning(false); });
  };

  const setNext = (next) => {
    setValues(next);
    if (live) run(changedOf(next));
  };
  const onChange = (k, v) => { setLastChanged(k); setNext({ ...values, [k]: v }); };
  const resetOne = (k) => { setLastChanged(null); setNext({ ...values, [k]: base[k] }); };
  const applyPreset = (preset) => {
    setLastChanged(null);
    const raw = preset.apply(values);
    const next = { ...values };
    Object.keys(raw).forEach(k => { if (Number.isFinite(raw[k])) next[k] = raw[k]; });
    setNext(next);
  };

  // Reset restores the sampled values and clears the comparison without calling the API.
  const reset = () => {
    runId.current += 1;
    setLastChanged(null);
    setValues(base);
    setResult(null);
    setRanChanged(null);
    setRunning(false);
    setRunError(null);
  };

  const b = result?.before;
  const a = result?.after;
  const both = !!(b && a);
  const stale = !!(result && JSON.stringify(ranChanged) !== JSON.stringify(changed));
  const baseShown = b || baseline;
  const labelChanged = both && b.predicted_label !== a.predicted_label;
  const sevDelta = both && b.severity in SEV_RANK && a.severity in SEV_RANK ? SEV_RANK[a.severity] - SEV_RANK[b.severity] : null;
  const confDelta = both && Number.isFinite(b.confidence) && Number.isFinite(a.confidence) ? (a.confidence - b.confidence) * 100 : null;

  const classRows = useMemo(() => {
    if (!both) return [];
    const map = new Map();
    (Array.isArray(b.top3) ? b.top3 : []).forEach(t => map.set(t.class, { label: t.label, before: t.probability, after: null }));
    (Array.isArray(a.top3) ? a.top3 : []).forEach(t => {
      const cur = map.get(t.class) || { label: t.label, before: null, after: null };
      cur.after = t.probability;
      map.set(t.class, cur);
    });
    return [...map.values()].sort((x, y) => (y.after ?? -1) - (x.after ?? -1));
  }, [both, b, a]);

  // ----- workflow strip: BASELINE -> MODIFY INPUTS -> RUN SIMULATION -> COMPARE RESULTS -----
  const hasFresh = !!result && !stale && !running;
  const steps = [
    { key: "base", label: "BASELINE", icon: Database,
      state: sampleError ? "error" : loading ? "active" : base ? "done" : "idle",
      detail: base ? `EngineFaultDB sample · ${Object.keys(base).length} inputs` : "EngineFaultDB sample" },
    { key: "mod", label: "MODIFY INPUTS", icon: SlidersHorizontal,
      state: !base ? "idle" : changedKeys.length ? "done" : "active",
      detail: !base ? "Adjust sliders or a preset" : changedKeys.length ? `${changedKeys.length} input${changedKeys.length > 1 ? "s" : ""} modified` : "Adjust sliders or a preset" },
    { key: "run", label: "RUN SIMULATION", icon: Cpu,
      state: runError ? "error" : running ? "active" : hasFresh ? "done" : "idle",
      detail: running ? "Re-running the model…" : runError ? "Simulation failed" : hasFresh ? "Model re-run on modified inputs" : "Re-runs the fault model" },
    { key: "cmp", label: "COMPARE RESULTS", icon: ArrowLeftRight,
      state: hasFresh ? "done" : "idle",
      detail: hasFresh ? (labelChanged ? "Prediction changed" : "Prediction unchanged") : "Baseline vs simulated" },
  ];

  const canRun = !!base && !running && changedKeys.length > 0;

  return (
    <div className="page dgx-page">
      <ModuleHeader
        eyebrow="Simulate / counterfactual analysis"
        title="What-If Simulator"
        source={
          <span className="dgx-source">
            <span className="dgx-source-dot" aria-hidden="true" />
            EngineFaultDB · model what-if
          </span>
        }
        actions={
          <button type="button" className="btn btn-sm" onClick={drawSample} disabled={loading}>
            <RefreshCw size={13} className={loading ? "spin" : undefined} aria-hidden="true" /> New sample
          </button>
        }
      >
        <p>
          Change selected inputs of the fault-diagnosis model and see how its prediction responds. The
          diagnosis model actually re-runs; before and after values are returned by the model, never hardcoded.
        </p>
      </ModuleHeader>

      <InfoBox>
        The sliders change input features of the EngineFaultDB fault classifier for one sampled operating
        point. This is a model what-if, not a physical simulation of a vehicle. Fault classes 1–3 are
        unnamed in the source dataset.
      </InfoBox>

      <Pipeline steps={steps} label="Simulation workflow" />

      {loading && <Loading label="Drawing a sample from EngineFaultDB…" />}
      {sampleError && (
        <div className="dgx-error">
          <ErrorBox message={sampleError} />
          <button type="button" className="btn btn-sm" onClick={drawSample} disabled={loading}>
            <RefreshCw size={13} aria-hidden="true" /> Try again
          </button>
        </div>
      )}

      {base && (
        <div className="dx-results">
          <div className="dx-row wi-row-a">
            {/* ---------- baseline ---------- */}
            <Panel title="Baseline diagnosis" sub="The model's prediction for the original sample" className="wi-baseline">
              <span className="wi-tag wi-tag-base">BASELINE</span>
              {baseShown ? (
                <>
                  <div className="dx-label">{baseShown.predicted_label ?? "—"}</div>
                  <div className="pill-row">
                    {baseShown.severity && <Badge status={sevBadge(baseShown.severity)}>{baseShown.severity}</Badge>}
                    <Badge status="info">{fmtPct(baseShown.confidence)} confidence</Badge>
                  </div>
                </>
              ) : baselineError ? (
                <ErrorBox message={`Baseline prediction unavailable: ${baselineError}`} />
              ) : (
                <Loading label="Running the model on the baseline…" />
              )}
              <dl className="dx-facts">
                {baseShown?.model_used && <div><dt>Model</dt><dd className="mono">{baseShown.model_used}</dd></div>}
                <div><dt>Sample</dt><dd>EngineFaultDB row · {Object.keys(base).length} inputs</dd></div>
                {truth !== undefined && <div><dt>Ground-truth label of this row</dt><dd className="mono">Class {truth}</dd></div>}
              </dl>
              <p className="dgx-cap">This is one operating-point snapshot, not live data from your vehicle.</p>
            </Panel>

            {/* ---------- sensor adjustment workspace ---------- */}
            <Panel
              title="Sensor adjustment workspace"
              sub="Move a slider or apply a preset, then run the simulation"
              right={<span className="dgx-chip-label">{changedKeys.length} MODIFIED</span>}
              className="wi-workspace"
            >
              <div className="wi-toolbar">
                <button type="button" className="btn btn-primary" onClick={() => run(changed)} disabled={!canRun}>
                  <Play size={14} className={running ? "spin" : undefined} aria-hidden="true" />
                  {running ? "Running…" : "Run simulation"}
                </button>
                <button type="button" className="btn btn-sm" onClick={reset}>
                  <RotateCcw size={13} aria-hidden="true" /> Reset to baseline
                </button>
                <label className="wi-live">
                  <input type="checkbox" checked={live} onChange={e => setLive(e.target.checked)} />
                  <span>Live update</span>
                </label>
              </div>
              <div className="wi-presets" role="group" aria-label="Scenario presets">
                <span className="wi-presets-label">PRESETS</span>
                {PRESETS.map(p => (
                  <button key={p.label} type="button" className="btn btn-sm" onClick={() => applyPreset(p)}>
                    <p.icon size={13} aria-hidden="true" /> {p.label}
                  </button>
                ))}
              </div>
              <p className="wi-status" role="status">
                {running ? "The model is processing the modified inputs…"
                  : stale ? "Inputs changed since the last run. Run the simulation again to refresh the comparison."
                  : changedKeys.length === 0 ? "No inputs modified yet. Change a slider or apply a preset."
                  : live ? "Live update is on: the model re-runs after every change."
                  : "Inputs modified. Press Run simulation to compare."}
              </p>

              <div className="wi-controls">
                {Object.entries(base).map(([k, v]) => (
                  <Control
                    key={k}
                    name={k}
                    baseVal={v}
                    value={values[k]}
                    active={lastChanged === k}
                    onChange={onChange}
                    onReset={resetOne}
                  />
                ))}
              </div>
            </Panel>
          </div>

          {runError && (
            <div className="dgx-error">
              <ErrorBox message={runError} />
              <button type="button" className="btn btn-sm" onClick={() => run(changed)} disabled={running || changedKeys.length === 0}>
                <RefreshCw size={13} aria-hidden="true" /> Try again
              </button>
            </div>
          )}

          {/* ---------- comparison ---------- */}
          {result ? (
            <div className={`wi-compare${running ? " is-busy" : ""}`} aria-busy={running}>
              <Panel
                title="Baseline vs simulated"
                sub="Both predictions come from the model"
                right={both ? (
                  <span className={`wi-verdict ${labelChanged ? "is-changed" : "is-same"}`}>
                    {labelChanged ? "PREDICTION CHANGED" : "PREDICTION UNCHANGED"}
                  </span>
                ) : null}
              >
                {stale && <p className="dgx-cap wi-stale">These results are for the inputs of the last run. Your current inputs are different.</p>}
                {both ? (
                  <>
                    <div className="wi-pair">
                      {[["BASELINE", b, "wi-tag-base"], ["SIMULATED", a, "wi-tag-sim"]].map(([tag, r, cls]) => (
                        <div className={`wi-side ${tag === "SIMULATED" ? "is-sim" : ""}`} key={tag}>
                          <span className={`wi-tag ${cls}`}>{tag}</span>
                          <div className="wi-side-label">{r.predicted_label ?? "—"}</div>
                          <div className="pill-row">
                            {r.severity && <Badge status={sevBadge(r.severity)}>{r.severity}</Badge>}
                            <Badge status="info">{fmtPct(r.confidence)} confidence</Badge>
                          </div>
                          <div className="wi-conf" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, (r.confidence || 0) * 100))}%` }} /></div>
                          {r.model_used && <div className="wi-side-model mono">{r.model_used}</div>}
                        </div>
                      ))}
                    </div>
                    <dl className="wi-deltas">
                      <div>
                        <dt>Predicted class</dt>
                        <dd>{labelChanged ? `${b.predicted_label} → ${a.predicted_label}` : "unchanged"}</dd>
                      </div>
                      <div>
                        <dt>Severity</dt>
                        <dd>{sevDelta === null ? "—" : sevDelta > 0 ? "higher severity" : sevDelta < 0 ? "lower severity" : "same severity"}</dd>
                      </div>
                      <div>
                        <dt>Confidence</dt>
                        <dd className="mono">{confDelta === null ? "—" : `${signed(confDelta, 1)} percentage points`}</dd>
                      </div>
                    </dl>
                  </>
                ) : (
                  <InfoBox>The model response did not include both a baseline and a simulated prediction.</InfoBox>
                )}
              </Panel>

              <div className="dx-row dx-row-b">
                <Panel title="Class probabilities" sub="Top-3 classes returned for each run">
                  {classRows.length ? (
                    <ul className="wi-classes">
                      {classRows.map(c => {
                        const d = c.before !== null && c.after !== null ? (c.after - c.before) * 100 : null;
                        return (
                          <li key={c.label}>
                            <div className="wi-class-head">
                              <span>{c.label}</span>
                              <b className="mono">{d === null ? "—" : `${signed(d, 1)} pp`}</b>
                            </div>
                            <div className="wi-class-bar"><i className="wi-b" style={{ width: `${(c.before || 0) * 100}%` }} /><em className="mono">{fmtPct(c.before)}</em></div>
                            <div className="wi-class-bar"><i className="wi-s" style={{ width: `${(c.after || 0) * 100}%` }} /><em className="mono">{fmtPct(c.after)}</em></div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : <p className="dgx-meta">No class probabilities returned.</p>}
                  <div className="wi-key"><span><i className="wi-sw wi-b" /> Baseline</span><span><i className="wi-sw wi-s" /> Simulated</span></div>
                  <p className="dgx-cap">Only each run's top three classes are returned, so a class outside one list shows "—". pp = percentage points.</p>
                </Panel>

                <Panel title="Change impact" sub="Inputs sent to the model for this run">
                  {ranChanged && Object.keys(ranChanged).length ? (
                    <ul className="wi-inputs">
                      {Object.entries(ranChanged).map(([k, v]) => {
                        const d = Number(v) - Number(base[k]);
                        const rel = Number(base[k]) !== 0 ? (d / Number(base[k])) * 100 : null;
                        return (
                          <li key={k}>
                            <span className="mono wi-in-name">{k}</span>
                            <span className="mono wi-in-vals">{num(base[k])} → {num(v)}</span>
                            <span className="mono wi-in-d">{signed(d)}{rel !== null && Number.isFinite(rel) ? ` (${signed(rel, 1)}%)` : ""}</span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : <p className="dgx-meta">No inputs were modified in this run.</p>}
                  <p className="dgx-cap">
                    The backend returns predictions, not per-input impact scores, so this page lists the modified
                    inputs and the real change in the model's output. It does not attribute the change to
                    individual inputs. For feature contributions, see Explainable AI.
                  </p>
                </Panel>
              </div>
            </div>
          ) : (
            !running && (
              <Panel title="Baseline vs simulated" sub="Run a simulation to compare">
                <p className="wi-hint">Modify one or more inputs, then press Run simulation. The comparison appears here.</p>
              </Panel>
            )
          )}
          {running && !result && <Loading label="Re-running the model on the modified inputs…" />}

          {/* ---------- interpretation + limitations ---------- */}
          <div className="dx-row dx-row-b">
            <Panel title="Interpretation" sub="How to read the result">
              {both && !stale ? (
                <ul className="dx-notes">
                  <li>
                    {labelChanged
                      ? <>Modifying {ranChanged ? Object.keys(ranChanged).length : 0} input(s) moved the predicted class from <b>{b.predicted_label}</b> to <b>{a.predicted_label}</b>.</>
                      : <>The predicted class stayed <b>{a.predicted_label}</b>{confDelta !== null ? <>; confidence moved from {fmtPct(b.confidence)} to {fmtPct(a.confidence)}</> : null}.</>}
                  </li>
                  {sevDelta !== null && <li>Severity is {sevDelta > 0 ? "higher" : sevDelta < 0 ? "lower" : "the same"} for the modified inputs ({b.severity} → {a.severity}).</li>}
                  <li>This describes how the trained model responds to these inputs. It does not show what would happen to a real vehicle.</li>
                </ul>
              ) : (
                <p className="wi-hint">Run a simulation to see what the model's response means.</p>
              )}
            </Panel>
            <Panel title="Limitations" sub="What a counterfactual simulation is and is not">
              <ul className="dx-notes">
                <li>This is a model-based counterfactual: it evaluates modified input values supplied to the model.</li>
                <li>It is not a physical vehicle test, and a lower predicted severity does not mean a repair would work.</li>
                <li>It does not establish mechanical causation. Predictions depend on the trained model and its dataset.</li>
                <li>Inputs are changed independently, but real sensor readings are correlated, so some combinations may not occur in a real engine.</li>
                <li>Fault classes 1–3 are unnamed in the source dataset, so no mechanical cause is implied.</li>
              </ul>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}