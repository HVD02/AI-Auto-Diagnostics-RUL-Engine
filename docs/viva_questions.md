# Viva / Defense Questions

**Q: Why isn't the anomaly model trained on the real EngineAD dataset if you
cite it as the primary dataset?**
A: The real EngineAD fleet recordings are access-gated (available on
request from the authors) and weren't included in the provided materials —
only the research paper. We documented this explicitly rather than
pretending otherwise, and substituted a synthetic demo dataset built to the
same one-class evaluation protocol the paper itself uses. See
`docs/dataset_sources.md`.

**Q: Your fault-diagnosis model only gets ~75% accuracy — why not higher?**
A: EngineFaultDB has 4 classes, one of which (Normal Operation) separates
almost perfectly; most of the residual error is between the three
undocumented fault classes, which the source data doesn't distinguish with
named, physically-interpretable labels. We report this honestly rather than
tuning until a bigger number appears, and the ROC-AUC (0.92) suggests the
model's probability ranking is meaningfully better than the flat accuracy
number alone suggests.

**Q: Why use NASA turbofan data for a car RUL model?**
A: It was specified in the brief as the RUL methodology-validation dataset,
and it's explicitly NOT presented as automotive data anywhere in the UI —
every RUL page carries a visible disclaimer. The point is to validate the
RUL *pipeline* (feature engineering → regression → evaluation on a held-out
run-to-failure trajectory), which transfers directly to a real automotive
dataset without redesign.

**Q: How do you avoid data leakage in the RUL model?**
A: Unit-level (engine-level) train/validation split — no single engine's
cycles appear in both sets — plus a completely separate official NASA test
set that's touched exactly once, after model selection is finalized on
validation data.

**Q: How does the system tell a sensor fault from a real engine fault?**
A: A heuristic in `ml_core.sensor_fault_analysis()` checks for near-zero
variance in a sensor's trailing window (a "stuck" reading) and physically
implausible values, then treats those as evidence of a sensor problem
rather than an engine problem. It's disclosed as a heuristic with a capped
confidence score, not a certainty claim.

**Q: What is SHAP and why did you use TreeExplainer specifically?**
A: SHAP (SHapley Additive exPlanations) attributes a prediction to its
input features using game-theoretic Shapley values. TreeExplainer is an
efficient, exact algorithm for tree ensembles (like our XGBoost diagnosis
model), computing exact SHAP values quickly rather than needing the slower
model-agnostic KernelExplainer.

**Q: Why didn't you use a deep learning model anywhere?**
A: The brief explicitly said not to use deep learning "to make the project
look advanced." For anomaly detection, the EngineAD paper's own benchmark
found classical models competitive with or better than deep autoencoders.
For RUL, classical regressors (Random Forest / Gradient Boosting / XGBoost)
performed comparably (MAE differences of ~0.1 cycles) with far less
complexity and training time.

**Q: What happens if I upload my own CSV?**
A: The upload endpoint validates the column schema against the demo
telemetry sensor set before running anything. If columns are missing, it
tells you exactly which ones rather than crashing or silently ignoring
them.

**Q: Is any number in this app hardcoded?**
A: No prediction, metric, or score is hardcoded. Every number traces to
either a trained model's output, an actual computed statistic (data
quality, z-scores), or a disclosed formula (health score) — see
`docs/methodology.md`.
