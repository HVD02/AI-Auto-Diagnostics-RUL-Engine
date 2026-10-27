import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, ArrowRight, Brain, Database, FileUp, HeartPulse, Info,
  LineChart, Radar, ShieldCheck, Stethoscope, TrendingDown, Wrench,
} from "lucide-react";
import { getHealth, getModelMetrics } from "../api";
import ThemeToggle from "../components/ThemeToggle.jsx";
import "./Welcome.css";

const TAGS = ["Vehicle health", "Sensor intelligence", "Fault analysis", "RUL prediction"];

const BACKEND_LABEL = {
  checking: "Checking backend…",
  online: "Backend online",
  offline: "Backend offline",
};

const STEPS = [
  {
    n: "01 / INGEST", icon: FileUp, title: "Validate the signal",
    text: "Upload a telemetry CSV or choose a synthetic demo scenario. Data-quality and sensor-plausibility checks run first, so unreliable inputs are flagged before anything is scored.",
  },
  {
    n: "02 / DETECT", icon: Radar, title: "Spot unusual behaviour",
    text: "A one-class anomaly model flags unusual windows and ranks the sensors that deviate most within the analysed window.",
  },
  {
    n: "03 / EXPLAIN", icon: Brain, title: "Show the reasoning",
    text: "Fault classification on EngineFaultDB comes with SHAP explanations that show which inputs drove a prediction.",
  },
  {
    n: "04 / PLAN", icon: Wrench, title: "Plan the next check",
    text: "A documented health-score formula, RUL estimates and maintenance checks retrieved from a real fault knowledge base. Retrieved, never generated.",
  },
];

const CAPS = [
  { to: "/health", icon: HeartPulse, title: "Vehicle health",
    text: "One score built from a disclosed additive formula, with every contribution shown rather than hidden." },
  { to: "/anomaly", icon: Radar, title: "Anomaly detection",
    text: "Relative anomaly intensity across a window, with the most deviating sensors ranked." },
  { to: "/sensors", icon: LineChart, title: "Sensor analytics",
    text: "Compare channels side by side and spot stuck or implausible sensors." },
  { to: "/diagnostics", icon: Stethoscope, title: "Fault diagnosis",
    text: "Fault classes from EngineFaultDB. Classes 1–3 are unnamed in the source data and are reported as such." },
  { to: "/rul", icon: TrendingDown, title: "Remaining useful life",
    text: "A prognostics method validated on NASA C-MAPSS aircraft turbofan data, not passenger-car data." },
  { to: "/xai", icon: Brain, title: "Explainable AI",
    text: "SHAP feature contributions for individual diagnoses, so a prediction is never a black box." },
];

const DATASETS = [
  { name: "EngineFaultDB", tone: "ok", status: "Real data",
    text: "Fault-diagnosis training and evaluation. Unnamed fault classes appear as Fault Class 1–3." },
  { name: "NASA C-MAPSS FD001", tone: "ok", status: "Real data",
    text: "RUL methodology only. Aircraft turbofan engines, not passenger cars." },
  { name: "Automotive Faults dataset", tone: "ok", status: "Real data",
    text: "Maintenance knowledge retrieval over 99 documented entries. Entries are retrieved, not generated." },
  { name: "Synthetic demo telemetry", tone: "warn", status: "Synthetic",
    text: "Powers the demo scenarios and the anomaly benchmark. Not real vehicle data." },
  { name: "EngineAD", tone: "neutral", status: "Not included",
    text: "Real fleet data is access-gated by its authors, so it is not part of this build." },
];

function fmt(value, digits = 2) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "—";
}

// Builds tiles ONLY from fields /api/model-metrics already returns (the same
// ones Dashboard.jsx reads). Dataset labels describe each model's data.
function buildTiles(m) {
  if (!m) return [];
  const an = m.anomaly;
  const anomalyF1 = an?.model_comparison?.[an?.best_model]?.f1;
  return [
    {
      key: "diagnosis", name: "Fault diagnosis", label: "macro-F1",
      value: fmt(m.diagnosis?.test_metrics?.test_f1_macro), unit: "",
      model: m.diagnosis?.best_model || "—", data: "EngineFaultDB · held-out test",
    },
    {
      key: "rul", name: "RUL prediction", label: "MAE",
      value: fmt(m.rul?.test_metrics?.test_mae, 1), unit: "cycles",
      model: m.rul?.best_model || "—", data: "NASA C-MAPSS FD001 · aircraft turbofan, not passenger cars",
    },
    {
      key: "anomaly", name: "Anomaly detection", label: "F1",
      value: fmt(anomalyF1), unit: "",
      model: an?.best_model || "—", data: "Synthetic demo telemetry",
    },
  ];
}

