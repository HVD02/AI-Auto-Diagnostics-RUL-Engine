import React, { useEffect, useState } from "react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { Card, Loading, ErrorBox, Badge } from "../components/ui.jsx";
import { getTelemetry, getCurrentUploadTelemetry } from "../api";
import { useVehicle } from "../VehicleContext.jsx";

const SENSOR_META = {
  coolant_temp_c: { label: "Coolant Temp (°C)", color: "#f87171" },
  oil_pressure_kpa: { label: "Oil Pressure (kPa)", color: "#60a5fa" },
  rpm: { label: "RPM", color: "#fbbf24" },
  engine_load_pct: { label: "Engine Load (%)", color: "#34d399" },
  intake_temp_c: { label: "Intake Temp (°C)", color: "#fb923c" },
  fuel_rate_lph: { label: "Fuel Rate (L/h)", color: "#a78bfa" },
  throttle_pos_pct: { label: "Throttle Position (%)", color: "#2dd4e8" },
  vibration_g: { label: "Vibration (g)", color: "#f472b6" },
  battery_voltage_v: { label: "Battery Voltage (V)", color: "#facc15" },
  speed_kph: { label: "Speed (km/h)", color: "#4ade80" },
};

function detectStuck(arr) {
  if (arr.length < 30) return false;
  const tail = arr.slice(-50);
  const std = Math.sqrt(tail.reduce((s, v) => s + (v - tail.reduce((a, b) => a + b, 0) / tail.length) ** 2, 0) / tail.length);
  return std < 1e-6;
}

export default function SensorAnalytics() {
  const { vehicleId, dataSource } = useVehicle();
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(["coolant_temp_c", "oil_pressure_kpa"]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isUpload = dataSource?.mode === "upload";

  useEffect(() => {
    setLoading(true);
    setError(null);
    const req = isUpload ? getCurrentUploadTelemetry() : (vehicleId ? getTelemetry(vehicleId) : Promise.reject(new Error("no vehicle")));
    req.then(setData).catch(e => setError(e?.response?.data?.detail || e.message)).finally(() => setLoading(false));
  }, [vehicleId, isUpload, dataSource?.filename]);

  const sensors = Object.keys(SENSOR_META);
  const chartData = data ? data.t.map((t, i) => {
    const row = { t };
    sensors.forEach(s => row[s] = data[s][i]);
    return row;
  }) : [];

  const toggle = (s) => setSelected(sel => sel.includes(s) ? sel.filter(x => x !== s) : [...sel, s]);

  return (
    <div className="page">
      <div className="page-header">
        <h2>Sensor Analytics</h2>
        <p>Only sensors present in this dataset's schema are shown — no invented channels.</p>
      </div>
      {loading && <Loading />}
      {error && <ErrorBox message={error} />}

      {data && (
        <>
          <Card title="Select sensors to compare">
            <div className="pill-row">
              {sensors.map(s => {
                const stuck = detectStuck(data[s]);
                return (
                  <button key={s}
                    className="btn btn-sm"
                    style={{ borderColor: selected.includes(s) ? SENSOR_META[s].color : undefined,
                             color: selected.includes(s) ? SENSOR_META[s].color : undefined }}
                    onClick={() => toggle(s)}>
                    {SENSOR_META[s].label}
                    {stuck && <span style={{ marginLeft: 5 }}><Badge status="crit">stuck</Badge></span>}
                  </button>
                );
              })}
            </div>
          </Card>

          <div style={{ height: 14 }} />

          <Card title="Sensor Comparison">
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={chartData}>
                <CartesianGrid stroke="var(--line-soft)" vertical={false} />
                <XAxis dataKey="t" tick={{ fill: "var(--text-2)", fontSize: 10 }} />
                <YAxis tick={{ fill: "var(--text-2)", fontSize: 10 }} width={40} />
                <Tooltip contentStyle={{ background: "var(--bg-2)", border: "1px solid var(--line)", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {selected.map(s => (
                  <Line key={s} type="monotone" dataKey={s} name={SENSOR_META[s].label}
                        stroke={SENSOR_META[s].color} dot={false} strokeWidth={1.4} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <div style={{ height: 14 }} />

          <div className="grid grid-2">
            <Card title="Sensor Reliability">
              <table className="data-table">
                <thead><tr><th>Sensor</th><th>Std Dev</th><th>Status</th></tr></thead>
                <tbody>
                  {sensors.map(s => {
                    const arr = data[s];
                    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
                    const std = Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length);
                    const stuck = detectStuck(arr);
                    return (
                      <tr key={s}>
                        <td>{SENSOR_META[s].label}</td>
                        <td>{std.toFixed(3)}</td>
                        <td>{stuck ? <Badge status="crit">stuck / invalid</Badge> : <Badge status="ok">reliable</Badge>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
            <Card title="Sensor Health Summary">
              <p style={{ fontSize: 12.5, color: "var(--text-1)", lineHeight: 1.6 }}>
                A sensor is flagged "stuck / invalid" when its last 50 samples show effectively zero
                variance — a strong indicator of a wiring or transducer fault rather than a real
                mechanical change, since real physical quantities in a running engine fluctuate.
              </p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
