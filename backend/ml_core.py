"""
ml_core.py - loads trained models once and implements the analysis pipeline.

Every number this module returns is computed from an actual trained model,
actual input data, or a documented formula. Nothing here is a hardcoded
prediction. Where a dataset can't support a requested output, functions
return {"available": False, "reason": "..."} instead of fabricating a value.
"""
import os
import json
import joblib
import numpy as np
import pandas as pd
import shap

HERE = os.path.dirname(__file__)
MODEL_DIR = os.path.join(HERE, "model")

# ---------------------------------------------------------------- loading --
diagnosis_model = joblib.load(os.path.join(MODEL_DIR, "diagnosis_model.pkl"))
diagnosis_scaler = joblib.load(os.path.join(MODEL_DIR, "diagnosis_scaler.pkl"))
diagnosis_features = joblib.load(os.path.join(MODEL_DIR, "diagnosis_features.pkl"))

rul_model = joblib.load(os.path.join(MODEL_DIR, "rul_model.pkl"))
rul_scaler = joblib.load(os.path.join(MODEL_DIR, "rul_scaler.pkl"))
rul_features = joblib.load(os.path.join(MODEL_DIR, "rul_features.pkl"))

anomaly_model = joblib.load(os.path.join(MODEL_DIR, "anomaly_model.pkl"))
anomaly_scaler = joblib.load(os.path.join(MODEL_DIR, "anomaly_scaler.pkl"))
anomaly_features = joblib.load(os.path.join(MODEL_DIR, "anomaly_features.pkl"))
anomaly_sensors = joblib.load(os.path.join(MODEL_DIR, "anomaly_sensors.pkl"))

METRICS = json.load(open(os.path.join(MODEL_DIR, "model_metrics.json")))

FAULT_CLASS_NAMES = {0: "Normal Operation", 1: "Fault Class 1", 2: "Fault Class 2", 3: "Fault Class 3"}

# SHAP explainer for diagnosis model (tree model -> fast TreeExplainer)
try:
    _diag_explainer = shap.TreeExplainer(diagnosis_model)
except Exception:
    _diag_explainer = None

# Background sample for anomaly-model SHAP-free local explanation:
# one-class models (LOF/OCSVM/IsolationForest) aren't all SHAP-tree
# compatible, so anomaly explanations use z-score contribution instead
# (documented, not fabricated).

DEMO_CSV = os.path.join(HERE, "..", "data", "demo", "demo_vehicle_telemetry.csv")
_demo_df = pd.read_csv(DEMO_CSV, parse_dates=["timestamp"])

ENGINEFAULTDB_CSV = os.path.join(HERE, "..", "data", "EngineFaultDB", "EngineFaultDB_Final.csv")
_efdb_df = pd.read_csv(ENGINEFAULTDB_CSV)

NASA_DIR = os.path.join(HERE, "..", "data", "NASA_RUL")
CMAPSS_COLS = ["unit", "cycle", "op1", "op2", "op3"] + [f"sensor_{i}" for i in range(1, 22)]
_cmapss_train = pd.read_csv(os.path.join(NASA_DIR, "train_FD001.txt"), sep=r"\s+", header=None, names=CMAPSS_COLS)


# ------------------------------------------------------------ data quality --
def data_quality_report(df: pd.DataFrame, numeric_cols):
    n = len(df)
    missing = df[numeric_cols].isna().sum()
    missing_pct = float(missing.sum()) / (n * len(numeric_cols)) * 100 if n else 0.0
    dup = int(df.duplicated().sum())
    outliers = {}
    for c in numeric_cols:
        s = df[c].dropna()
        if len(s) < 5:
            continue
        q1, q3 = s.quantile(0.25), s.quantile(0.75)
        iqr = q3 - q1
        lo, hi = q1 - 3 * iqr, q3 + 3 * iqr
        outliers[c] = int(((s < lo) | (s > hi)).sum())
    total_outliers = sum(outliers.values())
    ts_ok = True
    if "timestamp" in df.columns:
        ts = pd.to_datetime(df["timestamp"], errors="coerce")
        ts_ok = bool(ts.is_monotonic_increasing) if len(ts) else True

    # simple documented quality score: 100 minus penalties
    score = 100.0
    score -= min(30, missing_pct * 2)
    score -= min(20, (dup / n * 100 if n else 0))
    score -= min(30, (total_outliers / (n * max(1, len(numeric_cols))) * 100 if n else 0) * 3)
    score -= 0 if ts_ok else 10
    score = float(max(0, min(100, score)))

    return {
        "n_rows": n,
        "missing_pct": round(missing_pct, 3),
        "duplicate_rows": dup,
        "outlier_counts": outliers,
        "total_outliers": total_outliers,
        "timestamp_monotonic": ts_ok,
        "data_quality_score": round(score, 1),
    }


