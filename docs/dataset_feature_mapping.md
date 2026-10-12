# Dataset → Feature → Model → Module Mapping

```
EngineFaultDB_Final.csv
  → MAP, TPS, Force, Power, RPM, Consumption L/H, Consumption L/100KM,
    Speed, CO, HC, CO2, O2, Lambda, AFR   (13 features)
  → XGBoost multi-class classifier (backend/model/diagnosis_model.pkl)
  → Diagnostics page, Explainable AI page (SHAP), What-If Simulator

NASA C-MAPSS FD001 (train_FD001.txt / test_FD001.txt / RUL_FD001.txt)
  → op1, op2, op3 + 21 sensor_* columns (non-constant sensors only,
    verified by variance check, not assumed)
  → RandomForestRegressor (backend/model/rul_model.pkl)
  → RUL & Prognostics page

demo_vehicle_telemetry.csv (synthetic)
  → coolant_temp_c, oil_pressure_kpa, rpm, engine_load_pct, intake_temp_c,
    fuel_rate_lph, throttle_pos_pct, vibration_g, battery_voltage_v,
    speed_kph + engineered rolling mean/std/rate features (30-sample window)
  → LocalOutlierFactor (novelty mode) (backend/model/anomaly_model.pkl)
  → Dashboard, Vehicle Health, Anomaly Analysis, Sensor Analytics,
    Digital Twin, Data Quality pages

automotive_faults_aktc_obike_et_al.json
  → category, subcategory, symptoms[], diagnosis_steps[]
  → Keyword + category retriever (backend/knowledge.py) — no ML model,
    pure retrieval
  → Maintenance Center page, and the "maintenance" field attached to
    Diagnostics / demo analysis responses
```

## Why the feature spaces are kept separate

EngineFaultDB, C-MAPSS and the synthetic demo telemetry each describe
different physical systems with non-overlapping sensor vocabularies (engine
operating-point snapshots vs. turbofan degradation trajectories vs. an
OBD-II-style time series). Concatenating them into one feature matrix would
either require fabricating values for the columns each dataset lacks, or
silently degrade a model's assumptions about what its inputs mean. The
project brief explicitly disallows this ("DO NOT blindly merge datasets"),
so each module keeps its own trained model and its own feature schema, and
the frontend routes the user to the appropriate dataset-backed sample
selector for each page (e.g. "draw a sample from EngineFaultDB" for
Diagnostics, "pick a C-MAPSS unit" for RUL) rather than pretending a single
demo vehicle can drive every module end-to-end.

The one place these worlds meet honestly is maintenance retrieval: the
anomaly module's top-contributing *sensor names* (from the synthetic
telemetry) and the diagnosis module's top-contributing *SHAP features*
(from EngineFaultDB) are both just plain text tokens used to query the
Automotive Faults knowledge base — a text-retrieval join, not a
feature-space merge.
