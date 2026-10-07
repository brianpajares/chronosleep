
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
import math
import re

MODEL_VERSION = "chronosleep-sjl-2.0"
INPUT_TIME_UNCERTAINTY_MIN = 15.0
PLANNER_MAX_FREE_SHIFT_MIN = 90.0
ADULT_SLEEP_MIN_HOURS = 7.0

_TIME_RE = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")

class InputError(ValueError):
    pass

def _parse_hhmm(value: str) -> float:
    if not isinstance(value, str) or not _TIME_RE.match(value):
        raise InputError(f"Hora inválida: {value!r}; se requiere HH:MM 24h.")
    h, m = map(int, value.split(":"))
    return h * 60.0 + m

def _fmt_hhmm(minutes: float) -> str:
    # Presentación al minuto más cercano, half-up para evitar redondeo bancario.
    total = int(math.floor((minutes % 1440.0) + 0.5)) % 1440
    return f"{total//60:02d}:{total%60:02d}"

def _wrap720(delta_min: float) -> float:
    """Intervalo circular más corto en minutos; el empate exacto usa +720."""
    x = (delta_min + 720.0) % 1440.0 - 720.0
    if math.isclose(x, -720.0, abs_tol=1e-12):
        return 720.0
    return x

def _shift_time(hhmm: str, delta_min: float) -> str:
    return _fmt_hhmm(_parse_hhmm(hhmm) + delta_min)

def _round4(x: float) -> float:
    return round(float(x) + 0.0, 4)

def validate_inputs(inp: Dict[str, Any]) -> None:
    required = [
        "work_bedtime","sleep_latency_min","work_wake_time","free_bedtime",
        "free_wake_time","workdays_per_week","free_day_alarm","wake_flexibility_min"
    ]
    missing = [k for k in required if k not in inp]
    if missing:
        raise InputError(f"Faltan inputs: {', '.join(missing)}")
    for k in ["work_bedtime","work_wake_time","free_bedtime","free_wake_time"]:
        _parse_hhmm(inp[k])
    lat = inp["sleep_latency_min"]
    if isinstance(lat, bool) or not isinstance(lat, (int, float)) or not math.isfinite(lat) or not float(lat).is_integer() or not 0 <= lat <= 120:
        raise InputError("sleep_latency_min debe ser entero finito y estar entre 0 y 120.")
    wd = inp["workdays_per_week"]
    if isinstance(wd, bool) or not isinstance(wd, int) or not 1 <= wd <= 6:
        raise InputError("workdays_per_week debe ser entero entre 1 y 6.")
    if not isinstance(inp["free_day_alarm"], bool):
        raise InputError("free_day_alarm debe ser booleano.")
    flex = inp["wake_flexibility_min"]
    if isinstance(flex, bool) or not isinstance(flex, int) or not math.isfinite(flex) or not 0 <= flex <= 120:
        raise InputError("wake_flexibility_min debe ser entero y estar entre 0 y 120.")

