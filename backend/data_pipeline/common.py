import csv
import io
import json
import os
import math
import re

import numpy as np
import pandas as pd

MISSING = {"", "..", "...", "-", "--", "x", "X", "n/a", "N/A", "na", "NA", "nan", "None", "null", "…"}


def to_number(value):
    """'1,234.5' -> 1234.5 ; '..', '-', 'x', '' -> NaN."""
    if value is None:
        return np.nan
    if isinstance(value, (int, float, np.integer, np.floating)):
        return float(value)
    s = str(value).strip().replace(",", "").replace("\u00a0", "")
    if s in MISSING:
        return np.nan
    s = re.sub(r"[^\d.\-eE+]", "", s)
    try:
        return float(s)
    except ValueError:
        return np.nan


def read_csv_smart(path_or_text, **kw):
    """Reads a CSV even if it starts with title lines (PxWeb exports do).
    The header is the first line whose column count matches the lines after it."""
    if isinstance(path_or_text, str) and "\n" not in path_or_text and not path_or_text.lstrip().startswith(('"', ",")):
        with open(path_or_text, encoding="utf-8-sig", errors="replace") as fh:
            text = fh.read()
    else:
        text = path_or_text
    rows = list(csv.reader(io.StringIO(text)))
    header_at = 0
    for i in range(len(rows) - 2):
        n = len(rows[i])
        if n >= 3 and len(rows[i + 1]) == n and len(rows[i + 2]) == n:
            header_at = i
            break
    body = rows[header_at:]
    width = len(body[0])
    body = [r + [""] * (width - len(r)) if len(r) < width else r[:width] for r in body]
    df = pd.DataFrame(body[1:], columns=[c.strip() for c in body[0]])
    return df


def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0088
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dphi = p2 - p1
    dl = np.radians(lon2) - np.radians(lon1)
    a = np.sin(dphi / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2
    return 2 * r * np.arcsin(np.sqrt(a))


def norm_name(s):
    """'  Camarines  Sur ' -> 'camarines sur' (for matching names between files)."""
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", str(s).lower())).strip()


def write_outputs(df, name, clean_dir):
    """Writes <name>.csv (for MySQL import) and <name>.json (for the Flask backend / quick checks).
    Empty cells become null in the JSON."""
    os.makedirs(clean_dir, exist_ok=True)
    df.to_csv(os.path.join(clean_dir, name + ".csv"), index=False, encoding="utf-8")
    records = json.loads(df.to_json(orient="records", force_ascii=False))
    records = [{k: (None if v == "" else v) for k, v in r.items()} for r in records]
    with open(os.path.join(clean_dir, name + ".json"), "w", encoding="utf-8") as fh:
        json.dump(records, fh, indent=2, ensure_ascii=False)
