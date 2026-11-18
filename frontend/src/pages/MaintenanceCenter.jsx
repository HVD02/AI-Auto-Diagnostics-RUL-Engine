import React, { useRef, useState } from "react";
import { Search, ExternalLink, X } from "lucide-react";
import { Loading, ErrorBox, Empty, InfoBox } from "../components/ui.jsx";
import { ModuleHeader, Panel } from "../components/DiagnosisParts.jsx";
import { maintenanceSearch } from "../api";
import { useAnalysis } from "../useAnalysis.js";
import "./DiagnosisPages.css";
import "./DataPages.css";

const EXAMPLES = ["coolant", "brake pedal", "battery voltage"];

// main.py serves the flowchart folder at /static/flowcharts (proxied by Vite / Vercel).
const flowchartUrl = (file) => `/static/flowcharts/${encodeURIComponent(file)}`;

function Entry({ m, withOutcomes }) {
  const symptoms = Array.isArray(m.symptoms) ? m.symptoms : [];
  const steps = Array.isArray(m.diagnosis_steps) ? m.diagnosis_steps : [];
  return (
    <article className="dp-entry">
      <h3>{m.category} <span className="dp-sep">/</span> {m.subcategory}</h3>
      {symptoms.length > 0 && (
        <>
          <div className="dp-label">SYMPTOMS</div>
          <div className="dp-pills dp-pills-tight">{symptoms.map((s, j) => <span key={j} className="badge badge-neutral">{s}</span>)}</div>
        </>
      )}
      {steps.length > 0 && (
        <>
          <div className="dp-label">DIAGNOSIS STEPS</div>
          <ol className="dp-steps">
            {steps.map((step, j) => (
              <li key={j}>
                {step.step}
                {withOutcomes && Array.isArray(step.result) && step.result.length > 0 && <span className="dp-steps-out"> ({step.result.join(" / ")})</span>}
              </li>
            ))}
          </ol>
        </>
      )}
      {m.flowchart && (
        <a className="dp-link" href={flowchartUrl(m.flowchart)} target="_blank" rel="noopener noreferrer">
          Open flowchart <ExternalLink size={12} aria-hidden="true" />
        </a>
      )}
    </article>
  );
}

export default function MaintenanceCenter() {
  const { data } = useAnalysis();
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [searched, setSearched] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const reqId = useRef(0);

  // A request id makes sure only the latest search can update the page.
  const search = (query) => {
    const text = (query || "").trim();
    if (!text) return;
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    maintenanceSearch(text)
      .then(d => { if (id === reqId.current) { setResults(d.results); setSearched(text); } })
      .catch(e => { if (id === reqId.current) setError(e?.response?.data?.detail || e.message); })
      .finally(() => { if (id === reqId.current) setLoading(false); });
  };
  const clear = () => { reqId.current += 1; setResults(null); setError(null); setLoading(false); setSearched(""); };

  return (
    <div className="page dgx-page">
      <ModuleHeader eyebrow="Act / maintenance knowledge" title="Maintenance Center" source={<span className="dp-chip">Automotive Faults dataset</span>}>
        <p>
          Knowledge retrieved from the Automotive Faults dataset (Knowledge retrieved from the Automotive Faults dataset, containing documented symptoms and diagnostic steps). This is a retrieval layer — it never invents a diagnosis.
        </p>
      </ModuleHeader>

      <InfoBox>Retrieved entries are documented checks matched by keyword. They are not a confirmed diagnosis of any vehicle.</InfoBox>

      <Panel title="Search diagnostic knowledge base" sub="Search symptoms, systems or components">
        <form className="dp-search" role="search" onSubmit={e => { e.preventDefault(); search(q); }}>
          <label className="dp-search-field">
            <Search size={14} aria-hidden="true" />
            <span className="dp-sr">Search the knowledge base</span>
            <input type="search" placeholder="e.g. coolant, brake pedal, battery voltage…" value={q} onChange={e => setQ(e.target.value)} />
          </label>
          <button type="submit" className="btn btn-primary btn-sm" disabled={loading || !q.trim()}><Search size={13} aria-hidden="true" /> Search</button>
        </form>
        <div className="dp-pills dp-pills-tight">
          <span className="dp-label dp-label-inline">TRY</span>
          {EXAMPLES.map(ex => (
            <button type="button" key={ex} className="btn btn-sm" onClick={() => { setQ(ex); search(ex); }}>{ex}</button>
          ))}
        </div>
      </Panel>

      {loading && <Loading label="Searching the knowledge base…" />}
      {error && (
        <div className="dgx-error">
          <ErrorBox message={error} />
          <button type="button" className="btn btn-sm" onClick={() => search(q)} disabled={loading || !q.trim()}>Try again</button>
        </div>
      )}

      {results && (
        <section aria-label="Search results">
          <div className="dp-results-head">
            <h2 className="dp-h2">{results.length} result{results.length === 1 ? "" : "s"} for “{searched}”</h2>
            <button type="button" className="btn btn-sm" onClick={clear}><X size={13} aria-hidden="true" /> Clear search</button>
          </div>
          {results.length === 0 ? (
            <Empty label="No documented entries match this search. Try a different symptom or component." />
          ) : (
            <div className="dp-grid">{results.map((r, i) => <Entry key={i} m={r} withOutcomes />)}</div>
          )}
        </section>
      )}

      {!results && (
        <section aria-label="Current vehicle maintenance priority">
          <h2 className="dp-h2">Current vehicle's maintenance priority</h2>
          {data?.maintenance?.length ? (
            <div className="dp-grid">{data.maintenance.map((m, i) => <Entry key={i} m={m} />)}</div>
          ) : <Empty label="No maintenance items retrieved for the current vehicle." />}
        </section>
      )}
    </div>
  );
}