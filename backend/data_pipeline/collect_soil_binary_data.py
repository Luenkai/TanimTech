"""Collect a small, attributed soil/non-soil research dataset outside the repo.

This is an experimental prototype dataset, not production-grade coverage. Soil
samples are grouped by physical sample ID; Openverse images are restricted to
CC0/Public Domain or CC BY licenses. Source images and their manifests stay in
an external output directory and are never committed by this script.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path, PurePosixPath

from PIL import Image, UnidentifiedImageError

ZENODO_RECORD = "https://zenodo.org/api/records/14725633"
OPENVERSE_API = "https://api.openverse.org/v1/images/"
USER_AGENT = "TanimTech-soil-binary-prototype/1.0 (research; contact project owner)"
NEGATIVE_QUERIES = {
    "bottle": "plastic bottle",
    "vehicle": "car vehicle",
    "leaf": "green leaf",
    "concrete": "concrete surface",
    "person": "person portrait",
    "building": "building exterior",
    "food": "food close up",
    "rock": "rock stone",
}
HARD_NEGATIVE_QUERY = "Coca-Cola bottle"
CURATION_EXCLUSIONS = {
    "fa33657f-e8df-4038-8d99-8b735bed83d3": (
        "The image is dominated by sandy ground, so its non-soil label is ambiguous."
    ),
}
MAX_IMAGE_BYTES = 15 * 1024 * 1024
MAX_PIXELS = 30_000_000
ALLOWED_LICENSES = {"by", "cc0", "pdm"}


def _request_bytes(url: str, limit: int = MAX_IMAGE_BYTES) -> tuple[bytes, dict[str, str]]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        data = response.read(limit + 1)
        if len(data) > limit:
            raise ValueError(f"Response exceeded {limit} bytes: {url}")
        return data, dict(response.headers.items())


def _request_json(url: str, retries: int = 5) -> dict:
    for attempt in range(retries):
        try:
            data, _ = _request_bytes(url, limit=20 * 1024 * 1024)
            return json.loads(data.decode("utf-8"))
        except urllib.error.HTTPError as exc:
            if exc.code not in {429, 500, 502, 503, 504} or attempt + 1 == retries:
                raise
            delay = float(exc.headers.get("Retry-After", min(2 ** attempt, 16)))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            if attempt + 1 == retries:
                raise
            delay = min(2 ** attempt, 16)
        time.sleep(delay)
    raise RuntimeError("unreachable")


def _safe_image(data: bytes) -> tuple[str, int, int]:
    if not data:
        raise ValueError("Empty image")
    try:
        with Image.open(__import__("io").BytesIO(data)) as image:
            if image.width * image.height > MAX_PIXELS:
                raise ValueError("Image exceeds pixel limit")
            image.verify()
        with Image.open(__import__("io").BytesIO(data)) as image:
            image.load()
            fmt = (image.format or "").upper()
            ext = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}.get(fmt)
            if not ext:
                raise ValueError(f"Unsupported image format: {fmt or 'unknown'}")
            return ext, image.width, image.height
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("Downloaded content is not a readable image") from exc


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _download_zenodo(output: Path) -> list[dict]:
    record = _request_json(ZENODO_RECORD)
    metadata = record.get("metadata", {})
    license_info = metadata.get("license") or {}
    license_id = license_info.get("id") if isinstance(license_info, dict) else str(license_info)
    if str(license_id).lower() != "cc-by-4.0":
        raise RuntimeError(f"Unexpected Zenodo license: {license_info!r}")

    soil_root = output / "soil"
    source_root = soil_root / "source"
    images_root = soil_root / "images"
    source_root.mkdir(parents=True, exist_ok=True)
    images_root.mkdir(parents=True, exist_ok=True)
    files = record.get("files", [])
    photo_record = next((item for item in files if item.get("key") == "All_Photos.zip"), None)
    if not photo_record:
        raise RuntimeError("Zenodo record is missing All_Photos.zip")
    archive_path = source_root / "All_Photos.zip"
    expected_md5 = str(photo_record.get("checksum", "")).removeprefix("md5:").lower()
    expected_size = int(photo_record["size"])
    archive_urls = [
        f"https://zenodo.org/records/{record['id']}/files/"
        f"{urllib.parse.quote(photo_record['key'])}?download=1",
        photo_record["links"]["self"],
    ]
    archive_data = None
    if archive_path.is_file():
        cached = archive_path.read_bytes()
        if len(cached) == expected_size and hashlib.md5(cached).hexdigest() == expected_md5:
            archive_data = cached
            print("Using checksum-verified cached Zenodo archive")
    for archive_url in archive_urls if archive_data is None else ():
        try:
            candidate, _ = _request_bytes(archive_url, limit=100 * 1024 * 1024)
        except (urllib.error.URLError, TimeoutError) as exc:
            print(f"Zenodo download failed at {archive_url}: {exc}")
            continue
        actual_md5 = hashlib.md5(candidate).hexdigest()
        if len(candidate) == expected_size and actual_md5 == expected_md5:
            archive_data = candidate
            break
    if archive_data is None:
        raise RuntimeError("Zenodo photo archive failed size and MD5 verification on all download URLs")
    archive_path.write_bytes(archive_data)

    csv_files = [item for item in files if str(item.get("key", "")).lower().endswith(".csv")]
    for item in csv_files:
        csv_data, _ = _request_bytes(item["links"]["self"], limit=1024 * 1024)
        if len(csv_data) != int(item["size"]):
            raise RuntimeError(f"Unexpected size for Zenodo file {item['key']}")
        (source_root / Path(item["key"]).name).write_bytes(csv_data)

    with zipfile.ZipFile(archive_path) as archive:
        for member in archive.infolist():
            if member.is_dir():
                continue
            relative = PurePosixPath(member.filename)
            if relative.is_absolute() or ".." in relative.parts:
                raise RuntimeError(f"Unsafe ZIP member: {member.filename}")
            if relative.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
                continue
            target = images_root / relative.name
            target.write_bytes(archive.read(member))

    sample_pattern = re.compile(r"_([A-Z]\d+)_\d+\.(?:jpe?g|png|webp)$", re.I)
    manifest = []
    image_paths = sorted(path for path in images_root.iterdir() if path.is_file())
    for path in image_paths:
        match = sample_pattern.search(path.name)
        if not match:
            continue
        data = path.read_bytes()
        try:
            _, width, height = _safe_image(data)
        except ValueError:
            continue
        manifest.append({
            "file": path.relative_to(output).as_posix(),
            "label": "soil",
            "group": f"zenodo_sample:{match.group(1).upper()}",
            "sample_id": match.group(1).upper(),
            "source": "Zenodo 10.5281/zenodo.14725633",
            "source_url": "https://zenodo.org/records/14725633",
            "license": "CC BY 4.0",
            "license_url": "https://creativecommons.org/licenses/by/4.0/",
            "creator": "Enrico Soranzo and Anand D'Souza",
            "title": path.name,
            "width": width,
            "height": height,
            "sha256": _sha256(data),
        })
    if not manifest:
        raise RuntimeError("No soil images with recognizable sample IDs were found")
    return manifest


def _license_allowed(item: dict) -> bool:
    license_code = str(item.get("license", "")).lower()
    version = str(item.get("license_version", "")).lower()
    if license_code == "by":
        return version in {"2.0", "2.5", "3.0", "4.0"}
    return license_code in {"cc0", "pdm"}


def _search_openverse(query: str, pages: int = 4) -> Iterator[dict]:
    for page in range(1, pages + 1):
        params = urllib.parse.urlencode({
            "q": query,
            "page_size": 20,
            "page": page,
            "license_type": "commercial",
            "mature": "false",
        })
        try:
            payload = _request_json(f"{OPENVERSE_API}?{params}")
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            print(f"Openverse query unavailable ({query}, page {page}): {exc}")
            return
        results = payload.get("results", [])
        yield from results
        if not results:
            break
        time.sleep(0.25)


def _download_openverse(item: dict, label: str, query: str, root: Path, kind: str) -> dict | None:
    image_url = item.get("url")
    if not image_url or not _license_allowed(item):
        return None
    data, _ = _request_bytes(image_url)
    extension, width, height = _safe_image(data)
    image_id = re.sub(r"[^A-Za-z0-9_-]", "_", str(item.get("id", "unknown")))
    folder = root / ("hard-negative-tests" if kind == "hard-negative" else "nonsoil")
    folder.mkdir(parents=True, exist_ok=True)
    filename = f"{label}_{image_id}{extension}"
    path = folder / filename
    path.write_bytes(data)
    return {
        "file": path.relative_to(root).as_posix(),
        "label": "non_soil",
        "group": f"openverse:{item.get('id')}",
        "source": "Openverse",
        "source_url": item.get("foreign_landing_url"),
        "license": f"CC {str(item.get('license', '')).upper()} {item.get('license_version', '')}".strip(),
        "license_url": item.get("license_url"),
        "creator": item.get("creator"),
        "creator_url": item.get("creator_url"),
        "title": item.get("title"),
        "query": query,
        "provider": item.get("provider"),
        "attribution": item.get("attribution"),
        "width": width,
        "height": height,
        "sha256": _sha256(data),
        "kind": kind,
    }


def _collect_openverse(root: Path, per_query: int = 9) -> tuple[list[dict], list[dict]]:
    selected_ids: set[str] = set()
    negatives: list[dict] = []
    for category, query in NEGATIVE_QUERIES.items():
        accepted = 0
        for item in _search_openverse(query):
            item_id = str(item.get("id", ""))
            if item_id in CURATION_EXCLUSIONS:
                print(f"Curation exclusion {item_id}: {CURATION_EXCLUSIONS[item_id]}")
                continue
            if not item_id or item_id in selected_ids or not _license_allowed(item):
                continue
            title = str(item.get("title", ""))
            if re.search(r"\b(soil|mud|dirt|sand)\b", title, re.I):
                continue
            try:
                entry = _download_openverse(item, category, query, root, "training")
            except Exception as exc:  # bad/expired image hosts do not block other candidates
                print(f"skip {category} {item_id}: {type(exc).__name__}: {exc}")
                continue
            if entry is None:
                continue
            selected_ids.add(item_id)
            negatives.append(entry)
            accepted += 1
            if accepted >= per_query:
                break
        print(f"Openverse {category}: {accepted}/{per_query}")

    hard_negatives: list[dict] = []
    for item in _search_openverse(HARD_NEGATIVE_QUERY, pages=2):
        title = str(item.get("title", ""))
        if not _license_allowed(item) or not re.search(r"coca[- ]?cola|coke", title, re.I):
            continue
        try:
            entry = _download_openverse(item, "coca_cola", HARD_NEGATIVE_QUERY, root, "hard-negative")
        except Exception as exc:
            print(f"skip Coca-Cola hard negative {item.get('id')}: {exc}")
            continue
        if entry:
            hard_negatives.append(entry)
            break
    print(f"Openverse non-soil training images: {len(negatives)}; Coca-Cola hard negatives: {len(hard_negatives)}")
    return negatives, hard_negatives


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, default=Path("/tmp/tanimtech-soil-binary-data"))
    parser.add_argument("--per-query", type=int, default=9)
    args = parser.parse_args()
    output = args.output_dir.expanduser().resolve()
    output.mkdir(parents=True, exist_ok=True)

    print(f"Collecting into {output} (outside the repository)")
    soil = _download_zenodo(output)
    print(f"Zenodo soil images: {len(soil)} across {len({row['group'] for row in soil})} samples")
    negatives, hard_negatives = _collect_openverse(output, args.per_query)
    manifest = soil + negatives
    with (output / "manifest.jsonl").open("w", encoding="utf-8") as stream:
        for row in manifest:
            stream.write(json.dumps(row, ensure_ascii=False) + "\n")
    with (output / "hard_negative_tests.jsonl").open("w", encoding="utf-8") as stream:
        for row in hard_negatives:
            stream.write(json.dumps(row, ensure_ascii=False) + "\n")
    catalog = {
        "zenodo_record": ZENODO_RECORD,
        "soil_image_count": len(soil),
        "soil_sample_count": len({row["group"] for row in soil}),
        "nonsoil_image_count": len(negatives),
        "negative_queries": NEGATIVE_QUERIES,
        "hard_negative_count": len(hard_negatives),
        "curation_exclusions": [
            {"openverse_id": image_id, "reason": reason}
            for image_id, reason in CURATION_EXCLUSIONS.items()
        ],
        "manifest": "manifest.jsonl",
        "hard_negative_manifest": "hard_negative_tests.jsonl",
        "note": "Research-only. No texture labels are used. All split logic must group soil images by sample ID.",
    }
    (output / "dataset_catalog.json").write_text(json.dumps(catalog, indent=2), encoding="utf-8")
    if not negatives:
        raise SystemExit("No openly licensed non-soil images collected; do not train without negatives")
    print(json.dumps(catalog, indent=2))


if __name__ == "__main__":
    main()
