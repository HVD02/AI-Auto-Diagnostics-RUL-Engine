# AI Auto-Diagnostics & RUL Engine

**AI-Powered Vehicle Health, Fault Diagnosis, Predictive Maintenance & Remaining Useful Life Engine**

*Detect. Diagnose. Predict. Protect.*

---

## Overview

This is a full-stack automotive AI platform that behaves like an "AI doctor
for a vehicle": it runs data quality checks, anomaly detection, sensor-fault
analysis, fault diagnosis, health scoring, RUL/prognostics, explainable AI
(SHAP), and knowledge-grounded maintenance recommendations — all backed by
**real trained ML models** on **real datasets**, with every number in the UI
traceable to an actual model output or a documented formula. Nothing is
hardcoded.

## Problem Statement

Most "AI vehicle diagnostic" demo projects fake their outputs — hardcoded
health scores, invented confidence numbers, canned explanations. This
project does the opposite: it integrates four real, independently-sourced
datasets, each doing the job it's actually suited for, and is explicit about
what each dataset can and cannot support (see `docs/limitations.md`).

## Objectives

See the original project brief for the full list; in short: detect whether
a vehicle is healthy, localize abnormal sensors, distinguish a sensor fault
from a real fault, diagnose the probable fault with severity and confidence,
explain *why* the model made that call, track whether things are getting
worse, estimate failure risk / RUL where the data supports it, and surface
maintenance priorities — never fabricating an answer a dataset can't support.

## Architecture

See `docs/architecture.md` for the full diagram and pipeline walkthrough.

```
AI-AUTO-DIAGNOSTICS-RUL-ENGINE/
├── backend/            FastAPI app, ML pipeline, trained models, SQLite DB
├── frontend/            React + Vite, 15 pages, dark automotive theme
├── data/                 EngineAD (paper only), EngineFaultDB, NASA_RUL,
│                          Automotive_Faults, demo (synthetic)
├── notebook/             6 notebooks mirroring the training scripts
├── scripts/               prepare_data / train_* / evaluate_models / generate_demo_data
├── docs/                   architecture, methodology, dataset docs, limitations, etc.
└── tests/                  27 backend + API tests (pytest)
```

## Dataset Sources & Roles

| Dataset | Role | Status |
|---|---|---|
| EngineAD (arXiv:2603.25955) | Anomaly detection | Paper only — real fleet data is access-gated by the authors; see `docs/dataset_sources.md` |
| EngineFaultDB | Fault diagnosis | Included, real, fully trained |
| NASA C-MAPSS FD001 | RUL / prognostics methodology (aircraft, not automotive) | Included, real, fully trained |
| Automotive Faults Dataset (Zenodo 15626055) | Maintenance knowledge / retrieval | Included, real |
| Synthetic demo telemetry | Local Demo Mode | Generated, clearly labelled synthetic |

Full detail in `docs/dataset_sources.md` and `docs/dataset_feature_mapping.md`.

## ML Methodology

- **Anomaly detection:** one-class Isolation Forest / One-Class SVM / Local
  Outlier Factor benchmark, matching the EngineAD paper's own evaluation
  protocol. F1 ≈ 0.91 (LOF, on synthetic demo data — see limitations).
- **Fault diagnosis:** Logistic Regression / Random Forest / SVM / XGBoost
  benchmark on EngineFaultDB, stratified split, 5-fold CV, SHAP
  explanations. XGBoost selected, macro-F1 ≈ 0.75 on held-out test.
- **RUL:** Random Forest / Gradient Boosting / XGBoost regression on NASA
  C-MAPSS FD001, unit-level split (no leakage), evaluated on the official
  held-out test set. MAE ≈ 12.4 cycles, R² ≈ 0.81.
- **Health score:** disclosed additive formula (see `docs/methodology.md`)
  — no hidden weights.
- **Maintenance knowledge:** keyword/category retrieval over the real
  Automotive Faults dataset (99 entries) — never generates a diagnosis, only
  retrieves documented ones.

Full evaluation numbers: `docs/model_evaluation.md` (and live at
`/api/model-metrics` → Model Analytics page).

## Features / Pages

Dashboard · Vehicle Health · Digital Twin · Diagnostics · Anomaly Analysis ·
Sensor Analytics · RUL & Prognostics · Explainable AI · What-If Simulator ·
Maintenance Center · Reports · History · Model Analytics · Data Quality ·
Settings/About (Upload Mode)

