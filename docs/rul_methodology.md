# RUL Methodology

See `methodology.md` for the full protocol. Key points, standalone:

- **Dataset:** NASA C-MAPSS FD001 (turbofan jet engine simulation) — chosen
  because it's the standard public benchmark for run-to-failure RUL research
  and was explicitly named in the project brief for this purpose.
- **Target construction:** piecewise-linear RUL, capped at 125 cycles.
- **Leakage prevention:** unit-level split; official held-out test set used
  only once.
- **Model:** Random Forest Regressor selected over Gradient Boosting and
  XGBoost by validation MAE (differences between the three were small —
  ~0.1 cycle MAE — so this is not a dramatic result, just the best of three
  reasonable choices).
- **Extensibility:** `backend/ml_core.run_rul()` takes a `unit_id` and an
  optional `up_to_cycle` — swapping in a real automotive dataset means
  replacing `data/NASA_RUL/` with equivalent run-to-failure CSVs (unit,
  cycle, features) and re-running `scripts/train_rul.py`; no API or
  frontend changes required.
- **Mandatory disclosure:** every RUL API response includes a `disclaimer`
  field, and the RUL & Prognostics page renders it as a visible banner:
  *"RUL validated using NASA turbofan engine degradation data. This is NOT
  passenger-car data."*
