import os
import io
import time
from typing import Optional, List, Dict

import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

import ml_core
import knowledge
import db
import report as report_mod

app = FastAPI(title="AI Auto-Diagnostics & RUL Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

HERE = os.path.dirname(__file__)
DATA_ROOT = os.path.join(HERE, "..", "data", "Automotive_Faults")
app.mount("/static/flowcharts", StaticFiles(directory=DATA_ROOT), name="flowcharts")

db.init_db()


# ------------------------------------------------------------------ models --
class WhatIfDiagnosisRequest(BaseModel):
    base_features: Dict[str, float]
    changed_features: Dict[str, float]


class DemoAnalyzeRequest(BaseModel):
    vehicle_id: str


class RulRequest(BaseModel):
    unit_id: int
    up_to_cycle: Optional[int] = None


class DiagnosisRequest(BaseModel):
    features: Dict[str, float]


# ------------------------------------------------------------------ health --
@app.get("/api/health")
def api_health():
    return {"status": "ok", "time": time.time()}


# --------------------------------------------------------------- metadata --
@app.get("/api/model-metrics")
def model_metrics():
    return ml_core.METRICS


@app.get("/api/dropdown-options")
def dropdown_options():
    return {
        "demo_vehicles": ml_core.list_demo_scenarios(),
        "cmapss_units": ml_core.list_cmapss_units()[:30],
        "diagnosis_feature_schema": ml_core.diagnosis_features,
        "anomaly_sensor_schema": ml_core.anomaly_sensors,
        "fault_class_labels": ml_core.FAULT_CLASS_NAMES,
    }


# ---------------------------------------------------------- demo pipeline --
def _full_demo_analysis(vehicle_id: str):
    g = ml_core.get_demo_scenario(vehicle_id)
    if g.empty:
        raise HTTPException(404, f"Unknown demo vehicle_id '{vehicle_id}'")
    result = ml_core.analyze_dataframe(
        g, vehicle_id, "Demo telemetry is SYNTHETIC DEMO DATA - NOT REAL VEHICLE DATA.")
    diagnosis = result["diagnosis"]
    db.save_analysis(vehicle_id, result["health"]["health_score"], result["anomaly"]["status"],
                      diagnosis["predicted_label"] if diagnosis else None,
                      diagnosis["severity"] if diagnosis else "NONE", result)
    return result


@app.post("/api/analyze/demo")
def analyze_demo(req: DemoAnalyzeRequest):
    return _full_demo_analysis(req.vehicle_id)


@app.get("/api/vehicles/demo")
def demo_vehicles():
    return {"vehicles": ml_core.list_demo_scenarios()}


@app.get("/api/telemetry/{vehicle_id}")
def telemetry(vehicle_id: str):
    g = ml_core.get_demo_scenario(vehicle_id)
    if g.empty:
        raise HTTPException(404, "unknown vehicle_id")
    cols = ["t", "timestamp"] + ml_core.anomaly_sensors
    return g[cols].to_dict(orient="list")


# ------------------------------------------------------------- diagnosis ---
@app.post("/api/diagnose")
def diagnose(req: DiagnosisRequest):
    missing = [f for f in ml_core.diagnosis_features if f not in req.features]
    if missing:
        raise HTTPException(400, f"Missing required features: {missing}")
    result = ml_core.run_diagnosis(req.features)
    top_feats = [e["feature"] for e in (result["shap_explanation"] or [])[:3]]
    result["maintenance"] = knowledge.maintenance_recommendation(result["predicted_label"], top_feats)
    return result


@app.get("/api/diagnose/sample")
def diagnose_sample(seed: Optional[int] = None):
    row = ml_core.sample_efdb_row(seed)
    return {"sample_features": row}


@app.post("/api/whatif/diagnosis")
def whatif_diagnosis(req: WhatIfDiagnosisRequest):
    before = ml_core.run_diagnosis(req.base_features)
    merged = {**req.base_features, **req.changed_features}
    after = ml_core.run_diagnosis(merged)
    return {"before": before, "after": after, "changed_features": req.changed_features}


@app.post("/api/whatif/demo")
def whatif_demo(vehicle_id: str, sensor: str, delta: float):
    g = ml_core.get_demo_scenario(vehicle_id).copy()
    if g.empty:
        raise HTTPException(404, "unknown vehicle_id")
    before = _full_demo_analysis(vehicle_id)
    if sensor not in ml_core.anomaly_sensors:
        raise HTTPException(400, f"sensor must be one of {ml_core.anomaly_sensors}")
    g[sensor] = g[sensor] + delta
    dq = ml_core.data_quality_report(g, ml_core.anomaly_sensors)
    sf = ml_core.sensor_fault_analysis(g)
    an = ml_core.run_anomaly(g)
    health = ml_core.compute_health_score(an, dq, sf, None)
    after = {"data_quality": dq, "sensor_fault": sf, "anomaly": an, "health": health}
    return {"before": before, "after": after, "sensor": sensor, "delta": delta}


# ------------------------------------------------------------------- RUL ---
@app.post("/api/rul")
def rul(req: RulRequest):
    result = ml_core.run_rul(req.unit_id, req.up_to_cycle)
    if not result.get("available"):
        raise HTTPException(404, result.get("reason", "RUL not available"))
    return result


@app.get("/api/rul/units")
def rul_units():
    return {"units": ml_core.list_cmapss_units()}


# --------------------------------------------------------------- upload ---
REQUIRED_DEMO_COLS = set(ml_core.anomaly_sensors)

# Single-slot in-memory store for the most recently uploaded, schema-valid
# CSV. This is intentionally simple (local single-user demo tool, not a
# multi-tenant service) so every page can treat "the uploaded vehicle" as
# a first-class data source alongside the demo scenarios and re-fetch it
# without re-uploading. Restarting the backend clears it, same as history.
CURRENT_UPLOAD = {"df": None, "filename": None, "analysis": None, "uploaded_at": None}
UPLOAD_VEHICLE_ID = "UPLOADED"  # synthetic id used for history/report keying


def _validate_and_parse_csv(content: bytes):
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(400, f"Could not parse CSV: {e}")
    missing = REQUIRED_DEMO_COLS - set(df.columns)
    if missing:
        return None, {
            "valid": False,
            "missing_columns": sorted(missing),
            "required_schema": sorted(REQUIRED_DEMO_COLS),
            "found_columns": df.columns.tolist(),
            "message": f"Uploaded CSV is missing required columns: {sorted(missing)}. "
                       f"Expected the telemetry schema: {sorted(REQUIRED_DEMO_COLS)}.",
        }
    if "t" not in df.columns:
        df.insert(0, "t", range(len(df)))
    if "timestamp" not in df.columns:
        df["timestamp"] = pd.date_range("2026-01-01", periods=len(df), freq="s")
    return df, None


@app.post("/api/upload/telemetry")
async def upload_telemetry(file: UploadFile = File(...)):
    content = await file.read()
    df, error = _validate_and_parse_csv(content)
    if error:
        return error

    result = ml_core.analyze_dataframe(
        df, file.filename,
        f"Uploaded file '{file.filename}' — user-provided vehicle telemetry, "
        f"analyzed by the same live pipeline as the demo scenarios.",
    )
    CURRENT_UPLOAD["df"] = df
    CURRENT_UPLOAD["filename"] = file.filename
    CURRENT_UPLOAD["analysis"] = result
    CURRENT_UPLOAD["uploaded_at"] = time.time()

    diagnosis = result["diagnosis"]
    db.save_analysis(UPLOAD_VEHICLE_ID, result["health"]["health_score"], result["anomaly"]["status"],
                      diagnosis["predicted_label"] if diagnosis else None,
                      diagnosis["severity"] if diagnosis else "NONE", result)

    return {"valid": True, "filename": file.filename, "n_rows": len(df), **result}


@app.get("/api/upload/current")
def get_current_upload():
    if CURRENT_UPLOAD["analysis"] is None:
        raise HTTPException(404, "No CSV has been uploaded yet this session.")
    return {"filename": CURRENT_UPLOAD["filename"], "uploaded_at": CURRENT_UPLOAD["uploaded_at"], **CURRENT_UPLOAD["analysis"]}


@app.get("/api/telemetry/upload/current")
def get_current_upload_telemetry():
    if CURRENT_UPLOAD["df"] is None:
        raise HTTPException(404, "No CSV has been uploaded yet this session.")
    cols = ["t", "timestamp"] + ml_core.anomaly_sensors
    df = CURRENT_UPLOAD["df"]
    return df[[c for c in cols if c in df.columns]].to_dict(orient="list")


@app.post("/api/whatif/upload")
def whatif_upload(sensor: str, delta: float):
    if CURRENT_UPLOAD["df"] is None:
        raise HTTPException(404, "No CSV has been uploaded yet this session.")
    if sensor not in ml_core.anomaly_sensors:
        raise HTTPException(400, f"sensor must be one of {ml_core.anomaly_sensors}")
    before = CURRENT_UPLOAD["analysis"]
    g = CURRENT_UPLOAD["df"].copy()
    g[sensor] = g[sensor] + delta
    after = ml_core.analyze_dataframe(g, CURRENT_UPLOAD["filename"], before["source_disclaimer"])
    return {"before": before, "after": after, "sensor": sensor, "delta": delta}


# -------------------------------------------------------------- history ---
@app.get("/api/history")
def history(vehicle_id: Optional[str] = None, limit: int = 50):
    return {"history": db.get_history(vehicle_id, limit)}


# -------------------------------------------------------------- reports ---
@app.post("/api/report/{vehicle_id}")
def create_report(vehicle_id: str):
    if vehicle_id == UPLOAD_VEHICLE_ID:
        if CURRENT_UPLOAD["analysis"] is None:
            raise HTTPException(404, "No CSV has been uploaded yet this session.")
        analysis = CURRENT_UPLOAD["analysis"]
        fpath = report_mod.generate_report(CURRENT_UPLOAD["filename"] or "uploaded_vehicle", analysis)
    else:
        analysis = _full_demo_analysis(vehicle_id)
        fpath = report_mod.generate_report(vehicle_id, analysis)
    db.save_report(vehicle_id, fpath)
    return {"file": os.path.basename(fpath)}


@app.get("/api/report/download/{filename}")
def download_report(filename: str):
    # Reject directory traversal and path separators.
    if (
        not filename
        or filename in {".", ".."}
        or "/" in filename
        or "\\" in filename
    ):
        raise HTTPException(status_code=400, detail="Invalid report filename")

    # Resolve the report directory and requested file to absolute paths.
    report_dir = os.path.realpath(report_mod.REPORT_DIR)
    fpath = os.path.realpath(os.path.join(report_dir, filename))

    # Ensure the resolved file remains inside the report directory.
    try:
        if os.path.commonpath([report_dir, fpath]) != report_dir:
            raise HTTPException(
                status_code=400,
                detail="Invalid report filename",
            )
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid report filename",
        )

    if not os.path.isfile(fpath):
        raise HTTPException(status_code=404, detail="report not found")

    return FileResponse(
        fpath,
        media_type="application/pdf",
        filename=filename,
    )


@app.get("/api/reports")
def list_reports(vehicle_id: Optional[str] = None):
    return {"reports": db.get_reports(vehicle_id)}


# ---------------------------------------------------------- maintenance ---
@app.get("/api/maintenance/search")
def maintenance_search(q: str):
    return {"results": knowledge.retrieve(q, top_k=6)}
