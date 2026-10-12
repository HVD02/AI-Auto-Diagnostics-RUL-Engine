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
  return (
    <span className={`badge ${cls}`}>
      <span className="dot" />
      {children || status}
    </span>
  );
}

export function Loading({ label = "Loading…" }) {
  return (
    <div className="loading-state">
      <Loader2 size={15} className="spin" />
      {label}
    </div>
  );
}

export function Empty({ label = "Nothing here yet.", icon: Icon = Inbox }) {
  return (
    <div className="empty-state">
      <Icon size={30} />
      <div>{label}</div>
    </div>
  );
}

export function ErrorBox({ message }) {
  return (
    <div className="disclaimer">
      <AlertTriangle size={14} style={{ marginTop: 1 }} />
      <span>{message}</span>
    </div>
  );
}

export function InfoBox({ children }) {
  return (
    <div className="disclaimer-info">
      <Info size={14} style={{ marginTop: 1 }} />
      <span>{children}</span>
    </div>
  );
}

export function Gauge({ value, band }) {
  const r = 68, c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  const color = value >= 85 ? "var(--ok)" : value >= 70 ? "var(--ok)" : value >= 50 ? "var(--warn)" : value >= 25 ? "var(--mod)" : "var(--crit)";
  return (
    <div className="gauge-wrap">
      <svg width="168" height="168" viewBox="0 0 168 168">
        <circle cx="84" cy="84" r={r} fill="none" stroke="var(--bg-3)" strokeWidth="12" />
        <circle
          cx="84" cy="84" r={r} fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
          transform="rotate(-90 84 84)" style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="gauge-label">
        <div className="num">{value?.toFixed ? value.toFixed(0) : value}</div>
        <div className="band">{band}</div>
      </div>
    </div>
  );
}
