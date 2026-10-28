import React from "react";

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