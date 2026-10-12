# Model Evaluation

All numbers below are copied directly from `backend/model/model_metrics.json`,
produced by the training scripts in `scripts/`. Regenerate them anytime with
`python scripts/train_diagnosis.py`, `train_rul.py`, `train_anomaly.py`.

## Fault Diagnosis (EngineFaultDB)

| Model | Val Accuracy | Val F1 (macro) | Val ROC-AUC (OvR) | CV F1 mean ± std |
|---|---|---|---|---|
| Logistic Regression | 0.588 | 0.588 | 0.871 | 0.585 ± 0.006 |
| Random Forest | 0.748 | 0.756 | 0.917 | 0.755 ± 0.003 |
| SVM (RBF)* | 0.742 | 0.743 | 0.917 | 0.741 ± 0.016 |
| **XGBoost (selected)** | **0.750** | **0.759** | **0.919** | **0.757 ± 0.004** |

\* trained on a 4,000-row subsample for tractable runtime; evaluated on the
full validation set.

**Held-out test set (touched once, after model selection):**
- Accuracy: 0.745
- Precision (macro): 0.753
- Recall (macro): 0.753
- F1 (macro): 0.753
- ROC-AUC (OvR): 0.917
- Confusion matrix and full per-class classification report are in
  `backend/model/model_metrics.json → diagnosis.test_metrics`.

Class 0 (Normal Operation) is separated almost perfectly (2,400/2,400 in the
first confusion-matrix row); most of the residual error is between the three
fault classes, which is expected given they aren't documented as physically
distinct failure modes in the source file (see `limitations.md`).

## RUL / Prognostics (NASA C-MAPSS FD001)

| Model | Val MAE | Val RMSE | Val R² |
|---|---|---|---|
| **Random Forest (selected)** | **12.84** | **18.72** | **0.800** |
| Gradient Boosting | 12.98 | 18.94 | 0.795 |
| XGBoost Regressor | 13.00 | 19.05 | 0.793 |

**Official NASA test set (`test_FD001.txt` + `RUL_FD001.txt`, 100 held-out
engines, never used for model selection):**
- MAE: 12.40 cycles
- RMSE: 17.40 cycles
- R²: 0.812

For context, C-MAPSS FD001 published baselines in the literature typically
report RMSE in the 15–25 cycle range for comparable non-deep-learning
approaches, so this result is in a reasonable, unremarkable range for the
methodology — no inflated claims.

## Anomaly Detection (synthetic demo telemetry)

| Model | F1 | Precision | Recall |
|---|---|---|---|
| Isolation Forest | 0.899 | 0.842 | 0.964 |
| One-Class SVM | 0.910 | 0.846 | 0.985 |
| **Local Outlier Factor (selected)** | **0.915** | **0.848** | **0.993** |

These numbers describe separability on synthetic, deliberately-scripted
scenarios and should not be read as real-world anomaly-detection
performance — see `limitations.md`, point 1.
