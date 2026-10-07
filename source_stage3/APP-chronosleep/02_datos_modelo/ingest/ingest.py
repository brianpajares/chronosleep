#!/usr/bin/env python3
"""Refresh official PPP reference rows for ChronoSleep.

Uses World Bank Indicators API. This script is for the build environment
(with internet), not the ChatGPT Python sandbox.
"""
from __future__ import annotations
import csv, json, urllib.request
from pathlib import Path

COUNTRIES = ["USA","BRA","GBR","CAN","AUS","MEX","ESP"]
INDICATOR = "PA.NUS.PRVT.PP"
YEAR = 2025
URL = (
    "https://api.worldbank.org/v2/country/"
    + ";".join(COUNTRIES)
    + f"/indicator/{INDICATOR}?date={YEAR}&format=json&per_page=100"
)

def fetch():
    with urllib.request.urlopen(URL, timeout=30) as r:
        payload = json.load(r)
    rows = payload[1] if isinstance(payload, list) and len(payload) > 1 else []
    out = []
    for x in rows:
        if x.get("value") is None:
            continue
        out.append({
            "country_code": x["countryiso3code"],
            "country": x["country"]["value"],
            "year": int(x["date"]),
            "ppp_private_consumption": float(x["value"]),
            "unit": "LCU per international $",
            "source_url": "https://data.worldbank.org/indicator/PA.NUS.PRVT.PP",
            "estado": "verificado",
        })
    if {r["country_code"] for r in out} != set(COUNTRIES):
        missing = set(COUNTRIES) - {r["country_code"] for r in out}
        raise RuntimeError(f"Faltan países en respuesta World Bank: {sorted(missing)}")
    return sorted(out, key=lambda r: COUNTRIES.index(r["country_code"]))

def main():
    rows = fetch()
    out = Path(__file__).with_name("worldbank_ppp_2025.csv")
    with out.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=rows[0].keys())
        w.writeheader(); w.writerows(rows)
    print(out)

if __name__ == "__main__":
    main()
