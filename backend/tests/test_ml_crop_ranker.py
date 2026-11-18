import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from tanimtech.ml_crop_ranker import (  # noqa: E402
    FEATURE_COLUMNS,
    CropOutcomeDataset,
    CropOutcomeRanker,
    DatasetError,
)


class FakeModel:
    def fit(self, features, targets):
        self.mean = sum(targets) / len(targets)

    def predict(self, features):
        return [self.mean + (row[0] - 6.0) / 10 for row in features]


def row(score=0.5, ph=6.0):
    return {
        **{column: 1 for column in FEATURE_COLUMNS},
        "soil_ph": ph,
        "outcome_score": score,
    }


class CropOutcomeDatasetTests(unittest.TestCase):
    def test_validates_real_labeled_rows(self):
        dataset = CropOutcomeDataset.from_rows([row(score=0.4 + i / 100) for i in range(10)])
        self.assertEqual(len(dataset.features), 10)
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
    def test_rank_returns_highest_prediction_first(self):
        ranker = CropOutcomeRanker.__new__(CropOutcomeRanker)
        ranker.model = FakeModel()
        ranker.is_fitted = False
        ranker.fit(CropOutcomeDataset.from_rows([row(score=0.5, ph=6.0)] * 10))
        ranked = ranker.rank([row(ph=5.0), row(ph=7.0)])
        self.assertEqual(len(ranked), 2)
        self.assertEqual(ranked[0]["soil_ph"], 7.0)
        self.assertIn("predictedOutcome", ranked[0])

    def test_rejects_unknown_backend(self):
        with self.assertRaisesRegex(ValueError, "lightgbm.*xgboost"):
            CropOutcomeRanker.__init__(object.__new__(CropOutcomeRanker), backend="ann")


if __name__ == "__main__":
    unittest.main()
