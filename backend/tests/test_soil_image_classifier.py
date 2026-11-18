import io
import os
import tempfile
import unittest
from unittest import mock

import numpy as np
from PIL import Image

os.environ["TANIM_STORE_FILE"] = os.path.join(tempfile.mkdtemp(), "store.json")

from tanimtech import create_app  # noqa: E402
from tanimtech.soil_image_classifier import (  # noqa: E402
    MAX_IMAGE_BYTES,
    InvalidSoilImageError,
    SoilClassifierUnavailableError,
    SoilImageTooLargeError,
    classify_soil_image,
)


def png_bytes(color=(10, 20, 30)):
    image = Image.new("RGB", (4, 4), color)
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


class FakeModel:
    def __init__(self, scores):
        self.scores = scores
        self.input = None

    def predict(self, values, verbose=0):
        self.input = values.copy()
        return np.asarray([self.scores], dtype=np.float32)


class SoilImageClassifierTests(unittest.TestCase):
    def test_classifies_image_and_matches_training_channel_order(self):
        model = FakeModel([0.1, 0.2, 0.7])
        with mock.patch("tanimtech.soil_image_classifier._load_model", return_value=model):
            result = classify_soil_image(png_bytes())

        self.assertEqual(result["soilType"], "Saline Soil")
        self.assertEqual(result["soilTypeCode"], "saline_soil")
        self.assertEqual(result["modelScore"], 0.7)
        self.assertFalse(result["modelScoreIsCalibrated"])
        self.assertIn("only three soil classes", result["modelScope"])
        self.assertEqual(model.input.shape, (1, 224, 224, 3))
        np.testing.assert_allclose(
            model.input[0, 0, 0],
            np.asarray([30, 20, 10], dtype=np.float32) / 255,
        )

    def test_rejects_non_image_upload(self):
        with self.assertRaises(InvalidSoilImageError):
            classify_soil_image(b"not an image")

    def test_rejects_upload_larger_than_limit(self):
        with self.assertRaises(SoilImageTooLargeError):
            classify_soil_image(b"x" * (MAX_IMAGE_BYTES + 1))

    def test_rejects_invalid_model_scores(self):
        model = FakeModel([0.1, float("nan"), 0.9])
        with mock.patch("tanimtech.soil_image_classifier._load_model", return_value=model):
            with self.assertRaises(SoilClassifierUnavailableError):
                classify_soil_image(png_bytes())

    def test_image_endpoint_returns_local_model_result(self):
        client = create_app().test_client()
        expected = {
            "soilType": "Reddish Brown Soil",
            "soilTypeCode": "reddish_brown_soil",
            "modelScore": 0.82,
        }
        recommendations = {
            "profileLabel": "Loam profile proxy",
            "recommendedCrops": [{"slug": "pechay"}],
        }
        with (
            mock.patch(
                "tanimtech.routes.soil.classify_soil_image",
                return_value=expected,
            ) as classify,
            mock.patch(
                "tanimtech.routes.soil.recommend_crops_for_image_class",
                return_value=recommendations,
            ) as recommend,
        ):
            response = client.post(
                "/api/soil/classify-image",
                data={"image": (io.BytesIO(png_bytes()), "soil.png")},
                content_type="multipart/form-data",
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json["classification"]["cropRecommendations"],
            recommendations,
        )
        classify.assert_called_once()
        recommend.assert_called_once_with("reddish_brown_soil")

    def test_image_endpoint_validates_missing_and_invalid_images(self):
        client = create_app().test_client()
        missing = client.post("/api/soil/classify-image", data={})
        invalid = client.post(
            "/api/soil/classify-image",
            data={"image": (io.BytesIO(b"not an image"), "soil.png")},
            content_type="multipart/form-data",
        )

        self.assertEqual(missing.status_code, 400)
        self.assertEqual(invalid.status_code, 400)

    def test_image_endpoint_rejects_oversized_upload(self):
        client = create_app().test_client()
        response = client.post(
            "/api/soil/classify-image",
            data={"image": (io.BytesIO(b"x" * (MAX_IMAGE_BYTES + 1)), "soil.png")},
            content_type="multipart/form-data",
        )

        self.assertEqual(response.status_code, 413)

    def test_image_endpoint_reports_model_unavailable(self):
        client = create_app().test_client()
        with mock.patch(
            "tanimtech.routes.soil.classify_soil_image",
            side_effect=SoilClassifierUnavailableError("Model unavailable."),
        ):
            response = client.post(
                "/api/soil/classify-image",
                data={"image": (io.BytesIO(png_bytes()), "soil.png")},
                content_type="multipart/form-data",
            )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json["error"], "Model unavailable.")


if __name__ == "__main__":
    unittest.main()
