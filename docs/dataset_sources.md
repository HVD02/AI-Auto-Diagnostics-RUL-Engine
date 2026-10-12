# Dataset Sources

This project uses five datasets, each with a distinct role. None are blindly
merged — see `dataset_feature_mapping.md` for how each one plugs into the
pipeline.

---

## 1. EngineAD

- **Official URL:** https://github.com/Armanfard-Lab/EngineAD (access on request)
- **Paper:** Hojjati et al., *"EngineAD: A Real-World Vehicle Engine Anomaly
  Detection Dataset"*, arXiv:2603.25955 (included in `data/EngineAD/EngineAD_paper.pdf`)
- **Type:** Real, fleet-collected, expert-annotated
- **Records:** 25 commercial trucks, 6 months of CAN-bus telemetry (13
  sensors → 8 PCA components), segmented into 300-timestep (5-minute) windows
- **Labels:** Binary (normal / anomaly), technician-assigned
- **Temporal structure:** 1 Hz, engine-on periods only, non-overlapping windows
- **Intended module:** Anomaly detection
- **Status in this build:** **NOT INCLUDED.** The paper states the dataset is
  "available upon request" from the authors. Only the paper PDF and LaTeX
  source were provided to this build, not the `truck_N.pickle` files. The
  anomaly-detection module is therefore trained on `demo_vehicle_telemetry.csv`
  (synthetic) instead, using the same one-class evaluation protocol the paper
  uses. To use real EngineAD data: request access via the GitHub link above,
  place the resulting pickle files under `data/EngineAD/`, and adapt
  `scripts/train_anomaly.py` to load them (the PCA-component feature space
  will differ from the synthetic sensor space, so `anomaly_features.pkl`
  would be regenerated).
- **Limitations (per the paper itself):** heavy inter-vehicle performance
  variability (F1 0.21–0.93 across trucks for the same model); simple
  classical models (K-Means, One-Class SVM) were found to be competitive
  with or better than deep learning on this benchmark.

## 2. EngineFaultDB

- **Official repository:** https://github.com/leoxthomas/EngineFaultDB
- **File used:** `EngineFaultDB_Final.csv` (provided directly)
- **Type:** Real, tabular operating-point snapshots
- **Records:** 55,999 rows, 15 columns
- **Features:** MAP, TPS, Force, Power, RPM, Consumption L/H, Consumption
  L/100KM, Speed, CO, HC, CO2, O2, Lambda, AFR
- **Labels:** `Fault` — integer class 0–3 (0 = Normal Operation; classes 1–3
  are not named in the source file, so this build reports them as
  "Fault Class 1/2/3" rather than inventing named failure modes — see
  `limitations.md`)
- **Temporal structure:** none — rows are i.i.d. operating-point snapshots,
  no timestamp or vehicle ID columns
- **Intended module:** Fault diagnosis, SHAP explainability, model benchmarking
- **Split strategy:** stratified 70/15/15 train/val/test (no time-aware split
  possible since there's no temporal column; documented as a limitation)

## 3. NASA C-MAPSS (FD001)

- **NASA source:** https://data.nasa.gov/dataset/cmapss-jet-engine-simulated-data
- **PCoE repository:** https://www.nasa.gov/intelligent-systems-division/discovery-and-systems-health/pcoe/pcoe-data-set-repository/
- **File used:** `CMAPSSData.zip` → `train_FD001.txt`, `test_FD001.txt`, `RUL_FD001.txt`
- **Type:** Real, simulated turbofan **jet engine** run-to-failure data —
  **NOT passenger-vehicle telemetry.**
- **Records:** 100 training units, 100 test units, 26 columns each
  (unit, cycle, 3 operational settings, 21 sensors)
- **Labels:** RUL derived from run-to-failure trajectories (train); true RUL
  provided directly for the truncated test set
- **Temporal structure:** per-unit cycle sequences to failure
- **Intended module:** RUL / prognostics methodology validation only
- **Split strategy:** unit-level (engine-level) split — no cycle from one
  engine appears in both train and validation, preventing trajectory leakage.
  The official `test_FD001.txt` + `RUL_FD001.txt` are used as a fully
  held-out evaluation set (never touched during model selection).
- **UI requirement:** every RUL screen displays: *"RUL validated using NASA
  turbofan engine degradation data. This dataset is not passenger-vehicle
  telemetry."*

## 4. Automotive Faults Dataset

- **Official source:** https://zenodo.org/records/15626055
- **File used:** `automotive_faults_aktc_obike_et_al.json` (+ flowchart PNGs)
- **Type:** Real, structured diagnostic knowledge base
- **Records:** 99 documented fault entries across 13 categories (ABS System,
  Cooling System, Electrical System, Emissions System, Engine Components,
  Engine Compartment, Fuel System, Drivetrain, Transmission, Steering,
  Wheels & Tires, Air Conditioning System, Liquid Systems)
- **Fields:** category, subcategory, symptoms, diagnosis_steps (each with a
  possible-result set)
- **Intended module:** Maintenance Center retrieval layer / RAG-style
  knowledge support. **This is a retrieval layer, not a generator** — the
  backend (`backend/knowledge.py`) matches diagnosis/anomaly context to KB
  entries by category and keyword overlap; it never invents a diagnosis.

## 5. Synthetic Demo Dataset

- **File:** `data/demo/demo_vehicle_telemetry.csv`, generated by
  `scripts/generate_demo_data.py`
- **Type:** **SYNTHETIC DEMO DATA — NOT REAL VEHICLE DATA**
- **Records:** 7 scenarios × 600 seconds (10 minutes) at 1 Hz = 4,200 rows
- **Scenarios:** Healthy, Mild Anomaly, Moderate Anomaly, Severe Anomaly,
  Sensor Fault, Progressive Degradation, Multiple Abnormalities
- **Sensors:** coolant_temp_c, oil_pressure_kpa, rpm, engine_load_pct,
  intake_temp_c, fuel_rate_lph, throttle_pos_pct, vibration_g,
  battery_voltage_v, speed_kph — an OBD-II-like schema chosen so it
  generalizes to real telemetry later
- **Intended module:** Local Demo Mode — anomaly detection, sensor-fault
  heuristics, data quality, health scoring, digital twin, dashboard
- **Explicitly labelled in the UI** as synthetic on every page that uses it
  (`source_disclaimer` field in every relevant API response).

---

## Dataset Role Matrix

| Dataset | Real / Synthetic | Project Module |
|---|---|---|
| EngineAD | Real (not included — access-gated) | Anomaly detection methodology (substituted with synthetic data) |
| EngineFaultDB | Real | Fault diagnosis, SHAP, model benchmarking |
| NASA C-MAPSS | Real (aircraft, not automotive) | RUL / prognostics methodology |
| Automotive Faults Dataset | Real | Maintenance knowledge / retrieval layer |
| Synthetic Demo Data | Synthetic | Local demo — anomaly, health score, digital twin, dashboard |

Datasets are **not** merged into a single feature space — each keeps its own
schema and its own model, exactly as specified in the project brief.
