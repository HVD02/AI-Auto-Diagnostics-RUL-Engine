import React, { useEffect, useState } from "react";
import { FileText, Download } from "lucide-react";
import { Card, Loading, Empty } from "../components/ui.jsx";
import { createReport, getReports, reportDownloadUrl } from "../api";
import { useVehicle } from "../VehicleContext.jsx";

export default function Reports() {
  const { vehicleId, dataSource } = useVehicle();
  const isUpload = dataSource?.mode === "upload";
  const reportKey = isUpload ? "UPLOADED" : vehicleId;
  const displayLabel = isUpload ? dataSource.filename : vehicleId;
  const [reports, setReports] = useState(null);
  const [generating, setGenerating] = useState(false);

  const load = () => getReports(reportKey).then(d => setReports(d.reports));
  useEffect(() => { load(); }, [reportKey]);

  const generate = () => {
    setGenerating(true);
    createReport(reportKey).then(() => load()).finally(() => setGenerating(false));
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Reports</h2>
        <p>Generates a real PDF from the current pipeline output — health score, anomalies, diagnosis, SHAP, RUL and maintenance recommendation.</p>
      </div>

      <Card title={`Generate report for ${displayLabel || "…"}`}>
        <button className="btn btn-primary" onClick={generate} disabled={generating || !reportKey}>
          <FileText size={14} /> {generating ? "Generating…" : "Generate PDF Report"}
        </button>
      </Card>

      <div style={{ height: 14 }} />

      {reports === null && <Loading />}
      {reports && reports.length === 0 && <Empty label="No reports generated yet for this vehicle." icon={FileText} />}
      {reports && reports.length > 0 && (
        <Card title="Generated Reports">
          <table className="data-table">
            <thead><tr><th>Vehicle</th><th>Generated</th><th></th></tr></thead>
            <tbody>
              {reports.map(r => (
                <tr key={r.id}>
                  <td>{r.vehicle_id}</td>
                  <td>{new Date(r.created_at * 1000).toLocaleString()}</td>
                  <td>
                    <a className="btn btn-sm" href={reportDownloadUrl(r.file_path.split("/").pop())} target="_blank" rel="noreferrer">
                      <Download size={12} /> Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