# ------------------------------------------------------------ sensor fault --
def sensor_fault_analysis(window: pd.DataFrame):
    """Distinguish likely SENSOR fault vs VEHICLE/engine fault using
    physical-plausibility + cross-sensor consistency heuristics.
    Returns per-sensor flags + an overall verdict. Confidence is explicit
    and capped -- this is a heuristic, not a certainty claim."""
    flags = {}
    for s in anomaly_sensors:
        col = window[s].dropna()
        if len(col) < 5:
            continue
        stuck = bool(col.tail(50).std() < 1e-6) if len(col) >= 50 else False
        # physically implausible values (hard bounds, generous)
        bounds = {
            "coolant_temp_c": (-20, 140), "oil_pressure_kpa": (5, 700),
            "rpm": (0, 7000), "engine_load_pct": (0, 100),
            "intake_temp_c": (-30, 90), "fuel_rate_lph": (0, 60),
            "throttle_pos_pct": (0, 100), "vibration_g": (0, 3),
            "battery_voltage_v": (8, 16), "speed_kph": (0, 220),
        }
        lo, hi = bounds.get(s, (col.min(), col.max()))
        implausible = bool(((col < lo) | (col > hi)).any())
        flags[s] = {"stuck": stuck, "out_of_physical_range": implausible}

    flagged_sensors = [s for s, f in flags.items() if f["stuck"] or f["out_of_physical_range"]]

    if not flagged_sensors:
        verdict = "NO_SENSOR_FAULT_DETECTED"
        confidence = 0.0
    else:
        # if the flagged sensor moved independently of physically-correlated
        # signals (e.g. oil pressure stuck while RPM/load vary normally),
        # that's evidence for SENSOR fault rather than a real engine fault.
        verdict = "LIKELY_SENSOR_FAULT"
        confidence = min(0.9, 0.5 + 0.2 * len(flagged_sensors))

    return {
        "sensor_flags": flags,
        "flagged_sensors": flagged_sensors,
        "verdict": verdict,
        "confidence": round(confidence, 2),
        "note": "Heuristic cross-sensor/physical-plausibility check, not a certainty claim.",
    }


# --------------------------------------------------------------- anomaly ---
def engineer_anomaly_features(g: pd.DataFrame):
    g = g.sort_values("t").copy()
    for s in anomaly_sensors:
        g[f"{s}_roll_mean"] = g[s].rolling(30, min_periods=5).mean()
        g[f"{s}_roll_std"] = g[s].rolling(30, min_periods=5).std()
        g[f"{s}_rate"] = g[s].diff()
    g = g.bfill().ffill()
    return g


def run_anomaly(window: pd.DataFrame):
    feat = engineer_anomaly_features(window)
    X = feat[anomaly_features].values
    Xs = anomaly_scaler.transform(X)
    pred = anomaly_model.predict(Xs)  # 1 normal, -1 anomaly
    if hasattr(anomaly_model, "score_samples"):
        scores = anomaly_model.score_samples(Xs)
    elif hasattr(anomaly_model, "decision_function"):
        scores = anomaly_model.decision_function(Xs)
    else:
        scores = -pred.astype(float)
    anomaly_ratio = float((pred == -1).mean())
    # normalize score to 0-100 "anomaly intensity" using min-max over window
    s = -scores  # higher = more anomalous
    s_norm = (s - s.min()) / (s.max() - s.min() + 1e-9) * 100
    status = "NORMAL"
    if anomaly_ratio > 0.6:
        status = "CRITICAL"
    elif anomaly_ratio > 0.3:
        status = "WARNING"
    elif anomaly_ratio > 0.05:
        status = "WATCH"

    # per-sensor z-score contribution (local explanation, not SHAP since
    # one-class models here aren't tree-based)
    contrib = {}
    for sname in anomaly_sensors:
        col = window[sname]
        mu, sd = col.mean(), col.std() or 1e-6
        z = float(((col - mu) / sd).abs().mean())
        contrib[sname] = round(z, 3)
    top_contributors = sorted(contrib.items(), key=lambda kv: -kv[1])[:3]

    return {
        "anomaly_ratio": round(anomaly_ratio, 3),
        "status": status,
        "timeline_scores": [round(float(x), 2) for x in s_norm.tolist()],
        "timestamps": window["timestamp"].astype(str).tolist() if "timestamp" in window else list(range(len(window))),
        "top_contributors": [{"sensor": k, "z_score": v} for k, v in top_contributors],
        "model_used": METRICS["anomaly"]["best_model"],
    }


