import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Search, RefreshCw, ArrowUpRight } from "lucide-react";
import { Loading, ErrorBox, Badge, InfoBox, Empty } from "../components/ui.jsx";
import { ModuleHeader, Panel } from "../components/DiagnosisParts.jsx";
import { useAnalysis } from "../useAnalysis.js";
import { useVehicle } from "../VehicleContext.jsx";
import { getTelemetry, getCurrentUploadTelemetry } from "../api";
import "./DiagnosisPages.css";
import "./AnalyticsPages.css";

// Same ten channels, labels and colours as the original page (units split out of the old labels).
const SENSOR_META = {
  coolant_temp_c: { label: "Coolant Temp", unit: "°C", digits: 1, color: "var(--chart-1)" },
  oil_pressure_kpa: { label: "Oil Pressure", unit: "kPa", digits: 0, color: "var(--chart-2)" },
  rpm: { label: "RPM", unit: "rpm", digits: 0, color: "var(--chart-3)" },
  engine_load_pct: { label: "Engine Load", unit: "%", digits: 1, color: "var(--chart-4)" },
  intake_temp_c: { label: "Intake Temp", unit: "°C", digits: 1, color: "var(--chart-5)" },
  fuel_rate_lph: { label: "Fuel Rate", unit: "L/h", digits: 2, color: "var(--chart-6)" },
  throttle_pos_pct: { label: "Throttle", unit: "%", digits: 1, color: "var(--chart-7)" },
  vibration_g: { label: "Vibration", unit: "g", digits: 3, color: "var(--chart-8)" },
  battery_voltage_v: { label: "Battery", unit: "V", digits: 2, color: "var(--chart-9)" },
  speed_kph: { label: "Speed", unit: "km/h", digits: 0, color: "var(--chart-10)" },
};
const DEFAULT_SELECTED = ["coolant_temp_c", "oil_pressure_kpa"];
const RANGES = [300, 100];
const SENSOR_FAULT = "LIKELY_SENSOR_FAULT";

// Stuck-signal check: unchanged from the original page (last 50 samples, std < 1e-6, at least 30 samples).
function detectStuck(arr) {
  if (!Array.isArray(arr)) return false;

  const valid = arr
    .slice(-50)
    .filter(v => typeof v === "number" && Number.isFinite(v));

  if (valid.length < 30) return false;

  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;

  const std = Math.sqrt(
    valid.reduce((a, b) => a + (b - mean) ** 2, 0) / valid.length
  );

  return std < 1e-6;
}

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const fmt = (v, d = 2) => (isNum(v) ? v.toFixed(d) : "—");

function sensorStats(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  let min = Infinity, max = -Infinity, missing = 0;
  for (const v of arr) {
    if (isNum(v)) { if (v < min) min = v; if (v > max) max = v; } else missing += 1;
  }
  // Population std, the same formula as the original reliability table. It is computed over the readings
  // that exist, so a missing (null) value is not silently counted as 0. With no missing values the result
  // is identical to the original.
  const vals = arr.filter(isNum);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const std = vals.length ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) : NaN;
  const last = arr[arr.length - 1];
  return { min: min === Infinity ? null : min, max: max === -Infinity ? null : max, std, last: isNum(last) ? last : null, missing, n: arr.length };
}

function flagReasons(flags, sensor) {
  const f = flags && flags[sensor];
  if (!f) return [];
  const reasons = [];
  if (f.stuck) reasons.push("stuck signal");
  if (f.out_of_physical_range) reasons.push("outside physical range");
  return reasons;
}

function SignalTip({ active, payload, selected }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="an-tip">
      <div className="an-tip-time">{p.t !== undefined && p.t !== null ? String(p.t) : `Sample ${p.i}`}</div>
      <div className="an-tip-row"><span>Sample</span><span>{p.i}</span></div>
      {selected.map(s => (
        <div className="an-tip-row" key={s}>
          <span><i className="an-dot" style={{ background: SENSOR_META[s].color }} />{SENSOR_META[s].label}</span>
          <span>{fmt(p.raw[s], SENSOR_META[s].digits)} {SENSOR_META[s].unit}</span>
        </div>
      ))}
    </div>
  );
}