## Installation & Running

### Prerequisites
- Python 3.10+
- Node.js 18+

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
# → http://127.0.0.1:8000  (docs at /docs)
```

Models are already trained and included in `backend/model/`. To retrain
from scratch:

```bash
cd ..
python scripts/prepare_data.py       # inspect all datasets
python scripts/generate_demo_data.py # regenerate synthetic demo telemetry
python scripts/train_diagnosis.py    # EngineFaultDB → diagnosis_model.pkl
python scripts/train_rul.py          # NASA C-MAPSS → rul_model.pkl
python scripts/train_anomaly.py      # demo telemetry → anomaly_model.pkl
python scripts/evaluate_models.py    # print consolidated metrics
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173  (proxies /api to the backend on :8000)
```

### 3. Open the application

Visit `http://localhost:5173` to open the welcome screen.

Click **ENTER DIAGNOSTICS** to access the Dashboard at
`http://localhost:5173/dashboard`.

The application retains the existing diagnostic pages, including
Vehicle Health, Diagnostics, Anomaly Analysis, RUL & Prognostics,
Explainable AI, Reports, History, and Data Quality.

## Frontend Release

Current frontend release: **v2.0.0**

Version 2.0.0 introduces the redesigned welcome screen,
the updated diagnostic dashboard, improved navigation,
and corrected PDF report-download URL handling.

### Root convenience scripts

```bash
./start_backend.sh    # from project root
./start_frontend.sh   # from project root, in a second terminal
```

## Testing

```bash
pip install -r backend/requirements.txt pytest httpx
pytest tests/ -v
```
27 tests covering data loading, feature engineering (incl. no-leakage
check), each model, health scoring, sensor-fault detection, maintenance
retrieval, and all major API endpoints.

## Demo Mode / Research Mode / Upload Mode

- **Demo Mode** (default): 7 synthetic scenarios exercise the full pipeline
  (healthy, mild/moderate/severe anomaly, sensor fault, progressive
  degradation, multiple abnormalities).
- **Research Mode**: Diagnostics page draws real samples from
  EngineFaultDB; RUL page lets you pick real NASA C-MAPSS engine units.
- **Upload Mode**: Settings/About page validates a user CSV against the
  demo telemetry schema and runs it through the same pipeline, or explains
  exactly which columns are missing.

## Reports

The Reports page generates a real PDF (ReportLab) from the live analysis —
health score, anomaly findings, sensor-fault verdict, diagnosis + SHAP, RUL
(with NASA disclaimer where applicable), and maintenance recommendations.

## Limitations (short version — see `docs/limitations.md` for the full list)

- EngineAD's real fleet data isn't included (access-gated); anomaly module
  runs on synthetic data instead.
- EngineFaultDB's fault classes 1–3 aren't named in the source file —
  reported honestly as "Fault Class 1/2/3."
- NASA C-MAPSS is aircraft turbofan data, always labelled as such, never
  presented as passenger-car data.
- Demo telemetry and EngineFaultDB/C-MAPSS are different feature spaces by
  design — not merged.

## Research Gap

We do not claim to have invented anomaly detection, fault diagnosis, RUL
prediction, XGBoost, SHAP, or predictive maintenance. Our contribution is
the integration of these into one modular, honestly-scoped platform. See
`docs/research_gap.md`.

## Future Scope

See `docs/future_scope.md`: real EngineAD integration, vehicle-specific
baselines, automotive RUL data, data-drift monitoring, and more.

## References

- Hojjati et al., *EngineAD: A Real-World Vehicle Engine Anomaly Detection
  Dataset*, arXiv:2603.25955
- EngineFaultDB: https://github.com/leoxthomas/EngineFaultDB
- NASA C-MAPSS: https://data.nasa.gov/dataset/cmapss-jet-engine-simulated-data
- Automotive Faults Dataset: https://zenodo.org/records/15626055

## Safety Disclaimer

This system is a diagnostic aid for demonstration and educational purposes.
It does not replace inspection by a certified technician, and RUL/failure
predictions carry measurable uncertainty (see `docs/model_evaluation.md`).
Do not use it as the sole basis for a safety-critical maintenance decision.
