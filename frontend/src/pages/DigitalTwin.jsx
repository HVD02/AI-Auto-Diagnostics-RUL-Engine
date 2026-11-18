import React, { useEffect, useId, useState } from "react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { Thermometer, Gauge as GaugeIcon, Zap, Activity, Fuel } from "lucide-react";
import { Loading, ErrorBox, Badge } from "../components/ui.jsx";
import { ModuleHeader, Panel } from "../components/DiagnosisParts.jsx";
import { useAnalysis } from "../useAnalysis.js";
import { useVehicle } from "../VehicleContext.jsx";
import { getTelemetry, getCurrentUploadTelemetry } from "../api";
import "./DiagnosisPages.css";
import "./MonitorPages.css";

// Band logic: unchanged from the original page.
function bandFromZ(z) {
  if (z < 1) return "ok";
  if (z < 1.8) return "warn";
  if (z < 2.6) return "mod";
  return "crit";
}
const BAND_WORD = { ok: "Healthy", warn: "Watch", mod: "Moderate deviation", crit: "Critical" };

// Same five components and sensors as the original page. x / y place each pin on the vehicle
// (percent of the stage) and which side its label sits on; unit and digits are used only to format real telemetry values.
const COMPONENTS = [
  { key: "coolant_temp_c", label: "Cooling", icon: Thermometer, unit: "°C", digits: 1, x: 50, y: 17, side: "r" },
  { key: "oil_pressure_kpa", label: "Engine / Oil", icon: GaugeIcon, unit: "kPa", digits: 0, x: 50, y: 30, side: "r" },
  { key: "battery_voltage_v", label: "Electrical", icon: Zap, unit: "V", digits: 2, x: 36.5, y: 24, side: "l" },
  { key: "vibration_g", label: "Vibration / Mounts", icon: Activity, unit: "g", digits: 3, x: 33.8, y: 70, side: "l" },
  { key: "fuel_rate_lph", label: "Fuel System", icon: Fuel, unit: "L/h", digits: 2, x: 50, y: 77, side: "r" },
];

const fmt = (v, d = 2) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(d) : "—");

function flagReasons(flags, sensor) {
  const f = flags && flags[sensor];
  if (!f) return [];
  const reasons = [];
  if (f.stuck) reasons.push("stuck signal");
  if (f.out_of_physical_range) reasons.push("outside physical range");
  return reasons;
}

// Raw sensor arrays for the analysed window (same calls the Dashboard and Sensor Analytics use).
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
      .catch(e => { if (!cancelled) setTel({ status: "error", data: null, error: e?.response?.data?.detail || e.message }); });
    return () => { cancelled = true; };
  }, [isUpload, vehicleId, filename]);
  return tel;
}

function windowStats(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  let min = Infinity, max = -Infinity;
  for (const v of arr) {
    if (typeof v === "number" && Number.isFinite(v)) { if (v < min) min = v; if (v > max) max = v; }
  }
  if (min === Infinity) return null;
  const last = arr[arr.length - 1];
  return { min, max, last: typeof last === "number" ? last : null, n: arr.length };
}

