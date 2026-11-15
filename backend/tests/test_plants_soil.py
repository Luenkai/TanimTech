"""Plant catalog, Trefle client and SoilGrids soil lookup. Upstream HTTP is mocked."""
import io
import json
import os
import tempfile
import unittest
import urllib.error
from unittest import mock

os.environ["TANIM_STORE_FILE"] = os.path.join(tempfile.mkdtemp(), "store.json")

from tanimtech import create_app, soilgrids, trefle, upstream  # noqa: E402


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def soilgrids_payload(clay, sand, silt, ph=62, soc=250, null=False):
    """Same shape as https://rest.isric.org/soilgrids/v2.0/properties/query"""
    def layer(name, value, factor, unit):
        depths = [{"range": {"top_depth": a, "bottom_depth": b, "unit_depth": "cm"}, "label": f"{a}-{b}cm",
                   "values": {"mean": None if null else value}} for a, b in ((0, 5), (5, 15), (15, 30))]
        return {"name": name, "unit_measure": {"d_factor": factor, "mapped_units": unit}, "depths": depths}
    return {"type": "Point", "geometry": {"type": "Point", "coordinates": [121.1, 14.2]},
            "properties": {"layers": [layer("clay", clay, 10, "g/kg"), layer("sand", sand, 10, "g/kg"), layer("silt", silt, 10, "g/kg"),
                                      layer("phh2o", ph, 10, "pH*10"), layer("soc", soc, 10, "dg/kg"),
                                      layer("cec", 180, 10, "mmol(c)/kg"), layer("nitrogen", 200, 100, "cg/kg")]}}


class SoilTests(unittest.TestCase):
    def setUp(self):
        soilgrids._cache.clear()
        self.c = create_app().test_client()

    def test_usda_classes(self):
        cases = {(90, 5, 5): "Sand", (40, 40, 20): "Loam", (20, 65, 15): "Silt loam", (10, 10, 80): "Clay",
                 (65, 20, 15): "Sandy loam", (30, 35, 35): "Clay loam", (10, 45, 45): "Silty clay",
                 (60, 10, 30): "Sandy clay loam", (10, 88, 2): "Silt"}
        for (sand, silt, clay), expected in cases.items():
            self.assertEqual(soilgrids.usda_class(sand, silt, clay), expected, (sand, silt, clay))

    def test_classify_endpoint_maps_to_form_choices(self):
        r = self.c.get("/api/soil/classify?clay=55&silt=25&sand=20").json
        self.assertEqual((r["usdaClass"], r["appTexture"], r["appSoilType"]), ("Clay", "Clay", "Clay"))
        peat = self.c.get("/api/soil/classify?clay=10&silt=30&sand=60&soc=200").json
        self.assertEqual((peat["appTexture"], peat["appSoilType"]), ("Peaty", "Unknown"))
        self.assertEqual(self.c.get("/api/soil/classify?clay=abc").status_code, 400)

    def test_lookup_parses_soilgrids_response(self):
        body = json.dumps(soilgrids_payload(clay=450, sand=200, silt=350)).encode()
        with mock.patch.object(upstream, "_open", return_value=FakeResponse(body)) as opened:
            r = self.c.get("/api/soil/lookup?lat=14.2&lon=121.1")
            self.assertEqual(r.status_code, 200)
            j = r.json
            self.assertEqual(j["texture"], {"clayPct": 45.0, "siltPct": 35.0, "sandPct": 20.0, "usdaClass": "Clay"})
            self.assertEqual((j["appTexture"], j["appSoilType"]), ("Clay", "Clay"))
            self.assertEqual(j["phEstimate"], 6.2)
            self.assertEqual(j["organicCarbonGPerKg"], 25.0)
            self.assertEqual(j["organicMatterPct"], 4.3)
            self.assertFalse(j["cached"])
            url = opened.call_args[0][0].full_url
            self.assertIn("lat=14.2", url)
            self.assertIn("property=clay", url)
            self.assertIn("property=phh2o", url)
            # second identical request is served from cache (ISRIC is rate limited)
            self.assertTrue(self.c.get("/api/soil/lookup?latitude=14.2&longitude=121.1").json["cached"])
            self.assertEqual(opened.call_count, 1)

    def test_lookup_validation_and_upstream_errors(self):
        self.assertEqual(self.c.get("/api/soil/lookup?lat=95&lon=10").status_code, 400)
        self.assertEqual(self.c.get("/api/soil/lookup").status_code, 400)
        no_data = json.dumps(soilgrids_payload(0, 0, 0, null=True)).encode()
        with mock.patch.object(upstream, "_open", return_value=FakeResponse(no_data)):
            self.assertEqual(self.c.get("/api/soil/lookup?lat=0&lon=-30").status_code, 404)
        limited = urllib.error.HTTPError("u", 429, "Too Many", {"Retry-After": "30"}, None)
        with mock.patch.object(upstream, "_open", side_effect=limited), mock.patch.object(upstream.time, "sleep"):
            r = self.c.get("/api/soil/lookup?lat=10&lon=10")
            self.assertEqual(r.status_code, 429)
            self.assertEqual(r.headers["Retry-After"], "30")
        with mock.patch.object(upstream, "_open", side_effect=urllib.error.URLError("down")), mock.patch.object(upstream.time, "sleep"):
            self.assertEqual(self.c.get("/api/soil/lookup?lat=11&lon=11").status_code, 504)


