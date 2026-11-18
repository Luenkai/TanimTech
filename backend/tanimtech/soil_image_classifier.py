"""Local soil-photo classification using a pinned, cached MobileNetV2 model."""
import hashlib
import io
import os
import sys
import threading
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError


MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 20_000_000
MODEL_SIZE = 25_427_019
MODEL_SHA256 = "F6159C62A5AF257896E0AE15C72C88C6BB7EF2C07AA7D6C3012F081F4B4DEB96"
MODEL_URL = (
    "https://raw.githubusercontent.com/shrutmpatil/"
    "Machine-Learning-Framework-for-Soil-Classification-and-Nutrient-Aware-Crop-Recommendation/"
    "231bf9ac6449df1b38d3f937c84eb03273a684f6/best_soil_model.keras"
)
MODEL_PATH = Path(__file__).resolve().parents[1] / ".cache" / "soil" / "best_soil_model.keras"
# The training pipeline used sklearn LabelEncoder, which sorts labels alphabetically.
SOIL_CLASSES = (
    ("medium_black_soil", "Medium Black Soil"),
    ("reddish_brown_soil", "Reddish Brown Soil"),
    ("saline_soil", "Saline Soil"),
)
MODEL_NAME = "AgriSense MobileNetV2"

_MODEL = None
_MODEL_LOCK = threading.Lock()


class InvalidSoilImageError(ValueError):
    """The uploaded file is not a supported, decodable soil photo."""


class SoilImageTooLargeError(InvalidSoilImageError):
    """The uploaded image exceeds the configured size limit."""


class SoilClassifierUnavailableError(RuntimeError):
    """The local classifier or its model weights are unavailable."""


def _ensure_model_file():
    if MODEL_PATH.is_file():
        try:
            digest = hashlib.sha256(MODEL_PATH.read_bytes()).hexdigest().upper()
        except OSError as exc:
            raise SoilClassifierUnavailableError(
                "The cached soil model cannot be read. Check permissions on backend/.cache/soil/."
            ) from exc
        if digest != MODEL_SHA256:
            raise SoilClassifierUnavailableError(
                "The cached soil model failed its integrity check. Remove the backend/.cache/soil folder and retry."
            )
        return MODEL_PATH

    temporary_path = MODEL_PATH.with_suffix(".keras.download")
    try:
        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        request = Request(MODEL_URL, headers={"User-Agent": "TanimTech soil classifier"})
        digest = hashlib.sha256()
        size = 0
        with urlopen(request, timeout=30) as response, temporary_path.open("wb") as model_file:
            while True:
                block = response.read(1024 * 1024)
                if not block:
                    break
                size += len(block)
                if size > MODEL_SIZE:
                    raise SoilClassifierUnavailableError(
                        "The downloaded soil model has an unexpected size."
                    )
                digest.update(block)
                model_file.write(block)

        if size != MODEL_SIZE or digest.hexdigest().upper() != MODEL_SHA256:
            raise SoilClassifierUnavailableError(
                "The downloaded soil model failed its integrity check."
            )
        os.replace(temporary_path, MODEL_PATH)
        return MODEL_PATH
    except (OSError, TimeoutError, URLError) as exc:
        raise SoilClassifierUnavailableError(
            "The local soil model could not be downloaded or cached. Check the server's internet connection and cache-folder permissions."
        ) from exc
    finally:
        temporary_path.unlink(missing_ok=True)


def _load_model():
    global _MODEL
    with _MODEL_LOCK:
        if _MODEL is not None:
            return _MODEL

        if "keras" in sys.modules:
            import keras

            if keras.config.backend() != "torch":
                raise SoilClassifierUnavailableError(
                    "The soil classifier requires the Keras PyTorch backend."
                )
        else:
            os.environ["KERAS_BACKEND"] = "torch"
            try:
                import keras
            except ImportError as exc:
                raise SoilClassifierUnavailableError(
                    "Install the backend requirements to enable local soil-image classification."
                ) from exc

        try:
            _MODEL = keras.models.load_model(
                _ensure_model_file(),
                compile=False,
                safe_mode=True,
            )
        except (ImportError, OSError, TypeError, ValueError) as exc:
            raise SoilClassifierUnavailableError(
                "The local soil model could not be loaded with the installed ML packages."
            ) from exc
        return _MODEL


def _preprocess_image(image_bytes):
    if not image_bytes:
        raise InvalidSoilImageError("Choose a soil photo to analyze.")
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise SoilImageTooLargeError("The image must be 10 MB or smaller.")

    try:
        with Image.open(io.BytesIO(image_bytes)) as source:
            if source.format not in {"JPEG", "PNG", "WEBP"}:
                raise InvalidSoilImageError("Upload a JPG, PNG, or WebP soil photo.")
            if source.width * source.height > MAX_IMAGE_PIXELS:
                raise InvalidSoilImageError("The image dimensions are too large to analyze.")
            image = ImageOps.exif_transpose(source).convert("RGB")
            image.load()
    except InvalidSoilImageError:
        raise
    except (Image.DecompressionBombError, OSError, UnidentifiedImageError, ValueError) as exc:
        raise InvalidSoilImageError("The uploaded file is not a readable JPG, PNG, or WebP image.") from exc

    image = image.resize((224, 224), Image.Resampling.BILINEAR)
    pixels = np.asarray(image, dtype=np.float32)
    # Training images were loaded through OpenCV, whose channel order is BGR.
    pixels = np.ascontiguousarray(pixels[:, :, ::-1] / np.float32(255.0))
    return np.expand_dims(pixels, axis=0)


def classify_soil_image(image_bytes):
    """Classify a photo locally; return the model's three visual classes and raw scores."""
    model_input = _preprocess_image(image_bytes)
    model = _load_model()
    predictions = np.asarray(model.predict(model_input, verbose=0), dtype=np.float64)
    if (
        predictions.shape != (1, len(SOIL_CLASSES))
        or not np.isfinite(predictions).all()
        or (predictions < 0).any()
        or (predictions > 1).any()
    ):
        raise SoilClassifierUnavailableError("The soil model returned invalid class scores.")

    ranked = sorted(
        zip(SOIL_CLASSES, predictions[0]),
        key=lambda item: float(item[1]),
        reverse=True,
    )
    (class_code, class_label), score = ranked[0]
    return {
        "soilType": class_label,
        "soilTypeCode": class_code,
        "modelScore": round(float(score), 4),
        "modelScoreIsCalibrated": False,
        "alternatives": [
            {"soilType": label, "score": round(float(value), 4)}
            for (_, label), value in ranked[1:]
        ],
        "modelName": MODEL_NAME,
        "modelScope": (
            "The model recognizes only three soil classes from an Indian dataset: "
            "Medium Black Soil, Reddish Brown Soil, and Saline Soil. Other soil "
            "types may be grouped into one of these classes."
        ),
        "limitations": [
            "The model authors report 83.2% accuracy on their test split; TanimTech has not independently validated it.",
            "This model was developed for Indian soils and is not validated for Philippine soils.",
            "Its score is not a calibrated probability, and these classes are not the texture labels in TanimTech's crop dataset.",
            "The model always selects among its three classes, even when an image is not soil; a predicted Saline Soil class does not measure salinity.",
            "A photo cannot determine pH, nutrients, drainage, or laboratory soil properties.",
        ],
    }
