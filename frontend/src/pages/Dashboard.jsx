import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  LineChart, Line, AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import {
  Wrench, UploadCloud, Cpu, FileText, ShieldCheck, ExternalLink, HeartPulse, Activity,
  Database, RefreshCw, ArrowUpRight,
} from "lucide-react";
import { Badge, Loading, Empty, ErrorBox, InfoBox } from "../components/ui.jsx";
import { useAnalysis } from "../useAnalysis.js";
import { useVehicle } from "../VehicleContext.jsx";
import { getModelMetrics, getTelemetry, getCurrentUploadTelemetry } from "../api";
import "./Dashboard.css";

const SENSOR_FAULT = "LIKELY_SENSOR_FAULT";
const RANGES = [300, 100];

// Same 10 channels as the Sensor Analytics page. Colours come from theme tokens.
const SENSORS = {
  rpm: { label: "RPM", unit: "rpm", digits: 0, color: "var(--accent)" },
  coolant_temp_c: { label: "Coolant temp", unit: "°C", digits: 1, color: "var(--aqua)" },
  throttle_pos_pct: { label: "Throttle", unit: "%", digits: 1, color: "var(--violet)" },
  oil_pressure_kpa: { label: "Oil pressure", unit: "kPa", digits: 0, color: "var(--orange)" },
  engine_load_pct: { label: "Engine load", unit: "%", digits: 1, color: "var(--chart-4)" },
  intake_temp_c: { label: "Intake temp", unit: "°C", digits: 1, color: "var(--chart-5)" },
  fuel_rate_lph: { label: "Fuel rate", unit: "L/h", digits: 2, color: "var(--chart-6)" },
  vibration_g: { label: "Vibration", unit: "g", digits: 3, color: "var(--chart-8)" },
  battery_voltage_v: { label: "Battery", unit: "V", digits: 2, color: "var(--chart-9)" },
  speed_kph: { label: "Speed", unit: "km/h", digits: 0, color: "var(--chart-10)" },
};
const DEFAULT_SELECTED = ["rpm", "coolant_temp_c", "throttle_pos_pct"];

function fmt(value, digits = 1) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function humanize(key) {
  return String(key).replace(/_/g, " ");
}

function flowchartUrl(file) {
  // main.py mounts the Automotive_Faults data folder at /static/flowcharts
  // and vite.config.js proxies /static to the backend.
  return `/static/flowcharts/${encodeURIComponent(file)}`;
}

function flagReasons(flags, sensor) {
  const f = flags && flags[sensor];
  if (!f) return [];
  const reasons = [];
  if (f.stuck) reasons.push("stuck signal");
  if (f.out_of_physical_range) reasons.push("outside physical range");
  return reasons;
}

// Same thresholds the shared Gauge uses for its colour.
function scoreTone(score) {
  if (score >= 70) return "ok";
  if (score >= 50) return "warn";
  if (score >= 25) return "mod";
  return "crit";
}

