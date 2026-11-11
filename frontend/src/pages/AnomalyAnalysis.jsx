import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import { HeartPulse, ShieldCheck, Boxes, Stethoscope, Wrench, ArrowUpRight } from "lucide-react";
import { Loading, ErrorBox, Badge, InfoBox, Empty } from "../components/ui.jsx";
import { ModuleHeader, Panel } from "../components/DiagnosisParts.jsx";
import { useAnalysis } from "../useAnalysis.js";
import "./DiagnosisPages.css";
import "./AnalyticsPages.css";

const RANGES = [300, 100];
const BAND_WORD = { ok: "Within normal range", warn: "Elevated", mod: "Moderate deviation", crit: "Strong deviation" };

// Same deviation bands the Digital Twin page uses for z-scores.
function bandFromZ(z) {
  if (z < 1) return "ok";
  if (z < 1.8) return "warn";
  if (z < 2.6) return "mod";
  return "crit";
}

function statusTone(status) {
  if (status === "NORMAL") return "ok";
  if (status === "WARNING") return "warn";
  if (status === "CRITICAL") return "crit";
  return "neutral";
}

const fmt = (v, d = 1) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(d) : "—");

function TimelineTip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="an-tip">
      <div className="an-tip-time">{p.t !== undefined && p.t !== null ? String(p.t) : `Sample ${p.i}`}</div>
      <div className="an-tip-row"><span>Sample</span><span>{p.i}</span></div>
      <div className="an-tip-row"><span>Relative intensity</span><span>{fmt(p.v, 1)}</span></div>
    </div>
  );
}

