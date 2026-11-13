import os
import tempfile
import unittest

# Use a throw-away storage file so tests never touch real data.
os.environ["TANIM_STORE_FILE"] = os.path.join(tempfile.mkdtemp(), "store.json")

from tanimtech import create_app  # noqa: E402

SAMPLE = {"soilPh": 6.4, "temperature": 27, "humidity": 78, "rainfall": 1500}


class BackendTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.c = create_app().test_client()

    def test_health_and_methodology(self):
        self.assertEqual(self.c.get("/api/health").json, {"status": "ok"})
        m = self.c.get("/api/methodology").json
        self.assertEqual(sum(w["maxPoints"] for w in m["weights"]), 100)
        status = self.c.get("/api/recommendations/data-status")
        self.assertEqual(status.status_code, 200)
        self.assertTrue(status.json["available"])

    def test_explorer_filters(self):
        self.assertEqual(self.c.get("/api/crops").json["count"], 7)
        self.assertEqual([x["slug"] for x in self.c.get("/api/crops?q=pech").json["crops"]], ["pechay"])
        vines = self.c.get("/api/crops?lifeForm=Vine").json["crops"]
        self.assertTrue(vines and all(x["lifeForm"] == "Vine" for x in vines))
        self.assertTrue(all(x["growingDays"][1] <= 45 for x in self.c.get("/api/crops?maxDays=45").json["crops"]))
        self.assertEqual(self.c.get("/api/crops/pechay").json["bands"]["soilPh"], [6, 7.5])
        self.assertEqual(self.c.get("/api/crops/nope").status_code, 404)

    def test_recommendations(self):
        r = self.c.post("/api/recommendations", json={**SAMPLE, "season": "Wet season"})
        self.assertEqual(r.status_code, 200)
        res = r.json["results"]
        self.assertEqual(res[0]["slug"], "talong")
        self.assertTrue(all(0 <= x["fit"] <= 100 for x in res))
        self.assertEqual(sum(b["maxPoints"] for b in res[0]["breakdown"]), 100)
        self.assertIn("dataEvidence", res[0])

    def test_recommendation_validation(self):
        r = self.c.post("/api/recommendations", json={"soilPh": 20, "temperature": 27, "humidity": 78})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(len(r.json["errors"]), 2)
        self.assertEqual(self.c.post("/api/recommendations", data="not json").status_code, 400)

    def test_compare(self):
        ok = self.c.post("/api/compare", json={"slugs": ["pechay", "kangkong", "mongo"], **SAMPLE})
        self.assertEqual(len(ok.json["crops"]), 3)
        self.assertIsNotNone(ok.json["crops"][0]["fit"])
        self.assertEqual(self.c.post("/api/compare", json={"slugs": ["pechay"]}).status_code, 400)
        self.assertEqual(self.c.post("/api/compare", json={"slugs": ["pechay", "zzz"]}).status_code, 404)

    def test_calendar(self):
        g = self.c.get("/api/calendar?crops=pechay,mais").json
        self.assertEqual([r["slug"] for r in g["rows"]], ["pechay", "mais"])
        self.assertEqual(len(g["rows"][0]["months"]), 12)
        climate = [{"temperature": 20, "humidity": 78, "rainfall": 1200}] * 12
        p = self.c.post("/api/calendar", json={"soilPh": 6.4, "monthlyClimate": climate, "crops": ["pechay"]})
        self.assertEqual(p.json["rows"][0]["months"][0]["status"], "best")
        self.assertEqual(self.c.post("/api/calendar", json={"soilPh": 6.4, "monthlyClimate": []}).status_code, 400)

    def test_profile_lifecycle(self):
        r = self.c.post("/api/profiles", json={**SAMPLE, "name": "Field profile", "soilType": "Loam"})
        self.assertEqual(r.status_code, 201)
        pid = r.json["id"]
        self.assertEqual(r.json["soilTypeSource"], "manual")
        self.assertEqual(self.c.post("/api/profiles", json=SAMPLE).status_code, 400)  # no name

        upd = self.c.put(f"/api/profiles/{pid}", json={**SAMPLE, "name": "Renamed", "soilPh": 6.8})
        self.assertEqual(upd.json["soilPh"], 6.8)
        self.assertEqual(self.c.get(f"/api/profiles/{pid}/recommendations").json["results"][0]["slug"], "talong")
        self.assertEqual(len(self.c.get(f"/api/profiles/{pid}/calendar").json["rows"]), 7)
        self.assertEqual(self.c.post(f"/api/profiles/{pid}/shortlists", json={"label": "Nov"}).status_code, 201)
        ov = self.c.get(f"/api/profiles/{pid}/overview").json
        self.assertEqual(len(ov["topCrops"]), 3)
        self.assertEqual(ov["savedShortlists"], 1)

        self.assertEqual(self.c.delete(f"/api/profiles/{pid}").status_code, 204)
        self.assertEqual(self.c.get(f"/api/profiles/{pid}").status_code, 404)

    def test_website_served_safely(self):
        self.assertEqual(self.c.get("/").status_code, 200)
        self.assertEqual(self.c.get("/conditions.html").status_code, 200)
        self.assertEqual(self.c.get("/js/site.js").status_code, 200)
        self.assertEqual(self.c.get("/backend/app.py").status_code, 404)
        self.assertEqual(self.c.get("/backend/storage/store.json").status_code, 404)
        self.assertEqual(self.c.get("/api/nothing").status_code, 404)


if __name__ == "__main__":
    unittest.main()