def calculate(inp: Dict[str, Any]) -> Dict[str, Any]:
    validate_inputs(inp)
    wb = _parse_hhmm(inp["work_bedtime"])
    ww = _parse_hhmm(inp["work_wake_time"])
    fb = _parse_hhmm(inp["free_bedtime"])
    fw = _parse_hhmm(inp["free_wake_time"])
    lat = float(inp["sleep_latency_min"])
    wd = int(inp["workdays_per_week"])
    fd = 7 - wd

    so_w = (wb + lat) % 1440.0
    so_f = (fb + lat) % 1440.0
    sd_w_min = (ww - so_w) % 1440.0
    sd_f_min = (fw - so_f) % 1440.0

    # El rango de validez publicado exige 3–14 h por episodio.
    if not (180.0 <= sd_w_min <= 840.0) or not (180.0 <= sd_f_min <= 840.0):
        raise InputError("Duración implícita fuera del rango de validez de 3–14 h; el motor se abstiene.")

    msw = (so_w + sd_w_min/2.0) % 1440.0
    msf = (so_f + sd_f_min/2.0) % 1440.0
    sd_week_min = (wd*sd_w_min + fd*sd_f_min) / 7.0

    if inp["free_day_alarm"]:
        msf_sc = None
    elif sd_f_min <= sd_w_min:
        msf_sc = msf
    else:
        msf_sc = (msf - (sd_f_min - sd_week_min)/2.0) % 1440.0

    sjl_rel_min = _wrap720(msf - msw)
    sjl_min = abs(sjl_rel_min)
    sjl_h = sjl_min/60.0

    direction = 0.0 if math.isclose(sjl_rel_min,0.0,abs_tol=1e-12) else (1.0 if sjl_rel_min > 0 else -1.0)
    work_shift = direction * min(sjl_min, float(inp["wake_flexibility_min"]))
    remaining = max(0.0, sjl_min - abs(work_shift))
    free_shift = -direction * min(remaining, PLANNER_MAX_FREE_SHIFT_MIN)

    msw_plan = (msw + work_shift) % 1440.0
    msf_plan = (msf + free_shift) % 1440.0
    planned_rel_min = _wrap720(msf_plan - msw_plan)
    planned_h = abs(planned_rel_min)/60.0

    # Jankowski SJLsc, shorter-circular implementation.
    if sd_w_min > sd_f_min and ww <= fw:
        backup_sjlsc_h = abs(_wrap720(fw - ww))/60.0
    else:
        backup_sjlsc_h = abs(_wrap720(so_f - so_w))/60.0

    if sjl_h < 1.0:
        band = "menos_de_1h"
    elif sjl_h < 2.0:
        band = "1h_a_menos_de_2h"
    else:
        band = "2h_o_mas"

    warnings: List[str] = []
    sd_week_h = sd_week_min/60.0
    if sd_week_h < ADULT_SLEEP_MIN_HOURS:
        warnings.append(
            f"El promedio semanal estimado ({sd_week_h:.2f} h) está por debajo de 7 h; "
            "el plan de alineación no sustituye una evaluación del tiempo total de sueño."
        )
    if inp["free_day_alarm"]:
        warnings.append("MSFsc no se calcula cuando se usa alarma en días libres.")
    if sjl_h >= 6.0:
        warnings.append("Desfase muy alto para el alcance del MVP; revisar inputs y considerar orientación profesional si persiste.")
    if sd_w_min/60.0 >= 12.0 or sd_f_min/60.0 >= 12.0:
        warnings.append("Duración de sueño muy alta; revisar que las horas ingresadas sean correctas.")

    schedule = []
    for day in range(1, 8):
        if day <= wd:
            day_type="work"
            bedtime=_shift_time(inp["work_bedtime"], work_shift)
            wake=_shift_time(inp["work_wake_time"], work_shift)
            dur=sd_w_min/60.0
        else:
            day_type="free"
            bedtime=_shift_time(inp["free_bedtime"], free_shift)
            wake=_shift_time(inp["free_wake_time"], free_shift)
            dur=sd_f_min/60.0
        schedule.append({
            "day": day,
            "day_type": day_type,
            "bedtime": bedtime,
            "wake_time": wake,
            "sleep_duration_hours": _round4(dur),
        })

    u = INPUT_TIME_UNCERTAINTY_MIN
    return {
        "model_version": MODEL_VERSION,
        "current": {
            "sleep_onset_work": _fmt_hhmm(so_w),
            "sleep_onset_free": _fmt_hhmm(so_f),
            "sleep_duration_work_hours": _round4(sd_w_min/60.0),
            "sleep_duration_free_hours": _round4(sd_f_min/60.0),
            "sleep_duration_week_hours": _round4(sd_week_h),
            "mid_sleep_work": _fmt_hhmm(msw),
            "mid_sleep_free": _fmt_hhmm(msf),
            "msf_sc": None if msf_sc is None else _fmt_hhmm(msf_sc),
            "social_jetlag_relative_hours": _round4(sjl_rel_min/60.0),
            "social_jetlag_hours": _round4(sjl_h),
            "social_jetlag_sleep_corrected_hours": _round4(backup_sjlsc_h),
            "reference_band": band,
        },
        "plan": {
            "work_shift_minutes": int(round(work_shift)),
            "free_shift_minutes": int(round(free_shift)),
            "planned_social_jetlag_hours": _round4(planned_h),
            "planned_social_jetlag_relative_hours": _round4(planned_rel_min/60.0),
            "schedule_7d": schedule,
            "assumption": "adherencia inmediata al horario; no modela adaptación fisiológica ni DLMO",
        },
        "uncertainty": {
            "type": "worst_case_input_timing_scenario",
            "assumption": "cada midpoint puede desplazarse ±15 min por redondeo/autorreporte",
            "low_hours": _round4(max(0.0, sjl_h - 2*u/60.0)),
            "high_hours": _round4(min(12.0, sjl_h + 2*u/60.0)),
        },
        "warnings": warnings,
        "methodology": {
            "primary_metric": "absolute circular difference between MSF and MSW",
            "backup_metric": "Jankowski sleep-corrected SJL with shorter circular interval; disputed, sensitivity only",
            "msfsc_role": "chronotype proxy only; not used as the primary SJL metric",
            "planner": "deterministic schedule simulation preserving observed sleep durations",
        },
    }

def _walk_compare(actual: Any, expected: Any, path: str="root", rel_tol: float=1e-6) -> List[str]:
    diffs=[]
    if isinstance(expected, dict):
        if not isinstance(actual, dict):
            return [f"{path}: tipo {type(actual).__name__} != dict"]
        for k,v in expected.items():
            if k not in actual:
                diffs.append(f"{path}.{k}: ausente")
            else:
                diffs.extend(_walk_compare(actual[k],v,f"{path}.{k}",rel_tol))
        return diffs
    if isinstance(expected, list):
        if not isinstance(actual,list) or len(actual)!=len(expected):
            return [f"{path}: longitud/tipo distinto"]
        for i,(a,e) in enumerate(zip(actual,expected)):
            diffs.extend(_walk_compare(a,e,f"{path}[{i}]",rel_tol))
        return diffs
    if isinstance(expected,(int,float)) and not isinstance(expected,bool):
        if not isinstance(actual,(int,float)) or isinstance(actual,bool):
            return [f"{path}: {actual!r} != {expected!r}"]
        if not math.isclose(float(actual),float(expected),rel_tol=rel_tol,abs_tol=1e-9):
            return [f"{path}: {actual!r} != {expected!r}"]
        return []
    # Los vectores históricos serializan ausencia de MSFsc como "N/A".
    if expected == "N/A" and actual is None:
        return []
    if actual != expected:
        return [f"{path}: {actual!r} != {expected!r}"]
    return []

def run_vectors(vectors: List[Dict[str, Any]]) -> Dict[str, Any]:
    details=[]
    matched=0
    for tv in vectors:
        actual=calculate(tv["inputs"])
        diffs=_walk_compare(actual,tv["expected_outputs"])
        ok=not diffs
        matched += int(ok)
        details.append({"case_id":tv["case_id"],"ok":ok,"diffs":diffs})
    return {"matched":matched,"total":len(vectors),"details":details}
