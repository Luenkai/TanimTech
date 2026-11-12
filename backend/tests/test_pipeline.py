"""Tests for the cleaning pipeline. The tiny tables below are INVENTED fixtures that only mimic the
file layouts, to check the cleaning logic. They are not real data."""
import unittest

import numpy as np
import pandas as pd

from data_pipeline import build_crops, clean_psa, clean_ibtracs, fetch_nasa_power
from data_pipeline.common import to_number, read_csv_smart, haversine_km


class CommonTests(unittest.TestCase):
    def test_to_number(self):
        self.assertEqual(to_number("1,234.5"), 1234.5)
        for bad in ("..", "-", "x", "", None):
            self.assertTrue(np.isnan(to_number(bad)))

    def test_header_detection_skips_title_lines(self):
        text = 'Area planted by province\n"Source: PSA"\n\nGeolocation,Crop,2020,2021\nA,Pechay,1,2\nB,Pechay,3,4\nC,Pechay,5,6\n'
        df = read_csv_smart(text)
        self.assertEqual(list(df.columns), ["Geolocation", "Crop", "2020", "2021"])
        self.assertEqual(len(df), 3)

    def test_haversine(self):
        self.assertAlmostEqual(haversine_km(14.0, 121.0, 15.0, 121.0), 111.2, delta=1)


class CropTests(unittest.TestCase):
    def eco(self):
        raw = pd.DataFrame({
            "SCIENTNAME": ["Brassica rapa L.", "Brassica rapa L.", "Zea mays", "Vigna radiata"],
            "COMNAME": ["a", "b", "c", "d"],
            "TOPMN": ["18", "", "21", "24"], "TOPMX": ["30", "", "30", "32"], "TMIN": ["10", "", "10", "15"], "TMAX": ["35", "", "40", "38"],
            "ROPMN": ["720", "", "1000", "600"], "ROPMX": ["1800", "", "2400", "1200"], "RMIN": ["500", "", "500", "400"], "RMAX": ["2500", "", "3000", "1500"],
            "PHOPMN": ["6", "", "5.8", ""], "PHOPMX": ["7", "", "7", ""], "PHMIN": ["5.5", "", "5", "5"], "PHMAX": ["7.5", "", "8", "8"],
            "GMIN": ["30", "", "80", "60"], "GMAX": ["45", "", "110", "90"],
            "TOXIC": ["x", "x", "x", "x"], "FAMNAME": ["f"] * 4,   # columns we do not need
        })
        return build_crops.clean_ecocrop(raw)

    def wanted(self):
        return pd.DataFrame([
            {"slug": "pechay", "name": "Pechay", "scientific": "Brassica rapa subsp. chinensis", "category": "Leafy", "life_form": "Herb",
             "summary": "", "kaggle_label": "", "humidity_min": "65", "humidity_max": "85", "best_months": "11,12", "possible_months": "", "flood_note": "", "typhoon_note": ""},
            {"slug": "mongo", "name": "Mongo", "scientific": "Vigna radiata", "category": "Legumes", "life_form": "Herb",
             "summary": "", "kaggle_label": "mungbean", "humidity_min": "", "humidity_max": "", "best_months": "", "possible_months": "", "flood_note": "", "typhoon_note": ""},
            {"slug": "ghost", "name": "Ghost", "scientific": "Nonexistentus plantus", "category": "x", "life_form": "Herb",
             "summary": "", "kaggle_label": "", "humidity_min": "", "humidity_max": "", "best_months": "", "possible_months": "", "flood_note": "", "typhoon_note": ""},
        ])

    def test_ecocrop_conversion_and_filtering(self):
        out, problems = build_crops.build_crops(self.eco(), self.wanted(), {"mungbean": (62, 88)})
        self.assertEqual(list(out["slug"]), ["pechay", "mongo"])            # maize row dropped, ghost reported
        self.assertEqual(len(problems), 1)
        p = out.iloc[0]
        self.assertEqual((p["ph_min"], p["ph_max"]), (6.0, 7.0))            # optimum range
        self.assertEqual((p["rain_min"], p["rain_max"]), (60, 150))         # annual / 12
        self.assertEqual((p["days_min"], p["days_max"]), (30, 45))
        self.assertEqual(p["humidity_source"], "manual placeholder")
        self.assertEqual(p["needs_review"], 1)

    def test_fallback_to_absolute_range_and_kaggle_humidity(self):
        out, _ = build_crops.build_crops(self.eco(), self.wanted(), {"mungbean": (62, 88)})
        m = out.iloc[1]
        self.assertEqual((m["ph_min"], m["ph_max"]), (5.0, 8.0))            # optimum missing -> absolute
        self.assertEqual((m["humidity_min"], m["humidity_max"]), (62, 88))
        self.assertEqual(m["humidity_source"], "kaggle")
        self.assertEqual(m["needs_review"], 0)

    def test_kaggle_percentiles(self):
        df = pd.DataFrame({"N": range(100), "label": ["Maize"] * 100, "humidity": list(range(1, 101))})
        lo, hi = build_crops.kaggle_humidity(df)["maize"]
        self.assertTrue(lo < hi and 5 <= lo <= 8 and 94 <= hi <= 97)