export default function SensorAnalytics() {
  const { data: analysis, loading: analysisLoading, error: analysisError, vehicleId, isUpload } = useAnalysis();
  const { dataSource } = useVehicle();
  const [tel, setTel] = useState({ status: "loading", data: null, error: null });
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState(DEFAULT_SELECTED);
  const [query, setQuery] = useState("");
  const [scale, setScale] = useState("raw");
  const [range, setRange] = useState("all");

  // Telemetry for the analysed window (same two API calls as before). A cancel flag stops a slow,
  // older response from overwriting a newer one.
  useEffect(() => {
    let cancelled = false;
    setTel({ status: "loading", data: null, error: null });
    const req = isUpload
      ? getCurrentUploadTelemetry()
      : (vehicleId ? getTelemetry(vehicleId) : Promise.reject(new Error("no vehicle selected")));
    req
      .then(d => { if (!cancelled) setTel({ status: "ok", data: d, error: null }); })
      .catch(e => { if (!cancelled) setTel({ status: "error", data: null, error: e?.response?.data?.detail || e.message }); });
    return () => { cancelled = true; };
  }, [isUpload, vehicleId, dataSource?.filename, reload]);

  const telOk = tel.status === "ok" && Array.isArray(tel.data?.t);
  const available = useMemo(
    () => (telOk ? Object.keys(SENSOR_META).filter(k => Array.isArray(tel.data[k])) : []),
    [telOk, tel.data]
  );
  const rows = useMemo(
    () => available.map(k => ({ key: k, ...SENSOR_META[k], stats: sensorStats(tel.data[k]), stuck: detectStuck(tel.data[k]) })),
    [available, tel.data]
  );
  const activeSelected = selected.filter(k => available.includes(k));

  const q = query.trim().toLowerCase();
  const filtered = rows.filter(r => !q || r.label.toLowerCase().includes(q) || r.key.toLowerCase().includes(q));

  const total = telOk ? tel.data.t.length : 0;
  const rangeOptions = RANGES.filter(n => n < total);
  const activeRange = rangeOptions.includes(range) ? range : "all";

  // Chart rows. Raw = real values on one axis (original behaviour). Normalised = each trace scaled
  // 0-100 within its own min-max in the shown window (display only); the tooltip always shows real values.
  const chart = useMemo(() => {
    if (!telOk || activeSelected.length === 0) return { rows: [], spans: {} };
    const n = tel.data.t.length;
    const start = activeRange === "all" ? 0 : Math.max(0, n - activeRange);
    const spans = {};
    activeSelected.forEach(s => {
      let min = Infinity, max = -Infinity;
      for (let i = start; i < n; i++) { const v = tel.data[s][i]; if (isNum(v)) { if (v < min) min = v; if (v > max) max = v; } }
      spans[s] = { min, max };
    });
    const out = [];
    for (let i = start; i < n; i++) {
      const row = { i, t: tel.data.t[i], raw: {} };
      activeSelected.forEach(s => {
        const v = tel.data[s][i];
        row.raw[s] = v;
        const { min, max } = spans[s];
        row[s] = !isNum(v) ? null : scale === "norm" ? (max > min ? ((v - min) / (max - min)) * 100 : 50) : v;
      });
      out.push(row);
    }
    return { rows: out, spans };
  }, [telOk, tel.data, activeSelected, activeRange, scale]);

  const widths = activeSelected.map(s => chart.spans[s] ? chart.spans[s].max - chart.spans[s].min : 0).filter(w => w > 0);
  const scalesDiffer = scale === "raw" && widths.length > 1 && Math.max(...widths) / Math.min(...widths) > 20;

  const toggle = (k) => setSelected(sel => (sel.includes(k) ? sel.filter(x => x !== k) : [...sel, k]));

  // ----- overview numbers (all derived from real data) -----
  const stuckRows = rows.filter(r => r.stuck);
  const missingTotal = rows.reduce((s, r) => s + (r.stats ? r.stats.missing : 0), 0);
  const sf = analysis?.sensor_fault;
  const flagged = sf?.flagged_sensors || [];
  const sensorFlagged = sf?.verdict === SENSOR_FAULT;
  const outliers = analysis?.data_quality?.total_outliers;

  return (
    <div className="page dgx-page">
      <ModuleHeader
        eyebrow="Inspect / sensor intelligence"
        title="Sensor Analytics"
        source={
          <span className={`an-source ${isUpload ? "is-upload" : "is-demo"}`}>
            <span className="an-source-dot" aria-hidden="true" />
            {isUpload ? "Your uploaded telemetry" : "Synthetic demo telemetry"}
          </span>
        }
      >
        <p>
          Inspect the telemetry channels of the analysed window, compare their signals, and review sensor
          reliability checks. Values are recorded samples, not a live stream.
        </p>
      </ModuleHeader>

      {tel.status === "loading" && <Loading label="Loading sensor telemetry…" />}
      {tel.status === "error" && (
        <div className="dgx-error">
          <ErrorBox message={tel.error} />
          <button type="button" className="btn btn-sm" onClick={() => setReload(n => n + 1)}>
            <RefreshCw size={13} aria-hidden="true" /> Try again
          </button>
        </div>
      )}

      {telOk && (
        <div className="sa-body">
          {/* ---------- overview ---------- */}
          <section className="an-stats" aria-label="Sensor overview">
            <article className="an-stat">
              <h2>SENSORS</h2>
              <div className="an-stat-value">{available.length}<small>of {Object.keys(SENSOR_META).length} channels</small></div>
              <div className="an-stat-foot an-cap">{total} samples in the analysed window</div>
            </article>
            <article className="an-stat">
              <h2>SENSOR INTEGRITY</h2>
              <div className={`an-stat-value ${sf ? (sensorFlagged ? "an-tone-warn" : "an-tone-aqua") : ""}`}>
                {sf ? (sensorFlagged ? `${flagged.length} flagged` : "OK") : "—"}
              </div>
              <div className="an-stat-foot an-cap">
                {sf ? <Badge status={sensorFlagged ? "WARNING" : "NORMAL"}>{sensorFlagged ? "Backend check flagged" : "No backend faults"}</Badge>
                  : analysisLoading ? "Backend check loading…" : "Backend check unavailable"}
              </div>
            </article>
            <article className="an-stat">
              <h2>STUCK-SIGNAL CHECK</h2>
              <div className={`an-stat-value ${stuckRows.length ? "an-tone-warn" : "an-tone-aqua"}`}>{stuckRows.length}<small>stuck</small></div>
              <div className="an-stat-foot an-cap">Page check on the last 50 samples</div>
            </article>
            <article className="an-stat">
              <h2>MISSING / OUTLIERS</h2>
              <div className="an-stat-value">{missingTotal}<small>missing readings</small></div>
              <div className="an-stat-foot an-cap">{typeof outliers === "number" ? `${outliers} outliers reported by the data-quality check` : "Outlier count unavailable"}</div>
            </article>
          </section>

          {/* ---------- selector + chart ---------- */}
          <div className="sa-row">
            <Panel title="Sensor channels" sub="Select channels to compare" className="sa-select">
              <label className="sa-search">
                <Search size={14} aria-hidden="true" />
                <span className="an-sr">Filter sensors</span>
                <input type="search" placeholder="Filter sensors…" value={query} onChange={e => setQuery(e.target.value)} />
              </label>
              <div className="sa-select-actions">
                <button type="button" className="sa-link" onClick={() => setSelected(available)}>Select all</button>
                <button type="button" className="sa-link" onClick={() => setSelected([])}>Clear</button>
                <span className="an-cap">{activeSelected.length} selected</span>
              </div>
              {filtered.length === 0 ? (
                <p className="an-cap">No sensor matches "{query}".</p>
              ) : (
                <ul className="sa-chips">
                  {filtered.map(r => {
                    const on = activeSelected.includes(r.key);
                    return (
                      <li key={r.key}>
                        <button type="button" className={`sa-chip${on ? " is-on" : ""}`} aria-pressed={on} onClick={() => toggle(r.key)} style={{ "--sensor": r.color }}>
                          <i aria-hidden="true" />
                          <span className="sa-chip-name">{r.label}</span>
                          <span className="sa-chip-val mono">{r.stats && r.stats.last !== null ? `${fmt(r.stats.last, r.digits)} ${r.unit}` : "—"}</span>
                          {r.stuck && <span className="sa-chip-flag">stuck</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="an-cap">Shown value = last sample of the analysed window.</p>
            </Panel>

            <Panel title="Signal comparison" sub="Recorded samples over the analysed window" right={<span className="mono an-meta">{chart.rows.length || total} samples</span>} className="sa-chart-panel">
              <div className="sa-controls">
                <div className="an-seg" role="group" aria-label="Value scale">
                  <button type="button" className={scale === "raw" ? "is-active" : ""} aria-pressed={scale === "raw"} onClick={() => setScale("raw")}>Raw values</button>
                  <button type="button" className={scale === "norm" ? "is-active" : ""} aria-pressed={scale === "norm"} onClick={() => setScale("norm")}>Normalised</button>
                </div>
                {rangeOptions.length > 0 && (
                  <div className="an-seg" role="group" aria-label="Sample window shown in the chart">
                    <button type="button" className={activeRange === "all" ? "is-active" : ""} aria-pressed={activeRange === "all"} onClick={() => setRange("all")}>All {total}</button>
                    {rangeOptions.map(n => (
                      <button type="button" key={n} className={activeRange === n ? "is-active" : ""} aria-pressed={activeRange === n} onClick={() => setRange(n)}>Last {n}</button>
                    ))}
                  </div>
                )}
              </div>

              {activeSelected.length === 0 ? (
                <Empty label="Select at least one sensor to draw its signal." />
              ) : (
                <>
                  {scalesDiffer && (
                    <p className="an-note an-note-info">The selected sensors have very different value ranges. Try Normalised to compare their shapes.</p>
                  )}
                  <div className="sa-chart" role="img" aria-label={`Signals for ${activeSelected.map(s => SENSOR_META[s].label).join(", ")} over ${chart.rows.length} samples`}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chart.rows} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid stroke="var(--line-soft)" strokeDasharray="3 6" vertical={false} />
                        <XAxis dataKey="i" tick={{ fill: "var(--text-1)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--line)" }} minTickGap={48} />
                        <YAxis
                          width={scale === "norm" ? 40 : 48}
                          domain={scale === "norm" ? [0, 100] : ["auto", "auto"]}
                          tickFormatter={scale === "norm" ? (v => `${v}%`) : undefined}
                          tick={{ fill: "var(--text-1)", fontSize: 11 }} tickLine={false} axisLine={false}
                        />
                        <Tooltip content={<SignalTip selected={activeSelected} />} cursor={{ stroke: "var(--accent)", strokeOpacity: 0.45 }} />
                        {activeSelected.map(s => (
                          <Line key={s} type="monotone" dataKey={s} stroke={SENSOR_META[s].color} strokeWidth={1.8} dot={false} activeDot={{ r: 3.5, stroke: "var(--bg-1)" }} isAnimationActive={false} connectNulls={false} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="sa-spans" aria-label="Observed range of each shown sensor in this window">
                    {activeSelected.map(s => (
                      <li key={s}>
                        <i className="an-dot" style={{ background: SENSOR_META[s].color }} aria-hidden="true" />
                        <span>{SENSOR_META[s].label}</span>
                        <b className="mono">{fmt(chart.spans[s]?.min === Infinity ? null : chart.spans[s]?.min, SENSOR_META[s].digits)} – {fmt(chart.spans[s]?.max === -Infinity ? null : chart.spans[s]?.max, SENSOR_META[s].digits)} {SENSOR_META[s].unit}</b>
                      </li>
                    ))}
                  </ul>
                  <p className="dgx-cap">
                    {scale === "norm"
                      ? "Each trace is scaled 0–100% within its own minimum and maximum in the window shown (display only). Hover for the real values."
                      : "Real values and units on one shared axis."}{" "}
                    X axis: sample index (hover for the recorded timestamp). This view compares signals visually; it does not compute correlations.
                  </p>
                </>
              )}
            </Panel>
          </div>

          {/* ---------- reliability table ---------- */}
          <Panel title="Sensor reliability" sub="Per-channel statistics for the analysed window">
            <ul className="sa-table" aria-label="Sensor reliability table">
              <li className="sa-table-head" aria-hidden="true">
                <span>Sensor</span><span>Last sample</span><span>Min – max</span><span>Std dev</span><span>Missing</span><span>Check</span>
              </li>
              {rows.map(r => {
                const backendFlag = flagged.includes(r.key);
                return (
                  <li key={r.key} className="sa-table-row">
                    <span className="sa-cell sa-cell-name"><i className="an-dot" style={{ background: r.color }} aria-hidden="true" />{r.label}<small className="mono">{r.key}</small></span>
                    <span className="sa-cell mono" data-label="Last sample">{r.stats && r.stats.last !== null ? `${fmt(r.stats.last, r.digits)} ${r.unit}` : "—"}</span>
                    <span className="sa-cell mono" data-label="Min – max">{r.stats ? `${fmt(r.stats.min, r.digits)} – ${fmt(r.stats.max, r.digits)}` : "—"}</span>
                    <span className="sa-cell mono" data-label="Std dev">{r.stats && isNum(r.stats.std) ? r.stats.std.toFixed(3) : "—"}</span>
                    <span className="sa-cell mono" data-label="Missing">{r.stats ? r.stats.missing : "—"}</span>
                    <span className="sa-cell" data-label="Check">
                      {r.stuck ? <Badge status="WARNING">Stuck signal</Badge> : <Badge status="NORMAL">Reliable</Badge>}
                      {backendFlag && <Badge status="mod">Backend flag</Badge>}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="dgx-cap">
              Std dev is over the readings that exist in the window. "Stuck signal" is this page's own check (at
              least 30 samples and a standard deviation below 1e-6 over the last 50). "Backend flag" is the
              analysis pipeline's plausibility check, shown separately below.
            </p>
          </Panel>

          {/* ---------- fault inspection + limitations ---------- */}
          <div className="an-row an-row-b">
            <Panel title="Sensor-fault inspection" sub="Two independent checks, shown separately">
              <div className="sa-checks">
                <div>
                  <div className="sa-check-title">Backend plausibility check</div>
                  {analysisError ? (
                    <p className="an-note an-note-warn">Backend analysis unavailable ({String(analysisError)}). The telemetry views above still work.</p>
                  ) : analysisLoading && !sf ? (
                    <Loading label="Loading backend check…" />
                  ) : sf ? (
                    <>
                      <p className="sa-verdict"><Badge status={sensorFlagged ? "WARNING" : "NORMAL"}>{String(sf.verdict).replace(/_/g, " ")}</Badge></p>
                      {sensorFlagged && flagged.length > 0 && (
                        <ul className="sa-flag-list">
                          {flagged.map(s => (
                            <li key={s}><span className="mono">{s}</span><span>{flagReasons(sf.sensor_flags, s).join(", ") || "flagged"}</span></li>
                          ))}
                        </ul>
                      )}
                      {sensorFlagged && typeof sf.confidence === "number" && <p className="an-cap">Heuristic confidence {sf.confidence.toFixed(2)}</p>}
                      {typeof sf.note === "string" && <p className="an-cap">{sf.note}</p>}
                    </>
                  ) : <p className="an-cap">No backend result.</p>}
                </div>
                <div>
                  <div className="sa-check-title">Stuck-signal check (this page)</div>
                  {stuckRows.length ? (
                    <ul className="sa-flag-list">
                      {stuckRows.map(r => (<li key={r.key}><span className="mono">{r.key}</span><span>constant over the last 50 samples</span></li>))}
                    </ul>
                  ) : <p className="an-cap">No channel is constant over its last 50 samples.</p>}
                </div>
              </div>
            </Panel>

            <Panel title="Interpretation and limitations" sub="How to read suspicious patterns">
              <ul className="an-notes">
                <li>Statistical deviation does not automatically mean a physical sensor has failed.</li>
                <li>Sensor-fault flags come from heuristic checks (the backend's plausibility rules and this page's stuck-signal rule). They are not certain.</li>
                <li>Missing or invalid readings reduce the statistics' reliability.</li>
                <li>{isUpload ? "This is your uploaded CSV, analysed as recorded samples." : "This is synthetic demo telemetry. Neither it nor an upload is live vehicle telemetry."}</li>
              </ul>
              <div className="an-links an-links-inline">
                <Link className="btn btn-sm" to="/anomaly">Anomaly Analysis <ArrowUpRight size={13} aria-hidden="true" /></Link>
                <Link className="btn btn-sm" to="/health">Vehicle Health <ArrowUpRight size={13} aria-hidden="true" /></Link>
                <Link className="btn btn-sm" to="/twin">Digital Twin <ArrowUpRight size={13} aria-hidden="true" /></Link>
              </div>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}