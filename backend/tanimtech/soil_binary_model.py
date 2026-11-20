"""Binary soil-presence model utilities for an explicitly experimental prototype.

This classifier answers only whether an image resembles the soil training set.
It does not predict texture, chemistry, salinity, drainage, or crop suitability.
"""
from __future__ import annotations

import io
import os
import threading
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 20_000_000
FEATURE_VERSION = "rgb-hsv-hog-v1"
MODEL_NAME = "TanimTech Soil Presence Prototype"
MODEL_PATH = Path(__file__).resolve().parents[1] / "models" / "soil_binary_prototype.joblib"
MODEL_SCOPE = (
    "Experimental binary-only screen trained on close-range laboratory soil images and openly licensed web negatives. "
    "It is not validated for Philippine field photos or production use."
)
LIMITATIONS = [
    "The score is an uncalibrated SVM decision value, not a probability.",
    "Soil photos come from only 26 physical samples captured in controlled laboratory conditions.",
    "Non-soil photos are a small, web-sourced set and may not represent all objects or scenes.",
    "This model does not identify clay, loam, sandy, or silty texture and cannot measure soil properties.",
]

_MODEL = None
_MODEL_LOCK = threading.Lock()


class InvalidSoilScreenImageError(ValueError):
    """The upload is empty, too large, or not a supported image."""


class SoilScreenModelUnavailableError(RuntimeError):
    """The experimental model is missing or invalid."""


def extract_features(image: Image.Image) -> np.ndarray:
    """Extract normalized color histograms and unsigned HOG descriptors."""
    rgb_image = ImageOps.fit(
        image.convert("RGB"),
        (96, 96),
        method=Image.Resampling.BILINEAR,
        centering=(0.5, 0.5),
    )
    rgb = np.asarray(rgb_image, dtype=np.float32) / np.float32(255.0)
    hsv = np.asarray(rgb_image.convert("HSV"), dtype=np.uint8)

    color_features = []
    for channel in range(3):
        hist, _ = np.histogram(hsv[:, :, channel], bins=16, range=(0, 256))
        color_features.extend((hist / max(int(hist.sum()), 1)).astype(np.float32))
    color_features.extend(rgb.mean(axis=(0, 1)).astype(np.float32))
    color_features.extend(rgb.std(axis=(0, 1)).astype(np.float32))

    gray = rgb @ np.asarray([0.299, 0.587, 0.114], dtype=np.float32)
    gy, gx = np.gradient(gray)
    magnitude = np.hypot(gx, gy)
    orientation = np.mod(np.arctan2(gy, gx), np.pi)
    bins = 9
    hog_features = []
    for y in range(0, 96, 12):
        for x in range(0, 96, 12):
            cell_orientation = orientation[y:y + 12, x:x + 12].ravel()
            cell_magnitude = magnitude[y:y + 12, x:x + 12].ravel()
            hist, _ = np.histogram(
                cell_orientation,
                bins=bins,
                range=(0.0, np.pi),
                weights=cell_magnitude,
            )
            norm = float(np.linalg.norm(hist))
            hog_features.extend((hist / max(norm, 1e-8)).astype(np.float32))

    texture_features = np.asarray([
        float(magnitude.mean()),
        float(magnitude.std()),
        float(np.quantile(magnitude, 0.9)),
    ], dtype=np.float32)
    return np.concatenate((np.asarray(color_features, dtype=np.float32),
                           np.asarray(hog_features, dtype=np.float32),
                           texture_features))


def features_from_bytes(image_bytes: bytes) -> np.ndarray:
    if not image_bytes:
        raise InvalidSoilScreenImageError("Choose an image to screen.")
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise InvalidSoilScreenImageError("The image must be 10 MB or smaller.")
    try:
        with Image.open(io.BytesIO(image_bytes)) as source:
            if source.format not in {"JPEG", "PNG", "WEBP"}:
                raise InvalidSoilScreenImageError("Upload a JPG, PNG, or WebP image.")
            if source.width * source.height > MAX_IMAGE_PIXELS:
                raise InvalidSoilScreenImageError("The image dimensions are too large to screen.")
            image = ImageOps.exif_transpose(source).convert("RGB")
            image.load()
    except InvalidSoilScreenImageError:
        raise
    except (Image.DecompressionBombError, OSError, UnidentifiedImageError, ValueError) as exc:
        raise InvalidSoilScreenImageError("The uploaded file is not a readable JPG, PNG, or WebP image.") from exc
    return features_from_image(image)


def features_from_image(image: Image.Image) -> np.ndarray:
    return extract_features(image).reshape(1, -1)


def load_model(model_path: Path | str = MODEL_PATH):
    global _MODEL
    path = Path(model_path)
    if path != MODEL_PATH:
        return _load_model_file(path)
    with _MODEL_LOCK:
        if _MODEL is None:
            _MODEL = _load_model_file(path)
        return _MODEL


def _load_model_file(path: Path):
    if not path.is_file():
        raise SoilScreenModelUnavailableError(
            "The experimental soil-presence model is not installed."
        )
    try:
        import joblib
        model = joblib.load(path)
    except (ImportError, OSError, ValueError, EOFError) as exc:
        raise SoilScreenModelUnavailableError(
            "The experimental soil-presence model could not be loaded."
        ) from exc
    classes = list(getattr(model, "classes_", []))
    if classes != ["non_soil", "soil"]:
        raise SoilScreenModelUnavailableError("The model has an unexpected class order.")
    return model


def classify_soil_presence(image_bytes: bytes, model=None) -> dict:
    """Return an uncalibrated soil/non-soil prototype result."""
    values = features_from_bytes(image_bytes)
    classifier = model if model is not None else load_model()
    try:
        prediction = str(classifier.predict(values)[0])
        decision = float(classifier.decision_function(values)[0])
    except (AttributeError, IndexError, TypeError, ValueError) as exc:
        raise SoilScreenModelUnavailableError("The model returned an invalid result.") from exc
    if prediction not in {"soil", "non_soil"} or not np.isfinite(decision):
        raise SoilScreenModelUnavailableError("The model returned an invalid result.")
    return {
        "class": prediction,
        "isSoilLike": prediction == "soil",
        "decisionScore": round(decision, 4),
        "decisionScoreIsCalibrated": False,
        "modelName": MODEL_NAME,
        "experimental": True,
        "modelScope": MODEL_SCOPE,
        "limitations": LIMITATIONS.copy(),
    }
