import React, { useEffect, useRef, useState } from "react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceDot } from "recharts";
import { RefreshCw } from "lucide-react";
import { Loading, ErrorBox, Badge, InfoBox } from "../components/ui.jsx";
import { ModuleHeader, Panel } from "../components/DiagnosisParts.jsx";
import { getRulUnits, getRul, getModelMetrics } from "../api";
import "./DiagnosisPages.css";
import "./DataPages.css";

const errMsg = (e) => e?.response?.data?.detail || e.message;
const num = (v, d = 1) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(d) : "—");

function CurveTip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="dp-tip">
      <div className="dp-tip-row"><span>Cycle</span><span>{p.cycle}</span></div>
      <div className="dp-tip-row"><span>True RUL</span><span>{p.rul} cycles</span></div>
    </div>
  );
}

export default function RulPrognostics() {
  const [units, setUnits] = useState([]);
  const [unitsError, setUnitsError] = useState(null);
  const [unitId, setUnitId] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const reqId = useRef(0);

  const loadUnits = () => {
    setUnitsError(null);
    getRulUnits()
      .then(d => { setUnits(d.units); setUnitId(d.units[0]); })
      .catch(e => setUnitsError(errMsg(e)));
  };
  useEffect(() => {
    loadUnits();
    let cancelled = false;
    getModelMetrics().then(m => { if (!cancelled) setMetrics(m); }).catch(() => {});
    return () => { cancelled = true; reqId.current += 1; };
  }, []);

  // A request id stops a slow, older unit from overwriting the one the user picked last.
  const load = (uid) => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    getRul(uid)
      .then(r => { if (id === reqId.current) setResult(r); })
      .catch(e => { if (id === reqId.current) setError(errMsg(e)); })
      .finally(() => { if (id === reqId.current) setLoading(false); });
  };
  useEffect(() => { if (unitId !== null && unitId !== undefined) load(unitId); }, [unitId]);

  const curve = result?.degradation_curve
    ? result.degradation_curve.cycle.map((c, i) => ({ cycle: c, rul: result.degradation_curve.true_rul[i] }))
    : [];
  const rulMetrics = metrics?.rul;
  const cap = rulMetrics?.rul_cap ?? 125;
  const r2 = rulMetrics?.test_metrics?.test_r2;
  const diff = result && Number.isFinite(result.predicted_rul_cycles) && Number.isFinite(result.true_rul_cycles_for_reference)
    ? result.predicted_rul_cycles - result.true_rul_cycles_for_reference : null;

  return (
    <div className="page dgx-page">
      <ModuleHeader
        eyebrow="Predict / remaining useful life"
        title="RUL & Prognostics"
        source={<span className="dp-chip dp-chip-warn">NASA C-MAPSS FD001 · aircraft turbofan</span>}
      >
        <p>Remaining Useful Life regression, trained and evaluated on NASA C-MAPSS FD001 run-to-failure data.</p>
      </ModuleHeader>

      <InfoBox>
        RUL validated using NASA turbofan engine degradation data (C-MAPSS FD001). This is NOT passenger-car data —
        it is used here purely to validate an RUL methodology that can later be pointed at automotive run-to-failure data.
      </InfoBox>

      <Panel title="Select engine unit" sub="FD001 test set. These are turbofan engines, not vehicles.">
        {unitsError ? (
          <div className="dgx-error">
            <ErrorBox message={unitsError} />
            <button type="button" className="btn btn-sm" onClick={loadUnits}><RefreshCw size={13} aria-hidden="true" /> Try again</button>
          </div>
        ) : units.length === 0 ? (
          <Loading label="Loading engine units…" />
        ) : (
          <>
            <div className="dp-pills" role="group" aria-label="Engine units">
              {units.slice(0, 20).map(u => (
                <button type="button" key={u} className={`btn btn-sm ${u === unitId ? "btn-primary" : ""}`} aria-pressed={u === unitId} onClick={() => setUnitId(u)}>
                  Unit {u}
                </button>
              ))}
            </div>
            {units.length > 20 && <p className="dgx-cap">Showing the first 20 of {units.length} test units.</p>}
          </>
        )}
      </Panel>

      {loading && <Loading label="Running RUL model…" />}
      {error && (
        <div className="dgx-error">
          <ErrorBox message={error} />
          <button type="button" className="btn btn-sm" onClick={() => load(unitId)}><RefreshCw size={13} aria-hidden="true" /> Try again</button>
        </div>
      )}

      {result && (
        <div className={`dp-body${loading ? " is-busy" : ""}`}>
          <section className="dp-stats" aria-label="RUL summary">
            <article className="dp-stat">
              <h2>PREDICTED RUL</h2>
              <div className="dp-stat-value">{result.predicted_rul_cycles}<small>cycles</small></div>
              <div className="dp-cap">Model output for unit {result.unit_id}</div>
            </article>
            <article className="dp-stat">
              <h2>DEGRADATION STAGE</h2>
              <div className="dp-stat-foot"><Badge status={result.degradation_stage === "HEALTHY" ? "NORMAL" : result.degradation_stage} /></div>
              <div className="dp-cap">As returned by the RUL pipeline</div>
            </article>
            <article className="dp-stat">
              <h2>MODEL MAE (TEST SET)</h2>
              <div className="dp-stat-value">{num(result.model_test_mae, 1)}<small>cycles</small></div>
              <div className="dp-cap">Benchmark on held-out engines, not a per-unit error</div>
            </article>
            <article className="dp-stat">
              <h2>CURRENT CYCLE</h2>
              <div className="dp-stat-value">{result.current_cycle}</div>
              <div className="dp-cap">Cycle the prediction is made at</div>
            </article>
          </section>

          <Panel title={`Degradation curve · Unit ${result.unit_id}`} sub="Actual (ground-truth) trajectory with the model's prediction">
            <div className="dp-chart" role="img" aria-label={`True RUL against cycle for unit ${result.unit_id}, with the predicted RUL of ${result.predicted_rul_cycles} cycles at cycle ${result.current_cycle}`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={curve} margin={{ top: 8, right: 12, bottom: 14, left: 0 }}>
                  <CartesianGrid stroke="var(--line-soft)" strokeDasharray="3 6" vertical={false} />
                  <XAxis dataKey="cycle" tick={{ fill: "var(--text-1)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--line)" }} minTickGap={36}
                    label={{ value: "cycle", position: "insideBottom", offset: -8, fill: "var(--text-2)", fontSize: 11 }} />
                  <YAxis width={44} tick={{ fill: "var(--text-1)", fontSize: 11 }} tickLine={false} axisLine={false}
                    label={{ value: `true RUL (capped ${cap})`, angle: -90, position: "insideLeft", fill: "var(--text-2)", fontSize: 11 }} />
                  <Tooltip content={<CurveTip />} cursor={{ stroke: "var(--accent)", strokeOpacity: 0.45 }} />
                  <Line type="monotone" dataKey="rul" stroke="var(--accent)" dot={false} strokeWidth={1.8} isAnimationActive={false} />
                  <ReferenceDot x={result.current_cycle} y={result.predicted_rul_cycles} r={5} fill="var(--crit)" stroke="var(--bg-1)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="dgx-cap">Red dot = the model's predicted RUL at the currently selected cycle, plotted against the unit's actual (ground-truth) degradation trajectory.</p>
          </Panel>

          <div className="dp-row">
            <Panel title="Actual vs predicted" sub="Reference comparison at this cycle">
              <dl className="dp-kv">
                <div><dt>Predicted RUL</dt><dd className="mono">{result.predicted_rul_cycles} cycles</dd></div>
                <div><dt>True RUL at this point</dt><dd className="mono">{result.true_rul_cycles_for_reference} cycles</dd></div>
                {diff !== null && <div><dt>Difference (predicted − true)</dt><dd className="mono">{diff > 0 ? "+" : ""}{diff.toFixed(1)} cycles</dd></div>}
                <div><dt>Model</dt><dd className="mono">{result.model_used}</dd></div>
              </dl>
            </Panel>
            <Panel title="Prediction uncertainty" sub="How to read the number">
              <p className="dp-copy">
                Test-set MAE of {num(result.model_test_mae, 1)} cycles{typeof r2 === "number" ? ` (R² ≈ ${r2.toFixed(2)})` : ""} means predictions
                for engines with a true RUL over roughly 40–50 cycles should be read as directional trend
                signals rather than precise countdowns.
              </p>
              {rulMetrics?.split_strategy && <p className="dgx-cap">Evaluation split: {rulMetrics.split_strategy}.</p>}
              <p className="dgx-cap">The RUL model has not been validated on passenger cars.</p>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}