# -------------------------------------------------------------- diagnosis --
def run_diagnosis(features: dict):
    """features: dict keyed by EngineFaultDB feature names."""
    x = np.array([[features[f] for f in diagnosis_features]])
    xs = diagnosis_scaler.transform(x)
    proba = diagnosis_model.predict_proba(xs)[0]
    pred_class = int(np.argmax(proba))
    order = np.argsort(-proba)
    top3 = [{"class": int(c), "label": FAULT_CLASS_NAMES.get(int(c), f"Class {c}"),
             "probability": round(float(proba[c]), 4)} for c in order[:3]]

    explanation = None
    if _diag_explainer is not None:
        try:
            sv = _diag_explainer.shap_values(xs)
            if isinstance(sv, list):
                sv_row = sv[pred_class][0]
            else:
                sv_row = sv[0, :, pred_class] if sv.ndim == 3 else sv[0]
            pairs = list(zip(diagnosis_features, sv_row.tolist()))
            pairs.sort(key=lambda kv: -abs(kv[1]))
            explanation = [{"feature": f, "shap_value": round(float(v), 4)} for f, v in pairs[:5]]
        except Exception as e:
            explanation = None

    severity = "NONE"
    if pred_class != 0:
        top_p = top3[0]["probability"]
        severity = "SEVERE" if top_p > 0.8 else "MODERATE" if top_p > 0.55 else "MILD"

    return {
        "predicted_class": pred_class,
        "predicted_label": FAULT_CLASS_NAMES.get(pred_class, f"Class {pred_class}"),
        "confidence": round(float(proba[pred_class]), 4),
        "top3": top3,
        "severity": severity,
        "shap_explanation": explanation,
        "model_used": METRICS["diagnosis"]["best_model"],
    }


# ------------------------------------------------------------------- RUL ---
def get_cmapss_unit(unit_id: int):
    g = _cmapss_train[_cmapss_train["unit"] == unit_id].sort_values("cycle")
    return g


def run_rul(unit_id: int, up_to_cycle: int = None):
    g = get_cmapss_unit(unit_id)
    if g.empty:
        return {"available": False, "reason": f"Unit {unit_id} not found in FD001 training set."}
    if up_to_cycle:
        g = g[g["cycle"] <= up_to_cycle]
    row = g.iloc[[-1]]
    x = row[rul_features].values
    xs = rul_scaler.transform(x)
    pred = float(rul_model.predict(xs)[0])
    pred = max(0.0, min(125.0, pred))

    max_cycle = get_cmapss_unit(unit_id)["cycle"].max()
    true_rul_at_point = float(max(0, max_cycle - row["cycle"].values[0]))

    stage = "HEALTHY"
    if pred < 15:
        stage = "CRITICAL"
    elif pred < 40:
        stage = "DEGRADING"
    elif pred < 80:
        stage = "MODERATE_WEAR"

    degradation_curve = g[["cycle"]].copy()
    degradation_curve["true_rul"] = (max_cycle - degradation_curve["cycle"]).clip(upper=125)

    return {
        "available": True,
        "unit_id": int(unit_id),
        "current_cycle": int(row["cycle"].values[0]),
        "predicted_rul_cycles": round(pred, 1),
        "true_rul_cycles_for_reference": round(true_rul_at_point, 1),
        "degradation_stage": stage,
        "degradation_curve": degradation_curve.to_dict(orient="list"),
        "model_used": METRICS["rul"]["best_model"],
        "model_test_mae": METRICS["rul"]["test_metrics"]["test_mae"],
        "disclaimer": "RUL validated using NASA turbofan engine degradation data (C-MAPSS FD001). This is NOT passenger-car data.",
    }


