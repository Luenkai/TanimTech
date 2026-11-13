"""Legacy fallback records used only if the committed ECOCROP subset cannot be loaded.
Active recommendations use data_pipeline/clean/crops_clean.json.
best_months / possible_months: 1 = January ... 12 = December."""


def _crop(slug, name, scientific, category, life_form, summary, ph, temp, rain, humidity, days,
          best, possible, flood="Fallback note.", typhoon="Fallback note."):
    return {
        "slug": slug, "name": name, "scientific": scientific, "category": category,
        "life_form": life_form, "summary": summary,
        "ph_min": ph[0], "ph_max": ph[1], "temp_min": temp[0], "temp_max": temp[1],
        "rain_min": rain[0], "rain_max": rain[1], "humidity_min": humidity[0], "humidity_max": humidity[1],
        "days_min": days[0], "days_max": days[1],
        "best_months": best, "possible_months": possible,
        "flood_note": flood, "typhoon_note": typhoon,
    }


CROPS = [
    _crop("pechay", "Pechay", "Brassica rapa subsp. chinensis", "Leafy and fruit vegetables", "Herb",
          "A short-cycle leafy option for a closer look.",
          (6.0, 7.0), (18, 30), (60, 150), (65, 85), (30, 45), [11, 12, 1, 2], [3, 4, 5, 9, 10],
          "Use caution · fallback note. Do not interpret as safe under inundation.",
          "Not established. No crop-level storm resilience guarantee."),
    _crop("kangkong", "Kangkong", "Ipomoea aquatica", "Leafy and fruit vegetables", "Vine",
          "Familiar greens, with water conditions to check.",
          (5.5, 7.0), (25, 35), (100, 250), (70, 90), (25, 35), [4, 5, 6, 7, 8, 9, 10], [3, 11, 12],
          "Tolerates wet conditions · fallback note. Water quality still matters.", "Not established."),
    _crop("mongo", "Mongo", "Vigna radiata", "Legumes", "Herb",
          "A different growing rhythm for your shortlist.",
          (6.0, 7.5), (24, 32), (50, 100), (60, 80), (60, 90), [11, 12, 1], [2, 3, 10],
          "Sensitive to waterlogging · fallback note.",
          "Not established. Wet weather near maturity deserves caution."),
    _crop("sitaw", "Sitaw", "Vigna unguiculata subsp. sesquipedalis", "Legumes", "Vine",
          "A climbing legume that needs a trellis.",
          (5.5, 7.0), (20, 32), (80, 200), (65, 85), (50, 70), [10, 11, 12, 1, 2], [3, 4, 9]),
    _crop("talong", "Talong", "Solanum melongena", "Leafy and fruit vegetables", "Herb",
          "A fruiting vegetable with a longer cycle.",
          (5.5, 6.8), (22, 32), (80, 200), (60, 85), (70, 100), [10, 11, 12, 1], [2, 3, 4, 9]),
    _crop("kamote", "Kamote", "Ipomoea batatas", "Root crops", "Vine",
          "A hardy root crop with a long cycle.",
          (5.5, 6.5), (21, 30), (80, 200), (60, 80), (90, 120), [5, 6, 7, 8, 9, 10], [4, 11, 12]),
    _crop("mais", "Mais", "Zea mays", "Grains", "Herb",
          "A staple grain planned around the rains.",
          (5.8, 7.0), (21, 30), (80, 200), (55, 80), (80, 110), [5, 6, 10, 11], [4, 7, 12]),
]
