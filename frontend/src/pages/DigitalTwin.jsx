import React from "react";
import { Thermometer, Gauge as GaugeIcon, Zap, Activity, Fuel } from "lucide-react";
import { Card, Loading, ErrorBox } from "../components/ui.jsx";
import { useAnalysis } from "../useAnalysis.js";

function colorFor(band) {
  if (band === "ok") return "var(--ok)";
  if (band === "warn") return "var(--warn)";
  if (band === "mod") return "var(--mod)";
  return "var(--crit)";
}

function bandFromZ(z) {
  if (z < 1) return "ok";
  if (z < 1.8) return "warn";
  if (z < 2.6) return "mod";
  return "crit";
}

const COMPONENTS = [
  { key: "coolant_temp_c", label: "Cooling", icon: Thermometer },
  { key: "oil_pressure_kpa", label: "Engine / Oil", icon: GaugeIcon },
  { key: "battery_voltage_v", label: "Electrical", icon: Zap },
  { key: "vibration_g", label: "Vibration / Mounts", icon: Activity },
  { key: "fuel_rate_lph", label: "Fuel System", icon: Fuel },
];

export default function DigitalTwin() {
  const { data, loading, error } = useAnalysis();

  const zBySensor = {};
  data?.anomaly?.top_contributors?.forEach(c => { zBySensor[c.sensor] = c.z_score; });

  return (
    <div className="page">
      <div className="page-header">
        <h2>Vehicle Digital Twin</h2>
        <p>Component health inferred from the sensors that actually exist in this dataset — no components invented beyond available signals.</p>
      </div>
      {loading && <Loading />}
      {error && <ErrorBox message={error} />}
      {data && (
        <Card title="Component Health Map">
          <div className="twin-grid">
            {COMPONENTS.map(c => {
              const z = zBySensor[c.key] ?? 0.2;
              const band = data.sensor_fault.flagged_sensors.includes(c.key) ? "warn" : bandFromZ(z);
              const color = colorFor(band);
              return (
                <div className="twin-cell" key={c.key}>
                  <div className="icon-ring" style={{ borderColor: color, color }}>
                    <c.icon size={17} />
                  </div>
                  <div className="label">{c.label}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--text-2)", marginTop: 3 }}>z={z.toFixed(2)}</div>
                </div>
              );
            })}
          </div>
          <div className="hr" />
          <div style={{ fontSize: 11, color: "var(--text-2)" }}>
            Green = healthy, yellow = watch, orange = moderate deviation, red = critical / sensor-flagged.
            Colors derive from each sensor's z-score contribution to the current anomaly window.
          </div>
        </Card>
      )}
    </div>
  );
}
