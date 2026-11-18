import React from "react";
import { Link } from "react-router-dom";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { Activity, ShieldCheck, Database, Stethoscope, Wrench, ArrowUpRight } from "lucide-react";
import { Loading, ErrorBox, Gauge, InfoBox, Badge, Empty } from "../components/ui.jsx";
import { ModuleHeader, Panel } from "../components/DiagnosisParts.jsx";
import { useAnalysis } from "../useAnalysis.js";
import "./DiagnosisPages.css";
import "./MonitorPages.css";

const SENSOR_FAULT = "LIKELY_SENSOR_FAULT";

// The three contribution factors the original page showed, in the same order.
const KNOWN = [
  { key: "anomaly", title: "Anomaly contribution", note: d => `Anomaly ratio: ${(d.anomaly.anomaly_ratio * 100).toFixed(1)}%` },
  { key: "data_quality", title: "Data quality contribution", note: d => `Quality score: ${d.data_quality.data_quality_score}/100` },
  { key: "sensor_reliability", title: "Sensor reliability contribution", note: d => String(d.sensor_fault.verdict).replace(/_/g, " ") },
];

const humanize = (k) => String(k).replace(/_/g, " ");
const fmt = (v, d = 1) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(d) : "—");

function statusTone(status) {
  if (status === "NORMAL") return "ok";
  if (status === "WARNING") return "warn";
  if (status === "CRITICAL") return "crit";
  return "neutral";
}

function flagReasons(flags, sensor) {
  const f = flags && flags[sensor];
  if (!f) return [];
  const reasons = [];
  if (f.stuck) reasons.push("stuck signal");
  if (f.out_of_physical_range) reasons.push("outside physical range");
  return reasons;
}

function Indicator({ icon: Icon, title, badge, value, caption, to, linkLabel }) {
  return (
    <article className="vh-ind">
      <div className="vh-ind-top">
        <span className="vh-ind-ico" aria-hidden="true"><Icon size={16} /></span>
        <h3>{title}</h3>
        {badge}
      </div>
      <div className="vh-ind-value">{value}</div>
      <p className="vh-ind-cap">{caption}</p>
      <Link className="vh-ind-link" to={to}>{linkLabel} <ArrowUpRight size={12} aria-hidden="true" /></Link>
    </article>
  );
}

