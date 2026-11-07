import React from "react";

/* ============================================================
   Shared building blocks for the Diagnostics, Explainable AI and
   What-If pages. TopFaults and ShapBars are UNCHANGED (same props,
   same markup). ModuleHeader, Pipeline and Panel are new and are
   reused by all three pages.
   ============================================================ */

// Ranked class probabilities (Diagnostics, What-If).
export function TopFaults({ items }) {
  return (
    <ul className="fault-list dgx-list">
      {items.map(t => (
        <li className="fault-row" key={t.class}>
          <span className="dgx-lbl">{t.label}</span>
          <div className="bar-bg" aria-hidden="true">
            <div className="bar-fill" style={{ width: `${t.probability * 100}%` }} />
          </div>
          <span className="mono dgx-val">{(t.probability * 100).toFixed(1)}%</span>
        </li>
      ))}
    </ul>
  );
}

// SHAP contributions. Bar width formula is unchanged from the original pages.
// Direction is carried by the sign and a screen-reader phrase, not colour alone.
export function ShapBars({ items, legend = false }) {
  return (
    <>
      <ul className="fault-list dgx-list">
        {items.map(e => {
          const positive = e.shap_value >= 0;
          const n = Number(e.shap_value);
          const text = Number.isFinite(n) && n > 0 ? `+${e.shap_value}` : String(e.shap_value);
          return (
            <li className="fault-row" key={e.feature}>
              <span className="mono dgx-lbl">{e.feature}</span>
              <div className="bar-bg" aria-hidden="true">
                <div
                  className={`bar-fill ${positive ? "dgx-pos" : "dgx-neg"}`}
                  style={{ width: `${Math.min(100, Math.abs(e.shap_value) * 20)}%` }}
                />
              </div>
              <span className="mono dgx-val">
                {text}
                <span className="dgx-sr">
                  {positive ? " pushes toward the predicted class" : " pushes away from the predicted class"}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {legend && (
        <>
          <div className="dgx-legend">
            <span className="dgx-key">
              <span className="dgx-swatch dgx-pos" aria-hidden="true" />
              Red (+): pushes toward the predicted class
            </span>
            <span className="dgx-key">
              <span className="dgx-swatch dgx-neg" aria-hidden="true" />
              Green (−): pushes away from it
            </span>
          </div>
          <p className="dgx-cap">
            Values are true SHAP contributions from the trained XGBoost model. They describe the model's
            behaviour on this sample, not physical causes.
          </p>
        </>
      )}
    </>
  );
}

// Page header used by the three modules: eyebrow, title, description, and a right-hand action area.
export function ModuleHeader({ eyebrow, title, children, source, actions }) {
  return (
    <header className="dgx-head">
      <div className="dgx-head-text">
        <div className="dgx-eyebrow">{eyebrow}</div>
        <h1 className="dgx-title">{title}</h1>
        <div className="dgx-sub">{children}</div>
      </div>
      {(source || actions) && (
        <div className="dgx-head-side">
          {source}
          {actions}
        </div>
      )}
    </header>
  );
}

const STATE_WORD = { idle: "waiting", active: "in progress", done: "complete", error: "failed" };

// Workflow strip. steps: [{ key, label, icon, state: idle|active|done|error, detail }]
export function Pipeline({ steps, label }) {
  return (
    <ol className="dgx-steps" aria-label={label}>
      {steps.map((s, i) => (
        <li
          key={s.key}
          className={`dgx-step is-${s.state}`}
          aria-current={s.state === "active" ? "step" : undefined}
        >
          <span className="dgx-step-ico" aria-hidden="true">{s.icon ? <s.icon size={16} /> : null}</span>
          <span className="dgx-step-text">
            <span className="dgx-step-n">{String(i + 1).padStart(2, "0")} / {s.label}</span>
            <span className="dgx-step-detail">{s.detail}</span>
          </span>
          <span className="dgx-sr">{` (${STATE_WORD[s.state] || s.state})`}</span>
        </li>
      ))}
    </ol>
  );
}

// Premium panel: title, optional sub-title and right-hand slot.
export function Panel({ title, sub, right, className = "", label, children }) {
  return (
    <section className={`dgx-panel ${className}`.trim()} aria-label={label || title}>
      {title && (
        <div className="dgx-panel-head">
          <div>
            <h2>{title}</h2>
            {sub && <p>{sub}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}