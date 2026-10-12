# Future Scope

1. **Real EngineAD integration** — once fleet access is granted, replace the
   synthetic-data training in `scripts/train_anomaly.py` with the real
   pickled truck trajectories, re-benchmark the same three classical models
   (matching the paper's own protocol), and validate cross-vehicle
   generalization — the paper's own identified open problem.
2. **Vehicle-specific baselines** — with enough historical data per real
   vehicle, replace the universal anomaly threshold with a per-vehicle
   learned baseline (ML Module 3 in the original brief), directly
   addressing the inter-vehicle F1 variance (0.21–0.93) the EngineAD paper
   documents.
3. **Automotive RUL data** — swap NASA C-MAPSS for a real automotive
   run-to-failure dataset when one becomes available, using the same
   pipeline shape (see `rul_methodology.md`).
4. **A named fault-code dictionary** for EngineFaultDB's classes 1–3, if a
   verified mapping is obtained, replacing the honest "Fault Class N"
   placeholders with named failure modes.
5. **OBD-II / CAN live ingestion** — the upload/CSV path already validates
   schema; a streaming adapter could feed the same pipeline in near
   real-time.
6. **Data drift monitoring** (ML Module 11 in the brief) — compare
   incoming telemetry distributions against training distributions and
   surface a Low/Moderate/High drift indicator; not implemented in this
   build due to scope, but the data-quality module's outlier/summary stats
   are a direct foundation for it.
7. **True global SHAP summary plots** (mean |SHAP| across a held-out set),
   persisted at training time rather than computed only per-request.
8. **Model versioning UI** (ML Module 12) — `model_metrics.json` already
   carries dataset/model/feature metadata; a dedicated model-registry view
   could be added to Model Analytics.