class PsaTests(unittest.TestCase):
    def test_wide_layout_with_hierarchy_and_missing(self):
        raw = pd.DataFrame({
            "Geolocation": ["Philippines", "..Region IV-A", "....Laguna", "....Batangas", "....Quezon"],
            "Crop": ["Pechay"] * 5, "Indicator": ["Area planted"] * 5,
            "2020": ["1,000", "500", "120.5", "..", "80"], "2021": ["1,100", "520", "130", "90", "-"],
        })
        out = clean_psa.clean_area(raw)
        self.assertEqual(set(out["province"]), {"Laguna", "Batangas", "Quezon"})   # totals and regions removed
        lag = out[(out["province"] == "Laguna") & (out["year"] == 2020)].iloc[0]
        self.assertEqual(lag["area_planted_ha"], 120.5)
        self.assertEqual(len(out), 4)                                              # the '..' and '-' cells were dropped

    def test_long_layout_two_indicators(self):
        raw = pd.DataFrame({
            "Geolocation": ["Laguna", "Laguna"], "Crop": ["Pechay", "Pechay"], "Year": ["2020", "2020"],
            "Indicator": ["Area planted", "Area harvested"], "Value": ["100", "90"],
        })
        out = clean_psa.clean_area(raw)
        self.assertEqual(len(out), 1)
        self.assertEqual((out.iloc[0]["area_planted_ha"], out.iloc[0]["area_harvested_ha"]), (100, 90))


class ClimateTests(unittest.TestCase):
    def test_parse_power_climatology(self):
        months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
        payload = {"properties": {"parameter": {
            "T2M": {**{m: 27.0 for m in months}, "ANN": 27.0},
            "RH2M": {**{m: 78.0 for m in months}, "ANN": 78.0},
            "PRECTOTCORR": {**{m: 3.0 for m in months}, "ANN": 3.0},
        }}}
        payload["properties"]["parameter"]["T2M"]["FEB"] = -999   # missing month is skipped
        rows = fetch_nasa_power.parse_climatology(payload, "Laguna")
        self.assertEqual(len(rows), 11)
        self.assertEqual(rows[0], {"province": "Laguna", "month": 1, "temp_c": 27.0, "humidity_pct": 78, "rainfall_mm": 93})


class TyphoonTests(unittest.TestCase):
    def test_counts_distinct_storms_per_month(self):
        def storm(sid, month, lat, lon, wind=50):
            return [{"SID": sid, "ISO_TIME": f"2010-{month:02d}-0{d} 00:00:00", "LAT": lat + d * 0.1, "LON": lon, "WMO_WIND": wind}
                    for d in (1, 2, 3)]
        rows = storm("A", 11, 14.0, 121.0) + storm("B", 11, 14.0, 121.0) + storm("C", 11, 30.0, 140.0) \
            + storm("D", 7, 14.0, 121.0, wind=20)
        rows.append({"SID": "E", "ISO_TIME": "2011-11-01 00:00:00", "LAT": 14.0, "LON": 121.0, "WMO_WIND": 60})
        tracks = clean_ibtracs.load_tracks(pd.DataFrame(rows))
        provinces = pd.DataFrame([{"province": "Laguna", "lat": 14.17, "lon": 121.33}])
        out = clean_ibtracs.monthly_risk(tracks, provinces)
        nov = out[out["month"] == 11].iloc[0]
        self.assertEqual(nov["storms_per_year"], 1.5)       # A, B (2010) + E (2011) = 3 storms over 2 years; C is too far
        self.assertEqual(nov["risk_label"], "High")
        self.assertEqual(out[out["month"] == 7].iloc[0]["risk_label"], "Low")   # wind 20 kt is below tropical-storm strength


if __name__ == "__main__":
    unittest.main()


class JsonOutputTests(unittest.TestCase):
    def test_write_outputs_makes_csv_and_json(self):
        import json, os, tempfile
        from data_pipeline.common import write_outputs
        df = pd.DataFrame([{"slug": "a", "humidity_min": "", "days_min": 30}])
        with tempfile.TemporaryDirectory() as d:
            write_outputs(df, "t", d)
            self.assertTrue(os.path.exists(os.path.join(d, "t.csv")))
            rows = json.load(open(os.path.join(d, "t.json"), encoding="utf-8"))
        self.assertEqual(rows, [{"slug": "a", "humidity_min": None, "days_min": 30}])
