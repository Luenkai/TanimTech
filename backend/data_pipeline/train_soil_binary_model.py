"""Train and group-evaluate the experimental binary soil-presence prototype.

The only positive label is "soil"; this script deliberately does not derive
soil texture classes. All views of one Zenodo physical sample remain in the
same StratifiedGroupKFold split. Openverse negatives have per-image groups.
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
from PIL import Image, ImageOps
from sklearn.metrics import (
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    precision_score,
    recall_score,
)
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
from tanimtech.soil_binary_model import FEATURE_VERSION, extract_features  # noqa: E402

LABELS = ["non_soil", "soil"]


def read_jsonl(path: Path) -> list[dict]:
    rows = []
    with path.open(encoding="utf-8") as stream:
        for line_number, line in enumerate(stream, start=1):
            if line.strip():
                try:
                    rows.append(json.loads(line))
                except json.JSONDecodeError as exc:
                    raise ValueError(f"Invalid JSON in {path}:{line_number}") from exc
    return rows


def open_feature(data_root: Path, relative_path: str) -> np.ndarray:
    path = (data_root / relative_path).resolve()
    if data_root.resolve() not in path.parents:
        raise ValueError(f"Manifest path escapes the dataset directory: {relative_path}")
    with Image.open(path) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")
        image.load()
    return extract_features(image)


def make_estimator() -> object:
    return make_pipeline(
        StandardScaler(),
        SVC(kernel="rbf", C=1.0, class_weight="balanced"),
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=Path("/tmp/tanimtech-soil-binary-data"))
    parser.add_argument("--model-out", type=Path)
    parser.add_argument("--report-out", type=Path)
    parser.add_argument("--folds", type=int, default=5)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    data_root = args.data_dir.expanduser().resolve()
    manifest_path = data_root / "manifest.jsonl"
    rows = read_jsonl(manifest_path)
    rows = [row for row in rows if row.get("label") in LABELS]
    if len({row["label"] for row in rows}) != 2:
        raise SystemExit("Training requires both soil and non_soil examples")

    hashes = {}
    unique_rows = []
    for row in rows:
        digest = row.get("sha256")
        if digest and digest in hashes:
            prior = hashes[digest]
            if prior["label"] != row["label"]:
                raise SystemExit(f"The same image hash has conflicting labels: {digest}")
            continue
        if digest:
            hashes[digest] = row
        unique_rows.append(row)
    rows = unique_rows

    y = np.asarray([row["label"] for row in rows], dtype=object)
    groups = np.asarray([row["group"] for row in rows], dtype=object)
    group_counts = {label: len(set(groups[y == label])) for label in LABELS}
    n_splits = min(args.folds, min(group_counts.values()))
    if n_splits < 2:
        raise SystemExit(f"Not enough independent groups for grouped validation: {group_counts}")

    print(f"Extracting features for {len(rows)} images...")
    X = np.vstack([open_feature(data_root, row["file"]) for row in rows])
    splitter = StratifiedGroupKFold(n_splits=n_splits, shuffle=True, random_state=args.seed)
    oof = np.empty(len(rows), dtype=object)
    fold_results = []
    for fold, (train_idx, test_idx) in enumerate(splitter.split(X, y, groups), start=1):
        estimator = make_estimator()
        estimator.fit(X[train_idx], y[train_idx])
        predictions = estimator.predict(X[test_idx])
        oof[test_idx] = predictions
        fold_results.append({
            "fold": fold,
            "train_images": int(len(train_idx)),
            "test_images": int(len(test_idx)),
            "test_soil_groups": len(set(groups[test_idx][y[test_idx] == "soil"])),
            "test_nonsoil_groups": len(set(groups[test_idx][y[test_idx] == "non_soil"])),
            "balanced_accuracy": float(balanced_accuracy_score(y[test_idx], predictions)),
            "soil_recall": float(recall_score(y[test_idx], predictions, pos_label="soil", zero_division=0)),
            "nonsoil_recall": float(recall_score(y[test_idx], predictions, pos_label="non_soil", zero_division=0)),
        })
        print(f"Fold {fold}/{n_splits}: balanced accuracy {fold_results[-1]['balanced_accuracy']:.3f}; soil recall {fold_results[-1]['soil_recall']:.3f}")

    oof_report = classification_report(y, oof, labels=LABELS, output_dict=True, zero_division=0)
    cm = confusion_matrix(y, oof, labels=LABELS)
    metrics = {
        "images": int(len(rows)),
        "images_by_class": dict(Counter(y.tolist())),
        "independent_groups_by_class": group_counts,
        "feature_version": FEATURE_VERSION,
        "grouped_cv": {
            "splitter": "StratifiedGroupKFold",
            "folds": n_splits,
            "seed": args.seed,
            "fold_results": fold_results,
            "mean_balanced_accuracy": float(np.mean([item["balanced_accuracy"] for item in fold_results])),
            "std_balanced_accuracy": float(np.std([item["balanced_accuracy"] for item in fold_results])),
            "out_of_fold_balanced_accuracy": float(balanced_accuracy_score(y, oof)),
            "out_of_fold_soil_precision": float(precision_score(y, oof, pos_label="soil", zero_division=0)),
            "out_of_fold_soil_recall": float(recall_score(y, oof, pos_label="soil", zero_division=0)),
            "out_of_fold_nonsoil_recall": float(recall_score(y, oof, pos_label="non_soil", zero_division=0)),
            "out_of_fold_confusion_matrix_labels": LABELS,
            "out_of_fold_confusion_matrix": cm.tolist(),
            "out_of_fold_classification_report": oof_report,
        },
    }

    final_model = make_estimator()
    final_model.fit(X, y)
    hard_negative_results = []
    hard_negative_manifest = data_root / "hard_negative_tests.jsonl"
    if hard_negative_manifest.exists():
        for row in read_jsonl(hard_negative_manifest):
            features = open_feature(data_root, row["file"]).reshape(1, -1)
            hard_negative_results.append({
                "title": row.get("title"),
                "source_url": row.get("source_url"),
                "license": row.get("license"),
                "prediction": str(final_model.predict(features)[0]),
                "decision_score": float(final_model.decision_function(features)[0]),
            })
    metrics["hard_negative_tests"] = hard_negative_results
    metrics["trained_at_utc"] = datetime.now(timezone.utc).isoformat()
    metrics["notice"] = (
        "Research-only binary prototype. Cross-validation holds each Zenodo soil sample group together, "
        "but the dataset is small and domain-mismatched; metrics are not a production accuracy claim."
    )

    model_out = args.model_out or data_root / "soil_binary_prototype.joblib"
    report_out = args.report_out or data_root / "soil_binary_evaluation.json"
    model_out.parent.mkdir(parents=True, exist_ok=True)
    report_out.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(final_model, model_out, compress=3)
    report_out.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(json.dumps({
        "model_out": str(model_out),
        "report_out": str(report_out),
        "images": metrics["images"],
        "groups": group_counts,
        "grouped_cv_mean_balanced_accuracy": metrics["grouped_cv"]["mean_balanced_accuracy"],
        "grouped_cv_oof_balanced_accuracy": metrics["grouped_cv"]["out_of_fold_balanced_accuracy"],
        "hard_negative_tests": hard_negative_results,
    }, indent=2))


if __name__ == "__main__":
    main()
