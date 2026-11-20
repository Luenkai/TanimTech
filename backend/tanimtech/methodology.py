"""Static content for screen 13 (Methodology and fact...)."""
from .scoring import FACTORS
from .crop_suitability import ML_WEIGHT, SOURCE_NOTE


def get_methodology():
    return {
        "title": "Clear reasoning. Visible boundaries.",
        "weights": [{"factor": f["key"], "label": f["label"], "maxPoints": f["weight"]} for f in FACTORS],
        "scoringRule": ("Inside a crop's reference band a factor earns 50-100% of its weight (best at the middle "
                        "of the band). Outside the band it falls to 0 over one band-width. The four factor scores "
                        "add up to a fit out of 100."),
        "randomForest": {
            "purpose": "A small advisory ranking signal that can refine ordering; it does not replace or change the visible rule-based fit score.",
            "inputs": ["Crop identity", "Soil pH", "Temperature (°C)", "Rainfall (mm)", "Humidity (%)"],
            "target": "Within-crop yield percentile, used as a provisional suitability proxy rather than a yield prediction.",
            "source": SOURCE_NOTE,
            "validation": "Five-fold cross-validation holds out entire states. Percentile targets and crop encoding are learned from each fold's training states only. The model is enabled only when its held-out mean squared error is lower than the transparent rule-score baseline.",
            "effect": f"For crops with at least 30 matched, reconciled training observations, ranking blends {round((1 - ML_WEIGHT) * 100)}% rule-based fit with {round(ML_WEIGHT * 100)}% Random Forest advisory. Other crops keep rule-based ordering; soil-match points remain a tie-breaker.",
            "usedIn": [
                "Crop recommendations and saved recommendation lists",
                "Farm-profile recommendations",
                "Crop comparison when field conditions are supplied",
            ],
            "limitations": [
                "Training observations are state-level Indian data, not Philippine farm trials.",
                "Yield percentile is not a probability of success or an expected yield.",
                "The advisory only uses the listed climate/soil numeric inputs and crop identity; local pests, drainage, seed quality, and farm management are not modeled.",
            ],
        },
        "coreInputs": ["Soil pH", "Temperature (monthly mean, °C)", "Humidity (monthly mean, % RH)",
                       "Rainfall (mm per month)"],
        "addOnContext": ["Soil type", "Region or province", "Elevation", "Season", "Planning month",
                         "Typhoon or flood risk", "Plant category", "Life form"],
        "notScored": ["Drainage", "Pests and disease", "Seed quality", "Sunlight", "Land area",
                      "Soil image appearance"],
        "limitations": [
            "Fit is not a probability of success or a yield forecast.",
            "Reference bands are illustrative demo data, not a verified ECOCROP connection.",
            "Soil photos stay in the browser. The user selects a texture, and local soil/crop datasets provide advisory matches; the photo is not classified.",
            "Monthly climate values must not be compared with annual requirements.",
            "A high fit never overrides local weather advisories or an agriculture adviser.",
        ],
    }
