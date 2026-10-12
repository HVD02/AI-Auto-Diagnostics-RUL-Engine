import React, { useEffect, useState } from "react";
import { RefreshCw, ArrowUp, ArrowDown, Minus, Flame, Wind, RotateCcw } from "lucide-react";
import { Card, Loading, Badge } from "../components/ui.jsx";
import { diagnoseSample, whatIfDiagnosis } from "../api";

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

function DeltaIcon({ before, after }) {
  if (after > before) return <ArrowUp size={12} color="var(--crit)" />;
  if (after < before) return <ArrowDown size={12} color="var(--ok)" />;
  return <Minus size={12} color="var(--text-2)" />;
}

export default function WhatIf() {
  const [base, setBase] = useState(null);
  const [values, setValues] = useState({});
  const [before, setBefore] = useState(null);
  const [after, setAfter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastChanged, setLastChanged] = useState(null);

  const drawSample = () => {
    setLoading(true);
    setBefore(null); setAfter(null); setLastChanged(null);
    diagnoseSample().then(d => {
      const { Fault, ...features } = d.sample_features;
      setBase(features);
      setValues(features);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { drawSample(); }, []);

  const rerun = (newValues) => {
    if (!base) return;
    whatIfDiagnosis(base, newValues).then(r => { setBefore(r.before); setAfter(r.after); });
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

  const reset = () => { setLastChanged(null); applyValues(base); setBefore(null); setAfter(null); };

  const severityRank = { NONE: 0, MILD: 1, MODERATE: 2, SEVERE: 3 };
  const severityDelta = before && after ? severityRank[after.severity] - severityRank[before.severity] : 0;

  return (
    <div className="page">
      <div className="page-header">
        <h2>What-If Simulator</h2>
        <p>Adjust real EngineFaultDB feature values and the diagnosis model actually re-runs — before/after values are never hardcoded.</p>
      </div>

      <div className="pill-row" style={{ marginBottom: 14 }}>
        <button className="btn btn-primary btn-sm" onClick={drawSample} disabled={loading}>
          <RefreshCw size={13} className={loading ? "spin" : ""} /> New sample
        </button>
        {PRESETS.map(p => (
          <button key={p.label} className="btn btn-sm" onClick={() => applyPreset(p)} disabled={!base}>
            <p.icon size={13} /> {p.label}
          </button>
        ))}
        <button className="btn btn-sm" onClick={reset} disabled={!base}><RotateCcw size={13} /> Reset</button>
      </div>

      {loading && <Loading />}

      {base && (
        <div className="grid grid-2">
          <Card title="Adjust Parameters">
            {Object.entries(base).map(([k, v]) => {
              const [lo, hi] = FEATURE_RANGES[k] || [0, v * 2 || 100];
              const isActive = lastChanged === k;
              return (
                <div className="slider-row" key={k}>
                  <div className="slider-head">
                    <span style={{ color: isActive ? "var(--accent)" : undefined }}>{k}</span>
                    <span className="val">{Number(values[k]).toFixed(2)}</span>
                  </div>
                  <input type="range" min={lo} max={hi} step={(hi - lo) / 200}
                         value={values[k]} onChange={e => onChange(k, parseFloat(e.target.value))} />
                </div>
              );
            })}
          </Card>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Card title="BEFORE">
              {before ? (
                <>
                  <div className="card-hero" style={{ marginBottom: 8 }}><span className="value" style={{ fontSize: 18 }}>{before.predicted_label}</span></div>
                  <div className="pill-row">
                    <Badge status={before.severity === "NONE" ? "NORMAL" : before.severity}>{before.severity}</Badge>
                    <Badge status="info">{(before.confidence * 100).toFixed(1)}% conf.</Badge>
                  </div>
                </>
              ) : <div style={{ fontSize: 12, color: "var(--text-2)" }}>Adjust a slider or apply a preset to run the comparison.</div>}
            </Card>

            <Card title="AFTER" right={before && after ? (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                <DeltaIcon before={severityRank[before.severity]} after={severityRank[after.severity]} />
                {severityDelta > 0 ? "worse" : severityDelta < 0 ? "better" : "unchanged"}
              </span>
            ) : null}>
              {after ? (
                <>
                  <div className="card-hero" style={{ marginBottom: 8 }}><span className="value" style={{ fontSize: 18 }}>{after.predicted_label}</span></div>
                  <div className="pill-row" style={{ marginBottom: 12 }}>
                    <Badge status={after.severity === "NONE" ? "NORMAL" : after.severity}>{after.severity}</Badge>
                    <Badge status="info">{(after.confidence * 100).toFixed(1)}% conf.</Badge>
                  </div>
                  <div className="section-label">Top 3 (after)</div>
                  <div className="fault-list">
                    {after.top3.map(t => (
                      <div className="fault-row" key={t.class}>
                        <span style={{ fontSize: 12 }}>{t.label}</span>
                        <div className="bar-bg"><div className="bar-fill" style={{ width: `${t.probability * 100}%` }} /></div>
                        <span className="mono" style={{ fontSize: 11 }}>{(t.probability * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <div style={{ fontSize: 12, color: "var(--text-2)" }}>—</div>}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
