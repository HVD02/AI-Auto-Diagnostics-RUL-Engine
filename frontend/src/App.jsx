import React, { useRef } from "react";
import { Routes, Route, NavLink, Link, Outlet, useLocation } from "react-router-dom";
import {
  Gauge as GaugeIcon, HeartPulse, Stethoscope, Radar, LineChart, TrendingDown,
  Brain, SlidersHorizontal, Wrench, Boxes, History as HistoryIcon,
  BarChart3, ShieldCheck, FileText, Settings, Zap, UploadCloud, FileUp,
} from "lucide-react";
import { VehicleProvider, useVehicle } from "./VehicleContext.jsx";

import Welcome from "./pages/Welcome.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import VehicleHealth from "./pages/VehicleHealth.jsx";
import Diagnostics from "./pages/Diagnostics.jsx";
import AnomalyAnalysis from "./pages/AnomalyAnalysis.jsx";
import SensorAnalytics from "./pages/SensorAnalytics.jsx";
import RulPrognostics from "./pages/RulPrognostics.jsx";
import ExplainableAI from "./pages/ExplainableAI.jsx";
import WhatIf from "./pages/WhatIf.jsx";
import MaintenanceCenter from "./pages/MaintenanceCenter.jsx";
import DigitalTwin from "./pages/DigitalTwin.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import ModelAnalytics from "./pages/ModelAnalytics.jsx";
import DataQuality from "./pages/DataQuality.jsx";
import Reports from "./pages/Reports.jsx";
import About from "./pages/About.jsx";

const NAV = [
  { group: "Overview", items: [
    { to: "/dashboard", label: "Dashboard", icon: GaugeIcon },
    { to: "/health", label: "Vehicle Health", icon: HeartPulse },
    { to: "/twin", label: "Digital Twin", icon: Boxes },
  ]},
  { group: "Diagnosis", items: [
    { to: "/diagnostics", label: "Diagnostics", icon: Stethoscope },
    { to: "/anomaly", label: "Anomaly Analysis", icon: Radar },
    { to: "/sensors", label: "Sensor Analytics", icon: LineChart },
    { to: "/rul", label: "RUL & Prognostics", icon: TrendingDown },
    { to: "/xai", label: "Explainable AI", icon: Brain },
  ]},
  { group: "Act", items: [
    { to: "/whatif", label: "What-If Simulator", icon: SlidersHorizontal },
    { to: "/maintenance", label: "Maintenance Center", icon: Wrench },
    { to: "/reports", label: "Reports", icon: FileText },
  ]},
  { group: "System", items: [
    { to: "/history", label: "History", icon: HistoryIcon },
    { to: "/models", label: "Model Analytics", icon: BarChart3 },
    { to: "/quality", label: "Data Quality", icon: ShieldCheck },
    { to: "/about", label: "Settings / About", icon: Settings },
  ]},
];

function Sidebar() {
  return (
    <aside className="sidebar">
      <Link
        to="/"
        className="sidebar-brand"
        style={{ display: "block", textDecoration: "none", color: "inherit" }}
        title="Back to welcome screen"
        aria-label="AI Auto-Diagnostics, RUL Engine. Return to the welcome screen"
      >
        <div className="logo-row">
          <span className="logo-dot" />
          <h1>AI AUTO-DIAGNOSTICS</h1>
        </div>
        <p>RUL ENGINE · v2.0.0</p>
      </Link>
      {NAV.map(g => (
        <div className="nav-group" key={g.group}>
          <div className="nav-group-label">{g.group}</div>
          {g.items.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            >
              <item.icon size={15} />
              {item.label}
            </NavLink>
          ))}
        </div>
      ))}
    </aside>
  );
}

const PAGE_TITLES = {
  "/dashboard": "Dashboard", "/health": "Vehicle Health", "/twin": "Vehicle Digital Twin",
  "/diagnostics": "Diagnostics", "/anomaly": "Anomaly Analysis", "/sensors": "Sensor Analytics",
  "/rul": "RUL & Prognostics", "/xai": "Explainable AI", "/whatif": "What-If Simulator",
  "/maintenance": "Maintenance Center", "/reports": "Reports", "/history": "History",
  "/models": "Model Analytics", "/quality": "Data Quality", "/about": "Settings / About",
};

function TopBar() {
  const { vehicles, vehicleId, setVehicleId, dataSource, doUpload, uploading } = useVehicle();
  const fileRef = useRef(null);
  const location = useLocation();
  // ignore a trailing slash so "/dashboard/" resolves the same title as "/dashboard"
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const title = PAGE_TITLES[path] || "Vehicle Diagnostic Console";
  const isUpload = dataSource?.mode === "upload";

  const onPick = (e) => {
    const f = e.target.files[0];
    if (f) doUpload(f);
    e.target.value = "";
  };

  return (
    <div className="topbar">
      <div>
        <div className="topbar-title">{title}</div>
        <div className="topbar-sub">
          {isUpload
            ? `YOUR VEHICLE · ${dataSource.filename}`
            : "DEMO MODE · SYNTHETIC + REAL RESEARCH DATASETS"}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button className="btn btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
          <FileUp size={13} /> {uploading ? "Uploading…" : "Upload CSV"}
        </button>
        <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={onPick} />
        <Zap size={13} color="var(--accent)" />
        <select
          className="vehicle-select"
          value={isUpload ? "__upload__" : (vehicleId || "")}
          onChange={e => { if (e.target.value !== "__upload__") setVehicleId(e.target.value); }}
        >
          <optgroup label="Demo Scenarios">
            {vehicles.map(v => <option key={v} value={v}>{v}</option>)}
          </optgroup>
          {isUpload && (
            <optgroup label="Your Upload">
              <option value="__upload__">📄 {dataSource.filename}</option>
            </optgroup>
          )}
        </select>
      </div>
    </div>
  );
}

function UploadErrorBanner() {
  const { uploadError, setUploadError } = useVehicle();
  if (!uploadError) return null;
  return (
    <div style={{ padding: "10px 22px 0" }}>
      <div className="disclaimer" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span>{uploadError.message || "Upload failed."}</span>
        <button className="btn btn-sm" onClick={() => setUploadError(null)} style={{ marginLeft: 12 }}>Dismiss</button>
      </div>
    </div>
  );
}

// Layout route: sidebar + top bar + banner around every page except the welcome screen.
function AppShell() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-col">
        <TopBar />
        <UploadErrorBanner />
        <Outlet />
      </div>
    </div>
  );
}

// Fallback for unknown URLs: stays inside the shell and links to a valid route.
function NotFound() {
  const { pathname } = useLocation();
  return (
    <div className="page">
      <div className="empty-state">
        <div>No page exists at <span className="mono">{pathname}</span>.</div>
        <div style={{ marginTop: 14 }}>
          <Link className="btn btn-primary btn-sm" to="/dashboard">Go to Dashboard</Link>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <VehicleProvider>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/health" element={<VehicleHealth />} />
          <Route path="/twin" element={<DigitalTwin />} />
          <Route path="/diagnostics" element={<Diagnostics />} />
          <Route path="/anomaly" element={<AnomalyAnalysis />} />
          <Route path="/sensors" element={<SensorAnalytics />} />
          <Route path="/rul" element={<RulPrognostics />} />
          <Route path="/xai" element={<ExplainableAI />} />
          <Route path="/whatif" element={<WhatIf />} />
          <Route path="/maintenance" element={<MaintenanceCenter />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/models" element={<ModelAnalytics />} />
          <Route path="/quality" element={<DataQuality />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </VehicleProvider>
  );
}