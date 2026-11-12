# Data pipeline: raw datasets -> clean CSVs -> MySQL (phpMyAdmin)

## Which datasets to keep
| Dataset | Keep? | Used for |
|---|---|---|
| FAO ECOCROP | YES (main) | Crop requirements: pH, temperature, rainfall, cycle days -> `crops` table |
| NASA POWER | YES | Monthly temperature, humidity, rainfall per province -> `province_climate_monthly` |
| NOAA IBTrACS (West Pacific file only) | YES | Typhoon risk per province per month -> `province_typhoon_monthly` |
| PSA OpenSTAT: Other Crops area planted/harvested | YES | What is already grown in each province -> `crop_area` |
| Kaggle Crop Recommendation | ONLY for humidity | ECOCROP has no humidity. Kaggle covers few crops (e.g. mungbean, maize) and is not Philippine data |
| PSA Palay and Corn | OPTIONAL | Only if you add rice/corn to the crop list |
| PAGASA | NO (for now) | No open bulk download; NASA POWER covers the same need |
| PhilRice Soil Information | NO (for now) | A portal, no downloadable table; soil type stays user-entered |
| PSA Crops Production Survey 2017 microdata | NO | Restricted, huge, individual-farm records |
| PSA list of crop tables | NO | Just an index page |

## Steps
1. `pip install -r data_pipeline/requirements-data.txt` (from the `backend` folder)
2. Download the files and put them in `data_pipeline/raw/` with these names:
   `EcoCrop_DB.csv`, `Crop_recommendation.csv` (optional), `psa_other_crops_area.csv`,
   `ibtracs.WP.list.v04r01.csv`
   - PSA table: PxWeb page -> "Save as" -> comma delimited with heading.
   - IBTrACS: take the **WP** (West Pacific) CSV from the NOAA page.
   - ECOCROP: the FAO site search has no bulk export; use a copy of the old database CSV.
3. Edit `sample_inputs/crops_wanted.csv` (your crop list) and `sample_inputs/provinces.csv`
   (province, lat, lon; the 8 rows are examples with approximate centres. PSA province names must match).
4. `python -m data_pipeline.run_all` (or `... run_all crops`, `... run_all psa`, etc.)
5. Cleaned files appear in `data_pipeline/clean/` as `.csv` (for MySQL) and `.json` (the Flask API reads `crops_clean.json` automatically).

## Import into MySQL
1. XAMPP: start Apache + MySQL, open phpMyAdmin.
2. SQL tab: paste `schema_mysql.sql` -> Go.
3. For each table: Import -> choose the matching CSV -> "first line contains column names" -> Go.

| CSV | Table |
|---|---|
| crops_clean.csv | crops |
| province_climate_monthly.csv | province_climate_monthly |
| province_typhoon_monthly.csv | province_typhoon_monthly |
| crop_area_clean.csv | crop_area |

## What the cleaning does
- ECOCROP: keeps only the crops in `crops_wanted.csv`; keeps ~14 needed columns; uses the optimum range
  (falls back to the absolute range); rainfall annual mm / 12 = mm per month; drops crops with missing core values.
- Kaggle: humidity 5th-95th percentile per crop.
- PSA: turns year columns into rows, '..' '-' 'x' become empty and are dropped, removes Philippines/region totals,
  keeps province rows, one row per province + crop + year with planted/harvested area.
- IBTrACS: storms of 34 kt or more since 1991 that passed within 300 km of a province, counted once per storm,
  per month, averaged per year; Low / Caution / High with demo thresholds (edit `config.py`).
- NASA POWER: 2001-2020 monthly normals; rainfall mm/day x days in month.

## Honest limits
- Rows flagged `needs_review = 1` in crops_clean.csv have no real humidity source. Fill them by hand or reduce the humidity weight.
- Annual/12 rainfall is a rough conversion, and the thresholds in `config.py` are demo values.
- The cleaning was tested on small invented tables that imitate the file layouts, not on your real downloads.