// Simple geometric SUV (top-down, front at the top), the same plain style as the original landing art.
function Vehicle() {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg className="tw-svg" viewBox="0 0 560 500" role="img" aria-label="Top-down geometric SUV outline with five component pins" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id={`${uid}-glow`}>
          <stop offset="0" stopColor="#d6ff4f" stopOpacity=".13" />
          <stop offset="1" stopColor="#d6ff4f" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#314253" />
          <stop offset=".5" stopColor="#172431" />
          <stop offset="1" stopColor="#0a111b" />
        </linearGradient>
        <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#183849" />
          <stop offset="1" stopColor="#07131f" />
        </linearGradient>
      </defs>
      <circle cx="280" cy="258" r="215" fill={`url(#${uid}-glow)`} />
      <circle cx="280" cy="258" r="207" fill="none" stroke="rgba(214,255,79,.14)" strokeDasharray="2 8" />
      <circle cx="280" cy="258" r="160" fill="none" stroke="rgba(102,232,208,.16)" />
      <path d="M62 258H498M280 46V470" stroke="rgba(214,255,79,.14)" strokeDasharray="5 10" fill="none" />
      <g strokeLinejoin="round" strokeLinecap="round">
        <path d="M223 65L337 65 360 88 374 125 377 177 369 198 369 354 359 394 337 424 223 424 201 394 191 354 191 198 183 177 186 125 200 88Z" fill="#02070d" opacity=".6" transform="translate(0 8)" />
        <g fill="#050a11" stroke="#9dc8d7" strokeOpacity=".6" strokeWidth="1.6">
          <rect x="174" y="119" width="32" height="78" rx="8" /><rect x="354" y="119" width="32" height="78" rx="8" />
          <rect x="174" y="307" width="32" height="78" rx="8" /><rect x="354" y="307" width="32" height="78" rx="8" />
        </g>
        <path d="M226 63H334L355 82 368 116 371 164 363 190V354L352 391 331 418H229L208 391 197 354V190L189 164 192 116 205 82Z" fill={`url(#${uid}-body)`} stroke="#86bdcc" strokeOpacity=".85" strokeWidth="2.2" />
        <path d="M216 83H344L356 112 358 151 343 170H217L202 151 204 112Z" fill="#172a37" stroke="#d8f5fb" strokeOpacity=".6" strokeWidth="1.5" />
        <path d="M222 95H338L346 116 344 143H216L214 116Z" fill="#203b48" stroke="#80aebd" strokeOpacity=".6" strokeWidth="1.2" />
        <path d="M213 174L347 174 354 212 349 237H211L206 212Z" fill={`url(#${uid}-glass)`} stroke="#d9f5fb" strokeOpacity=".6" strokeWidth="1.5" />
        <path d="M222 238H338L344 347 330 367H230L216 347Z" fill="#142634" stroke="#b8dce7" strokeOpacity=".7" strokeWidth="1.6" />
        <path d="M230 248H330L334 344H226Z" fill="#0b1722" stroke="#7899aa" strokeWidth="1.2" />
        <rect x="238" y="263" width="84" height="52" rx="8" fill="#101e2b" stroke="#a6c7d4" strokeOpacity=".7" strokeWidth="1.2" />
        <rect x="204" y="78" width="20" height="12" rx="2" fill="#d6ff4f" fillOpacity=".75" />
        <rect x="336" y="78" width="20" height="12" rx="2" fill="#d6ff4f" fillOpacity=".75" />
        <rect x="202" y="384" width="27" height="9" rx="3" fill="#ff5f61" fillOpacity=".8" />
        <rect x="331" y="384" width="27" height="9" rx="3" fill="#ff5f61" fillOpacity=".8" />
        <circle cx="280" cy="405" r="24" fill="#071019" stroke="#b6d9e5" strokeOpacity=".7" strokeWidth="1.6" />
        <circle cx="280" cy="405" r="16" fill="#142632" stroke="#69899a" strokeWidth="1.2" />
      </g>
    </svg>
  );
}

