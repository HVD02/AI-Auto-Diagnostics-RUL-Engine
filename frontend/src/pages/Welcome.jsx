import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, ArrowRight, Info } from "lucide-react";
import { getHealth, getModelMetrics } from "../api";
import "./Welcome.css";

const CAPABILITIES = [
  "Vehicle health",
  "Sensor intelligence",
  "Fault analysis",
  "RUL prediction",
];

const BACKEND_LABEL = {
  checking: "Checking backend…",
  online: "Backend online",
  offline: "Backend offline",
};

function fmt(value, digits = 2) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "—";
}

// Builds display rows ONLY from fields that /api/model-metrics already
// returns (the same ones Dashboard.jsx reads). Dataset labels are static
// descriptions of each model's training data, taken from the project README.
function buildModelRows(m) {
  if (!m) return [];
  const diag = m.diagnosis;
  const rul = m.rul;
  const an = m.anomaly;
  const anomalyF1 = an?.model_comparison?.[an?.best_model]?.f1;
  return [
    {
      key: "diagnosis",
      name: "Fault diagnosis",
      model: diag?.best_model || "—",
      metric: `macro-F1 ${fmt(diag?.test_metrics?.test_f1_macro)}`,
      data: "Trained on EngineFaultDB",
    },
    {
      key: "rul",
      name: "RUL prediction",
      model: rul?.best_model || "—",
      metric: `MAE ${fmt(rul?.test_metrics?.test_mae, 1)} cycles`,
      data: "NASA C-MAPSS FD001 — aircraft turbofan data, not passenger cars",
    },
    {
      key: "anomaly",
      name: "Anomaly detection",
      model: an?.best_model || "—",
      metric: `F1 ${fmt(anomalyF1)}`,
      data: "Evaluated on synthetic demo telemetry",
    },
  ];
}

export default function Welcome() {
  const navigate = useNavigate();
  const [backend, setBackend] = useState("checking");
  const [metrics, setMetrics] = useState(null);
  const [metricsFailed, setMetricsFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getHealth()
      .then(h => {
        if (!cancelled) setBackend(h?.status === "ok" ? "online" : "offline");
      })
      .catch(() => {
        if (!cancelled) setBackend("offline");
      });

    getModelMetrics()
      .then(m => {
        if (!cancelled) setMetrics(m);
      })
      .catch(() => {
        if (!cancelled) setMetricsFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const rows = buildModelRows(metrics);

  return (
    <main className="wlc" aria-labelledby="wlc-title">
      <svg
        className="wlc-bg"
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <pattern id="wlc-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="800" height="600" fill="url(#wlc-grid)" />
        <path
          className="wlc-wave wlc-wave-1"
          d="M0 470 Q60 430 120 470 T240 470 T360 470 T480 470 T600 470 T720 470 T840 470"
          fill="none"
          strokeWidth="1.5"
        />
        <path
          className="wlc-wave wlc-wave-2"
          d="M0 505 Q50 483 100 505 T200 505 T300 505 T400 505 T500 505 T600 505 T700 505 T800 505"
          fill="none"
          strokeWidth="1"
        />
      </svg>

      <div className="wlc-layout">
        <div className="wlc-hero">
          <div className="wlc-eyebrow">
            <Activity size={16} aria-hidden="true" />
            <span>Automotive intelligence platform</span>
          </div>

          <h1 id="wlc-title" className="wlc-title">
            AI Auto-Diagnostics <span className="wlc-amp">&amp;</span> RUL Engine
          </h1>

          <p className="wlc-sub">
            Intelligent vehicle health monitoring, anomaly detection &amp; predictive maintenance
          </p>

          <p className="wlc-desc">
            Vehicle health, sensor intelligence, fault analysis and remaining useful life
            estimates in one readable diagnostic console, driven by the live analysis pipeline.
          </p>

          <button type="button" className="wlc-cta" onClick={() => navigate("/dashboard")}>
            <span>ENTER DIAGNOSTICS</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>

          <ul className="wlc-tags" aria-label="Capabilities">
            {CAPABILITIES.map(c => (
              <li className="wlc-tag" key={c}>{c}</li>
            ))}
          </ul>
        </div>

        <aside className="wlc-panel" aria-label="Pipeline status">
          <div className="wlc-panel-head">
            <span className="wlc-panel-title">Pipeline status</span>
            <span
              className={`wlc-status wlc-status-${backend}`}
              role="status"
              aria-live="polite"
            >
              <span className="wlc-status-dot" aria-hidden="true" />
              {BACKEND_LABEL[backend]}
            </span>
          </div>

          {backend === "offline" && (
            <p className="wlc-offline">
              The backend is not reachable. Start it from the <code>backend</code> folder
              with <code>uvicorn main:app --reload</code>, then refresh this page.
            </p>
          )}

          {rows.length > 0 && (
            <ul className="wlc-rows">
              {rows.map(r => (
                <li className="wlc-row" key={r.key}>
                  <div className="wlc-row-main">
                    <span className="wlc-row-name">{r.name}</span>
                    <span className="wlc-row-metric">{r.metric}</span>
                  </div>
                  <div className="wlc-row-sub">
                    <span className="wlc-row-model">{r.model}</span>
                    <span className="wlc-row-data">{r.data}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {rows.length === 0 && !metricsFailed && (
            <p className="wlc-muted">Loading model information…</p>
          )}
          {rows.length === 0 && metricsFailed && backend !== "offline" && (
            <p className="wlc-muted">Model metrics are unavailable right now.</p>
          )}

          <div className="wlc-note">
            <Info size={14} aria-hidden="true" />
            <span>
              Demo mode analyses synthetic telemetry, not real vehicle data. You can upload
              your own telemetry CSV from the dashboard.
            </span>
          </div>
        </aside>
      </div>

      <p className="wlc-foot">
        Figures above are the evaluation metrics stored with the trained models. RUL is
        trained on NASA C-MAPSS aircraft turbofan data, not passenger-car data. This is a
        diagnostic aid for demonstration and education, not a replacement for inspection
        by a certified technician.
      </p>
    </main>
  );
}