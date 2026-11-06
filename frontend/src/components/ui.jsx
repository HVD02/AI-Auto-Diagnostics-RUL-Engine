import React from "react";
import { Loader2, Inbox, AlertTriangle, Info } from "lucide-react";

export function Card({ title, right, children, className = "" }) {
  return (
    <div className={`card ${className}`}>
      {title && (
        <div className="card-title">
          <span>{title}</span>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function Badge({ status, children }) {
  const map = {
    ok: "badge-ok", NORMAL: "badge-ok", HEALTHY: "badge-ok", GOOD: "badge-ok", EXCELLENT: "badge-ok",
    warn: "badge-warn", WARNING: "badge-warn", WATCH: "badge-warn", FAIR: "badge-warn", MILD: "badge-warn",
    mod: "badge-mod", MODERATE: "badge-mod", MODERATE_WEAR: "badge-mod", DEGRADING: "badge-mod",
    crit: "badge-crit", CRITICAL: "badge-crit", SEVERE: "badge-crit", POOR: "badge-crit",
    info: "badge-info",
    neutral: "badge-neutral", NONE: "badge-neutral", NO_SENSOR_FAULT_DETECTED: "badge-neutral",
  };
  const cls = map[status] || "badge-neutral";
  // Fallback label (when no children are given): show status codes with spaces, e.g. MODERATE WEAR.
  const fallback = typeof status === "string" ? status.replace(/_/g, " ") : status;
  return (
    <span className={`badge ${cls}`}>
      <span className="dot" aria-hidden="true" />
      {children || fallback}
    </span>
  );
}

export function Loading({ label = "Loading…" }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <Loader2 size={15} className="spin" aria-hidden="true" />
      {label}
    </div>
  );
}

export function Empty({ label = "Nothing here yet.", icon: Icon = Inbox }) {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true">
        <Icon size={26} />
      </span>
      <div>{label}</div>
    </div>
  );
}

// Errors keep the "disclaimer" base class (so existing page CSS still applies)
// and add "is-error" for the red error treatment.
export function ErrorBox({ message }) {
  return (
    <div className="disclaimer is-error" role="alert">
      <AlertTriangle size={14} style={{ marginTop: 1 }} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export function InfoBox({ children }) {
  return (
    <div className="disclaimer-info" role="note">
      <Info size={14} style={{ marginTop: 1 }} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export function Gauge({ value, band }) {
  const r = 68, c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  const color = value >= 85 ? "var(--ok)" : value >= 70 ? "var(--ok)" : value >= 50 ? "var(--warn)" : value >= 25 ? "var(--mod)" : "var(--crit)";
  const shown = value?.toFixed ? value.toFixed(0) : value;
  return (
    <div
      className="gauge-wrap"
      role="img"
      aria-label={`Health score ${shown} out of 100${band ? `, ${band}` : ""}`}
    >
      <svg width="168" height="168" viewBox="0 0 168 168" aria-hidden="true" focusable="false">
        <circle className="gauge-ticks" cx="84" cy="84" r="79" fill="none" strokeWidth="4" strokeDasharray="1.5 6.3" />
        <circle cx="84" cy="84" r={r} fill="none" stroke="var(--bg-3)" strokeWidth="11" />
        <circle cx="84" cy="84" r="56" fill="none" stroke="var(--line-soft)" strokeWidth="1" />
        <circle
          className="gauge-arc"
          cx="84" cy="84" r={r} fill="none" stroke="currentColor" strokeWidth="11"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
          transform="rotate(-90 84 84)"
          style={{ color, transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="gauge-label">
        <div className="num">{shown}</div>
        <div className="band">{band}</div>
      </div>
    </div>
  );
}