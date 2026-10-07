#!/usr/bin/env python3
"""ChronoSleep reference engine v2.0.

Pure deterministic calculator for schedule-based social jetlag.
No diagnosis, no LLM, no external API.
"""
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping
import json
import math
import re
import zipfile
import xml.etree.ElementTree as ET

MODEL_VERSION = "chronosleep-sjl-2.0"
TIME_RE = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")

DEFAULTS = {
    "input_time_uncertainty_min": 15.0,
    "planner_max_free_shift_min": 90.0,
    "adult_sleep_min_hours": 7.0,
}

def _parse_time(value: str) -> int:
    if not isinstance(value, str) or not TIME_RE.match(value):
        raise ValueError(f"Hora inválida {value!r}; use HH:MM (00:00–23:59).")
    h, m = map(int, value.split(":"))
    return h * 60 + m

def _fmt_time(minutes: float) -> str:
    m = int(round(minutes)) % 1440
    return f"{m//60:02d}:{m%60:02d}"

def _duration_hours(start_min: float, end_min: float) -> float:
    return ((end_min - start_min) % 1440) / 60.0

def _midpoint_min(start_min: float, duration_h: float) -> float:
    return (start_min + duration_h * 30.0) % 1440

def _signed_shortest_hours(a_min: float, b_min: float) -> float:
    """Signed shortest circular interval b-a, in [-12, 12)."""
    d = ((b_min - a_min + 720.0) % 1440.0) - 720.0
    if abs(d + 720.0) < 1e-9:  # deterministic tie convention
        d = 720.0
    return d / 60.0

def _read_shared_strings(zf: zipfile.ZipFile) -> list[str]:
    try:
        data = zf.read("xl/sharedStrings.xml")
    except KeyError:
        return []
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    root = ET.fromstring(data)
    out = []
    for si in root.findall("m:si", ns):
        texts = [t.text or "" for t in si.findall(".//m:t", ns)]
        out.append("".join(texts))
    return out

def _xlsx_sheet_path(zf: zipfile.ZipFile, sheet_name: str) -> str:
    ns = {
        "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
        "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "p": "http://schemas.openxmlformats.org/package/2006/relationships",
    }
    wb = ET.fromstring(zf.read("xl/workbook.xml"))
    rid = None
    for sh in wb.findall("m:sheets/m:sheet", ns):
        if sh.attrib.get("name") == sheet_name:
            rid = sh.attrib.get("{%s}id" % ns["r"])
            break
    if not rid:
        raise KeyError(f"No existe la hoja {sheet_name!r}.")
    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    target = None
    for rel in rels.findall("p:Relationship", ns):
        if rel.attrib.get("Id") == rid:
            target = rel.attrib["Target"]
            break
    if not target:
        raise KeyError(f"No se encontró relación para {sheet_name!r}.")
    if target.startswith("/"):
        return target.lstrip("/")
    if target.startswith("xl/"):
        return target
    return "xl/" + target.lstrip("/")

def _read_xlsx_rows(path: str | Path, sheet_name: str) -> list[list[Any]]:
    """Small stdlib XLSX reader sufficient for the reference base sheets."""
    path = Path(path)
    with zipfile.ZipFile(path, "r") as zf:
        shared = _read_shared_strings(zf)
        sheet_path = _xlsx_sheet_path(zf, sheet_name)
        root = ET.fromstring(zf.read(sheet_path))
        ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
        rows_out = []
        for row in root.findall(".//m:sheetData/m:row", ns):
            vals = {}
            max_col = -1
            for c in row.findall("m:c", ns):
                ref = c.attrib.get("r", "A1")
                letters = re.match(r"[A-Z]+", ref).group(0)
                col = 0
                for ch in letters:
                    col = col * 26 + (ord(ch) - 64)
                col -= 1
                max_col = max(max_col, col)
                typ = c.attrib.get("t")
                if typ == "inlineStr":
                    t = c.find("m:is/m:t", ns)
                    val = t.text if t is not None else ""
                else:
                    v = c.find("m:v", ns)
                    raw = v.text if v is not None else ""
                    if typ == "s" and raw != "":
                        val = shared[int(raw)]
                    elif typ in ("str", "e"):
                        val = raw
                    elif typ == "b":
                        val = raw == "1"
                    else:
                        if raw == "":
                            val = None
                        else:
                            try:
                                num = float(raw)
                                val = int(num) if num.is_integer() else num
                            except ValueError:
                                val = raw
                vals[col] = val
            if max_col >= 0:
                rows_out.append([vals.get(i) for i in range(max_col + 1)])
        return rows_out

