# Presentation Talking Points

1. **Problem:** vehicle owners and fleet operators need earlier warning of
   engine problems than "wait for a warning light," but most student/demo
   ML projects fake this with hardcoded predictions.
2. **Approach:** integrate four real datasets, each doing the job it's
   actually good at — anomaly detection, fault classification, RUL
   prognostics, diagnostic knowledge — behind one consistent UI, with every
   number traceable to a real model or formula.
3. **What's real:** show Model Analytics live — every metric loads from
   `model_metrics.json`, produced by the actual training scripts in the ZIP.
4. **Explainability:** show the Diagnostics page's SHAP bars responding to a
   newly-drawn sample — the explanation changes because it's computed live,
   not a fixed screenshot.
5. **What-If Simulator:** drag a slider, watch the diagnosis model actually
   re-run and the "AFTER" card update — demonstrates the model is live, not
   a lookup table.
6. **Honesty as a feature:** the RUL page's NASA disclaimer, the "Fault
   Class 1/2/3" labels instead of invented names, and the EngineAD
   substitution note in `docs/dataset_sources.md` are all deliberate —
   they're the scientific-integrity requirement made visible, not
   omissions.
7. **Architecture:** FastAPI + SQLite backend, React/Vite frontend, clean
   REST boundary — runs entirely locally, no external API keys required.
8. **Extensibility:** show `docs/dataset_feature_mapping.md` and
   `docs/future_scope.md` — the RUL and anomaly modules are built so real
   automotive datasets can replace the current stand-ins without touching
   the API or frontend.
