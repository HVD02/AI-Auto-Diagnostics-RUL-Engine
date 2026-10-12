# Limitations

This document is deliberately blunt. Understanding these boundaries is part
of using the system responsibly.

## Dataset-level limitations

1. **EngineAD real fleet data is not included.** It's access-gated by the
   authors. The anomaly-detection module runs on synthetic demo data
   instead. Reported anomaly F1/precision/recall (~0.91/0.85/0.99) describe
   performance on that synthetic data, which is easier to separate than the
   EngineAD paper's real fleet data (which itself ranged F1 0.21–0.93 across
   25 real trucks). **Do not read the synthetic-data metrics as a claim
   about real-world anomaly detection performance.**

2. **EngineFaultDB's fault classes 1–3 are not named** in the source CSV —
   there is no accompanying data dictionary in the file we were given. This
   build reports them honestly as "Fault Class 1/2/3" rather than inventing
   plausible-sounding names (e.g. "misfire", "lean condition") that cannot
   be verified against the actual label source.

3. **NASA C-MAPSS is aircraft turbofan data, not automotive data.** The RUL
   module's MAE (~12.4 cycles) and R² (~0.81) describe how well the
   methodology predicts *jet engine* degradation, not car engine
   degradation. The module is structured so a real automotive
   run-to-failure dataset could be substituted without changing the
   pipeline shape, but no such substitution has been done here.

4. **EngineFaultDB has no temporal or vehicle-ID structure**, so a
   time-aware or vehicle-level split (as used for C-MAPSS) was not possible
   — a stratified random split was used instead. This means the reported
   metrics assume i.i.d. rows, which may not hold if the original data
   collection had autocorrelated sampling.

5. **The demo telemetry and EngineFaultDB/C-MAPSS feature spaces don't
   overlap.** A demo-mode "vehicle" cannot get a real EngineFaultDB fault
   classification directly, because the sensor readings that would need to
   feed that model (MAP, TPS, AFR, etc.) simply aren't part of the demo
   schema. The Diagnostics and RUL pages use their own dataset-appropriate
   sample selectors rather than fabricating a cross-dataset mapping.

## Modeling limitations

6. **SVM in the diagnosis benchmark was trained on a 4,000-row subsample**
   of the training set for runtime reasons (RBF-kernel SVM scales poorly
   past that size in this environment). It's still evaluated on the full
   validation/test sets, and this is flagged in `model_metrics.json` and
   the Model Analytics page (`trained_on_subsample: true`).

7. **Sensor-fault detection is a heuristic**, not a certified diagnostic. It
   flags near-zero variance in the trailing 50 samples and values outside
   generous physical bounds. It cannot detect subtler sensor faults (drift,
   bias, intermittent noise) and its confidence score is a simple function
   of how many sensors are flagged, not a calibrated probability.

8. **The "maintenance recommendation" retrieval is keyword/category
   matching**, not a trained ranking model or an LLM. It can retrieve
   loosely-relevant entries when a diagnosis/anomaly context doesn't map
   cleanly onto one of the knowledge base's 13 categories.

9. **RUL predictions beyond ~40-50 true-RUL cycles should be read as
   directional**, not precise: the test-set MAE (~12.4 cycles) is a
   meaningful fraction of the RUL range for engines that aren't close to
   failure.

## Product-level limitations

10. No OBD-II/CAN hardware integration is implemented — only a clean CSV
    ingestion path, as scoped in the brief.
11. No user authentication; SQLite history is local and unauthenticated —
    fine for a local demo, not production-ready.
12. The AI/knowledge assistant described in the brief is implemented as the
    deterministic Maintenance Center retrieval (no external LLM dependency,
    as required), not a conversational assistant.