export default function Welcome() {
  const [backend, setBackend] = useState("checking");
  const [metrics, setMetrics] = useState(null);
  const [metricsFailed, setMetricsFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getHealth()
      .then(h => { if (!cancelled) setBackend(h?.status === "ok" ? "online" : "offline"); })
      .catch(() => { if (!cancelled) setBackend("offline"); });
    getModelMetrics()
      .then(m => { if (!cancelled) setMetrics(m); })
      .catch(() => { if (!cancelled) setMetricsFailed(true); });
    return () => { cancelled = true; };
  }, []);

  const tiles = buildTiles(metrics);

  return (
    <div className="lp">
      <div className="lp-bg" aria-hidden="true" />

      <header className="lp-header">
        <div className="lp-wrap lp-header-inner">
          <Link to="/" className="lp-brand" aria-label="AI Auto-Diagnostics and RUL Engine, home">
            <span className="lp-mark" aria-hidden="true"><Activity size={17} /></span>
            <span className="lp-brand-text">
              <span className="lp-brand-name">AI Auto-Diagnostics</span>
              <span className="lp-brand-sub">Automotive intelligence</span>
            </span>
          </Link>
          <nav className="lp-nav" aria-label="Page sections">
            <a href="#capabilities">Capabilities</a>
            <a href="#pipeline">Pipeline</a>
            <a href="#data">Data &amp; limits</a>
          </nav>
          <div className="lp-header-actions">
            <ThemeToggle />
            <Link to="/dashboard" className="lp-btn lp-btn-primary lp-btn-sm">
              Workspace <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="lp-hero" aria-labelledby="lp-title">
          <div className="lp-wrap lp-hero-grid">
            <div className="lp-hero-copy">
              <div className="lp-eyebrow">
                <span className="lp-eyebrow-dot" aria-hidden="true" />
                Automotive intelligence platform
              </div>
              <h1 id="lp-title" className="lp-title">
                Understand the signal. <span className="lp-accent">Anticipate the failure.</span>
              </h1>
              <p className="lp-lede">
                Vehicle health, sensor anomalies, fault diagnosis and remaining useful life, brought
                together in one transparent diagnostic workspace.
              </p>
              <p className="lp-support">
                Built to show what the models know, what the data supports, and where uncertainty
                remains. Demo mode runs on synthetic telemetry, and you can upload your own CSV from
                the workspace.
              </p>
              <div className="lp-cta-row">
                <Link to="/dashboard" className="lp-btn lp-btn-primary">
                  Enter diagnostics <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <a href="#pipeline" className="lp-btn lp-btn-ghost">See how it works</a>
              </div>
              <ul className="lp-tags" aria-label="Capabilities">
                {TAGS.map(t => <li className="lp-tag" key={t}>{t}</li>)}
              </ul>
            </div>

            <aside className="lp-preview" aria-label="Pipeline status and model metrics">
              <div className="lp-preview-head">
                <span className="lp-preview-title">Pipeline status</span>
                <span className={`lp-status lp-status-${backend}`} role="status" aria-live="polite">
                  <span className="lp-status-dot" aria-hidden="true" />
                  {BACKEND_LABEL[backend]}
                </span>
              </div>

              {backend === "offline" && (
                <p className="lp-offline">
                  The backend is not reachable. Start it from the <code>backend</code> folder with{" "}
                  <code>uvicorn main:app --reload</code>, then refresh this page.
                </p>
              )}

              {tiles.length > 0 && (
                <ul className="lp-tiles">
                  {tiles.map(t => (
                    <li className="lp-tile" key={t.key}>
                      <span className="lp-tile-kicker">{t.name}</span>
                      <span className="lp-tile-value">
                        <span className="lp-tile-label">{t.label}</span>
                        {t.value}
                        {t.unit && <small>{t.unit}</small>}
                      </span>
                      <span className="lp-tile-model">{t.model}</span>
                      <span className="lp-tile-data">{t.data}</span>
                    </li>
                  ))}
                </ul>
              )}
              {tiles.length === 0 && !metricsFailed && (
                <p className="lp-muted">Loading model information…</p>
              )}
              {tiles.length === 0 && metricsFailed && backend !== "offline" && (
                <p className="lp-muted">Model metrics are unavailable right now.</p>
              )}

              <figure className="lp-signal">
                <svg viewBox="0 0 400 80" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                  <path className="lp-signal-base" d="M0 40 H400" />
                  <path
                    className="lp-signal-line"
                    pathLength="1"
                    d="M0 44 L24 41 L44 46 L66 38 L88 43 L108 36 L124 20 L138 62 L154 30 L172 45 L196 40 L220 47 L242 35 L262 42 L284 38 L304 14 L318 66 L334 34 L358 43 L378 39 L400 42"
                  />
                </svg>
                <figcaption>Illustrative signal graphic · not live data</figcaption>
              </figure>

              <div className="lp-note">
                <Info size={14} aria-hidden="true" />
                <span>
                  Metrics are the evaluation figures stored with the trained models. They describe
                  each model on its own dataset, not on your vehicle.
                </span>
              </div>
            </aside>
          </div>
        </section>

        <section className="lp-section" id="capabilities" aria-labelledby="lp-caps-title">
          <div className="lp-wrap">
            <div className="lp-section-head">
              <div className="lp-eyebrow"><span className="lp-eyebrow-dot" aria-hidden="true" />What you can do</div>
              <h2 id="lp-caps-title">Six views, one connected workflow.</h2>
              <p>Each card opens the real page in the workspace.</p>
            </div>
            <ul className="lp-caps">
              {CAPS.map(c => (
                <li key={c.to}>
                  <Link to={c.to} className="lp-cap">
                    <span className="lp-cap-icon" aria-hidden="true"><c.icon size={18} /></span>
                    <h3>{c.title}</h3>
                    <p>{c.text}</p>
                    <span className="lp-cap-link">Open <ArrowRight size={13} aria-hidden="true" /></span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="lp-section lp-section-alt" id="pipeline" aria-labelledby="lp-pipe-title">
          <div className="lp-wrap">
            <div className="lp-section-head">
              <div className="lp-eyebrow"><span className="lp-eyebrow-dot" aria-hidden="true" />The pipeline</div>
              <h2 id="lp-pipe-title">From raw signal to reasoned action.</h2>
              <p>The important result comes first. Evidence, context and next steps sit one click away.</p>
            </div>
            <ol className="lp-steps">
              {STEPS.map(s => (
                <li className="lp-step" key={s.n}>
                  <span className="lp-step-n">{s.n}</span>
                  <span className="lp-cap-icon" aria-hidden="true"><s.icon size={18} /></span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lp-section" id="data" aria-labelledby="lp-data-title">
          <div className="lp-wrap lp-honest">
            <div>
              <div className="lp-eyebrow"><span className="lp-eyebrow-dot" aria-hidden="true" />Trust is a feature</div>
              <h2 id="lp-data-title">Useful AI is honest about its limits.</h2>
              <p className="lp-honest-copy">
                Every model here is tied to the dataset it was trained and evaluated on. Provenance and
                limitations are part of the interface, not buried in a footer.
              </p>
              <div className="lp-callout" role="note">
                <ShieldCheck size={18} aria-hidden="true" />
                <div>
                  <strong>Important:</strong> Remaining useful life is trained on NASA C-MAPSS aircraft
                  turbofan data. It demonstrates a prognostics method and is not a passenger-car RUL
                  model. Anomaly figures are measured on synthetic telemetry. This is a diagnostic aid
                  for demonstration and education, not a replacement for a certified technician.
                </div>
              </div>
            </div>
            <ul className="lp-data-list">
              {DATASETS.map(d => (
                <li className="lp-data-row" key={d.name}>
                  <span className="lp-cap-icon" aria-hidden="true"><Database size={17} /></span>
                  <span className="lp-data-text">
                    <span className="lp-data-name">
                      {d.name}
                      <span className={`lp-chip lp-chip-${d.tone}`}>{d.status}</span>
                    </span>
                    <span className="lp-data-desc">{d.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-inner">
          <p>
            AI Auto-Diagnostics &amp; RUL Engine · v2.0.0 · A decision-support aid for research and
            education. Do not use it as the sole basis for a safety-critical maintenance decision.
          </p>
          <nav aria-label="Footer">
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/models">Model Analytics</Link>
            <Link to="/about">Settings / About</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}