def load_base(base: str | Path | Mapping[str, Any]) -> dict[str, Any]:
    if isinstance(base, Mapping):
        params = dict(DEFAULTS)
        params.update(base.get("parameters", base))
        return {"parameters": params}
    rows = _read_xlsx_rows(base, "Parametros")
    if not rows:
        raise ValueError("La hoja Parametros está vacía.")
    header = [str(x or "").strip().lower() for x in rows[0]]
    try:
        p_i = header.index("parametro")
        v_i = header.index("valor")
    except ValueError as exc:
        raise ValueError("Parametros debe contener columnas parametro y valor.") from exc
    params = dict(DEFAULTS)
    for row in rows[1:]:
        if len(row) <= max(p_i, v_i) or row[p_i] in (None, ""):
            continue
        params[str(row[p_i])] = row[v_i]
    return {"parameters": params}

def _validate_inputs(inputs: Mapping[str, Any]) -> dict[str, Any]:
    required = [
        "work_bedtime", "sleep_latency_min", "work_wake_time",
        "free_bedtime", "free_wake_time", "workdays_per_week",
        "free_day_alarm", "wake_flexibility_min",
    ]
    missing = [k for k in required if k not in inputs]
    if missing:
        raise ValueError("Faltan inputs: " + ", ".join(missing))
    x = dict(inputs)
    for k in ("work_bedtime", "work_wake_time", "free_bedtime", "free_wake_time"):
        _parse_time(x[k])
    if isinstance(x["free_day_alarm"], str):
        if x["free_day_alarm"].lower() in ("true", "1", "si", "sí", "yes"):
            x["free_day_alarm"] = True
        elif x["free_day_alarm"].lower() in ("false", "0", "no"):
            x["free_day_alarm"] = False
        else:
            raise ValueError("free_day_alarm debe ser booleano.")
    if not isinstance(x["free_day_alarm"], bool):
        raise ValueError("free_day_alarm debe ser booleano.")
    for k, lo, hi in [
        ("sleep_latency_min", 0, 120),
        ("workdays_per_week", 1, 6),
        ("wake_flexibility_min", 0, 120),
    ]:
        v = x[k]
        if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or float(v) != int(v):
            raise ValueError(f"{k} debe ser entero finito.")
        x[k] = int(v)
        if not (lo <= x[k] <= hi):
            raise ValueError(f"{k} fuera de rango [{lo}, {hi}].")
    return x

