import io
import unittest

import numpy as np
from PIL import Image

from tanimtech.soil_binary_model import (
    FEATURE_VERSION,
    InvalidSoilScreenImageError,
    classify_soil_presence,
    features_from_bytes,
)


def png_bytes(color=(90, 70, 45)):
    image = Image.new("RGB", (24, 18), color)
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


class FakeBinaryModel:
    classes_ = np.asarray(["non_soil", "soil"])

    def __init__(self, prediction="soil", score=0.4):
        self.prediction = prediction
        self.score = score
        self.input = None

    def predict(self, values):
        self.input = values.copy()
        return np.asarray([self.prediction], dtype=object)

    def decision_function(self, values):
        self.input = values.copy()
        return np.asarray([self.score], dtype=np.float64)


class SoilBinaryModelTests(unittest.TestCase):
    def test_feature_extraction_is_finite_repeatable_and_versioned(self):
        first = features_from_bytes(png_bytes())
        second = features_from_bytes(png_bytes())
        self.assertEqual(FEATURE_VERSION, "rgb-hsv-hog-v1")
        self.assertEqual(first.shape, (1, 633))
        self.assertTrue(np.isfinite(first).all())
        np.testing.assert_allclose(first, second)

    def test_rejects_empty_and_undecodable_uploads(self):
        for content in (b"", b"not an image"):
            with self.subTest(content=content):
                with self.assertRaises(InvalidSoilScreenImageError):
                    features_from_bytes(content)

    def test_classification_result_is_binary_and_not_a_probability(self):
        model = FakeBinaryModel(prediction="soil", score=0.4)
        result = classify_soil_presence(png_bytes(), model=model)
        self.assertEqual(result["class"], "soil")
        self.assertTrue(result["isSoilLike"])
        self.assertEqual(result["decisionScore"], 0.4)
        self.assertFalse(result["decisionScoreIsCalibrated"])
        self.assertTrue(result["experimental"])
        self.assertIn("does not identify", result["limitations"][-1])
        self.assertEqual(model.input.shape, (1, 633))
        self.assertNotIn("suggestedSoilType", result)

    def test_non_soil_prediction_does_not_emit_texture_labels(self):
        result = classify_soil_presence(
            png_bytes(),
            model=FakeBinaryModel(prediction="non_soil", score=-0.8),
        )
        self.assertEqual(result["class"], "non_soil")
        self.assertFalse(result["isSoilLike"])
        self.assertNotIn("soilType", result)


if __name__ == "__main__":
    unittest.main()
