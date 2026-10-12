# Architecture

## System Overview

```
                          ┌─────────────────────────┐
                          │   React + Vite Frontend  │
                          │  (15 pages, dark theme)  │
                          └────────────┬─────────────┘
                                       │  REST (JSON) via /api/*
                          ┌────────────▼─────────────┐
                          │   FastAPI Backend         │
                          │   backend/main.py         │
                          └──┬─────┬─────┬─────┬──────┘
                             │     │     │     │
                 ┌───────────┘     │     │     └────────────┐
                 ▼                 ▼     ▼                   ▼
        backend/ml_core.py   backend/knowledge.py   backend/db.py   backend/report.py
        (models + pipeline)  (KB retrieval)          (SQLite)        (PDF generation)
                 │
     ┌───────────┼──────────────┬───────────────────┐
     ▼           ▼               ▼                   ▼
diagnosis_   rul_model.pkl  anomaly_model.pkl   sensor-fault /
model.pkl    (RF Regressor) (LocalOutlierFactor) health-score /
(XGBoost)                                        data-quality
                                                  (formula-based,
                                                   no model file)
```

## Backend pipeline (per the brief's "CORE PROJECT PIPELINE")

For a demo-mode request (`POST /api/analyze/demo`):

1. **Data Quality Analysis** — `ml_core.data_quality_report()`: missing %,
   duplicates, IQR-based outliers per sensor, timestamp monotonicity → a
   0–100 score.
2. **Sensor Validation / Sensor Fault Analysis** — `ml_core.sensor_fault_analysis()`:
   stuck-value detection (near-zero variance in the trailing window) +
   physical-range checks per sensor.
3. **Feature Engineering** — `ml_core.engineer_anomaly_features()`: rolling
   mean/std (30-sample window, `min_periods=5`) and first-difference rate
   per sensor, computed causally (no future leakage).
4. **Anomaly Detection** — `ml_core.run_anomaly()`: scaled features →
   LocalOutlierFactor (novelty mode) → per-window anomaly ratio, status
   band, and top contributing sensors (z-score based local explanation).
5. **Fault Diagnosis** (only triggered on a real, non-sensor-fault anomaly,
   using its own EngineFaultDB-backed model/schema — see
   `dataset_feature_mapping.md` for why demo telemetry doesn't feed this
   model directly).
6. **Health Score** — `ml_core.compute_health_score()`: documented additive
   formula (see `methodology.md`) combining anomaly ratio, data quality,
   sensor-fault flag, and diagnosis severity.
7. **Maintenance Recommendation** — `knowledge.maintenance_recommendation()`:
   retrieves from the Automotive Faults JSON using the anomaly's/diagnosis's
   top contributing signal names as the query.
8. **Persistence** — the full result is saved to SQLite (`db.save_analysis`)
   for the History page.
9. **Reporting** — `report.generate_report()` turns the same analysis dict
   into a PDF on demand.

RUL (`POST /api/rul`) and straight fault diagnosis (`POST /api/diagnose`)
are separate, dataset-appropriate endpoints (see `dataset_feature_mapping.md`).

## Frontend structure

```
frontend/src/
  App.jsx              sidebar nav + routes
  VehicleContext.jsx    shared selected-vehicle state
  useAnalysis.js         shared hook: fetch full demo analysis for selected vehicle
  api.js                 typed wrapper around all /api/* calls
  components/ui.jsx      Card, Badge, Gauge, Loading, Empty, ErrorBox, InfoBox
  pages/                 one file per page (15 pages, see README)
```

State management is intentionally simple (React context + hooks, no Redux)
since the app is a set of independent diagnostic views over a single
selected vehicle/sample, not a complex multi-entity CRUD app.

## Folder structure

See the root `README.md` for the full annotated tree.
