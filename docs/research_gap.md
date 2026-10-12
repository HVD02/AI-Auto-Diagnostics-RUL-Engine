# Research Gap

## What we are not claiming to have invented

- Anomaly detection (Isolation Forest, One-Class SVM, LOF — all pre-existing,
  well-studied algorithms)
- Fault classification with gradient-boosted trees / SHAP
- RUL regression on run-to-failure data
- XGBoost, Random Forest, or any of the underlying ML algorithms
- The datasets themselves (EngineAD, EngineFaultDB, NASA C-MAPSS, and the
  Automotive Faults dataset are all pre-existing public/research resources,
  cited and linked in `dataset_sources.md`)

## What this project actually contributes

The integration of independently-sourced capabilities into one coherent,
honestly-scoped automotive diagnostic platform:

1. **Real anomaly detection** methodology (validated against a real
   published benchmark's own protocol, run on synthetic data pending real
   EngineAD access) combined with
2. **Real fault diagnosis** (trained on real automotive fault data) combined with
3. **Sensor-reliability heuristics** that distinguish a likely sensor fault
   from a likely vehicle fault — a distinction most simpler class projects
   skip entirely — combined with
4. **A documented, auditable health-scoring formula** (not a black box)
   combined with
5. **RUL/prognostics methodology** validated on real run-to-failure data,
   architected so an automotive run-to-failure dataset can be substituted
   without redesigning the pipeline, combined with
6. **Explainable AI** (real SHAP values, not canned explanations) combined with
7. **A retrieval-based diagnostic knowledge layer** grounded in a real
   documented fault database, that never lets the "AI assistant" invent a
   diagnosis, combined with
8. **What-if simulation that actually reruns the trained model** rather than
   interpolating between two hardcoded states, combined with
9. **Consistent, disclosed handling of dataset boundaries** — every page
   that uses NASA data says so; every page that uses synthetic data says
   so; nothing is silently presented as more authoritative than it is.

## Where the open research problems remain

The EngineAD paper itself identifies the real open problem in this space:
cross-vehicle generalization. Its own benchmark shows F1 scores ranging from
0.21 to 0.93 across 25 trucks of the *same make/model* using the *same*
sensors — meaning a model tuned on one fleet's "normal" baseline does not
reliably transfer to another vehicle. This project's vehicle-specific
baseline concept (Module 3 in the brief) is a step toward addressing that,
but with only synthetic demo data available, it could not be validated
against the real cross-vehicle variability the paper documents. That
remains open future work (see `future_scope.md`).
