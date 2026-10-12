import React from "react";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import { Card, Loading, ErrorBox, Badge, InfoBox } from "../components/ui.jsx";
import { useAnalysis } from "../useAnalysis.js";

export default function AnomalyAnalysis() {
  const { data, loading, error } = useAnalysis();
  return (
    <div className="page">
      <div className="page-header">
        <h2>Anomaly Analysis</h2>
        <p>One-class anomaly detection (Local Outlier Factor / Isolation Forest / One-Class SVM benchmark, per the EngineAD paper's own protocol).</p>
      </div>
      {loading && <Loading />}
      {error && <ErrorBox message={error} />}
      {data && (
        <>
          <div className="grid grid-3">
            <Card title="Anomaly Score">
              <div className="card-hero"><span className="value">{(data.anomaly.anomaly_ratio * 100).toFixed(1)}</span><span className="unit">% flagged</span></div>
              <div style={{ marginTop: 10 }}><Badge status={data.anomaly.status} /></div>
            </Card>
            <Card title="Abnormal Sensors (top contributors)">
              <div className="pill-row">
                {data.anomaly.top_contributors.map(c => (
                  <Badge key={c.sensor} status="warn">{c.sensor} · z={c.z_score}</Badge>
                ))}
              </div>
            </Card>
            <Card title="Multi-sensor Confirmation">
              <div style={{ fontSize: 12.5, color: "var(--text-1)" }}>
                {data.anomaly.top_contributors.length > 1
                  ? `${data.anomaly.top_contributors.length} sensors show elevated deviation simultaneously — reduces the chance this is a single noisy channel.`
                  : "Only one sensor shows elevated deviation — treat with more caution (see Sensor Fault Analysis)."}
              </div>
            </Card>
          </div>

          <div style={{ height: 14 }} />

          <Card title="Anomaly Intensity Timeline">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.anomaly.timeline_scores.map((v, i) => ({ i, v }))}>
                <defs>
                  <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--line-soft)" vertical={false} />
                <XAxis dataKey="i" tick={{ fill: "var(--text-2)", fontSize: 10 }} label={{ value: "seconds", position: "insideBottom", offset: -3, fill: "var(--text-2)", fontSize: 10 }} />
                <YAxis width={30} tick={{ fill: "var(--text-2)", fontSize: 10 }} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "var(--bg-2)", border: "1px solid var(--line)", fontSize: 12 }} />
                <ReferenceLine y={60} stroke="var(--crit)" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="v" stroke="var(--accent)" fill="url(#ag)" strokeWidth={1.6} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <div style={{ height: 14 }} />
          <InfoBox>
            False-alarm analysis: the EngineAD benchmark paper reports F1 scores in the 0.2–0.9 range depending
            on the vehicle, meaning even the best classical models miss some anomalies or raise some false alarms.
            Treat any single-window flag as a signal to investigate, not a certain diagnosis.
          </InfoBox>
        </>
      )}
    </div>
  );
}