class PlantCatalogTests(unittest.TestCase):
    def setUp(self):
        self.c = create_app().test_client()

    def test_catalog_has_many_edible_plants(self):
        g = self.c.get("/api/plants/groups").json
        self.assertGreater(g["total"], 500)
        self.assertGreater(g["groups"]["fruit-tree"]["count"], 100)
        self.assertGreater(g["groups"]["vegetable"]["count"], 100)

    def test_search_by_name_group_and_common_name(self):
        r = self.c.get("/api/plants/search?q=mango&group=fruit-tree&source=ecocrop").json
        self.assertIn("Mangifera indica", [p["scientific"] for p in r["plants"]])
        self.assertTrue(all(p["category"] == "Fruit trees" for p in r["plants"]))
        self.assertTrue(any(p["scientific"] == "Artocarpus heterophyllus" for p in self.c.get("/api/plants/search?q=nangka").json["plants"]))
        self.assertEqual(self.c.get("/api/plants/search?group=nope").status_code, 400)

    def test_pagination_and_detail(self):
        p1 = self.c.get("/api/plants/search?source=ecocrop&limit=5&page=1").json
        p2 = self.c.get("/api/plants/search?source=ecocrop&limit=5&page=2").json
        self.assertEqual(len(p1["plants"]), 5)
        self.assertNotEqual(p1["plants"][0]["id"], p2["plants"][0]["id"])
        d = self.c.get("/api/plants/mangifera-indica").json
        self.assertTrue(d["scoreable"])
        self.assertEqual(len(d["bands"]["soilPh"]), 2)
        self.assertIn("texture", d["soil"])
        self.assertEqual(self.c.get("/api/plants/does-not-exist").status_code, 404)

    def test_trefle_not_configured(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("TREFLE_TOKEN", None)
            self.assertEqual(self.c.get("/api/plants/search?q=mango&source=trefle").status_code, 503)
            auto = self.c.get("/api/plants/search?q=mango").json
            self.assertFalse(auto["trefle"]["configured"])
            self.assertTrue(auto["plants"])  # ECOCROP results still returned
            self.assertEqual(self.c.get("/api/plants/trefle-1").status_code, 503)

    def test_trefle_search_and_detail_with_mocked_api(self):
        search_json = {"data": [{"id": 111, "common_name": "Mango", "scientific_name": "Mangifera indica", "family_common_name": "Cashew family",
                                 "image_url": "https://example.test/mango.jpg", "genus": "Mangifera"}], "meta": {"total": 1}}
        detail_json = {"data": {"id": 111, "common_name": "Mango", "scientific_name": "Mangifera indica", "edible": True, "edible_part": ["fruits"],
                                "vegetable": False, "common_names": {"en": ["Mango"], "tl": ["Mangga"]},
                                "specifications": {"ligneous_type": "tree", "growth_habit": "Tree"},
                                "growth": {"ph_minimum": 5.5, "ph_maximum": 7.5, "minimum_temperature": {"deg_c": 4, "deg_f": 39},
                                           "minimum_precipitation": {"mm": 750}, "maximum_precipitation": {"mm": 2500}, "days_to_harvest": None}}}
        trefle._cache.clear()
        with mock.patch.dict(os.environ, {"TREFLE_TOKEN": "secret-token"}):
            with mock.patch.object(upstream, "_open", return_value=FakeResponse(json.dumps(search_json).encode())) as opened:
                r = self.c.get("/api/plants/search?q=mango&group=fruit-tree&source=trefle")
                self.assertEqual(r.status_code, 200)
                item = r.json["trefle"]["items"][0]
                self.assertEqual((item["id"], item["ecocropId"]), ("trefle-111", "mangifera-indica"))
                url = opened.call_args[0][0].full_url
                self.assertIn("/species/search", url)
                self.assertIn("filter[edible]=true", url)
                self.assertIn("filter[ligneous_type]=tree", url)
                self.assertIn("token=secret-token", url)
                self.assertNotIn("secret-token", r.get_data(as_text=True))  # token never reaches the browser
            with mock.patch.object(upstream, "_open", return_value=FakeResponse(json.dumps(detail_json).encode())):
                d = self.c.get("/api/plants/trefle-111").json
                self.assertEqual(d["edibleParts"], ["fruits"])
                self.assertEqual(d["toleranceLimits"]["rainfall"], [750, 2500])
                self.assertEqual(d["toleranceLimits"]["temperature"][0], 4)
                self.assertTrue(d["scoreable"])
                self.assertEqual(d["ecocrop"]["id"], "mangifera-indica")
            bad = urllib.error.HTTPError("u", 401, "Unauthorized", {}, None)
            trefle._cache.clear()
            with mock.patch.object(upstream, "_open", side_effect=bad):
                auto = self.c.get("/api/plants/search?q=mango")
                self.assertEqual(auto.status_code, 200)  # auto mode degrades gracefully
                self.assertIn("rejected", auto.json["trefle"]["error"])
                self.assertNotIn("secret-token", auto.get_data(as_text=True))
                self.assertEqual(self.c.get("/api/plants/search?q=mango&source=trefle").status_code, 502)


class ExtendedRecommendationTests(unittest.TestCase):
    BODY = {"soilPh": 6.2, "temperature": 27, "humidity": 80, "rainfall": 1800}

    def setUp(self):
        self.c = create_app().test_client()

    def test_core_scope_unchanged_and_extended_adds_plants(self):
        core = self.c.post("/api/recommendations", json=self.BODY).json
        self.assertEqual(len(core["results"]), 7)
        ext = self.c.post("/api/recommendations", json={**self.BODY, "catalog": "extended"}).json
        self.assertGreater(len(ext["results"]), 500)
        self.assertGreater(len({r["slug"] for r in ext["results"]}), 500)  # unique slugs
        self.assertIn("extended", {r["source"] for r in ext["results"]})

    def test_extended_category_filter_and_soil_match(self):
        r = self.c.post("/api/recommendations", json={**self.BODY, "catalog": "extended", "plantCategory": "Fruit trees",
                                                      "lifeForm": "Tree", "soilTexture": "Sandy", "drainage": "Poor"}).json
        self.assertTrue(r["results"])
        self.assertTrue(all(x["category"] == "Fruit trees" and x["lifeForm"] == "Tree" for x in r["results"]))
        self.assertIn("reasons", r["results"][0]["soilMatch"])
        self.assertEqual(self.c.post("/api/recommendations", json={**self.BODY, "catalog": "bogus"}).status_code, 400)


if __name__ == "__main__":
    unittest.main()
