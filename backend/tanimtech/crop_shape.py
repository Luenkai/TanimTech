def shape_crop(c):
    """Converts a raw crop record into the JSON the frontend receives."""
    return {
        "slug": c["slug"], "name": c["name"], "scientific": c["scientific"], "category": c["category"],
        "lifeForm": c["life_form"], "summary": c["summary"], "growingDays": [c["days_min"], c["days_max"]],
        "bands": {
            "soilPh": [c["ph_min"], c["ph_max"]], "temperature": [c["temp_min"], c["temp_max"]],
            "rainfall": [c["rain_min"], c["rain_max"]], "humidity": [c["humidity_min"], c["humidity_max"]],
        },
        "floodNote": c["flood_note"], "typhoonNote": c["typhoon_note"],
        "bestMonths": c["best_months"], "possibleMonths": c["possible_months"], "isDemoData": "data_source" not in c,
    }
