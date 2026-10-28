import React, { useEffect, useRef, useState } from "react";
import { RefreshCw, ArrowUp, ArrowDown, Minus, Flame, Wind, RotateCcw } from "lucide-react";
import { Card, Loading, Badge, ErrorBox, InfoBox } from "../components/ui.jsx";
import { TopFaults } from "../components/DiagnosisParts.jsx";
import { diagnoseSample, whatIfDiagnosis } from "../api";
import "./DiagnosisPages.css";

const FEATURE_RANGES = {
  MAP: [10, 250], TPS: [0, 100], Force: [0, 5000], Power: [0, 300],
  RPM: [500, 6000], "Consumption L/H": [0, 40], "Consumption L/100KM": [0, 25],
  Speed: [0, 220], CO: [0, 5], HC: [0, 1000], CO2: [0, 20], O2: [0, 10],
  Lambda: [0.5, 1.5], AFR: [8, 20],
};

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

const errMsg = (e) => e?.response?.data?.detail || e.message;

function DeltaIcon({ before, after }) {
  if (after > before) return <ArrowUp size={12} color="var(--crit)" aria-hidden="true" />;
  if (after < before) return <ArrowDown size={12} color="var(--ok)" aria-hidden="true" />;
  return <Minus size={12} color="var(--text-2)" aria-hidden="true" />;
}

export default function WhatIf() {
  const [base, setBase] = useState(null);
  const [values, setValues] = useState({});
  const [before, setBefore] = useState(null);
  const [after, setAfter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [lastChanged, setLastChanged] = useState(null);
  // Incremented for every request/reset so a slow, older response can never overwrite a newer one.
  const reqId = useRef(0);

  const drawSample = () => {
    reqId.current += 1;
    setLoading(true);
    setError(null);
    setRunning(false);
    setBefore(null); setAfter(null); setLastChanged(null);
    diagnoseSample().then(d => {
      const { Fault, ...features } = d.sample_features;
      setBase(features);
      setValues(features);
    }).catch(e => setError(errMsg(e))).finally(() => setLoading(false));
  };

  useEffect(() => { drawSample(); }, []);

  const rerun = (newValues) => {
    if (!base) return;
    const id = ++reqId.current;
    setRunning(true);
    setError(null);
    whatIfDiagnosis(base, newValues)
      .then(r => {
        if (id !== reqId.current) return;
        setBefore(r.before);
        setAfter(r.after);
      })
      .catch(e => { if (id === reqId.current) setError(errMsg(e)); })
      .finally(() => { if (id === reqId.current) setRunning(false); });
  };

  const applyValues = (nextValues) => {
    setValues(nextValues);
    const changed = {};
    Object.keys(nextValues).forEach(key => { if (nextValues[key] !== base[key]) changed[key] = nextValues[key]; });
    rerun(changed);
  };

  const onChange = (k, v) => {
    setLastChanged(k);
    applyValues({ ...values, [k]: v });
  };

  const applyPreset = (preset) => {
    setLastChanged(null);
    applyValues(preset.apply(values));
  };

  // Reset restores the sampled values and clears the comparison without calling the API.
  const reset = () => {
    reqId.current += 1;
    setLastChanged(null);
    setValues(base);
    setBefore(null);
    setAfter(null);
    setRunning(false);
    setError(null);
  };

  const severityRank = { NONE: 0, MILD: 1, MODERATE: 2, SEVERE: 3 };
  const severityDelta = before && after ? severityRank[after.severity] - severityRank[before.severity] : 0;

  const afterRight = running
    ? <span className="wi-delta">Re-running model…</span>
    : (before && after ? (
        <span className="wi-delta">
          <DeltaIcon before={severityRank[before.severity]} after={severityRank[after.severity]} />
          {severityDelta > 0 ? "worse" : severityDelta < 0 ? "better" : "unchanged"}
        </span>
      ) : null);

  return (
    <div className="page">
      <div className="page-header">
        <h2>What-If Simulator</h2>
        <p>Adjust real EngineFaultDB feature values and the diagnosis model actually re-runs. Before/after values are never hardcoded.</p>
      </div>

      <div className="dgx-note">
        <InfoBox>
          The sliders change input features of the EngineFaultDB fault classifier for one sampled operating
          point. This is a model what-if, not a physical simulation of a vehicle. Fault classes 1–3 are
          unnamed in the source dataset.
        </InfoBox>
      </div>

      <div className="pill-row dgx-toolbar">
        <button className="btn btn-primary btn-sm" onClick={drawSample} disabled={loading}>
          <RefreshCw size={13} className={loading ? "spin" : ""} aria-hidden="true" /> New sample
        </button>
        {PRESETS.map(p => (
          <button key={p.label} className="btn btn-sm" onClick={() => applyPreset(p)} disabled={!base}>
            <p.icon size={13} aria-hidden="true" /> {p.label}
          </button>
        ))}
        <button className="btn btn-sm" onClick={reset} disabled={!base}><RotateCcw size={13} aria-hidden="true" /> Reset</button>
      </div>

      {loading && <Loading />}
      {error && <div role="alert" className="dgx-note"><ErrorBox message={error} /></div>}

      {base && (
        <div className="wi-layout">
          <Card title="Adjust Parameters">
            <div className="wi-sliders">
              {Object.entries(base).map(([k, v], idx) => {
                const [lo, hi] = FEATURE_RANGES[k] || [0, v * 2 || 100];
                const isActive = lastChanged === k;
                const id = `wi-slider-${idx}`;
                const pct = hi > lo ? Math.max(0, Math.min(100, ((Number(values[k]) - lo) / (hi - lo)) * 100)) : 0;
                return (
                  <div className="slider-row" key={k}>
                    <div className="slider-head">
                      <label htmlFor={id} className={isActive ? "is-active" : undefined}>{k}</label>
                      <span className="val">{Number(values[k]).toFixed(2)}</span>
                    </div>
                    <input
                      id={id}
                      type="range"
                      min={lo}
                      max={hi}
                      step={(hi - lo) / 200}
                      value={values[k]}
                      style={{ "--p": `${pct}%` }}
                      onChange={e => onChange(k, parseFloat(e.target.value))}
                    />
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="wi-results">
            <Card title="Before">
              {before ? (
                <>
                  <div className="dgx-primary dgx-primary-sm">{before.predicted_label}</div>
                  <div className="pill-row">
                    <Badge status={before.severity === "NONE" ? "NORMAL" : before.severity}>{before.severity}</Badge>
                    <Badge status="info">{(before.confidence * 100).toFixed(1)}% conf.</Badge>
                  </div>
                </>
              ) : <p className="wi-hint">Adjust a slider or apply a preset to run the comparison.</p>}
            </Card>

            <Card title="After" right={afterRight}>
              {after ? (
                <>
                  <div className="dgx-primary dgx-primary-sm">{after.predicted_label}</div>
                  <div className="pill-row" style={{ marginBottom: 12 }}>
                    <Badge status={after.severity === "NONE" ? "NORMAL" : after.severity}>{after.severity}</Badge>
                    <Badge status="info">{(after.confidence * 100).toFixed(1)}% conf.</Badge>
                  </div>
                  <div className="section-label">Top 3 (after)</div>
                  <TopFaults items={after.top3} />
                </>
              ) : <p className="wi-hint">—</p>}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}