export default function AnomalyAnalysis() {
  const { data, loading, error, vehicleId, isUpload } = useAnalysis();
  const [range, setRange] = useState("all");

  const an = data?.anomaly;
  const scores = Array.isArray(an?.timeline_scores) ? an.timeline_scores : [];
  const stamps = Array.isArray(an?.timestamps) ? an.timestamps : null;
  const timeline = useMemo(
    () => scores.map((v, i) => ({ i, v, t: stamps ? stamps[i] : undefined })),
    [an] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Display window only: slices what is drawn, never the underlying values.
  const rangeOptions = RANGES.filter(n => n < timeline.length);
  const activeRange = rangeOptions.includes(range) ? range : "all";
  const visible = activeRange === "all" ? timeline : timeline.slice(-activeRange);
  const stats = useMemo(() => {
    if (!visible.length) return null;
    let peak = visible[0];
    let sum = 0;
    for (const p of visible) { if (p.v > peak.v) peak = p; sum += p.v; }
    return { peak, mean: sum / visible.length };
  }, [visible]);

  const contributors = Array.isArray(an?.top_contributors) ? an.top_contributors : [];
  const maxZ = contributors.length ? (Math.max(...contributors.map(c => Math.abs(Number(c.z_score)))) || 1) : 1;
  const ratio = an?.anomaly_ratio;
  const pct = typeof ratio === "number" ? ratio * 100 : null;
  const derivedFlagged = typeof ratio === "number" && timeline.length ? Math.round(ratio * timeline.length) : null;
  const tone = statusTone(an?.status);

  return (
    <div className="page dgx-page">
      <ModuleHeader
        eyebrow="Investigate / anomaly detection"
        title="Anomaly Analysis"
        source={
          <span className={`an-source ${isUpload ? "is-upload" : "is-demo"}`}>
            <span className="an-source-dot" aria-hidden="true" />
            {isUpload ? "Your uploaded telemetry" : "Synthetic demo telemetry"}
          </span>
        }
      >
        <p>
          One-class anomaly detection (Local Outlier Factor / Isolation Forest / One-Class SVM benchmark, per
          the EngineAD paper's own protocol).
          {an?.model_used && <> Model used for this analysis: <span className="mono">{an.model_used}</span>.</>}
        </p>
      </ModuleHeader>

      {loading && <Loading label="Running diagnostic pipeline…" />}
      {error && <ErrorBox message={error} />}

      {data && an && (
        <div className="an-body">
          {/* ---------- overview ---------- */}
          <section className="an-stats" aria-label="Anomaly overview">
            <article className="an-stat">
              <h2>ANOMALY SCORE</h2>
              <div className={`an-stat-value an-tone-${tone}`}>{fmt(pct, 1)}<small>% flagged</small></div>
              <div className="an-stat-foot"><Badge status={an.status} /></div>
            </article>
            <article className="an-stat">
              <h2>ANALYSED WINDOW</h2>
              <div className="an-stat-value">{timeline.length || "—"}<small>samples</small></div>
              <div className="an-stat-foot an-cap">
                {derivedFlagged !== null
                  ? `≈ ${derivedFlagged} flagged, ${timeline.length - derivedFlagged} normal (derived from the flagged share)`
                  : "Sample counts unavailable"}
              </div>
            </article>
            <article className="an-stat">
              <h2>DETECTOR</h2>
              <div className="an-stat-value an-stat-model mono">{an.model_used ?? "—"}</div>
              <div className="an-stat-foot an-cap">Trained one-class on the healthy scenario.</div>
            </article>
            <article className="an-stat">
              <h2>MULTI-SENSOR CONFIRMATION</h2>
              <div className="an-stat-foot an-cap an-cap-lg">
                {contributors.length > 1
                  ? `${contributors.length} sensors show elevated deviation simultaneously — reduces the chance this is a single noisy channel.`
                  : contributors.length === 1
                    ? "Only one sensor shows elevated deviation — treat with more caution (see Sensor Analytics)."
                    : "No contributing sensors were returned."}
              </div>
            </article>
          </section>

          {/* ---------- timeline + contributors ---------- */}
          <div className="an-row">
            <Panel
              title="Anomaly intensity timeline"
              sub="Relative intensity across the analysed window"
              right={<span className="mono an-meta">{timeline.length} samples</span>}
              className="an-timeline"
            >
              {timeline.length === 0 ? (
                <Empty label="No timeline data in this analysis." />
              ) : (
                <>
                  {rangeOptions.length > 0 && (
                    <div className="an-seg" role="group" aria-label="Sample window shown in the chart">
                      <button type="button" className={activeRange === "all" ? "is-active" : ""} aria-pressed={activeRange === "all"} onClick={() => setRange("all")}>All {timeline.length}</button>
                      {rangeOptions.map(n => (
                        <button type="button" key={n} className={activeRange === n ? "is-active" : ""} aria-pressed={activeRange === n} onClick={() => setRange(n)}>Last {n}</button>
                      ))}
                    </div>
                  )}
                  <div
                    className="an-chart"
                    role="img"
                    aria-label={`Anomaly intensity over ${visible.length} samples. Peak ${fmt(stats?.peak.v, 1)} at sample ${stats?.peak.i}; mean ${fmt(stats?.mean, 1)}.`}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={visible} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id="an-fill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" style={{ stopColor: "var(--accent)", stopOpacity: 0.3 }} />
                            <stop offset="100%" style={{ stopColor: "var(--accent)", stopOpacity: 0.02 }} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="var(--line-soft)" strokeDasharray="3 6" vertical={false} />
                        <XAxis dataKey="i" tick={{ fill: "var(--text-1)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--line)" }} minTickGap={48} />
                        <YAxis width={32} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: "var(--text-1)", fontSize: 11 }} tickLine={false} axisLine={false} />
                        <Tooltip content={<TimelineTip />} cursor={{ stroke: "var(--accent)", strokeOpacity: 0.45 }} />
                        <ReferenceLine y={60} stroke="var(--crit)" strokeDasharray="4 4" />
                        <Area type="monotone" dataKey="v" stroke="var(--accent)" strokeWidth={1.8} fill="url(#an-fill)" dot={false} activeDot={{ r: 3.5, fill: "var(--accent)", stroke: "var(--bg-1)" }} isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  {stats && (
                    <dl className="an-mini">
                      <div><dt>Peak</dt><dd>{fmt(stats.peak.v, 1)} <span>at sample {stats.peak.i}</span></dd></div>
                      <div><dt>Mean</dt><dd>{fmt(stats.mean, 1)}</dd></div>
                      <div><dt>Shown</dt><dd>{visible.length} <span>of {timeline.length}</span></dd></div>
                    </dl>
                  )}
                  <p className="dgx-cap">
                    X axis: sample index (hover for the recorded timestamp). Intensity is relative, scaled 0–100
                    within the analysed window, so even a healthy window spans the full range. The response
                    does not mark individual flagged samples, so none are marked. The dashed line at 60 is a
                    display reference carried over from the original chart.
                  </p>
                </>
              )}
            </Panel>

            <Panel title="Top contributing sensors" sub="Which sensors deviate most in this window" className="an-contrib">
              {contributors.length === 0 ? (
                <Empty label="No sensor contributions in this analysis." />
              ) : (
                <ol className="an-rank">
                  {contributors.map((c, i) => {
                    const z = Number(c.z_score);
                    const band = Number.isFinite(z) ? bandFromZ(Math.abs(z)) : null;
                    const rel = Number.isFinite(z) ? Math.round((Math.abs(z) / maxZ) * 100) : null;
                    return (
                      <li key={c.sensor}>
                        <span className="an-rank-n mono" aria-hidden="true">{i + 1}</span>
                        <span className="an-rank-main">
                          <span className="mono an-rank-name">{c.sensor}</span>
                          {band && <Badge status={band}>{BAND_WORD[band]}</Badge>}
                        </span>
                        <span className="an-track" aria-hidden="true"><i style={{ width: `${rel ?? 0}%` }} /></span>
                        <span className="an-rank-val">
                          <b className="mono">z = {c.z_score}</b>
                          {rel !== null && <small>{rel}% of strongest</small>}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
              <p className="dgx-cap">
                Mean absolute z-score of each sensor within the analysed window, as returned by the anomaly
                pipeline. "% of strongest" and the bands (the same rule as the Digital Twin) are derived from
                those values. These are <b>anomaly z-scores</b>, not SHAP values from the fault-diagnosis model, and
                they do not prove that a component has failed.
              </p>
            </Panel>
          </div>

          {/* ---------- interpretation + navigation ---------- */}
          <div className="an-row an-row-b">
            <Panel title="Interpretation" sub="What the detector found, and what it cannot establish">
              <ul className="an-notes">
                <li>
                  {pct !== null ? <><b>{fmt(pct, 1)}%</b> of the analysed window was flagged (status <b>{an.status}</b>)</> : <>The flagged share is unavailable</>}
                  {an.model_used ? <> by <span className="mono">{an.model_used}</span>.</> : "."}
                </li>
                {contributors.length > 0 && (
                  <li>
                    The sensors that deviated most from their own typical behaviour:{" "}
                    <span className="mono">{contributors.map(c => `${c.sensor} (z=${c.z_score})`).join(", ")}</span>.
                  </li>
                )}
                <li>Anomaly intensity is a relative score within this window: higher means more unusual compared with the rest of the same window.</li>
                <li>A flag is a signal to investigate, not a diagnosis. It does not show which component is at fault or why the readings deviated.</li>
              </ul>
              <p className="dgx-cap">
                {isUpload ? "This analysis uses your uploaded telemetry." : "This analysis uses synthetic demo telemetry, not data from a real vehicle."}
                {vehicleId ? <> Active vehicle: <span className="mono">{vehicleId}</span>.</> : null}
              </p>
            </Panel>

            <Panel title="Investigate next" sub="Existing pages that go deeper">
              <ul className="an-links">
                <li><Link to="/sensors"><ShieldCheck size={15} aria-hidden="true" /><span><b>Sensor Analytics</b><small>Inspect the raw signals behind these scores</small></span><ArrowUpRight size={14} aria-hidden="true" /></Link></li>
                <li><Link to="/health"><HeartPulse size={15} aria-hidden="true" /><span><b>Vehicle Health</b><small>How this result feeds the health score</small></span><ArrowUpRight size={14} aria-hidden="true" /></Link></li>
                <li><Link to="/twin"><Boxes size={15} aria-hidden="true" /><span><b>Digital Twin</b><small>Component view coloured by these deviations</small></span><ArrowUpRight size={14} aria-hidden="true" /></Link></li>
                <li><Link to="/diagnostics"><Stethoscope size={15} aria-hidden="true" /><span><b>Diagnostics</b><small>Fault classification on EngineFaultDB samples</small></span><ArrowUpRight size={14} aria-hidden="true" /></Link></li>
                <li><Link to="/maintenance"><Wrench size={15} aria-hidden="true" /><span><b>Maintenance Center</b><small>Documented checks, not a diagnosis</small></span><ArrowUpRight size={14} aria-hidden="true" /></Link></li>
              </ul>
            </Panel>
          </div>

          <InfoBox>
            False-alarm analysis: the EngineAD benchmark paper reports F1 scores in the 0.2–0.9 range depending
            on the vehicle, meaning even the best classical models miss some anomalies or raise some false alarms.
            Treat any single-window flag as a signal to investigate, not a certain diagnosis.
          </InfoBox>
        </div>
      )}
    </div>
  );
}