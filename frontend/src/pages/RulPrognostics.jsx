import React, { useEffect, useState } from "react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceDot } from "recharts";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { Card, Loading, ErrorBox, Badge, InfoBox } from "../components/ui.jsx";
import { getRulUnits, getRul } from "../api";

export default function RulPrognostics() {
  const [units, setUnits] = useState([]);
  const [unitId, setUnitId] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getRulUnits().then(d => {
      setUnits(d.units);
      setUnitId(d.units[0]);
    });
  }, []);

  const load = (uid) => {
    setLoading(true);
    setError(null);
    getRul(uid).then(setResult).catch(e => setError(e?.response?.data?.detail || e.message)).finally(() => setLoading(false));
  };

  useEffect(() => { if (unitId) load(unitId); }, [unitId]);

  const curve = result?.degradation_curve
    ? result.degradation_curve.cycle.map((c, i) => ({ cycle: c, rul: result.degradation_curve.true_rul[i] }))
    : [];

  return (
    <div className="page">
      <div className="page-header">
        <h2>RUL &amp; Prognostics</h2>
        <p>Remaining Useful Life regression, trained and evaluated on NASA C-MAPSS FD001 run-to-failure data.</p>
      </div>

      <InfoBox>
        RUL validated using NASA turbofan engine degradation data (C-MAPSS FD001). This is NOT passenger-car data —
        it is used here purely to validate an RUL methodology that can later be pointed at automotive run-to-failure data.
      </InfoBox>

      <div style={{ height: 14 }} />

      <Card title="Select engine unit (FD001 test set)">
        <div className="pill-row">
          {units.slice(0, 20).map(u => (
            <button key={u} className={`btn btn-sm ${u === unitId ? "btn-primary" : ""}`} onClick={() => setUnitId(u)}>
              Unit {u}
            </button>
          ))}
        </div>
      </Card>

      <div style={{ height: 14 }} />

      {loading && <Loading label="Running RUL model…" />}
      {error && <ErrorBox message={error} />}

      {result && (
        <>
          <div className="grid grid-4">
            <Card title="Predicted RUL">
              <div className="card-hero"><span className="value">{result.predicted_rul_cycles}</span><span className="unit">cycles</span></div>
            </Card>
            <Card title="Degradation Stage">
              <Badge status={result.degradation_stage === "HEALTHY" ? "NORMAL" : result.degradation_stage} />
            </Card>
            <Card title="Model MAE (test set)">
              <div className="card-hero"><span className="value">{result.model_test_mae.toFixed(1)}</span><span className="unit">cycles</span></div>
            </Card>
            <Card title="Current Cycle">
              <div className="card-hero"><span className="value">{result.current_cycle}</span></div>
            </Card>
          </div>

          <div style={{ height: 14 }} />

          <Card title={`Degradation Curve — Unit ${result.unit_id}`}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={curve}>
                <CartesianGrid stroke="var(--line-soft)" vertical={false} />
                <XAxis dataKey="cycle" tick={{ fill: "var(--text-2)", fontSize: 10 }} label={{ value: "cycle", position: "insideBottom", offset: -3, fill: "var(--text-2)", fontSize: 10 }} />
                <YAxis width={40} tick={{ fill: "var(--text-2)", fontSize: 10 }} label={{ value: "true RUL (capped 125)", angle: -90, position: "insideLeft", fill: "var(--text-2)", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "var(--bg-2)", border: "1px solid var(--line)", fontSize: 12 }} />
                <Line type="monotone" dataKey="rul" stroke="var(--accent)" dot={false} strokeWidth={1.6} />
                <ReferenceDot x={result.current_cycle} y={result.predicted_rul_cycles} r={5} fill="var(--crit)" stroke="none" />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 6 }}>
              Red dot = model's predicted RUL at the currently selected cycle, plotted against the unit's actual (ground-truth) degradation trajectory.
            </div>
          </Card>

          <div style={{ height: 14 }} />
          <div className="grid grid-2">
            <Card title="Actual vs Predicted (reference)">
              <div className="kv-list">
                <div className="kv-row"><span className="k">Predicted RUL</span><span className="v">{result.predicted_rul_cycles} cycles</span></div>
                <div className="kv-row"><span className="k">True RUL at this point</span><span className="v">{result.true_rul_cycles_for_reference} cycles</span></div>
                <div className="kv-row"><span className="k">Model</span><span className="v">{result.model_used}</span></div>
              </div>
            </Card>
            <Card title="Prediction Uncertainty">
              <p style={{ fontSize: 12.5, color: "var(--text-1)", lineHeight: 1.6 }}>
                Test-set MAE of {result.model_test_mae.toFixed(1)} cycles (R² ≈ 0.81) means predictions
                for engines with a true RUL over roughly 40–50 cycles should be read as directional trend
                signals rather than precise countdowns.
              </p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
