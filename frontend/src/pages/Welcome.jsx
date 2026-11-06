import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, ArrowDown, ArrowRight, ArrowUpRight, Brain, Database, HeartPulse, Info,
  LineChart, Radar, ShieldCheck, Stethoscope, TrendingDown, Wrench,
} from "lucide-react";
import { getHealth, getModelMetrics } from "../api";
import ThemeToggle from "../components/ThemeToggle.jsx";
import CarStage from "../components/CarStage.jsx";
import "./Welcome.css";

// Version label for the footer. Bump together with package.json at the final release.
const APP_VERSION = "2.0.0";
const REPO_URL = "https://github.com/HVD02/AI-Auto-Diagnostics-RUL-Engine";

const TAGS = ["Anomaly intelligence", "Explainable diagnosis", "RUL prognostics"];

const BACKEND_LABEL = {
  checking: "Checking backend…",
  online: "Backend online",
  offline: "Backend offline",
};

// Four workflow cards (prototype layout, statements taken from the README).
const STEPS = [
  { n: "01 / VALIDATE", icon: ShieldCheck, tone: "lime", title: "Prepare the signal",
    text: "Check schema, missing values, duplicates, timestamps and physical plausibility before analysis begins." },
  { n: "02 / DETECT", icon: Radar, tone: "aqua", title: "Find the deviation",
    text: "Compare sensor behaviour, surface anomalies and rank the signals that deserve a closer look." },
  { n: "03 / EXPLAIN", icon: Brain, tone: "violet", title: "Show the reasoning",
    text: "Bring fault classes, SHAP feature contributions and limitations into the same visual field." },
  { n: "04 / PLAN", icon: Wrench, tone: "orange", title: "Prioritise the check",
    text: "Explore prognostics and maintenance references without presenting a model estimate as certainty." },
];

// Links into the real workspace pages (unchanged routes).
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
  { name: "EngineFaultDB", role: "DIAGNOSIS", tone: "ok", status: "Real data",
    text: "Fault-diagnosis training and evaluation. Unnamed fault classes appear as Fault Class 1–3." },
  { name: "NASA C-MAPSS FD001", role: "PROGNOSTICS", tone: "ok", status: "Real data",
    text: "RUL methodology only. Aircraft turbofan engines, not passenger cars." },
  { name: "Automotive Faults dataset", role: "REFERENCE", tone: "ok", status: "Real data",
    text: "Maintenance knowledge retrieval. Entries are retrieved, not generated, and are not a diagnosis." },
  { name: "Synthetic demo telemetry", role: "DEMO MODE", tone: "warn", status: "Synthetic",
    text: "Powers the demo scenarios and the anomaly benchmark. Not real vehicle data." },
  { name: "EngineAD", role: "RESEARCH REFERENCE", tone: "neutral", status: "Not included",
    text: "Real fleet data is access-gated by its authors, so it is not part of this build." },
];

// Methodology (compared models are documented in the README; "selected" comes live from the backend).
const METHODS = [
  { key: "anomaly", title: "Anomaly detection",
    compared: "Isolation Forest · One-Class SVM · Local Outlier Factor",
    data: "Synthetic demo telemetry, trained one-class on the healthy scenario." },
  { key: "diagnosis", title: "Fault diagnosis",
    compared: "Logistic Regression · Random Forest · SVM · XGBoost",
    data: "EngineFaultDB, evaluated on a held-out test set." },
  { key: "rul", title: "Remaining useful life",
    compared: "Random Forest · Gradient Boosting · XGBoost regression",
    data: "NASA C-MAPSS FD001 with an engine-level split. Aircraft turbofan data." },
];

function fmt(value, digits = 2) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "—";
}