export default function DigitalTwin() {
  const { data, loading, error, vehicleId, isUpload } = useAnalysis();
  const { dataSource } = useVehicle();
  const tel = useTelemetry(isUpload, vehicleId, dataSource?.filename);
  const [selected, setSelected] = useState(COMPONENTS[0].key);

  const zBySensor = {};
  data?.anomaly?.top_contributors?.forEach(c => { zBySensor[c.sensor] = c.z_score; });
  const flaggedList = data?.sensor_fault?.flagged_sensors ?? [];

  // Same classification as the original page. A sensor that is not among the top contributors was
  // never given a real z-score, so it is classified as before but shown without a number.
  const rows = COMPONENTS.map(c => {
    const hasZ = zBySensor[c.key] !== undefined;
    const z = zBySensor[c.key] ?? 0.2;
    const flagged = flaggedList.includes(c.key);
    const band = flagged ? "warn" : bandFromZ(z);
    const stats = tel.status === "ok" ? windowStats(tel.data?.[c.key]) : null;
    return { ...c, hasZ, z, flagged, band, stats };
  });
  const active = rows.find(r => r.key === selected) || rows[0];
  const series = tel.status === "ok" && Array.isArray(tel.data?.[active.key])
    ? tel.data[active.key].map((v, i) => ({ i, v })) : [];

  return (
    <div className="page dgx-page">
      <ModuleHeader
        eyebrow="Visualize / digital twin"
        title="Digital Twin"
        source={
          <span className={`vh-source ${isUpload ? "is-upload" : "is-demo"}`}>
            <span className="vh-source-dot" aria-hidden="true" />
            {isUpload ? "Your uploaded telemetry" : "Synthetic demo telemetry"}
          </span>
        }
      >
        <p>
          Component health inferred from the sensors that actually exist in this dataset — no components
          invented beyond available signals. Select a component to inspect its sensor.
        </p>
      </ModuleHeader>

      {loading && <Loading label="Running diagnostic pipeline…" />}
      {error && <ErrorBox message={error} />}

      {data && (
        <div className="tw-body">
          <div className="tw-row">
            {/* ---------- vehicle stage ---------- */}
            <section className="tw-stage-wrap" aria-label="Vehicle component map">
              <div className="tw-stage">
                <div className="tw-stage-top">
                  <span>TWIN / {vehicleId}</span>
                  <span className="tw-stage-src">{isUpload ? "UPLOADED DATA" : "SYNTHETIC DEMO DATA"}</span>
                </div>
                <Vehicle />
                {rows.map(r => (
                  <button
                    key={r.key}
                    type="button"
                    className={`tw-pin tw-side-${r.side} tw-band-${r.band}${r.key === active.key ? " is-selected" : ""}`}
                    style={{ left: `${r.x}%`, top: `${r.y}%` }}
                    aria-pressed={r.key === active.key}
                    aria-label={`${r.label}: ${BAND_WORD[r.band]}${r.flagged ? ", sensor flagged" : ""}`}
                    onClick={() => setSelected(r.key)}
                  >
                    <span className="tw-pin-ico"><r.icon size={15} aria-hidden="true" /></span>
                    <span className="tw-pin-label">{r.label}</span>
                  </button>
                ))}
                <div className="tw-stage-foot">No physical vehicle connected · values come from the analysed window</div>
              </div>
              <ul className="tw-legend" aria-label="Colour legend">
                <li><i className="tw-band-ok" /> Healthy</li>
                <li><i className="tw-band-warn" /> Watch / sensor-flagged</li>
                <li><i className="tw-band-mod" /> Moderate deviation</li>
                <li><i className="tw-band-crit" /> Critical</li>
              </ul>
            </section>

            {/* ---------- selected component ---------- */}
            <Panel title={active.label} sub="Selected component" className="tw-detail" right={<Badge status={active.band}>{BAND_WORD[active.band]}</Badge>}>
              <dl className="dx-facts">
                <div><dt>Sensor</dt><dd className="mono">{active.key}</dd></div>
                <div>
                  <dt>Anomaly z-score</dt>
                  <dd className="mono">{active.hasZ ? active.z.toFixed(2) : "not in top-3 contributors"}</dd>
                </div>
                {active.flagged && (
                  <div><dt>Sensor check</dt><dd>Flagged: {flagReasons(data.sensor_fault.sensor_flags, active.key).join(", ") || "implausible signal"}</dd></div>
                )}
                <div>
                  <dt>Last sample in window</dt>
                  <dd className="mono">{active.stats && active.stats.last !== null ? `${fmt(active.stats.last, active.digits)} ${active.unit}` : tel.status === "loading" ? "loading…" : "—"}</dd>
                </div>
                <div>
                  <dt>Window range</dt>
                  <dd className="mono">{active.stats ? `${fmt(active.stats.min, active.digits)} – ${fmt(active.stats.max, active.digits)} ${active.unit}` : "—"}</dd>
                </div>
              </dl>

              {tel.status === "loading" && <Loading label="Loading sensor telemetry…" />}
              {tel.status === "error" && (
                <p className="tw-note tw-note-warn">Sensor telemetry could not be loaded ({String(tel.error)}). Health colours above still come from the analysis.</p>
              )}
              {series.length > 0 && (
                <div className="tw-spark">
                  <div className="vh-spark-head"><span>{active.key.toUpperCase()} · ANALYSED WINDOW</span><b className="mono">{series.length} samples</b></div>
                  <div className="tw-spark-chart" role="img" aria-label={`${active.label} sensor values over ${series.length} samples`}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                        <XAxis dataKey="i" hide />
                        <YAxis domain={["auto", "auto"]} hide />
                        <Tooltip
                          cursor={{ stroke: "var(--accent)", strokeOpacity: 0.4 }}
                          content={({ active: on, payload }) => on && payload && payload.length ? (
                            <div className="dv2-tip">
                              <div className="dv2-tip-time">Sample {payload[0].payload.i}</div>
                              <div className="dv2-tip-row"><span>{active.label}</span><span>{fmt(payload[0].payload.v, active.digits)} {active.unit}</span></div>
                            </div>
                          ) : null}
                        />
                        <Line type="monotone" dataKey="v" stroke="var(--accent)" strokeWidth={1.6} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              <p className="dgx-cap">
                The colour derives from this sensor's z-score contribution to the current anomaly window. It
                indicates deviation in the data, not a confirmed component fault.
              </p>
            </Panel>
          </div>

          {/* ---------- component list + telemetry ---------- */}
          <Panel title="Component health map" sub="Select a component to inspect it. Colours use the same rules as the vehicle pins.">
            <div className="twin-grid tw-grid">
              {rows.map(r => (
                <button
                  key={r.key}
                  type="button"
                  className={`tw-cell tw-band-${r.band}${r.key === active.key ? " is-selected" : ""}`}
                  aria-pressed={r.key === active.key}
                  onClick={() => setSelected(r.key)}
                >
                  <span className="tw-cell-ring"><r.icon size={17} aria-hidden="true" /></span>
                  <span className="tw-cell-label">{r.label}</span>
                  <span className="mono tw-cell-z">{r.hasZ ? `z=${r.z.toFixed(2)}` : "below top-3"}</span>
                  <span className="mono tw-cell-val">
                    {r.stats && r.stats.last !== null ? `${fmt(r.stats.last, r.digits)} ${r.unit}` : "—"}
                  </span>
                </button>
              ))}
            </div>
            <p className="dgx-cap">
              Healthy = z below 1, watch = below 1.8, moderate = below 2.6, critical = 2.6 or more. A
              sensor flagged by the plausibility checks is shown as "watch". Only the top three contributing
              sensors receive a z-score; the others are shown as healthy without a number.
            </p>
            <p className="dgx-cap">
              Values shown are the last sample of the analysed window ({isUpload ? "your uploaded CSV" : "synthetic demo telemetry"}),
              not live telemetry from a vehicle.
            </p>
          </Panel>
        </div>
      )}
    </div>
  );
}