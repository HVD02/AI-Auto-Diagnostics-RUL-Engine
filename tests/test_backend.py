"""
Test suite covering: data loading, feature engineering, anomaly model,
diagnosis model, RUL model, health score, SHAP, what-if, recommendations,
and API endpoints.

Run with: pytest tests/ -v   (from project root, backend/ on PYTHONPATH)
"""
import os
import sys
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    import main
    return TestClient(main.app)


# ---------------------------------------------------------- data loading --
def test_engine_fault_db_loads():
    import ml_core
    assert len(ml_core._efdb_df) > 1000
    assert "Fault" in ml_core._efdb_df.columns


def test_cmapss_loads():
    import ml_core
    assert ml_core._cmapss_train["unit"].nunique() == 100


def test_demo_data_loads():
    import ml_core
    scenarios = ml_core.list_demo_scenarios()
    assert "DEMO_healthy" in scenarios
    assert "DEMO_sensor_fault" in scenarios
    assert len(scenarios) == 7


# ------------------------------------------------------ feature engineering
def test_anomaly_feature_engineering_no_nans():
    import ml_core
    g = ml_core.get_demo_scenario("DEMO_healthy")
    feat = ml_core.engineer_anomaly_features(g)
    for col in ml_core.anomaly_features:
        assert feat[col].isna().sum() == 0


def test_feature_engineering_no_future_leakage():
    """Rolling stats at row i must not depend on rows after i."""
    import ml_core
    import pandas as pd
    g = ml_core.get_demo_scenario("DEMO_healthy").reset_index(drop=True)
    feat_full = ml_core.engineer_anomaly_features(g)
    truncated = g.iloc[:100].copy()
    feat_trunc = ml_core.engineer_anomaly_features(truncated)
    # value at row 50 should be identical whether or not future rows exist
    col = "coolant_temp_c_roll_mean"
    assert abs(feat_full[col].iloc[50] - feat_trunc[col].iloc[50]) < 1e-9


# --------------------------------------------------------------- anomaly --
def test_anomaly_model_runs():
    import ml_core
    g = ml_core.get_demo_scenario("DEMO_healthy")
    result = ml_core.run_anomaly(g)
    assert result["status"] in ("NORMAL", "WATCH", "WARNING", "CRITICAL")
    assert 0 <= result["anomaly_ratio"] <= 1


def test_anomaly_detects_severe_scenario():
    import ml_core
    g = ml_core.get_demo_scenario("DEMO_severe_anomaly")
    result = ml_core.run_anomaly(g)
    assert result["anomaly_ratio"] > 0.2  # should catch a meaningful chunk of the severe window


# ------------------------------------------------------------- diagnosis --
def test_diagnosis_model_runs():
    import ml_core
    row = ml_core.sample_efdb_row(seed=1)
    features = {k: v for k, v in row.items() if k != "Fault"}
    result = ml_core.run_diagnosis(features)
    assert result["predicted_class"] in (0, 1, 2, 3)
    assert 0 <= result["confidence"] <= 1
    assert len(result["top3"]) == 3


def test_diagnosis_shap_present():
    import ml_core
    row = ml_core.sample_efdb_row(seed=2)
    features = {k: v for k, v in row.items() if k != "Fault"}
    result = ml_core.run_diagnosis(features)
    assert result["shap_explanation"] is not None
    assert len(result["shap_explanation"]) <= 5


# ------------------------------------------------------------------- RUL ---
def test_rul_model_runs():
    import ml_core
    result = ml_core.run_rul(1)
    assert result["available"] is True
    assert 0 <= result["predicted_rul_cycles"] <= 125
    assert "NASA" in result["disclaimer"]


def test_rul_unknown_unit_handled_honestly():
    import ml_core
    result = ml_core.run_rul(999999)
    assert result["available"] is False
    assert "reason" in result


# --------------------------------------------------------------- health ---
def test_health_score_bounds():
    import ml_core
    g = ml_core.get_demo_scenario("DEMO_healthy")
    dq = ml_core.data_quality_report(g, ml_core.anomaly_sensors)
    sf = ml_core.sensor_fault_analysis(g)
    an = ml_core.run_anomaly(g)
    health = ml_core.compute_health_score(an, dq, sf, None)
    assert 0 <= health["health_score"] <= 100


def test_healthy_scenario_scores_higher_than_severe():
    import ml_core
    def score_for(vid):
        g = ml_core.get_demo_scenario(vid)
        dq = ml_core.data_quality_report(g, ml_core.anomaly_sensors)
        sf = ml_core.sensor_fault_analysis(g)
        an = ml_core.run_anomaly(g)
        return ml_core.compute_health_score(an, dq, sf, None)["health_score"]
    assert score_for("DEMO_healthy") > score_for("DEMO_severe_anomaly")


# ---------------------------------------------------------- sensor fault --
def test_sensor_fault_detects_stuck_sensor():
    import ml_core
    g = ml_core.get_demo_scenario("DEMO_sensor_fault")
    result = ml_core.sensor_fault_analysis(g)
    assert result["verdict"] == "LIKELY_SENSOR_FAULT"
    assert "oil_pressure_kpa" in result["flagged_sensors"]


def test_sensor_fault_no_false_positive_on_healthy():
    import ml_core
    g = ml_core.get_demo_scenario("DEMO_healthy")
    result = ml_core.sensor_fault_analysis(g)
    assert result["verdict"] == "NO_SENSOR_FAULT_DETECTED"


