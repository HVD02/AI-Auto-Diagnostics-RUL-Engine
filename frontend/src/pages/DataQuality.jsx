import React from "react";
import { Loading, ErrorBox, Badge, InfoBox, Empty } from "../components/ui.jsx";
import { ModuleHeader, Panel } from "../components/DiagnosisParts.jsx";
import { useAnalysis } from "../useAnalysis.js";
import "./DiagnosisPages.css";
import "./DataPages.css";

const SENSOR_FAULT = "LIKELY_SENSOR_FAULT";

function flagReasons(flags, sensor) {
  const f = flags && flags[sensor];
  if (!f) return [];
  const reasons = [];
  if (f.stuck) reasons.push("stuck signal");
  if (f.out_of_physical_range) reasons.push("outside physical range");
  return reasons;
}

export default function DataQuality() {
  const { data, loading, error, isUpload } = useAnalysis();
  const dq = data?.data_quality;
  const sf = data?.sensor_fault;
  const outliers = dq?.outlier_counts ? Object.entries(dq.outlier_counts) : [];
  const maxOut = Math.max(1, ...outliers.map(([, v]) => Number(v) || 0));
  const flagged = sf?.flagged_sensors || [];
  const sensorFlagged = sf?.verdict === SENSOR_FAULT;

  return (
    <div className="page dgx-page">
      <ModuleHeader
        eyebrow="System / data validation"
        title="Data Quality"
        source={<span className={`dp-chip ${isUpload ? "dp-chip-accent" : "dp-chip-warn"}`}>{isUpload ? "Your uploaded telemetry" : "Synthetic demo telemetry"}</span>}
      >
        <p>Automated data-quality checks computed on the raw telemetry window before any modeling happens.</p>
      </ModuleHeader>

      {loading && <Loading label="Running diagnostic pipeline…" />}
      {error && <ErrorBox message={error} />}

      {dq && (
        <div className="dp-body">
          <section className="dp-stats dp-stats-6" aria-label="Data quality summary">
            <article className="dp-stat"><h2>QUALITY SCORE</h2><div className="dp-stat-value">{dq.data_quality_score}<small>/ 100</small></div></article>
            <article className="dp-stat"><h2>MISSING DATA</h2><div className="dp-stat-value">{dq.missing_pct}<small>%</small></div></article>
            <article className="dp-stat"><h2>DUPLICATE ROWS</h2><div className="dp-stat-value">{dq.duplicate_rows}</div></article>
            <article className="dp-stat">
              <h2>TIMESTAMP INTEGRITY</h2>
              <div className="dp-stat-foot"><Badge status={dq.timestamp_monotonic ? "NORMAL" : "CRITICAL"}>{dq.timestamp_monotonic ? "Monotonic" : "Out of order"}</Badge></div>
            </article>
            <article className="dp-stat"><h2>ROWS ANALYSED</h2><div className="dp-stat-value">{typeof dq.n_rows === "number" ? dq.n_rows : "—"}</div></article>
            <article className="dp-stat"><h2>TOTAL OUTLIERS</h2><div className="dp-stat-value">{typeof dq.total_outliers === "number" ? dq.total_outliers : "—"}</div></article>
          </section>

          <div className="dp-row">
            <Panel title="Outliers by sensor" sub="IQR × 3 method, counted per channel">
              {outliers.length === 0 ? <Empty label="No per-sensor outlier counts in this analysis." /> : (
                <ul className="dp-bars">
                  {outliers.map(([k, v]) => (
                    <li key={k}>
                      <span className="mono dp-bars-name">{k}</span>
                      <span className="dp-bars-track" aria-hidden="true"><i style={{ width: `${((Number(v) || 0) / maxOut) * 100}%` }} /></span>
                      <span className="mono dp-bars-val">{v}{typeof dq.n_rows === "number" && dq.n_rows > 0 ? <small> · {(((Number(v) || 0) / dq.n_rows) * 100).toFixed(1)}%</small> : null}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="dgx-cap">Percentages are the outlier count divided by the rows analysed. An outlier is a statistical extreme, not necessarily an invalid reading.</p>
            </Panel>

            <Panel title="Sensor consistency" sub="Cross-sensor plausibility check from the analysis pipeline">
              {sf ? (
                <>
                  <p className="dp-verdict"><Badge status={sensorFlagged ? "WARNING" : "NORMAL"}>{String(sf.verdict).replace(/_/g, " ")}</Badge></p>
                  <p className="dp-copy">
                    {sensorFlagged
                      ? `Cross-sensor consistency check flagged: ${flagged.join(", ")}.`
                      : "No cross-sensor consistency issues detected in this window."}
                  </p>
                  {sensorFlagged && flagged.length > 0 && (
                    <ul className="dp-flags">
                      {flagged.map(s => <li key={s}><span className="mono">{s}</span><span>{flagReasons(sf.sensor_flags, s).join(", ") || "flagged"}</span></li>)}
                    </ul>
                  )}
                </>
              ) : <Empty label="No sensor-consistency result in this analysis." />}
            </Panel>
          </div>

          <InfoBox>
            Data quality describes the input telemetry (completeness, duplicates, ordering, outliers). It is not model accuracy.
            For model evaluation scores, see Model Analytics.
          </InfoBox>
        </div>
      )}
    </div>
  );
}