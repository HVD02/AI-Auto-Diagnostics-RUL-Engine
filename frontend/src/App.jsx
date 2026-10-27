import React, { useEffect, useRef, useState } from "react";
import { Routes, Route, NavLink, Link, Outlet, useLocation } from "react-router-dom";
import {
  Gauge as GaugeIcon, HeartPulse, Stethoscope, Radar, LineChart, TrendingDown,
  Brain, SlidersHorizontal, Wrench, Boxes, History as HistoryIcon,
  BarChart3, ShieldCheck, FileText, Settings, Zap, FileUp, Menu, X,
} from "lucide-react";
import { VehicleProvider, useVehicle } from "./VehicleContext.jsx";
import ThemeToggle from "./components/ThemeToggle.jsx";
import "./shell.css";

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
  { group: "Operations", items: [
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

const PAGE_TITLES = {
  "/dashboard": "Dashboard", "/health": "Vehicle Health", "/twin": "Vehicle Digital Twin",
  "/diagnostics": "Diagnostics", "/anomaly": "Anomaly Analysis", "/sensors": "Sensor Analytics",
  "/rul": "RUL & Prognostics", "/xai": "Explainable AI", "/whatif": "What-If Simulator",
  "/maintenance": "Maintenance Center", "/reports": "Reports", "/history": "History",
  "/models": "Model Analytics", "/quality": "Data Quality", "/about": "Settings / About",
};

// Tracks a CSS media query (used to know when the sidebar behaves as a drawer).
function useMediaQuery(query) {
  const read = () =>
    typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false;
  const [matches, setMatches] = useState(read);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

function Sidebar({ open, drawerOpen, onClose, closeRef }) {
  return (
    <aside
      id="app-sidebar"
      className={`sidebar${open ? " is-open" : ""}`}
      role={drawerOpen ? "dialog" : undefined}
      aria-modal={drawerOpen ? "true" : undefined}
      aria-label={drawerOpen ? "Navigation menu" : undefined}
    >
      <button
        type="button"
        className="btn btn-sm sidebar-close"
        onClick={onClose}
        ref={closeRef}
        aria-label="Close navigation"
      >
        <X size={16} aria-hidden="true" />
      </button>
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
      <nav aria-label="Main navigation">
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
                <item.icon size={15} aria-hidden="true" />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

function TopBar({ navOpen, onMenu, menuRef }) {
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
      <div className="topbar-lead">
        <button
          type="button"
          className="btn btn-sm menu-btn"
          onClick={onMenu}
          ref={menuRef}
          aria-label={navOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={navOpen}
          aria-controls="app-sidebar"
        >
          <Menu size={18} aria-hidden="true" />
        </button>
        <div className="topbar-titles">
          <div className="topbar-title">{title}</div>
          <div className="topbar-sub">
            {isUpload
              ? `YOUR VEHICLE · ${dataSource.filename}`
              : "DEMO MODE · SYNTHETIC + REAL RESEARCH DATASETS"}
          </div>
        </div>
        <div className="topbar-tools">
          <ThemeToggle />
        </div>
      </div>
      <div className="topbar-actions">
        <button
          type="button"
          className="btn btn-sm upload-btn"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          aria-label="Upload CSV"
        >
          <FileUp size={13} aria-hidden="true" />
          <span className="upload-label">{uploading ? "Uploading…" : "Upload CSV"}</span>
        </button>
        <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={onPick} />
        <Zap size={13} color="var(--accent)" className="zap-icon" aria-hidden="true" />
        <select
          className="vehicle-select"
          aria-label="Select demo scenario or uploaded vehicle"
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
      <div className="disclaimer" role="alert" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span>{uploadError.message || "Upload failed."}</span>
        <button className="btn btn-sm" onClick={() => setUploadError(null)} style={{ marginLeft: 12 }}>Dismiss</button>
      </div>
    </div>
  );
}

// Layout route: sidebar + top bar + banner around every page except the welcome screen.
function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  const isNarrow = useMediaQuery("(max-width: 900px)");
  const { pathname } = useLocation();
  const drawerOpen = isNarrow && navOpen;

  const menuRef = useRef(null);
  const closeRef = useRef(null);
  const mainColRef = useRef(null);
  const wasOpen = useRef(false);

  // close the drawer after any navigation, and when the screen becomes wide
  useEffect(() => { setNavOpen(false); }, [pathname]);
  useEffect(() => { if (!isNarrow) setNavOpen(false); }, [isNarrow]);

  // while the drawer is open, the page behind it cannot be focused or clicked
  useEffect(() => {
    const el = mainColRef.current;
    if (!el) return undefined;
    if (drawerOpen) el.setAttribute("inert", "");
    else el.removeAttribute("inert");
    return () => el.removeAttribute("inert");
  }, [drawerOpen]);

  // Scroll lock, focus trap, and Escape to close the drawer.
useEffect(() => {
  if (!drawerOpen) return undefined;

  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  closeRef.current?.focus();

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      setNavOpen(false);
      return;
    }

    if (event.key !== "Tab") return;

    const sidebar = document.getElementById("app-sidebar");
    if (!sidebar) return;

    const focusable = sidebar.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  document.addEventListener("keydown", onKeyDown);

  return () => {
    document.body.style.overflow = previousOverflow;
    document.removeEventListener("keydown", onKeyDown);
  };
}, [drawerOpen]);

  // return focus to the menu button after the drawer closes
  useEffect(() => {
    if (wasOpen.current && !drawerOpen) menuRef.current?.focus();
    wasOpen.current = drawerOpen;
  }, [drawerOpen]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Sidebar
        open={drawerOpen}
        drawerOpen={drawerOpen}
        onClose={() => setNavOpen(false)}
        closeRef={closeRef}
      />
      <div
        className={`sidebar-backdrop${drawerOpen ? " is-open" : ""}`}
        onClick={() => setNavOpen(false)}
        aria-hidden="true"
      />
      <div className="main-col" ref={mainColRef}>
        <TopBar navOpen={drawerOpen} onMenu={() => setNavOpen(o => !o)} menuRef={menuRef} />
        <UploadErrorBanner />
        <main id="main-content" className="main-content" tabIndex={-1}>
          <Outlet />
        </main>
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