// Benchmark items are built ONLY from fields /api/model-metrics already returns
// (the same ones Dashboard.jsx reads). With no metrics, stable placeholders are shown.
function buildBenchmarks(m) {
  const an = m?.anomaly;
  const anomalyF1 = an?.model_comparison?.[an?.best_model]?.f1;
  return [
    {
      key: "anomaly", label: "F1", unit: "F1", value: fmt(anomalyF1),
      caption: "Anomaly / synthetic demo telemetry", model: an?.best_model || "",
    },
    {
      key: "diagnosis", label: "macro-F1", unit: "F1", value: fmt(m?.diagnosis?.test_metrics?.test_f1_macro),
      caption: "Diagnosis / EngineFaultDB", model: m?.diagnosis?.best_model || "",
    },
    {
      key: "rul", label: "MAE", unit: "cycles", value: fmt(m?.rul?.test_metrics?.test_mae, 1),
      caption: "RUL MAE / NASA C-MAPSS FD001", model: m?.rul?.best_model || "",
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

  const benches = buildBenchmarks(metrics);
  let benchHint = "Documented evaluation · dataset-specific";
  if (!metrics && !metricsFailed) benchHint = "Loading model information…";
  if (!metrics && metricsFailed) benchHint = "Model metrics are unavailable right now";

  return (
    <div className="lp">
      <header className="lp-header">
        <div className="lp-header-inner">
          <Link to="/" className="lp-brand" aria-label="AI Auto-Diagnostics and RUL Engine, home">
            <span className="lp-mark" aria-hidden="true"><Activity size={22} strokeWidth={2.4} /></span>
            <span className="lp-brand-text">
              <span className="lp-brand-name">AI AUTO-DIAGNOSTICS</span>
              <span className="lp-brand-sub">RUL Engine / Intelligence studio</span>
            </span>
          </Link>
          <nav className="lp-nav" aria-label="Page sections">
            <a href="#workflow">Platform</a>
            <a href="#capabilities">Capabilities</a>
            <a href="#benchmarks">Model results</a>
            <a href="#provenance">Data &amp; limits</a>
          </nav>
          <div className="lp-header-actions">
            <ThemeToggle />
            <a
              className="lp-btn lp-btn-outline lp-btn-sm lp-gh"
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub repository (opens in a new tab)"
            >
              GitHub <ArrowUpRight size={14} aria-hidden="true" />
            </a>
            <Link to="/dashboard" className="lp-btn lp-btn-lime lp-btn-sm">
              Workspace <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="lp-hero" aria-labelledby="lp-title">
          <div className="lp-hero-grid">
            <div className="lp-hero-copy">
              <div className="lp-eyebrow">Automotive intelligence / research edition</div>
              <h1 id="lp-title" className="lp-title">
                Know what’s<br />happening <em>under</em><br />the hood.
              </h1>
              <p className="lp-lede">
                A diagnostic cockpit for vehicle telemetry. Spot unusual signals, investigate likely
                faults, understand model behaviour and explore predictive-maintenance workflows, all
                in one connected workspace.
              </p>
              <p className="lp-support">
                Demo mode runs on synthetic telemetry, and you can upload your own CSV from the
                workspace.
              </p>
              <p className="lp-note-line">DETECT THE PATTERN. EXPLAIN THE SIGNAL. PLAN THE NEXT CHECK.</p>
              <div className="lp-cta-row">
                <Link to="/dashboard" className="lp-btn lp-btn-lime">
                  Enter the diagnostic cockpit <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
                <a href="#workflow" className="lp-btn lp-btn-outline">
                  Explore the platform <ArrowDown size={16} aria-hidden="true" />
                </a>
              </div>
              <ul className="lp-tags" aria-label="Highlights">
                {TAGS.map(t => <li className="lp-tag" key={t}><b aria-hidden="true">✳</b>{t}</li>)}
              </ul>
            </div>

            <div className="lp-stage">
              <CarStage />
              <p className="lp-stage-caption">
                Illustrative scan graphic. Sample labels on the stage are not live backend results.
              </p>
            </div>
          </div>
          <div className="lp-scroll" aria-hidden="true">
            <span><i className="lp-scroll-line" />Scroll to inspect the system</span>
            <span>01 / 04 — SIGNAL TO SERVICE</span>
          </div>
        </section>

        <section className="lp-bench" id="benchmarks" aria-labelledby="lp-bench-title">
          <div className="lp-bench-inner">
            <div className="lp-bench-intro">
              <h2 id="lp-bench-title">MODEL BENCHMARKS</h2>
              <span>{benchHint}</span>
              <span className={`lp-status lp-status-${backend}`} role="status" aria-live="polite">
                <span className="lp-status-dot" aria-hidden="true" />
                {BACKEND_LABEL[backend]}
              </span>
            </div>
            {benches.map(b => (
              <div className="lp-bench-item" key={b.key}>
                <strong>
                  {b.value}
                  {b.value !== "—" && <em> {b.unit}</em>}
                </strong>
                <small>{b.caption}</small>
                {b.model && <span className="lp-bench-model">{b.model}</span>}
              </div>
            ))}
          </div>
          {backend === "offline" && (
            <p className="lp-offline">
              The backend is not reachable. Start it from the <code>backend</code> folder with{" "}
              <code>uvicorn main:app --reload</code>, then refresh this page.
            </p>
          )}
          <p className="lp-bench-note">
            <Info size={13} aria-hidden="true" />
            <span>
              Figures are the evaluation metrics stored with the trained models. They describe each
              model on its own dataset, not your vehicle.
            </span>
          </p>
        </section>

        <section className="lp-section" id="workflow" aria-labelledby="lp-flow-title">
          <div className="lp-section-head">
            <div>
              <div className="lp-eyebrow">From data to decision support</div>
              <h2 id="lp-flow-title">Four moves.<br />One diagnostic story.</h2>
            </div>
            <p>
              Put the evidence first. Give every model output a clear context, then make the next
              inspection step easy to understand.
            </p>
          </div>
          <ol className="lp-flow">
            {STEPS.map(s => (
              <li className={`lp-card lp-flow-card lp-tone-${s.tone}`} key={s.n}>
                <div className="lp-flow-top">
                  <span>{s.n}</span>
                  <span className="lp-icon" aria-hidden="true"><s.icon size={19} /></span>
                </div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="lp-section lp-section-tight" id="capabilities" aria-labelledby="lp-caps-title">
          <div className="lp-section-head">
            <div>
              <div className="lp-eyebrow">The workspace</div>
              <h2 id="lp-caps-title">Six views, one connected workflow.</h2>
            </div>
            <p>Each card opens the real page in the workspace.</p>
          </div>
          <ul className="lp-caps">
            {CAPS.map(c => (
              <li key={c.to}>
                <Link to={c.to} className="lp-card lp-cap">
                  <span className="lp-icon lp-tone-lime" aria-hidden="true"><c.icon size={18} /></span>
                  <h3>{c.title}</h3>
                  <p>{c.text}</p>
                  <span className="lp-cap-link">Open <ArrowRight size={13} aria-hidden="true" /></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="lp-section lp-section-tight" id="provenance" aria-labelledby="lp-data-title">
          <div className="lp-split">
            <div className="lp-split-copy">
              <div className="lp-eyebrow">Research transparency / built in</div>
              <h2 id="lp-data-title">Good AI makes its boundaries visible.</h2>
              <p>
                The interface distinguishes synthetic demo telemetry, supported automotive fault
                samples and aircraft-engine prognostics. That clarity is part of the product, not a
                footnote.
              </p>
              <div className="lp-caution" role="note">
                <b>Important RUL context:</b> NASA C-MAPSS FD001 contains aircraft turbofan data. It
                demonstrates the prognostics workflow; it is not a passenger-car remaining-life
                model. Anomaly figures are measured on synthetic telemetry.
              </div>
            </div>
            <ul className="lp-data-list">
              {DATASETS.map(d => (
                <li className="lp-data-row" key={d.name}>
                  <span className="lp-icon" aria-hidden="true"><Database size={17} /></span>
                  <span className="lp-data-text">
                    <strong>{d.name}</strong>
                    <small>{d.text}</small>
                  </span>
                  <span className="lp-data-side">
                    <span className="lp-data-role">{d.role}</span>
                    <span className={`lp-chip lp-chip-${d.tone}`}>{d.status}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="lp-section lp-section-tight" aria-labelledby="lp-method-title">
          <div className="lp-section-head">
            <div>
              <div className="lp-eyebrow">Methodology</div>
              <h2 id="lp-method-title">How each model was chosen.</h2>
            </div>
            <p>
              Every module benchmarks several approaches on its own dataset. The selected model is
              read from the backend.
            </p>
          </div>
          <ul className="lp-method">
            {METHODS.map(x => {
              const selected = metrics?.[x.key]?.best_model;
              return (
                <li className="lp-card lp-method-card" key={x.key}>
                  <h3>{x.title}</h3>
                  <dl>
                    <div><dt>Compared</dt><dd>{x.compared}</dd></div>
                    <div><dt>Selected</dt><dd className="mono">{selected || "—"}</dd></div>
                    <div><dt>Data</dt><dd>{x.data}</dd></div>
                  </dl>
                </li>
              );
            })}
          </ul>
          <div className="lp-safety" role="note">
            <ShieldCheck size={18} aria-hidden="true" />
            <p>
              <strong>Responsible use.</strong> This system is an educational and research
              demonstration. It is a diagnostic aid and does not replace inspection by a qualified
              automotive technician. Do not use it as the sole basis for a safety-critical
              maintenance decision.
            </p>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <p>
            AI AUTO-DIAGNOSTICS &amp; RUL ENGINE · v{APP_VERSION}
            <span> Decision support for research and education · Not a replacement for certified inspection</span>
          </p>
          <nav aria-label="Footer">
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/models">Model Analytics</Link>
            <Link to="/about">Settings / About</Link>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub ↗</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}