export default function VehicleHealth() {
  const { data, loading, error, vehicleId, isUpload } = useAnalysis();

  const health = data?.health;
  const an = data?.anomaly;
  const sf = data?.sensor_fault;
  const dq = data?.data_quality;
  const flagged = sf?.flagged_sensors || [];
  const sensorFlagged = sf?.verdict === SENSOR_FAULT;
  const stamps = Array.isArray(an?.timestamps) && an.timestamps.length ? an.timestamps : null;
  const timeline = Array.isArray(an?.timeline_scores)
    ? an.timeline_scores.map((v, i) => ({ i, v, t: stamps ? stamps[i] : undefined }))
    : [];
  const contributors = an?.top_contributors || [];
  const extraKeys = health ? Object.keys(health.contributions || {}).filter(k => !KNOWN.some(x => x.key === k)) : [];

  return (
    <div className="page dgx-page">
      <ModuleHeader
        eyebrow="Monitor / vehicle condition"
        title="Vehicle Health"
        source={
          <span className={`vh-source ${isUpload ? "is-upload" : "is-demo"}`}>
            <span className="vh-source-dot" aria-hidden="true" />
            {isUpload ? "Your uploaded telemetry" : "Synthetic demo telemetry"}
          </span>
        }
      >
        <p>A documented, weighted-formula health score — no hidden weights, no arbitrary thresholds.</p>
      </ModuleHeader>

      {loading && <Loading label="Running diagnostic pipeline…" />}
      {error && <ErrorBox message={error} />}

      {data && (
        <div className="vh-body">
          {/* ---------- overall health + methodology ---------- */}
          <div className="vh-row vh-row-a">
            <Panel title="Overall vehicle health" sub="Model-derived estimate from the analysed window" className="vh-overall">
              <div className="vh-overall-grid">
                <div className="vh-gauge">
                  <Gauge value={health.health_score} band={health.band} />
                  <div className="vh-gauge-badge">
                    <Badge status={health.band === "EXCELLENT" || health.band === "GOOD" ? "GOOD" : health.band} />
                  </div>
                </div>
                <dl className="dx-facts vh-facts">
                  <div><dt>Active vehicle</dt><dd className="mono">{vehicleId}</dd></div>
                  <div><dt>Data source</dt><dd>{isUpload ? "Your uploaded CSV" : "Synthetic demo telemetry"}</dd></div>
                  <div><dt>Analysed window</dt><dd>{dq.n_rows} rows</dd></div>
                  {stamps && <div><dt>Window range</dt><dd className="mono vh-range">{String(stamps[0])} → {String(stamps[stamps.length - 1])}</dd></div>}
                </dl>
              </div>
            </Panel>

            <Panel title="Scoring methodology" sub="How the number is formed">
              <p className="vh-copy">
                Health starts at 100 and is penalized by four measured factors: the anomaly-model's
                flagged-window ratio, the data-quality score, a fixed penalty when a sensor fault is
                detected (readings become unreliable), and a fault-diagnosis severity penalty when
                applicable. No factor is invented — each comes from a model output computed earlier
                in the pipeline for this vehicle.
              </p>
              <div className="vh-formula mono">{health.formula}</div>
            </Panel>
          </div>

          {/* ---------- contributions ---------- */}
          <section className="vh-contribs" aria-label="Score contributions">
            {KNOWN.map(c => {
              const v = health.contributions[c.key];
              return (
                <article className="vh-contrib" key={c.key}>
                  <h3>{c.title}</h3>
                  <div className="vh-contrib-value"><b>{v}</b><span>points</span></div>
                  <div className="vh-contrib-bar" aria-hidden="true">
                    <i style={{ width: `${Math.min(100, Math.abs(Number(v) || 0))}%` }} />
                  </div>
                  <p>{c.note(data)}</p>
                </article>
              );
            })}
            {extraKeys.map(k => (
              <article className="vh-contrib" key={k}>
                <h3>{humanize(k)} contribution</h3>
                <div className="vh-contrib-value"><b>{String(health.contributions[k])}</b><span>points</span></div>
                <div className="vh-contrib-bar" aria-hidden="true">
                  <i style={{ width: `${Math.min(100, Math.abs(Number(health.contributions[k]) || 0))}%` }} />
                </div>
                <p>{k === "fault_diagnosis" && !data.diagnosis ? "Not run for this analysis" : "Included in the score"}</p>
              </article>
            ))}
          </section>
          <p className="dgx-cap vh-scale-note">Bars show each contribution's magnitude on the 100-point scale.</p>

          {/* ---------- indicators ---------- */}
          <section className="vh-indicators" aria-label="Health indicators">
            <Indicator
              icon={Activity}
              title="Anomaly status"
              badge={<Badge status={an.status} />}
              value={<span className={`vh-tone-${statusTone(an.status)}`}>{fmt(an.anomaly_ratio * 100, 0)}<small>% flagged</small></span>}
              caption={`Model: ${an.model_used}`}
              to="/anomaly" linkLabel="Anomaly analysis"
            />
            <Indicator
              icon={ShieldCheck}
              title="Sensor integrity"
              badge={<Badge status={sensorFlagged ? "WARNING" : "NORMAL"}>{sensorFlagged ? "Flagged" : "No faults"}</Badge>}
              value={<span className={sensorFlagged ? "vh-tone-warn" : "vh-tone-aqua"}>{sensorFlagged ? `${flagged.length} flagged` : "OK"}</span>}
              caption={flagged.length ? flagged.join(", ") : "Heuristic plausibility checks"}
              to="/sensors" linkLabel="Sensor analytics"
            />
            <Indicator
              icon={Database}
              title="Data quality"
              badge={<span className="vh-chip">{dq.timestamp_monotonic ? "Timestamps in order" : "Timestamps out of order"}</span>}
              value={<span className="vh-tone-violet">{dq.data_quality_score}<small>/100</small></span>}
              caption={`${dq.n_rows} rows · ${dq.duplicate_rows} duplicate · ${dq.total_outliers} outliers · ${fmt(dq.missing_pct, 2)}% missing`}
              to="/quality" linkLabel="Data quality"
            />
            <Indicator
              icon={Stethoscope}
              title="Fault diagnosis"
              badge={<span className="vh-chip">{data.diagnosis ? "Included" : "Not run"}</span>}
              value={<span className="vh-tone-neutral">{data.diagnosis ? "In score" : "—"}</span>}
              caption={data.diagnosis ? "A fault-diagnosis result is part of this analysis." : "Not run for this analysis. Use Diagnostics to sample EngineFaultDB."}
              to="/diagnostics" linkLabel="Diagnostics"
            />
          </section>

          {/* ---------- sensor + condition details ---------- */}
          <div className="vh-row vh-row-b">
            <Panel title="Sensor and condition details" sub="Which signals deviate most in this window">
              {contributors.length ? (
                <ol className="vh-rank">
                  {contributors.map((c, i) => (
                    <li key={c.sensor}>
                      <span className="vh-rank-n" aria-hidden="true">{i + 1}</span>
                      <span className="mono vh-rank-name">{c.sensor}</span>
                      <span className="vh-track" aria-hidden="true"><i style={{ width: `${Math.min(100, c.z_score * 40)}%` }} /></span>
                      <span className="mono vh-rank-val">{c.z_score}</span>
                    </li>
                  ))}
                </ol>
              ) : <Empty label="No sensor contributions in this analysis." />}
              <p className="dgx-cap">
                Mean absolute z-score of each sensor in the analysed window. They show which signals deviate
                most; they do not prove a component has failed.
              </p>
              {sensorFlagged && flagged.length > 0 && (
                <ul className="vh-flags">
                  {flagged.map(s => (
                    <li key={s}>
                      <span className="mono">{s}</span>
                      <span>{flagReasons(sf.sensor_flags, s).join(", ") || "flagged"}</span>
                    </li>
                  ))}
                </ul>
              )}
              {timeline.length > 0 && (
                <div className="vh-spark">
                  <div className="vh-spark-head"><span>ANOMALY INTENSITY · ANALYSED WINDOW</span><b className="mono">{timeline.length} samples</b></div>
                  <div className="vh-spark-chart" role="img" aria-label={`Relative anomaly intensity over ${timeline.length} samples`}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timeline} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id="vh-spark-fill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" style={{ stopColor: "var(--accent)", stopOpacity: 0.28 }} />
                            <stop offset="100%" style={{ stopColor: "var(--accent)", stopOpacity: 0.02 }} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="i" hide />
                        <YAxis domain={[0, 100]} hide />
                        <Tooltip
                          cursor={{ stroke: "var(--accent)", strokeOpacity: 0.4 }}
                          content={({ active, payload }) => active && payload && payload.length ? (
                            <div className="dv2-tip">
                              <div className="dv2-tip-time">{payload[0].payload.t !== undefined ? String(payload[0].payload.t) : `Sample ${payload[0].payload.i}`}</div>
                              <div className="dv2-tip-row"><span>Relative intensity</span><span>{fmt(payload[0].payload.v, 1)}</span></div>
                            </div>
                          ) : null}
                        />
                        <Area type="monotone" dataKey="v" stroke="var(--accent)" strokeWidth={1.6} fill="url(#vh-spark-fill)" dot={false} isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </Panel>

            <Panel title="Investigate next" sub="Existing pages that go deeper">
              <ul className="vh-links">
                <li><Link to="/diagnostics"><Stethoscope size={15} aria-hidden="true" /><span><b>Diagnostics</b><small>Fault classification on EngineFaultDB samples</small></span><ArrowUpRight size={14} aria-hidden="true" /></Link></li>
                <li><Link to="/anomaly"><Activity size={15} aria-hidden="true" /><span><b>Anomaly Analysis</b><small>Timeline and top contributing sensors</small></span><ArrowUpRight size={14} aria-hidden="true" /></Link></li>
                <li><Link to="/sensors"><ShieldCheck size={15} aria-hidden="true" /><span><b>Sensor Analytics</b><small>Compare channels and spot implausible signals</small></span><ArrowUpRight size={14} aria-hidden="true" /></Link></li>
                <li><Link to="/maintenance"><Wrench size={15} aria-hidden="true" /><span><b>Maintenance Center</b><small>{(data.maintenance || []).length ? `${data.maintenance.length} reference entr${data.maintenance.length > 1 ? "ies" : "y"} retrieved for this analysis` : "Search documented checks"}</small></span><ArrowUpRight size={14} aria-hidden="true" /></Link></li>
              </ul>
            </Panel>
          </div>

          <InfoBox>
            {isUpload
              ? "Health scoring, anomaly detection and sensor-fault flags are computed from your uploaded telemetry."
              : "Health scoring, anomaly detection and sensor-fault flags are computed from synthetic demo telemetry in this mode. Real EngineAD fleet data would plug into the same pipeline unchanged."}
          </InfoBox>
          <p className="dgx-cap vh-disclaimer">
            The health score is a model-derived estimate for the analysed window. It is not a substitute for a
            physical inspection by a qualified technician and should not be the sole basis for a
            safety-critical maintenance decision.
          </p>
        </div>
      )}
    </div>
  );
}