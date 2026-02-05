import os
import urllib.request
from datetime import datetime
from flask import Blueprint, jsonify

bp = Blueprint("calendar", __name__)


def parse_ics_datetime(raw: str):
    """
    Supports formats like:
    - 20250115T120000Z
    - 20250115T120000
    - 20250115
    """
    if not raw:
        return None
    raw = raw.strip()
    try:
        if "T" in raw:
            fmt = "%Y%m%dT%H%M%S"
            if raw.endswith("Z"):
                raw = raw[:-1]
            return datetime.strptime(raw, fmt)
        return datetime.strptime(raw, "%Y%m%d")
    except Exception:
        return None


def parse_ics(content: str):
    events = []
    current = None
    for line in content.splitlines():
        line = line.strip()
        if line == "BEGIN:VEVENT":
            current = {}
        elif line == "END:VEVENT":
            if current:
                events.append(current)
            current = None
        elif current is not None:
            if line.startswith("SUMMARY:"):
                current["summary"] = line.split(":", 1)[1]
            elif line.startswith("DTSTART"):
                raw = line.split(":", 1)[1] if ":" in line else ""
                dt = parse_ics_datetime(raw)
                current["start"] = dt.isoformat() if dt else None
            elif line.startswith("DTEND"):
                raw = line.split(":", 1)[1] if ":" in line else ""
                dt = parse_ics_datetime(raw)
                current["end"] = dt.isoformat() if dt else None
            elif line.startswith("LOCATION:"):
                current["location"] = line.split(":", 1)[1]
    return events


@bp.get("/public-calendar")
def public_calendar():
    url = os.getenv("CALENDAR_ICS_URL") or ""
    if not url:
        return jsonify({"message": "CALENDAR_ICS_URL is not set", "items": []}), 200

    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = resp.read().decode("utf-8", errors="ignore")
        items = parse_ics(data)
        return jsonify({"items": items}), 200
    except Exception as ex:
        return jsonify({"message": "calendar_fetch_failed", "error": str(ex), "items": []}), 200
