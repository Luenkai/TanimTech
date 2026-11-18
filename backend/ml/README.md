# Optional crop-outcome machine learning

`backend/tanimtech/ml_crop_ranker.py` is a standalone supervised-learning module. It supports either **LightGBM** or **XGBoost** regression and is intentionally not imported by the existing Flask application. The current rule-based recommendation behavior therefore remains unchanged.

The model requires real labeled farm outcomes. It does not generate synthetic labels and should not be trained from the 719-plant reference catalog alone. The catalog describes crop requirements, but it does not contain observed survival, harvest, or farmer-success outcomes.

Install one optional backend:

```bash
pip install lightgbm
# or
pip install xgboost
```

Training CSV columns:

```text
soil_ph,temperature_c,humidity_pct,rainfall_mm,latitude,longitude,crop_code,season_code,soil_type_code,drainage_code,outcome_score
```

`outcome_score` must be a measured or documented value from 0 to 1. The code validates the schema, requires at least 10 labeled rows, trains a regression model, predicts candidate outcomes, and ranks candidates from highest to lowest predicted outcome.

Example:

```python
from tanimtech.ml_crop_ranker import CropOutcomeDataset, CropOutcomeRanker

data = CropOutcomeDataset.from_csv("farm_outcomes.csv")
ranker = CropOutcomeRanker(backend="lightgbm").fit(data)
ranked = ranker.rank([
    {
        "crop_slug": "pechay",
        "soil_ph": 6.4, "temperature_c": 27, "humidity_pct": 78,
        "rainfall_mm": 1200, "latitude": 14.2, "longitude": 121.1,
        "crop_code": 1, "season_code": 1, "soil_type_code": 2, "drainage_code": 1,
    }
])
```

This module is advisory only. It should eventually be combined with the existing transparent crop-fit score, not used to replace it or make unsupported soil-chemistry or yield guarantees.