// Anomaly status -> visual tone (same words the shared Badge understands).
function statusTone(status) {
  if (status === "NORMAL") return "ok";
  if (status === "WARNING") return "warn";
  if (status === "CRITICAL") return "crit";
  return "neutral";
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */
function PanelHead({ title, sub, right }) {
  return (
    <div className="dv2-panel-head">
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {right}
    </div>
  );
}

function Ring({ value, size, stroke, tone, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, Number(value) || 0)) / 100;
  const mid = size / 2;
  return (
    <div className="dv2-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
        <circle className="dv2-ring-track" cx={mid} cy={mid} r={r} strokeWidth={stroke} />
        <circle
          className={`dv2-ring-val dv2-stroke-${tone}`}
          cx={mid} cy={mid} r={r} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${mid} ${mid})`}
        />
      </svg>
      <div className="dv2-ring-label">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tooltips                                                            */
/* ------------------------------------------------------------------ */
function TimelineTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="dv2-tip">
      <div className="dv2-tip-time">{p.t !== undefined && p.t !== null ? String(p.t) : `Sample ${p.i}`}</div>
      <div className="dv2-tip-row"><span>Sample</span><span>{p.i}</span></div>
      <div className="dv2-tip-row"><span>Relative intensity</span><span>{fmt(p.v, 1)}</span></div>
    </div>
  );
}

function SignalTooltip({ active, payload, selected }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="dv2-tip">
      <div className="dv2-tip-time">{p.t !== undefined && p.t !== null ? String(p.t) : `Sample ${p.i}`}</div>
      <div className="dv2-tip-row"><span>Sample</span><span>{p.i}</span></div>
      {selected.map(s => (
        <div className="dv2-tip-row" key={s}>
          <span><i className="dv2-dot" style={{ background: SENSORS[s].color }} />{SENSORS[s].label}</span>
          <span>{fmt(p.raw[s], SENSORS[s].digits)} {SENSORS[s].unit}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Telemetry panel: raw sensor signals + anomaly intensity             */
/* ------------------------------------------------------------------ */
function useTelemetry(isUpload, vehicleId, filename) {
  const [tel, setTel] = useState({ status: "loading", data: null, error: null });
  useEffect(() => {
    let cancelled = false;
    setTel({ status: "loading", data: null, error: null });
    const req = isUpload
      ? getCurrentUploadTelemetry()
      : (vehicleId ? getTelemetry(vehicleId) : Promise.reject(new Error("no vehicle selected")));
    req
      .then(d => { if (!cancelled) setTel({ status: "ok", data: d, error: null }); })
      .catch(e => {
        if (!cancelled) setTel({ status: "error", data: null, error: e?.response?.data?.detail || e.message });
      });
    return () => { cancelled = true; };
  }, [isUpload, vehicleId, filename]);
  return tel;
}

function TelemetryPanel({ analysis, tel }) {
  const [view, setView] = useState("signals");
  const [range, setRange] = useState("all");
  const [selected, setSelected] = useState(DEFAULT_SELECTED);

  const telOk = tel.status === "ok" && Array.isArray(tel.data?.t);
  const available = useMemo(
    () => (telOk ? Object.keys(SENSORS).filter(s => Array.isArray(tel.data[s])) : []),
    [telOk, tel.data]
  );
  const activeSelected = selected.filter(s => available.includes(s));

  const activeView = tel.status === "error" ? "anomaly" : view;

  // anomaly timeline (unchanged data transformation)
  const timeline = useMemo(() => {
    const scores = analysis?.anomaly?.timeline_scores;
    if (!Array.isArray(scores)) return [];
    const stamps = analysis.anomaly.timestamps;
    return scores.map((v, i) => ({ i, v, t: Array.isArray(stamps) ? stamps[i] : undefined }));
  }, [analysis]);

  const total = activeView === "signals" ? (telOk ? tel.data.t.length : 0) : timeline.length;

  // Display window only: slices what is drawn, never the underlying values.
  const rangeOptions = RANGES.filter(n => n < total);
  const activeRange = rangeOptions.includes(range) ? range : "all";

  const visibleTimeline = useMemo(
    () => (activeRange === "all" ? timeline : timeline.slice(-activeRange)),
    [timeline, activeRange]
  );
  const stats = useMemo(() => {
    if (!visibleTimeline.length) return null;
    let peak = visibleTimeline[0];
    let sum = 0;
    for (const p of visibleTimeline) {
      if (p.v > peak.v) peak = p;
      sum += p.v;
    }
    return { peak, mean: sum / visibleTimeline.length };
  }, [visibleTimeline]);

  // Signals: every trace is scaled 0-100 within its own min-max in the visible window so that
  // RPM, temperature and throttle can share one axis. Real values are kept for the tooltip.
  const signal = useMemo(() => {
    if (!telOk || activeSelected.length === 0) return { rows: [], spans: {} };
    const n = tel.data.t.length;
    const start = activeRange === "all" ? 0 : Math.max(0, n - activeRange);
    const spans = {};
    activeSelected.forEach(s => {
      let min = Infinity, max = -Infinity;
      for (let i = start; i < n; i++) {
        const v = tel.data[s][i];
        if (typeof v === "number" && Number.isFinite(v)) { if (v < min) min = v; if (v > max) max = v; }
      }
      spans[s] = { min, max };
    });
    const rows = [];
    for (let i = start; i < n; i++) {
      const row = { i, t: tel.data.t[i], raw: {} };
      activeSelected.forEach(s => {
        const v = tel.data[s][i];
        const { min, max } = spans[s];
        row.raw[s] = v;
        row[s] = typeof v === "number" && Number.isFinite(v) ? (max > min ? ((v - min) / (max - min)) * 100 : 50) : null;
      });
      rows.push(row);
    }
    return { rows, spans };
  }, [telOk, tel.data, activeSelected, activeRange]);

  const toggle = (s) =>
    setSelected(sel => (sel.includes(s) ? sel.filter(x => x !== s) : [...sel, s]));

  const meta = activeView === "signals"
    ? `${signal.rows.length || (telOk ? tel.data.t.length : 0)} samples`
    : `${timeline.length} samples`;

  return (
    <section className="dv2-panel dv2-card dv2-telemetry" aria-label="Telemetry">
      <PanelHead
        title="Telemetry / signal behaviour"
        sub={activeView === "signals"
          ? "Real sensor readings from this analysis, one trace per selected sensor"
          : "Relative anomaly intensity across the analysed window"}
        right={<span className="mono dv2-card-meta">{meta}</span>}
      />

      <div className="dv2-controls">
        <div className="dv2-segmented" role="group" aria-label="Chart view">
          <button
            type="button"
            className={`dv2-seg${activeView === "signals" ? " is-active" : ""}`}
            aria-pressed={activeView === "signals"}
            disabled={tel.status === "error"}
            onClick={() => setView("signals")}
          >
            Sensor signals
          </button>
          <button
            type="button"
            className={`dv2-seg${activeView === "anomaly" ? " is-active" : ""}`}
            aria-pressed={activeView === "anomaly"}
            onClick={() => setView("anomaly")}
          >
            Anomaly intensity
          </button>
        </div>

        {rangeOptions.length > 0 && (
          <div className="dv2-segmented" role="group" aria-label="Sample window shown in the chart">
            <button
              type="button"
              className={`dv2-seg${activeRange === "all" ? " is-active" : ""}`}
              aria-pressed={activeRange === "all"}
              onClick={() => setRange("all")}
            >
              All {total}
            </button>
            {rangeOptions.map(n => (
              <button
                type="button"
                key={n}
                className={`dv2-seg${activeRange === n ? " is-active" : ""}`}
                aria-pressed={activeRange === n}
                onClick={() => setRange(n)}
              >
                Last {n}
              </button>
            ))}
          </div>
        )}
      </div>

      {tel.status === "error" && (
        <p className="dv2-cap dv2-cap-warn">
          Raw sensor telemetry could not be loaded ({String(tel.error)}), so only the anomaly
          intensity view is available.
        </p>
      )}

      {activeView === "signals" && tel.status === "loading" && <Loading label="Loading sensor telemetry…" />}

      {activeView === "signals" && telOk && (
        <>
          <div className="dv2-legend" role="group" aria-label="Sensors shown in the chart">
            {available.map(s => {
              const on = activeSelected.includes(s);
              return (
                <button
                  type="button"
                  key={s}
                  className={`dv2-legend-item${on ? " is-on" : ""}`}
                  aria-pressed={on}
                  onClick={() => toggle(s)}
                  style={{ "--sensor": SENSORS[s].color }}
                >
                  <i aria-hidden="true" />
                  {SENSORS[s].label}
                </button>
              );
            })}
          </div>

          {activeSelected.length === 0 ? (
            <Empty label="Select at least one sensor to draw its trace." />
          ) : (
            <>
              <div
                className="dv2-chart"
                role="img"
                aria-label={`Signal traces for ${activeSelected.map(s => SENSORS[s].label).join(", ")} over ${signal.rows.length} samples, each scaled to its own range.`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={signal.rows} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="var(--line-soft)" strokeDasharray="3 6" vertical={false} />
                    <XAxis
                      dataKey="i"
                      tick={{ fill: "var(--text-1)", fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: "var(--line)" }}
                      minTickGap={48}
                    />
                    <YAxis
                      width={40}
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      tickFormatter={v => `${v}%`}
                      tick={{ fill: "var(--text-1)", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      content={<SignalTooltip selected={activeSelected} />}
                      cursor={{ stroke: "var(--accent)", strokeOpacity: 0.45 }}
                    />
                    {activeSelected.map(s => (
                      <Line
                        key={s}
                        type="monotone"
                        dataKey={s}
                        stroke={SENSORS[s].color}
                        strokeWidth={1.8}
                        dot={false}
                        activeDot={{ r: 3.5, stroke: "var(--bg-1)" }}
                        isAnimationActive={false}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <ul className="dv2-spans" aria-label="Value range of each shown sensor in this window">
                {activeSelected.map(s => (
                  <li key={s}>
                    <i className="dv2-dot" style={{ background: SENSORS[s].color }} aria-hidden="true" />
                    <span>{SENSORS[s].label}</span>
                    <b className="mono">
                      {fmt(signal.spans[s]?.min, SENSORS[s].digits)} – {fmt(signal.spans[s]?.max, SENSORS[s].digits)} {SENSORS[s].unit}
                    </b>
                  </li>
                ))}
              </ul>

              <p className="dv2-cap">
                Each trace is scaled 0–100% within its own minimum and maximum in the window shown
                (x-axis: sample index), so different units can share one chart. Hover for the real
                values. A deviation is a pattern to inspect, not proof of a fault.
              </p>
            </>
          )}
        </>
      )}

      {activeView === "anomaly" && (
        timeline.length === 0 ? (
          <Empty label="No timeline data in this analysis." />
        ) : (
          <>
            <div
              className="dv2-chart"
              role="img"
              aria-label={`Anomaly intensity over ${visibleTimeline.length} samples. Peak ${fmt(stats?.peak.v, 1)} at sample ${stats?.peak.i}; mean ${fmt(stats?.mean, 1)}.`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={visibleTimeline} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="dv2-timeline-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" style={{ stopColor: "var(--accent)", stopOpacity: 0.3 }} />
                      <stop offset="100%" style={{ stopColor: "var(--accent)", stopOpacity: 0.02 }} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--line-soft)" strokeDasharray="3 6" vertical={false} />
                  <XAxis
                    dataKey="i"
                    tick={{ fill: "var(--text-1)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--line)" }}
                    minTickGap={48}
                  />
                  <YAxis
                    width={32}
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    tick={{ fill: "var(--text-1)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={<TimelineTooltip />}
                    cursor={{ stroke: "var(--accent)", strokeOpacity: 0.45 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke="var(--accent)"
                    strokeWidth={1.8}
                    fill="url(#dv2-timeline-fill)"
                    dot={false}
                    activeDot={{ r: 3.5, fill: "var(--accent)", stroke: "var(--bg-1)" }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {stats && (
              <dl className="dv2-stats">
                <div><dt>Peak</dt><dd>{fmt(stats.peak.v, 1)} <span>at sample {stats.peak.i}</span></dd></div>
                <div><dt>Mean</dt><dd>{fmt(stats.mean, 1)}</dd></div>
                <div><dt>Shown</dt><dd>{visibleTimeline.length} <span>of {timeline.length}</span></dd></div>
              </dl>
            )}

            <p className="dv2-cap">
              Relative intensity, scaled 0–100 within the analysed window (x-axis: sample index). It
              is not an absolute fault level, so even a healthy window spans the full range.
            </p>
          </>
        )
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Diagnostic readout                                                  */
/* ------------------------------------------------------------------ */
function DiagnosticReadout({ data, isUpload }) {
  const an = data.anomaly;
  const sf = data.sensor_fault;
  const dq = data.data_quality;
  const tone = statusTone(an.status);
  const sensorFlagged = sf?.verdict === SENSOR_FAULT;
  const flaggedSensors = sf?.flagged_sensors || [];

  return (
    <section className="dv2-panel dv2-card dv2-readout" aria-label="Diagnostic readout">
      <PanelHead
        title="Diagnostic readout"
        sub="What deserves attention first"
        right={<Badge status={an.status} />}
      />

      <div className={`dv2-flagcard dv2-tint-${tone}`}>
        <div className="dv2-flagcard-top">
          <span>ANOMALY PATTERN</span>
          <b>{an.status}</b>
        </div>
        <h3>{fmt(an.anomaly_ratio * 100, 0)}% of the analysed window is flagged</h3>
        <p>
          Start with the sensors that deviate most (see Feature contributions below). An anomaly
          score is a relative statistic for this window. It is not proof that a physical component
          has failed.
        </p>
      </div>

      <dl className="dv2-meta">
        <div><dt>Window size</dt><dd>{dq.n_rows} rows</dd></div>
        <div><dt>Analysis mode</dt><dd>{isUpload ? "Your upload" : "Synthetic demo"}</dd></div>
        <div><dt>Anomaly model</dt><dd className="mono dv2-meta-sm">{an.model_used}</dd></div>
        <div><dt>Sensor check</dt><dd>{sensorFlagged ? "Flagged" : "No faults"}</dd></div>
      </dl>

      <div className="dv2-evidence">
        <div className="dv2-micro">SUPPORTING EVIDENCE</div>
        {sensorFlagged ? (
          <ul className="dv2-flags">
            {flaggedSensors.map(s => (
              <li className="dv2-flag" key={s}>
                <span className="dv2-flag-sensor mono">{s}</span>
                <span className="dv2-flag-why">{flagReasons(sf.sensor_flags, s).join(", ") || "flagged"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="dv2-cap dv2-cap-flush">No sensor faults flagged by the plausibility checks.</p>
        )}
        {sensorFlagged && typeof sf.confidence === "number" && (
          <p className="dv2-cap">Heuristic confidence {fmt(sf.confidence, 2)}</p>
        )}
        {typeof sf?.note === "string" && <p className="dv2-cap">{sf.note}</p>}
      </div>

      <div className="dv2-readout-actions">
        <Link className="btn btn-sm" to="/anomaly">Anomaly analysis <ArrowUpRight size={13} aria-hidden="true" /></Link>
        <Link className="btn btn-sm" to="/sensors">Inspect signals <ArrowUpRight size={13} aria-hidden="true" /></Link>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Lower panels                                                        */
/* ------------------------------------------------------------------ */
function HealthBreakdown({ data }) {
  const health = data.health;
  const tone = scoreTone(health.health_score);
  return (
    <section className="dv2-panel dv2-card dv2-breakdown" aria-label="Health score breakdown">
      <PanelHead title="Health score / anatomy" sub="How the number is formed" right={<span className="dv2-chip">FORMULA</span>} />
      <div className="dv2-break">
        <Ring value={health.health_score} size={88} stroke={8} tone={tone}>
          <strong>{fmt(health.health_score, 0)}</strong>
        </Ring>
        <div className="kv-list dv2-kv">
          <div className="kv-row">
            <span className="k">Starting score</span>
            <span className="v">100</span>
          </div>
          {Object.entries(health.contributions || {}).map(([k, v]) => (
            <div className="kv-row" key={k}>
              <span className="k">
                {humanize(k)}
                {k === "fault_diagnosis" && !data.diagnosis && (
                  <span className="dv2-hint"> · not run for this analysis</span>
                )}
              </span>
              <span className={`v${Number(v) < 0 ? " dv2-neg" : ""}`}>{fmt(Number(v), 1)}</span>
            </div>
          ))}
          <div className="kv-row dv2-total">
            <span className="k">Health score</span>
            <span className="v">{fmt(health.health_score, 1)} · {health.band}</span>
          </div>
        </div>
      </div>
      <div className="dv2-formula mono">{health.formula}</div>
    </section>
  );
}

function FeatureContributions({ an }) {
  const rows = an.top_contributors || [];
  return (
    <section className="dv2-panel dv2-card dv2-contrib" aria-label="Feature contributions">
      <PanelHead title="Explainability / feature contributions" sub="Which sensors deviate most" right={<span className="dv2-chip">Z-SCORE</span>} />
      {rows.length === 0 ? (
        <Empty label="No sensor contributions in this analysis." />
      ) : (
        <ol className="dv2-rank">
          {rows.map((c, idx) => (
            <li className="dv2-rank-row" key={c.sensor}>
              <span className="dv2-rank-n" aria-hidden="true">{idx + 1}</span>
              <span className="mono dv2-contrib-name">{c.sensor}</span>
              <div className="dv2-track" aria-hidden="true">
                <i style={{ width: `${Math.min(100, c.z_score * 40)}%` }} />
              </div>
              <span className="mono dv2-contrib-val">{c.z_score}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="dv2-cap">
        Mean absolute z-score of each sensor within the analysed window. These are anomaly
        contributions, not SHAP values, and they do not prove a component has failed. True SHAP
        explanations for the fault-diagnosis model are on the{" "}
        <Link className="dv2-inline-link" to="/xai">Explainable AI</Link> page.
      </p>
    </section>
  );
}

function NextChecks({ maintenance }) {
  return (
    <section className="dv2-panel dv2-card dv2-maint" aria-label="Suggested next checks">
      <PanelHead
        title="Suggested next checks"
        sub="Knowledge retrieval is not diagnosis"
        right={<Wrench size={15} color="var(--text-2)" aria-hidden="true" />}
      />
      {maintenance.length === 0 ? (
        <>
          <Empty icon={Wrench} label="No maintenance action indicated right now." />
          <p className="dv2-cap dv2-cap-center">
            Entries are retrieved only for a WARNING or CRITICAL anomaly status, or when a sensor
            fault is flagged.
          </p>
        </>
      ) : (
        <>
          <p className="dv2-cap dv2-cap-top">
            Reference entries retrieved from the Automotive Faults dataset by keyword match on the
            anomaly context and top sensors. They are documented checks, not a diagnosis of this
            vehicle.
          </p>
          <ul className="dv2-maint-list">
            {maintenance.map((m, i) => {
              const symptoms = Array.isArray(m.symptoms) ? m.symptoms : [];
              const steps = Array.isArray(m.diagnosis_steps) ? m.diagnosis_steps : [];
              return (
                <li className="dv2-maint-item" key={`${m.category}|${m.subcategory}|${i}`}>
                  <div className="dv2-maint-head">
                    <span className="dv2-maint-cat">{m.category}</span>
                    <span className="dv2-maint-sub">{m.subcategory}</span>
                  </div>
                  {symptoms.length > 0 && (
                    <p className="dv2-maint-symptoms">
                      <span className="dv2-label">Symptoms</span> {symptoms.join(" · ")}
                    </p>
                  )}
                  {steps.length > 0 && (
                    <details className="dv2-steps">
                      <summary>Diagnostic steps ({steps.length})</summary>
                      <ol className="dv2-steps-list">
                        {steps.map((s, si) => (
                          <li key={si}>
                            <span className="dv2-step-text">{s.step}</span>
                            {Array.isArray(s.result) && s.result.length > 0 && (
                              <span className="dv2-step-out">Outcomes: {s.result.join(" / ")}</span>
                            )}
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                  {m.flowchart && (
                    <a
                      className="dv2-flow"
                      href={flowchartUrl(m.flowchart)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open flowchart <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Model evaluation strip, live from /api/model-metrics                */
/* ------------------------------------------------------------------ */
function ModelStrip() {
  const [m, setM] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getModelMetrics()
      .then(d => { if (!cancelled) setM(d); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);

  if (failed) {
    return (
      <section className="dv2-panel dv2-card dv2-models" aria-label="Model evaluation">
        <ErrorBox message="Model metrics could not be loaded from /api/model-metrics." />
      </section>
    );
  }
  if (!m) {
    return (
      <section className="dv2-panel dv2-card dv2-models" aria-label="Model evaluation">
        <Loading label="Loading model evaluation…" />
      </section>
    );
  }

  const an = m.anomaly;
  const anomalyF1 = an?.model_comparison?.[an?.best_model]?.f1;

  return (
    <section className="dv2-panel dv2-card dv2-models" aria-label="Model evaluation">
      <div className="dv2-models-grid">
        <div className="dv2-models-intro">
          <strong><Cpu size={14} aria-hidden="true" /> Model evaluation</strong>
          <small>Benchmark scores, not live vehicle confidence</small>
        </div>
        <div className="dv2-model-metric">
          <b>{fmt(anomalyF1, 2)} <em>F1</em></b>
          <span>Anomaly · {an?.best_model ?? "—"}</span>
          <small>Synthetic demo telemetry</small>
        </div>
        <div className="dv2-model-metric">
          <b>{fmt(m.diagnosis?.test_metrics?.test_f1_macro, 2)} <em>macro-F1</em></b>
          <span>Diagnosis · {m.diagnosis?.best_model ?? "—"}</span>
          <small>EngineFaultDB, held-out test set</small>
        </div>
        <div className="dv2-model-metric">
          <b>{fmt(m.rul?.test_metrics?.test_mae, 1)} <em>cycles MAE</em></b>
          <span>RUL · {m.rul?.best_model ?? "—"}</span>
          <small>NASA C-MAPSS FD001, aircraft turbofan, not passenger cars</small>
        </div>
      </div>
      <p className="dv2-cap">
        These scores describe each model on its own dataset, not its accuracy on your vehicle.{" "}
        <Link className="dv2-inline-link" to="/models">Model Analytics</Link> has the full breakdown.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Upload call-to-action (demo mode only), same workflow as before     */
/* ------------------------------------------------------------------ */
function UploadCTA() {
  const { doUpload, uploading } = useVehicle();
  const fileRef = useRef(null);

  const onPick = (e) => {
    const file = e.target.files[0];
    // doUpload already stores failures in uploadError (shown by App's banner);
    // the catch only prevents an unhandled promise rejection in the console.
    if (file) doUpload(file).catch(() => {});
    e.target.value = "";
  };

  return (
    <section className="dv2-panel dv2-card dv2-upload" aria-label="Analyze your own vehicle">
      <PanelHead
        title="Analyze your own vehicle"
        sub="Switch from synthetic demo data to your telemetry"
        right={<UploadCloud size={15} color="var(--text-2)" aria-hidden="true" />}
      />
      <p className="dv2-copy">
        Everything on this dashboard is currently a synthetic demo scenario. Upload your own
        telemetry CSV and this page, plus Vehicle Health, Anomaly Analysis, Sensor Analytics,
        Digital Twin and Data Quality, will switch to show your vehicle's real numbers instead.
      </p>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
      >
        <UploadCloud size={13} aria-hidden="true" /> {uploading ? "Analyzing…" : "Upload CSV"}
      </button>
      <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={onPick} />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Data limitations & safety                                           */
/* ------------------------------------------------------------------ */
function Limitations({ isUpload }) {
  return (
    <section className="dv2-panel dv2-card dv2-limits" aria-label="Data limitations and safety">
      <PanelHead
        title="Data limitations & safety"
        sub="Read the numbers in context"
        right={<ShieldCheck size={15} color="var(--text-2)" aria-hidden="true" />}
      />
      <ul className="dv2-limit-list">
        {isUpload ? (
          <li>
            Your uploaded telemetry is analysed by the same pipeline as the demo scenarios. Results
            depend on how closely your sensors match the demo telemetry schema.
          </li>
        ) : (
          <li>Demo telemetry is synthetic demonstration data, not real vehicle data.</li>
        )}
        <li>
          The anomaly model was trained on synthetic demo telemetry (real EngineAD fleet data is not
          included), so results on real vehicles are indicative only.
        </li>
        <li>
          RUL estimates use NASA C-MAPSS FD001, which is aircraft turbofan engine data, not
          passenger-car data. The RUL model has not been validated on passenger cars.
        </li>
        <li>
          The anomaly timeline and sensor contributor scores are relative to the analysed window,
          not absolute limits. Sensor-fault verdicts are heuristic plausibility checks.
        </li>
        <li>
          Maintenance entries are retrieved from the Automotive Faults dataset by keyword match.
          They are documented checks, not a diagnosis of this vehicle.
        </li>
        <li>
          This is a diagnostic aid for demonstration and education. It does not replace inspection
          by a certified technician, and should not be the sole basis for a safety-critical
          maintenance decision.
        </li>
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard view                                                      */
/* ------------------------------------------------------------------ */
function DashboardView({ onRerun }) {
  const { data, loading, error, vehicleId, isUpload } = useAnalysis();
  const { dataSource } = useVehicle();
  const tel = useTelemetry(isUpload, vehicleId, dataSource?.filename);

  const health = data?.health;
  const an = data?.anomaly;
  const sf = data?.sensor_fault;
  const dq = data?.data_quality;
  const maintenance = data?.maintenance || [];

  const sensorFlagged = sf?.verdict === SENSOR_FAULT;
  const flaggedSensors = sf?.flagged_sensors || [];

  return (
    <div className={`page dv2${loading ? " dv2-busy" : ""}`} aria-busy={loading}>
      <header className="dv2-head">
        <div className="dv2-head-text">
          <div className="dv2-eyebrow">
            Operational overview / {isUpload ? "your upload" : "demo session"}
          </div>
          <h1 className="dv2-title">Command centre</h1>
          <p className="dv2-sub">
            {isUpload
              ? <>Live pipeline output for your uploaded vehicle <span className="mono">{vehicleId}</span>. Every figure below comes from the running anomaly, data-quality and health-scoring models.</>
              : <>Live pipeline output for demo scenario <span className="mono">{vehicleId}</span>. Every figure below comes from the running anomaly, data-quality and health-scoring models, not a static mock.</>}
          </p>
        </div>
        <div className="dv2-head-side">
          <span className={`dv2-source ${isUpload ? "dv2-source-upload" : "dv2-source-demo"}`}>
            <span className="dv2-source-dot" aria-hidden="true" />
            {isUpload ? "Your uploaded telemetry" : "Synthetic demo telemetry"}
          </span>
          <Link className="btn btn-sm" to="/reports">
            <FileText size={13} aria-hidden="true" /> Reports
          </Link>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onRerun}
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? "spin" : undefined} aria-hidden="true" />
            {loading ? "Running…" : "Run analysis"}
          </button>
        </div>
      </header>

      {loading && <Loading label="Running diagnostic pipeline…" />}
      {error && <ErrorBox message={error} />}

      {data && (
        <div className="dv2-body">
          <InfoBox>{data.source_disclaimer}</InfoBox>

          <section className="dv2-summary" aria-label="Key metrics">
            <article className="dv2-sum-main">
              <Ring value={health.health_score} size={72} stroke={7} tone={scoreTone(health.health_score)}>
                <strong>{fmt(health.health_score, 0)}<small>/100</small></strong>
              </Ring>
              <div
                className="dv2-sum-copy"
                role="meter"
                aria-label="Vehicle health score"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(health.health_score)}
              >
                <h2 className="dv2-micro"><HeartPulse size={12} aria-hidden="true" /> VEHICLE HEALTH INDEX</h2>
                <div className="dv2-sum-band"><Badge status={health.band} /></div>
                <span className="dv2-cap dv2-cap-flush">Documented weighted formula, see anatomy below.</span>
              </div>
            </article>

            <article className="dv2-stat">
              <h2 className="dv2-stat-top"><span>WINDOW FLAGGED</span><Activity size={15} aria-hidden="true" /></h2>
              <div className={`dv2-stat-value dv2-text-${statusTone(an.status)}`}>
                {fmt(an.anomaly_ratio * 100, 0)}<small>% of window</small>
              </div>
              <div className="dv2-stat-foot">
                <Badge status={an.status} />
                <span className="dv2-cap dv2-cap-flush">Model: {an.model_used}</span>
              </div>
            </article>

            <article className="dv2-stat">
              <h2 className="dv2-stat-top"><span>SENSOR INTEGRITY</span><ShieldCheck size={15} aria-hidden="true" /></h2>
              <div className={`dv2-stat-value ${sensorFlagged ? "dv2-text-warn" : "dv2-text-aqua"}`}>
                {sensorFlagged ? "Flagged" : "OK"}
              </div>
              <div className="dv2-stat-foot">
                <Badge status={sensorFlagged ? "WARNING" : "NORMAL"}>
                  {flaggedSensors.length ? flaggedSensors.join(", ") : "No sensor faults"}
                </Badge>
              </div>
            </article>

            <article className="dv2-stat">
              <h2 className="dv2-stat-top"><span>DATA QUALITY</span><Database size={15} aria-hidden="true" /></h2>
              <div className="dv2-stat-value dv2-text-violet">
                {dq.data_quality_score}<small>/100</small>
              </div>
              <div className="dv2-stat-foot dv2-stat-foot-col">
                <span className="dv2-cap dv2-cap-flush">
                  {dq.n_rows} rows · {dq.duplicate_rows} duplicate · {dq.total_outliers} outliers
                </span>
                <span className="dv2-cap dv2-cap-flush">
                  {fmt(dq.missing_pct, 2)}% missing · timestamps {dq.timestamp_monotonic ? "in order" : "out of order"}
                </span>
              </div>
            </article>
          </section>

          <section className="dv2-main-grid" aria-label="Telemetry and diagnostic readout">
            <TelemetryPanel analysis={data} tel={tel} />
            <DiagnosticReadout data={data} isUpload={isUpload} />
          </section>

          <section className="dv2-lower" aria-label="Health breakdown, feature contributions and next checks">
            <HealthBreakdown data={data} />
            <FeatureContributions an={an} />
            <NextChecks maintenance={maintenance} />
          </section>
        </div>
      )}

      <ModelStrip />

      <div className={`dv2-bottom${!isUpload && !loading ? " dv2-bottom-2" : ""}`}>
        {!isUpload && !loading && <UploadCTA />}
        <Limitations isUpload={isUpload} />
      </div>
    </div>
  );
}

// "Run analysis" remounts the view with a new key. That re-runs the existing useAnalysis hook
// (and therefore the real API call) without changing the hook itself.
export default function Dashboard() {
  const [runId, setRunId] = useState(0);
  return <DashboardView key={runId} onRerun={() => setRunId(n => n + 1)} />;
}