"""Static content for screen 13 (Methodology and fact...)."""
from .scoring import FACTORS


def get_methodology():
    return {
        "title": "Clear reasoning. Visible boundaries.",
        "weights": [{"factor": f["key"], "label": f["label"], "maxPoints": f["weight"]} for f in FACTORS],
        "scoringRule": ("Inside a crop's reference band a factor earns 50-100% of its weight (best at the middle "
                        "of the band). Outside the band it falls to 0 over one band-width. The four factor scores "
                        "add up to a fit out of 100."),
        "coreInputs": ["Soil pH", "Temperature (monthly mean, °C)", "Humidity (monthly mean, % RH)",
                       "Rainfall (mm per month)"],
        "addOnContext": ["Soil type", "Region or province", "Elevation", "Season", "Planning month",
                         "Typhoon or flood risk", "Plant category", "Life form"],
        "notScored": ["Drainage", "Pests and disease", "Seed quality", "Sunlight", "Land area",
                      "Soil photo (never analysed)"],
        "limitations": [
            "Fit is not a probability of success or a yield forecast.",
            "Reference bands are illustrative demo data, not a verified ECOCROP connection.",
            "Soil photos stay on the device and are never analysed; soil type is always user-entered.",
            "Monthly climate values must not be compared with annual requirements.",
            "A high fit never overrides local weather advisories or an agriculture adviser.",
        ],
    }
