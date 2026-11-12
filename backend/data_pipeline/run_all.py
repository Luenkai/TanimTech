"""Run:  python -m data_pipeline.run_all   (from the backend folder)
Each step is skipped with a message if its raw file is missing, so you can add datasets one at a time."""
import os
import sys

from . import config, build_crops, clean_psa, clean_ibtracs, fetch_nasa_power

STEPS = [
    ("Crops (ECOCROP + Kaggle humidity)", config.ECOCROP_FILE, build_crops.run),
    ("PSA area planted by province", config.PSA_AREA_FILE, clean_psa.run),
    ("Typhoon risk (IBTrACS)", config.IBTRACS_FILE, clean_ibtracs.run),
    ("Monthly climate (NASA POWER, needs internet)", None, fetch_nasa_power.run),
]

if __name__ == "__main__":
    os.makedirs(config.CLEAN, exist_ok=True)
    only = sys.argv[1:]  # e.g. python -m data_pipeline.run_all crops
    for title, raw, fn in STEPS:
        if only and not any(o in title.lower() for o in only):
            continue
        print(f"\n== {title}")
        if raw and not os.path.exists(os.path.join(config.RAW, raw)):
            print(f"   skipped: put {raw} in data_pipeline/raw/")
            continue
        try:
            fn()
        except Exception as e:  # keep going so one bad file does not block the rest
            print("   FAILED:", e)
