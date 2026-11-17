"""Regression tests for opt-in soil image analysis."""
import io
import json
import os
import tempfile
import unittest
import urllib.error
from unittest import mock

os.environ["TANIM_STORE_FILE"] = os.path.join(tempfile.mkdtemp(), "store.json")

from tanimtech import create_app  # noqa: E402
from tanimtech.soil_analysis import SoilAnalysisError, _vision_request, analyze_image  # noqa: E402


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False


class SoilAnalysisTests(unittest.TestCase):
    def test_default_model_supports_vision_and_json_schema(self):
        answer = {
            "suggestedTexture": "loam",
            "confidence": "medium",
            "observations": ["Visible fine and coarse particles"],
            "limitations": ["A photo cannot establish pH"],
            "recommendedChecks": ["Use a soil test"],
        }
        response_body = json.dumps({"choices": [{"message": {"content": json.dumps(answer)}}]}).encode()
        with mock.patch.dict(os.environ, {"OPENAI_API_KEY": "unit-test-key", "SOIL_VISION_MODEL": ""}):
            with mock.patch("urllib.request.urlopen", return_value=FakeResponse(response_body)) as opened:
                result = _vision_request(b"jpeg-bytes", "image/jpeg", {})
        request = opened.call_args.args[0]
        request_body = json.loads(request.data)
        self.assertEqual(request_body["model"], "gpt-5-mini")
        self.assertEqual(request_body["response_format"]["type"], "json_schema")
        self.assertTrue(request_body["messages"][0]["content"][1]["image_url"]["url"].startswith("data:image/jpeg;base64,"))
        self.assertEqual(result, answer)

    def test_upstream_http_error_is_reported_as_rejected_request(self):
        response = io.BytesIO(b'{"error":{"message":"The model does not exist."}}')
        error = urllib.error.HTTPError("https://api.example.test/v1/chat/completions", 404, "Not Found", {}, response)
        with mock.patch.dict(os.environ, {"OPENAI_API_KEY": "unit-test-key"}):
            with mock.patch("urllib.request.urlopen", side_effect=error):
                with self.assertRaisesRegex(SoilAnalysisError, "HTTP 404.*model does not exist") as raised:
                    _vision_request(b"jpeg-bytes", "image/jpeg", {})
        self.assertEqual(raised.exception.status_code, 502)

    def test_analyze_endpoint_accepts_multipart_image_and_returns_analysis(self):
        expected = {
            "suggestedTexture": "loam",
            "suggestedSoilType": "Loam",
            "confidence": "medium",
            "observations": ["Mixed particle sizes"],
            "limitations": ["Photo is not a test"],
            "recommendedChecks": ["Confirm with a soil test"],
            "datasetProfile": {"slug": "loam"},
        }
        client = create_app().test_client()
        with mock.patch("tanimtech.routes.soil.analyze_image", return_value=expected) as analyze:
            response = client.post(
                "/api/soil/analyze",
                data={"image": (io.BytesIO(b"image-data"), "soil.jpg", "image/jpeg"), "consent": "true", "details": '{"soilTexture":"loam"}'},
                content_type="multipart/form-data",
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["analysis"], expected)
        analyze.assert_called_once_with(b"image-data", "image/jpeg", {"soilTexture": "loam"})

    def test_analyze_endpoint_preserves_upstream_error_status(self):
        client = create_app().test_client()
        with mock.patch(
            "tanimtech.routes.soil.analyze_image",
            side_effect=SoilAnalysisError("The model does not exist.", status_code=502),
        ):
            response = client.post(
                "/api/soil/analyze",
                data={"image": (io.BytesIO(b"image-data"), "soil.jpg", "image/jpeg"), "consent": "true"},
                content_type="multipart/form-data",
            )
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json["error"], "The model does not exist.")

    def test_analyze_endpoint_requires_explicit_consent(self):
        client = create_app().test_client()
        with mock.patch("tanimtech.routes.soil.analyze_image") as analyze:
            response = client.post(
                "/api/soil/analyze",
                data={"image": (io.BytesIO(b"image-data"), "soil.jpg", "image/jpeg")},
                content_type="multipart/form-data",
            )
        self.assertEqual(response.status_code, 400)
        self.assertIn("consent", response.json["error"].lower())
        analyze.assert_not_called()

    def test_every_vision_texture_round_trips_into_recommendations(self):
        client = create_app().test_client()
        textures = ["clay", "loam", "sandy", "silty", "peaty", "unknown"]
        for texture in textures:
            with self.subTest(texture=texture):
                raw = {
                    "suggestedTexture": texture,
                    "confidence": "medium",
                    "observations": [],
                    "limitations": [],
                    "recommendedChecks": [],
                }
                with mock.patch("tanimtech.soil_analysis._vision_request", return_value=raw):
                    analysis = analyze_image(b"image-data", "image/jpeg")
                canonical = "Unknown" if texture == "unknown" else texture.title()
                self.assertEqual(analysis["suggestedSoilType"], canonical)
                self.assertTrue(analysis["soilProfileName"])
                response = client.post("/api/recommendations", json={
                    "soilPh": 6.4,
                    "temperature": 27,
                    "humidity": 78,
                    "rainfall": 1500,
                    "catalog": "extended",
                    "soilType": canonical,
                    "soilTexture": canonical,
                    "soilTypeSource": "model-suggested",
                })
                self.assertEqual(response.status_code, 200, response.get_data(as_text=True))
                self.assertTrue(response.json["results"])

    def test_legacy_peaty_display_label_is_normalized(self):
        response = create_app().test_client().post("/api/recommendations", json={
            "soilPh": 6.4,
            "temperature": 27,
            "humidity": 78,
            "rainfall": 1500,
            "soilType": "Peaty / organic-rich",
            "soilTexture": "Peaty / organic-rich",
        })
        self.assertEqual(response.status_code, 200, response.get_data(as_text=True))
        self.assertEqual(response.json["context"]["soilType"], "Peaty")
        self.assertEqual(response.json["context"]["soilTexture"], "Peaty")

    def test_methodology_describes_opt_in_photo_review_accurately(self):
        response = create_app().test_client().get("/api/methodology")
        self.assertEqual(response.status_code, 200)
        text = " ".join(response.json["limitations"] + response.json["notScored"])
        self.assertIn("explicit", text)
        self.assertIn("not a soil test", text)
        self.assertNotIn("never analysed", text)
        self.assertNotIn("never analyzed", text)


if __name__ == "__main__":
    unittest.main()