def calculate(inputs: Mapping[str, Any], base: str | Path | Mapping[str, Any]) -> dict[str, Any]:
    """Calculate ChronoSleep outputs from eight user inputs and the Excel base."""
    x = _validate_inputs(inputs)
    cfg = load_base(base)["parameters"]

    latency = x["sleep_latency_min"]
    work_bed = _parse_time(x["work_bedtime"])
    work_wake = _parse_time(x["work_wake_time"])
    free_bed = _parse_time(x["free_bedtime"])
    free_wake = _parse_time(x["free_wake_time"])
    wd = x["workdays_per_week"]
    fd = 7 - wd

    so_w = (work_bed + latency) % 1440
    so_f = (free_bed + latency) % 1440
    sd_w = _duration_hours(so_w, work_wake)
    sd_f = _duration_hours(so_f, free_wake)
    if not (3.0 <= sd_w <= 14.0):
        raise ValueError(f"Duración de sueño en días de trabajo no plausible para el MVP: {sd_w:.2f} h.")
    if not (3.0 <= sd_f <= 14.0):
        raise ValueError(f"Duración de sueño en días libres no plausible para el MVP: {sd_f:.2f} h.")

    msw = _midpoint_min(so_w, sd_w)
    msf = _midpoint_min(so_f, sd_f)
    sd_week = (wd * sd_w + fd * sd_f) / 7.0

    if x["free_day_alarm"]:
        msf_sc = None
    elif sd_f <= sd_w:
        msf_sc = msf
    else:
        msf_sc = (msf - (sd_f - sd_week) * 30.0) % 1440

    sjl_rel = _signed_shortest_hours(msw, msf)
    sjl = abs(sjl_rel)

    # Backup / methodological sensitivity: Jankowski (2017) sleep-corrected SJL.
    # The default rOpenSci implementation uses the shorter circular interval.
    # This alternative is disputed and is never the free/main figure.
    if sd_w > sd_f and work_wake <= free_wake:
        sjl_sc = abs(_signed_shortest_hours(work_wake, free_wake))
    else:
        sjl_sc = abs(_signed_shortest_hours(so_w, so_f))

    # Deterministic planner. It preserves observed sleep durations and moves
    # timing only. Work timing uses declared flexibility first; free timing is
    # then moved in the opposite direction, capped by a product constraint.
    direction = 0 if abs(sjl_rel) < 1e-12 else (1 if sjl_rel > 0 else -1)
    work_cap = float(x["wake_flexibility_min"])
    free_cap = float(cfg["planner_max_free_shift_min"])
    need = sjl * 60.0
    work_shift = direction * min(need, work_cap)
    remaining = max(0.0, need - abs(work_shift))
    free_shift = -direction * min(remaining, free_cap)

    plan_msw = (msw + work_shift) % 1440
    plan_msf = (msf + free_shift) % 1440
    plan_sjl_rel = _signed_shortest_hours(plan_msw, plan_msf)
    plan_sjl = abs(plan_sjl_rel)

    work_bed_plan = (work_bed + work_shift) % 1440
    work_wake_plan = (work_wake + work_shift) % 1440
    free_bed_plan = (free_bed + free_shift) % 1440
    free_wake_plan = (free_wake + free_shift) % 1440

    plan = []
    for day in range(1, 8):
        is_work = day <= wd
        plan.append({
            "day": day,
            "day_type": "work" if is_work else "free",
            "bedtime": _fmt_time(work_bed_plan if is_work else free_bed_plan),
            "wake_time": _fmt_time(work_wake_plan if is_work else free_wake_plan),
            "sleep_duration_hours": round(sd_w if is_work else sd_f, 4),
        })

    uncertainty_min = float(cfg["input_time_uncertainty_min"])
    sjl_delta_h = 2.0 * uncertainty_min / 60.0
    sensitivity = {
        "type": "worst_case_input_timing_scenario",
        "assumption": f"cada midpoint puede desplazarse ±{uncertainty_min:.0f} min por redondeo/autorreporte",
        "low_hours": round(max(0.0, sjl - sjl_delta_h), 4),
        "high_hours": round(min(12.0, sjl + sjl_delta_h), 4),
    }

    if sjl < 1.0:
        ref_band = "menos_de_1h"
    elif sjl < 2.0:
        ref_band = "1h_a_menos_de_2h"
    else:
        ref_band = "2h_o_mas"

    warnings = []
    adult_min = float(cfg.get("adult_sleep_min_hours", 7.0))
    if sd_week < adult_min:
        warnings.append(
            f"El promedio semanal estimado ({sd_week:.2f} h) está por debajo de {adult_min:.0f} h; "
            "el plan de alineación no sustituye una evaluación del tiempo total de sueño."
        )
    if x["free_day_alarm"]:
        warnings.append("MSFsc no se calcula cuando se usa alarma en días libres.")
    if sjl >= 6:
        warnings.append("Desfase muy alto para el alcance del MVP; revisar inputs y considerar orientación profesional si persiste.")
    if max(sd_w, sd_f) >= 12:
        warnings.append("Duración de sueño muy alta; revisar que las horas ingresadas sean correctas.")

    return {
        "model_version": MODEL_VERSION,
        "current": {
            "sleep_onset_work": _fmt_time(so_w),
            "sleep_onset_free": _fmt_time(so_f),
            "sleep_duration_work_hours": round(sd_w, 4),
            "sleep_duration_free_hours": round(sd_f, 4),
            "sleep_duration_week_hours": round(sd_week, 4),
            "mid_sleep_work": _fmt_time(msw),
            "mid_sleep_free": _fmt_time(msf),
            "msf_sc": None if msf_sc is None else _fmt_time(msf_sc),
            "social_jetlag_relative_hours": round(sjl_rel, 4),
            "social_jetlag_hours": round(sjl, 4),
            "social_jetlag_sleep_corrected_hours": round(sjl_sc, 4),
            "reference_band": ref_band,
        },
        "plan": {
            "work_shift_minutes": int(round(work_shift)),
            "free_shift_minutes": int(round(free_shift)),
            "planned_social_jetlag_hours": round(plan_sjl, 4),
            "planned_social_jetlag_relative_hours": round(plan_sjl_rel, 4),
            "schedule_7d": plan,
            "assumption": "adherencia inmediata al horario; no modela adaptación fisiológica ni DLMO",
        },
        "uncertainty": sensitivity,
        "warnings": warnings,
        "methodology": {
            "primary_metric": "absolute circular difference between MSF and MSW",
            "backup_metric": "Jankowski sleep-corrected SJL with shorter circular interval; disputed, sensitivity only",
            "msfsc_role": "chronotype proxy only; not used as the primary SJL metric",
            "planner": "deterministic schedule simulation preserving observed sleep durations",
        },
    }

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--base", required=True)
    p.add_argument("--inputs", required=True, help="JSON file")
    args = p.parse_args()
    with open(args.inputs, "r", encoding="utf-8") as f:
        data = json.load(f)
    print(json.dumps(calculate(data, args.base), ensure_ascii=False, indent=2))