# --------------------------------------------------------- recommendations
def test_maintenance_recommendation_retrieval():
    import knowledge
    recs = knowledge.maintenance_recommendation("high coolant temperature overheating", ["coolant_temp_c"])
    assert len(recs) > 0
    assert any("Cooling" in r["category"] for r in recs)


def test_emissions_keywords_route_to_emissions_category():
    import knowledge
    recs = knowledge.maintenance_recommendation("Fault Class 1", ["CO", "CO2", "HC"])
    assert any(r["category"] == "Emissions System" for r in recs)


# ------------------------------------------------------------- API tests --
def test_api_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200


def test_api_demo_vehicles(client):
    r = client.get("/api/vehicles/demo")
    assert r.status_code == 200
    assert len(r.json()["vehicles"]) == 7


def test_api_analyze_demo(client):
    r = client.post("/api/analyze/demo", json={"vehicle_id": "DEMO_moderate_anomaly"})
    assert r.status_code == 200
    body = r.json()
    assert "health" in body and "anomaly" in body and "sensor_fault" in body


def test_api_analyze_demo_unknown_vehicle(client):
    r = client.post("/api/analyze/demo", json={"vehicle_id": "NOT_REAL"})
    assert r.status_code == 404


def test_api_diagnose_missing_features(client):
    r = client.post("/api/diagnose", json={"features": {"MAP": 100}})
    assert r.status_code == 400


def test_api_rul(client):
    r = client.post("/api/rul", json={"unit_id": 1})
    assert r.status_code == 200


def test_api_upload_bad_schema(client):
    csv_bytes = b"foo,bar\n1,2\n"
    r = client.post("/api/upload/telemetry", files={"file": ("bad.csv", csv_bytes, "text/csv")})
    assert r.status_code == 200
    assert r.json()["valid"] is False


def test_api_model_metrics(client):
    r = client.get("/api/model-metrics")
    assert r.status_code == 200
    body = r.json()
    assert "diagnosis" in body and "rul" in body and "anomaly" in body


def test_api_report_generation(client):
    r = client.post("/api/report/DEMO_healthy")
    assert r.status_code == 200
    assert r.json()["file"].endswith(".pdf")


def test_api_history_after_analysis(client):
    client.post("/api/analyze/demo", json={"vehicle_id": "DEMO_healthy"})
    r = client.get("/api/history", params={"vehicle_id": "DEMO_healthy"})
    assert r.status_code == 200
    assert len(r.json()["history"]) >= 1


# ---------------------------------------------- upload as active data source
def _healthy_csv_bytes():
    import ml_core
    g = ml_core.get_demo_scenario("DEMO_healthy")
    return g.to_csv(index=False).encode("utf-8")


def test_api_upload_good_schema_returns_full_analysis(client):
    r = client.post("/api/upload/telemetry", files={"file": ("mycar.csv", _healthy_csv_bytes(), "text/csv")})
    assert r.status_code == 200
    body = r.json()
    assert body["valid"] is True
    assert "health" in body and "anomaly" in body and "sensor_fault" in body and "data_quality" in body
    assert body["filename"] == "mycar.csv"


def test_api_upload_current_reflects_last_upload(client):
    client.post("/api/upload/telemetry", files={"file": ("mycar2.csv", _healthy_csv_bytes(), "text/csv")})
    r = client.get("/api/upload/current")
    assert r.status_code == 200
    assert r.json()["filename"] == "mycar2.csv"


def test_api_upload_current_telemetry_matches_schema(client):
    client.post("/api/upload/telemetry", files={"file": ("mycar3.csv", _healthy_csv_bytes(), "text/csv")})
    r = client.get("/api/telemetry/upload/current")
    assert r.status_code == 200
    body = r.json()
    import ml_core
    for s in ml_core.anomaly_sensors:
        assert s in body


def test_api_whatif_upload_reruns_pipeline(client):
    client.post("/api/upload/telemetry", files={"file": ("mycar4.csv", _healthy_csv_bytes(), "text/csv")})
    r = client.post("/api/whatif/upload", params={"sensor": "coolant_temp_c", "delta": 25})
    assert r.status_code == 200
    body = r.json()
    assert body["before"]["health"]["health_score"] >= body["after"]["health"]["health_score"]


def test_api_report_for_uploaded_vehicle(client):
    client.post("/api/upload/telemetry", files={"file": ("mycar5.csv", _healthy_csv_bytes(), "text/csv")})
    r = client.post("/api/report/UPLOADED")
    assert r.status_code == 200
    assert r.json()["file"].endswith(".pdf")


def test_api_upload_current_404_before_any_upload():
    """Fresh app instance, nothing uploaded yet -> honest 404, not a crash."""
    import importlib
    import main as main_mod
    # simulate a clean slot without restarting the whole app
    saved = dict(main_mod.CURRENT_UPLOAD)
    main_mod.CURRENT_UPLOAD.update({"df": None, "filename": None, "analysis": None, "uploaded_at": None})
    from fastapi.testclient import TestClient
    c = TestClient(main_mod.app)
    r = c.get("/api/upload/current")
    assert r.status_code == 404
    main_mod.CURRENT_UPLOAD.update(saved)
