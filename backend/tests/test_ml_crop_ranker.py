import os
import random
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from tanimtech.ml_crop_ranker import (  # noqa: E402
    FEATURE_COLUMNS,
    CropOutcomeDataset,
    CropOutcomeRanker,
    DatasetError,
)
from tanimtech import create_app  # noqa: E402


def row(index=0, score=None, ph=None):
    generator = random.Random(1000 + index)
    values = {column: float(generator.randint(1, 100)) for column in FEATURE_COLUMNS}
    values["soil_ph"] = float(ph if ph is not None else 5.5 + (index % 5) * 0.25)
    values["outcome_score"] = float(score if score is not None else min(0.95, 0.25 + index * 0.02))
    return values


class CropOutcomeDatasetTests(unittest.TestCase):
    def test_validates_real_labeled_rows(self):
        dataset = CropOutcomeDataset.from_rows([row(index=i) for i in range(20)])
        self.assertEqual(len(dataset.features), 20)
        self.assertEqual(len(dataset.features[0]), len(FEATURE_COLUMNS))

    def test_rejects_small_or_missing_data(self):
        with self.assertRaisesRegex(DatasetError, "at least 10"):
            CropOutcomeDataset.from_rows([row()])
        bad = row()
        del bad["rainfall_mm"]
        with self.assertRaisesRegex(DatasetError, "rainfall_mm"):
            CropOutcomeDataset.from_rows([bad] * 10)

    def test_rejects_outcome_outside_normalized_range(self):
        with self.assertRaisesRegex(DatasetError, "between 0 and 1"):
            CropOutcomeDataset.from_rows([row(score=2)] * 10)


class CropOutcomeRankerTests(unittest.TestCase):
    def test_linear_regression_predicts_and_ranks_candidates(self):
        dataset = CropOutcomeDataset.from_rows([row(index=i) for i in range(20)])
        ranker = CropOutcomeRanker().fit(dataset)
        predictions = ranker.predict([row(ph=5.5), row(ph=6.5)])
        self.assertEqual(len(predictions), 2)
        self.assertTrue(all(0 <= value <= 1 for value in predictions))
        ranked = ranker.rank([row(ph=5.5), row(ph=6.5)])
        self.assertEqual(len(ranked), 2)
        self.assertIn("predictedOutcome", ranked[0])

    def test_predict_requires_training(self):
        with self.assertRaisesRegex(RuntimeError, "fit"):
            CropOutcomeRanker().predict([row()])

    def test_save_and_load(self):
        ranker = CropOutcomeRanker().fit(CropOutcomeDataset.from_rows([row(index=i) for i in range(20)]))
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "crop-linear-model.pkl")
            ranker.save(path)
            restored = CropOutcomeRanker.load(path)
            self.assertEqual(ranker.predict([row(index=2)]), restored.predict([row(index=2)]))

    def test_isolated_ml_endpoint(self):
        client = create_app().test_client()
        response = client.post("/api/ml/recommendations", json={
            "trainingRows": [row(index=i) for i in range(20)],
            "candidates": [row(ph=5.5), row(ph=6.5)],
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["model"], "ordinary-linear-regression")
        self.assertEqual(len(response.json["results"]), 2)


if __name__ == "__main__":
    unittest.main()
