import React, { useState } from "react";
import { Search } from "lucide-react";
import { Card, Loading, ErrorBox, Empty } from "../components/ui.jsx";
import { maintenanceSearch } from "../api";
import { useAnalysis } from "../useAnalysis.js";

export default function MaintenanceCenter() {
  const { data } = useAnalysis();
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const search = (query) => {
    if (!query) return;
    setLoading(true);
    maintenanceSearch(query).then(d => setResults(d.results)).finally(() => setLoading(false));
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Maintenance Center</h2>
        <p>Knowledge retrieved from the Automotive Faults dataset (99 documented fault entries with symptoms &amp; diagnosis steps). This is a retrieval layer — it never invents a diagnosis.</p>
      </div>

      <Card title="Search diagnostic knowledge base">
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ flex: 1, background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--text-0)", padding: "8px 12px", fontSize: 13 }}
            placeholder="e.g. coolant, brake pedal, battery voltage…"
            value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === "Enter" && search(q)}
          />
          <button className="btn btn-primary btn-sm" onClick={() => search(q)}><Search size={13} /> Search</button>
        </div>
      </Card>

      <div style={{ height: 14 }} />

      {loading && <Loading />}

      {results && (
        <div className="grid grid-2">
          {results.map((r, i) => (
            <Card key={i} title={`${r.category} — ${r.subcategory}`}>
              <div className="section-label">Symptoms</div>
              <div className="pill-row" style={{ marginBottom: 10 }}>
                {r.symptoms.map((s, j) => <span key={j} className="badge badge-neutral">{s}</span>)}
              </div>
              <div className="section-label">Diagnosis Steps</div>
              <ol style={{ fontSize: 12.5, color: "var(--text-1)", paddingLeft: 18, margin: 0 }}>
                {r.diagnosis_steps.map((step, j) => (
                  <li key={j} style={{ marginBottom: 4 }}>
                    {step.step} {step.result && <span style={{ color: "var(--text-2)" }}>({step.result.join(" / ")})</span>}
                  </li>
                ))}
              </ol>
            </Card>
          ))}
        </div>
      )}

      {!results && (
        <>
          <div className="section-label">Current vehicle's maintenance priority</div>
          {data?.maintenance?.length ? (
            <div className="grid grid-2">
              {data.maintenance.map((m, i) => (
                <Card key={i} title={`${m.category} — ${m.subcategory}`}>
                  <div className="pill-row" style={{ marginBottom: 10 }}>
                    {m.symptoms?.map((s, j) => <span key={j} className="badge badge-neutral">{s}</span>)}
                  </div>
                  <ol style={{ fontSize: 12.5, color: "var(--text-1)", paddingLeft: 18, margin: 0 }}>
                    {m.diagnosis_steps?.map((step, j) => (
                      <li key={j} style={{ marginBottom: 4 }}>{step.step}</li>
                    ))}
                  </ol>
                </Card>
              ))}
            </div>
          ) : <Empty label="No maintenance items retrieved for the current vehicle." />}
        </>
      )}
    </div>
  );
}
