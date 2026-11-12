import os

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")        # put the files you download here
CLEAN = os.path.join(HERE, "clean")    # cleaned CSVs for MySQL appear here
INPUTS = os.path.join(HERE, "sample_inputs")

# Raw file names the pipeline looks for (rename your downloads to these, or edit here)
ECOCROP_FILE = "EcoCrop_DB.csv"
KAGGLE_FILE = "Crop_recommendation.csv"
PSA_AREA_FILE = "psa_other_crops_area.csv"
PSA_PALAY_CORN_FILE = "psa_palay_corn.csv"        # optional
IBTRACS_FILE = "ibtracs.WP.list.v04r01.csv"
WANTED_CROPS_FILE = "crops_wanted.csv"            # in sample_inputs/ (you edit it)
PROVINCES_FILE = "provinces.csv"                  # in sample_inputs/ (you edit it)

# ---- Demo thresholds (the team should review these) ----
TYPHOON_RADIUS_KM = 300        # a storm "affects" a province if its track passes within this distance
TYPHOON_MIN_WIND_KT = 34       # tropical-storm strength and above
TYPHOON_FIRST_YEAR = 1991      # use the last ~30+ years
RISK_CAUTION = 0.10            # average storms per year in that month
RISK_HIGH = 0.30
KAGGLE_LOW_PCT, KAGGLE_HIGH_PCT = 5, 95
