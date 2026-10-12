import sqlite3
import os
import json
import time

HERE = os.path.dirname(__file__)
DB_PATH = os.path.join(HERE, "app_history.db")


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS analysis_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicle_id TEXT,
            created_at REAL,
            health_score REAL,
            anomaly_status TEXT,
            diagnosis_label TEXT,
            severity TEXT,
            payload TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicle_id TEXT,
            created_at REAL,
            file_path TEXT
        )
    """)
    conn.commit()
    conn.close()


def save_analysis(vehicle_id, health_score, anomaly_status, diagnosis_label, severity, payload: dict):
    conn = get_conn()
    conn.execute(
        "INSERT INTO analysis_history (vehicle_id, created_at, health_score, anomaly_status, diagnosis_label, severity, payload) VALUES (?,?,?,?,?,?,?)",
        (vehicle_id, time.time(), health_score, anomaly_status, diagnosis_label, severity, json.dumps(payload)),
    )
    conn.commit()
    row_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    return row_id


def get_history(vehicle_id=None, limit=50):
    conn = get_conn()
    if vehicle_id:
        rows = conn.execute(
            "SELECT * FROM analysis_history WHERE vehicle_id=? ORDER BY created_at DESC LIMIT ?",
            (vehicle_id, limit)).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM analysis_history ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def save_report(vehicle_id, file_path):
    conn = get_conn()
    conn.execute("INSERT INTO reports (vehicle_id, created_at, file_path) VALUES (?,?,?)",
                 (vehicle_id, time.time(), file_path))
    conn.commit()
    conn.close()


def get_reports(vehicle_id=None):
    conn = get_conn()
    if vehicle_id:
        rows = conn.execute("SELECT * FROM reports WHERE vehicle_id=? ORDER BY created_at DESC", (vehicle_id,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM reports ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]
