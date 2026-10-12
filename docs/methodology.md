# Methodology

## Health Score (documented formula, no hidden weights)

```
health = 100
         - 40 * anomaly_ratio
         - 0.3 * (100 - data_quality_score)
         - 15                      (only if a sensor fault is flagged)
         - severity_penalty        (0 / 10 / 20 / 30 for NONE/MILD/MODERATE/SEVERE diagnosis)

health = clip(health, 0, 100)
```

Rationale for the weights (disclosed, not hidden, and intentionally simple
so they're auditable):
- **Anomaly ratio** dominates (×40) because it's the most direct real-time
  signal of abnormal operation in the current window.
- **Data quality** is scaled by 0.3 because poor data quality reduces
  *confidence* in every other signal rather than being a fault itself.
- **Sensor fault** is a flat penalty because an unreliable sensor doesn't
  scale with anomaly severity — either the readings can be trusted or they
  can't.
- **Diagnosis severity** stacks on top when an actual fault classification
  is available for that reading.

This is implemented exactly as shown in `backend/ml_core.compute_health_score()`
and the same string is returned in every API response's `health.formula`
field, so the frontend never has to hardcode or re-derive it.

## Anomaly Detection Protocol

Following the EngineAD paper's own evaluation protocol (Section 4.1): models
are trained in **one-class** mode on the healthy scenario only (70% split),
then evaluated on the full labeled set (30% held-out healthy + all abnormal
scenarios). Three classical model families are benchmarked — Isolation
Forest, One-Class SVM, Local Outlier Factor — mirroring the paper's own
finding that classical methods are competitive with or better than deep
autoencoders for this kind of data. No deep learning model was used here
"to look advanced" (explicitly against the project brief); a deep
autoencoder was not justified by the evaluation results.

## Fault Diagnosis Protocol

Stratified 70/15/15 train/val/test split (no temporal or vehicle-ID column
exists in EngineFaultDB to split on otherwise). Four model families
benchmarked: Logistic Regression, Random Forest, SVM (RBF, trained on a
4,000-row subsample for tractable runtime — full val/test evaluation),
XGBoost. Best model selected by validation macro-F1, then evaluated once on
the held-out test set. 5-fold stratified cross-validation reported for each
candidate. SHAP TreeExplainer used for both local (per-prediction) and
feature-set (global) explanations.

## RUL Protocol

Standard NASA C-MAPSS RUL construction: for each training unit, RUL at
cycle *t* = (unit's max cycle − *t*), **capped at 125** (the standard
piecewise-linear RUL target widely used in CMAPSS literature, since a
"brand new" engine's true RUL is not meaningfully more informative beyond
that cap and an uncapped target adds noise without adding signal). Models
compared: Random Forest, Gradient Boosting, XGBoost — regression, not deep
learning, since the task didn't justify the added complexity. Final
evaluation on NASA's official `test_FD001.txt` + `RUL_FD001.txt` (last
cycle per test unit vs. provided true RUL) — a fully held-out set never
touched during model selection.

## No-Leakage Guarantees

- **RUL:** unit-level (engine-level) train/val split — no cycle from a
  training engine appears in validation. Official test set is separate
  engines entirely.
- **Anomaly features:** rolling statistics use `min_periods` and only past
  + current samples (pandas `.rolling()` is inherently causal here — no
  `center=True`, no shifting forward).
- **Fault diagnosis:** EngineFaultDB has no temporal or vehicle structure to
  leak across; stratified split is on i.i.d. rows.

## Data Quality Score

```
score = 100
        - min(30, missing_pct * 2)
        - min(20, duplicate_row_pct)
        - min(30, outlier_rate_pct * 3)
        - 10 if timestamps not monotonic increasing
```