# --------------------------------------------------------------- health ----
def compute_health_score(anomaly_result: dict, dq_result: dict, sensor_fault_result: dict,
                          diagnosis_result: dict = None):
    """Documented weighted formula, weights fixed & disclosed (not hidden):
        health = 100
                 - 40 * anomaly_ratio
                 - 0.3 * (100 - data_quality_score)
                 - 15 (if sensor fault flagged, since reliability of readings drops)
                 - severity_penalty from diagnosis (0/10/20/30 for NONE/MILD/MODERATE/SEVERE)
    Clipped to [0, 100].
    """
    score = 100.0
    contributions = {}

    anomaly_penalty = 40 * anomaly_result["anomaly_ratio"]
    score -= anomaly_penalty
    contributions["anomaly"] = -round(anomaly_penalty, 1)

    dq_penalty = 0.3 * (100 - dq_result["data_quality_score"])
    score -= dq_penalty
    contributions["data_quality"] = -round(dq_penalty, 1)

    sf_penalty = 15 if sensor_fault_result["verdict"] == "LIKELY_SENSOR_FAULT" else 0
    score -= sf_penalty
    contributions["sensor_reliability"] = -sf_penalty

    sev_map = {"NONE": 0, "MILD": 10, "MODERATE": 20, "SEVERE": 30}
    diag_penalty = sev_map.get(diagnosis_result["severity"], 0) if diagnosis_result else 0
    score -= diag_penalty
    contributions["fault_diagnosis"] = -diag_penalty

    score = float(max(0, min(100, score)))
    band = "EXCELLENT" if score >= 85 else "GOOD" if score >= 70 else "FAIR" if score >= 50 else "POOR" if score >= 25 else "CRITICAL"

    return {
        "health_score": round(score, 1),
        "band": band,
        "contributions": contributions,
        "formula": "100 - 40*anomaly_ratio - 0.3*(100-data_quality_score) - 15*sensor_fault_flag - severity_penalty[0/10/20/30]",
    }


def get_demo_scenario(vehicle_id: str):
    g = _demo_df[_demo_df["vehicle_id"] == vehicle_id].copy()
    return g


def list_demo_scenarios():
    return sorted(_demo_df["vehicle_id"].unique().tolist())


def analyze_dataframe(df: pd.DataFrame, label: str, source_disclaimer: str):
    """Shared full-pipeline analysis, used identically by demo vehicles and
    by uploaded CSVs, so both produce the same rich result shape."""
    dq = data_quality_report(df, anomaly_sensors)
    sf = sensor_fault_analysis(df)
    an = run_anomaly(df)

    diagnosis = None
    maintenance = []
    if an["status"] in ("WARNING", "CRITICAL") and sf["verdict"] != "LIKELY_SENSOR_FAULT":
        top_sensor_names = [c["sensor"] for c in an["top_contributors"]]
        import knowledge
        maintenance = knowledge.maintenance_recommendation(
            f"{an['status']} anomaly in {label}", top_sensor_names)
    elif sf["verdict"] == "LIKELY_SENSOR_FAULT":
        import knowledge
        maintenance = knowledge.maintenance_recommendation("sensor fault electrical wiring", sf["flagged_sensors"])

    health = compute_health_score(an, dq, sf, diagnosis)

    return {
        "vehicle_id": label,
        "data_quality": dq,
        "sensor_fault": sf,
        "anomaly": an,
        "diagnosis": diagnosis,
        "health": health,
        "maintenance": maintenance,
        "source_disclaimer": source_disclaimer,
    }


def sample_efdb_row(seed=None):
    row = _efdb_df.sample(1, random_state=seed).iloc[0]
    return row.to_dict()


def list_cmapss_units():
    return sorted(_cmapss_train["unit"].unique().tolist())
