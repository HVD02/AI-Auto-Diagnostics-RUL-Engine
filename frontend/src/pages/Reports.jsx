import React, { useEffect, useRef, useState } from "react";
import { FileText, Download, RefreshCw } from "lucide-react";
import { Loading, Empty, ErrorBox, InfoBox } from "../components/ui.jsx";
import { ModuleHeader, Panel } from "../components/DiagnosisParts.jsx";
import { createReport, getReports, reportDownloadUrl } from "../api";
import { useVehicle } from "../VehicleContext.jsx";
import "./DiagnosisPages.css";
import "./DataPages.css";

const errMsg = (e) => e?.response?.data?.detail || e.message;

export default function Reports() {
  const { vehicleId, dataSource } = useVehicle();
  const isUpload = dataSource?.mode === "upload";
  const reportKey = isUpload ? "UPLOADED" : vehicleId;
  const displayLabel = isUpload ? dataSource.filename : vehicleId;
  const [reports, setReports] = useState(null);
  const [listError, setListError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);
  const reqId = useRef(0);

  // The request id stops a slow list for an earlier vehicle from replacing the current one.
  const load = () => {
    if (!reportKey) return Promise.resolve();
    const id = ++reqId.current;
    setListError(null);
    return getReports(reportKey)
      .then(d => { if (id === reqId.current) setReports(d.reports); })
      .catch(e => { if (id === reqId.current) setListError(errMsg(e)); });
  };
  useEffect(() => { setReports(null); load(); return () => { reqId.current += 1; }; }, [reportKey]);

  const generate = () => {
    setGenerating(true);
    setGenError(null);
    createReport(reportKey)
      .then(() => load())
      .catch(e => setGenError(errMsg(e)))
      .finally(() => setGenerating(false));
  };

  return (
    <div className="page dgx-page">
      <ModuleHeader
        eyebrow="Act / reporting"
        title="Reports"
        source={<span className={`dp-chip ${isUpload ? "dp-chip-accent" : "dp-chip-warn"}`}>{isUpload ? "Your uploaded telemetry" : "Synthetic demo telemetry"}</span>}
      >
        <p>Generates a real PDF from the current pipeline output — health score, anomalies, diagnosis, SHAP, RUL and maintenance recommendation.</p>
      </ModuleHeader>

      <Panel title={`Generate report for ${displayLabel || "…"}`} sub="Creates a PDF from the backend's current analysis of this vehicle">
        <div className="dp-actions">
          <button type="button" className="btn btn-primary" onClick={generate} disabled={generating || !reportKey}>
            <FileText size={14} aria-hidden="true" /> {generating ? "Generating…" : "Generate PDF Report"}
          </button>
          <button type="button" className="btn btn-sm" onClick={load} disabled={generating || !reportKey}>
            <RefreshCw size={13} aria-hidden="true" /> Refresh list
          </button>
        </div>
        <p className="dgx-cap">The report reflects model outputs for the analysed window. It is a diagnostic aid, not a certified inspection report.</p>
        {genError && (
          <div className="dgx-error dp-gap">
            <ErrorBox message={`Report generation failed: ${genError}`} />
            <button type="button" className="btn btn-sm" onClick={generate} disabled={generating}>Try again</button>
          </div>
        )}
      </Panel>

      {listError && (
        <div className="dgx-error">
          <ErrorBox message={`Could not load reports: ${listError}`} />
          <button type="button" className="btn btn-sm" onClick={load}>Try again</button>
        </div>
      )}
      {reports === null && !listError && <Loading label="Loading reports…" />}
      {reports && reports.length === 0 && <Empty label="No reports generated yet for this vehicle." icon={FileText} />}
      {reports && reports.length > 0 && (
        <Panel title="Generated reports" sub={`${reports.length} report${reports.length === 1 ? "" : "s"} for ${displayLabel}`}>
          <ul className="dp-table dp-table-3" aria-label="Generated reports">
            <li className="dp-table-head" aria-hidden="true"><span>Vehicle</span><span>Generated</span><span /></li>
            {reports.map(r => (
              <li key={r.id} className="dp-table-row">
                <span className="dp-cell mono" data-label="Vehicle">{r.vehicle_id}</span>
                <span className="dp-cell mono" data-label="Generated">{new Date(r.created_at * 1000).toLocaleString()}</span>
                <span className="dp-cell dp-cell-end">
                  {r.file_path ? (
                    <a className="btn btn-sm" href={reportDownloadUrl(r.file_path)} target="_blank" rel="noreferrer">
                      <Download size={12} aria-hidden="true" /> Download
                    </a>
                  ) : <span className="dp-cap">File unavailable</span>}
                </span>
              </li>
            ))}
          </ul>
          <InfoBox>If a download does not open, generate a new report: the file may have been removed from the backend's storage.</InfoBox>
        </Panel>
      )}
    </div>
  );
}