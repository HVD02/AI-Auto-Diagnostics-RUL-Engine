"""
knowledge.py - Diagnostic knowledge layer built from the Automotive Faults
Dataset (Zenodo 15626055). This is a RETRIEVAL layer, not a generator: it
never invents a diagnosis, it only retrieves the most relevant documented
fault entries and flowcharts for a given diagnosis/anomaly context.
"""
import json
import os

HERE = os.path.dirname(__file__)
KB_PATH = os.path.join(HERE, "..", "data", "Automotive_Faults", "automotive_faults_aktc_obike_et_al.json")
_KB = json.load(open(KB_PATH, encoding="utf-8"))

FLOWCHARTS = {
    "Cooling System": "engine_overheating_flowchart.png",
    "Engine": "engine_overheating_flowchart.png",
    "Braking System": "brake_faults_flowchart.png",
    "Electrical System": "electrical_faults_flowchart.png",
    "Transmission": "transmission_faults_flowchart.png",
}

# Simple keyword retriever: score KB entries by category keyword overlap
# with a context string (e.g. "coolant temperature high" or "Fault Class 2").
# Explicit token -> KB category map. Deliberately whole-word matched (not
# substring) to avoid false positives like "CO" matching inside "Condenser".
TOKEN_TO_CATEGORY = {
    "coolant": "Cooling System", "coolant_temp_c": "Cooling System",
    "overheat": "Cooling System", "thermostat": "Cooling System", "radiator": "Cooling System",
    "battery": "Electrical System", "battery_voltage_v": "Electrical System",
    "voltage": "Electrical System", "alternator": "Electrical System", "wiring": "Electrical System",
    "electrical": "Electrical System",
    "co": "Emissions System", "hc": "Emissions System", "co2": "Emissions System",
    "o2": "Emissions System", "lambda": "Emissions System", "afr": "Emissions System",
    "emissions": "Emissions System",
    "fuel_rate_lph": "Fuel System", "consumption": "Fuel System", "fuel": "Fuel System",
    "map": "Engine Components", "tps": "Engine Components", "throttle_pos_pct": "Engine Components",
    "rpm": "Engine Components", "power": "Engine Components", "force": "Engine Components",
    "engine_load_pct": "Engine Components", "vibration_g": "Engine Components",
    "oil_pressure_kpa": "Engine Components", "intake_temp_c": "Engine Components",
    "sensor": "Electrical System",
    "speed": "Wheels & Tires", "speed_kph": "Wheels & Tires",
    "brake": "ABS System", "abs": "ABS System", "pedal": "ABS System",
    "transmission": "Transmission", "gear": "Transmission", "clutch": "Transmission",
}


def retrieve(context_text: str, top_k=5):
    tokens = [w.strip(".,()").lower() for w in context_text.replace("_", " ").split()]
    # also keep original underscored tokens (e.g. "coolant_temp_c")
    tokens += [w.strip(".,()").lower() for w in context_text.split()]

    target_categories = set()
    for t in tokens:
        if t in TOKEN_TO_CATEGORY:
            target_categories.add(TOKEN_TO_CATEGORY[t])

    scored = []
    for entry in _KB:
        cat = entry.get("category", "")
        score = 0
        if cat in target_categories:
            score += 5
        text_blob_words = set((cat + " " + entry.get("subcategory", "") + " " +
                                " ".join(entry.get("symptoms", []))).lower().replace("/", " ").split())
        score += sum(1 for t in tokens if t in text_blob_words)
        if score > 0:
            scored.append((score, entry))
    scored.sort(key=lambda x: -x[0])
    results = [e for _, e in scored[:top_k]]
    if not results:
        results = [e for e in _KB if e.get("category") == "Engine Components"][:top_k] or _KB[:top_k]
    return results


def flowchart_for_category(category: str):
    for k, v in FLOWCHARTS.items():
        if k.lower() in category.lower():
            return v
    return None


def maintenance_recommendation(diagnosis_label: str, top_features: list = None):
    """Build a maintenance recommendation by retrieving relevant KB entries
    based on the diagnosis label and (if available) the top contributing
    sensor features from SHAP, e.g. ['CO', 'HC'] -> emissions-related."""
    context = diagnosis_label
    if top_features:
        context += " " + " ".join(top_features)
    entries = retrieve(context, top_k=3)
    recs = []
    for e in entries:
        recs.append({
            "category": e.get("category"),
            "subcategory": e.get("subcategory"),
            "symptoms": e.get("symptoms", []),
            "diagnosis_steps": e.get("diagnosis_steps", []),
            "flowchart": flowchart_for_category(e.get("category", "")),
        })
    return recs
