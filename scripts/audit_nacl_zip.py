#!/usr/bin/env python3
"""Offline, source-native inventory of a user-provided NaCl research ZIP.

This is a gate BEFORE scientific parsing: it preserves exact source bytes,
checks ZIP structure, computes SHA-256s, and optionally extracts to a private
directory. It never invents physical units, experiment labels or predictions.
The archive and extracted source measurements must not be committed publicly.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import stat
import sys
from collections import Counter
from pathlib import Path, PurePosixPath
from zipfile import BadZipFile, ZipFile

SCHEMA = "crystaltwin-nacl-source-native-archive/1"
CHUNK = 1024 * 1024
MAX_FILES = 100_000
MAX_TOTAL = 32 * 1024**3
MAX_MEMBER = 12 * 1024**3
MAX_RATIO = 2_000

class IntakeError(ValueError):
    pass

def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(CHUNK), b""):
            h.update(chunk)
    return h.hexdigest()

def safe_member_path(name: str) -> PurePosixPath:
    if not name or "\x00" in name or "\\" in name or name.startswith("/"):
        raise IntakeError("Unsafe archive path")
    path = PurePosixPath(name)
    if any(part in ("", ".", "..") for part in name.split("/")):
        # ZIP directory paths may end in /, handled by the caller.
        raise IntakeError("Unsafe archive path: " + repr(name))
    if any(":" in part for part in path.parts) or not path.parts:
        raise IntakeError("Unsafe archive path: " + repr(name))
    return path

def classify(name: str) -> str:
    suffix = PurePosixPath(name).suffix.lower()
    return {
        ".csv": "csv", ".tsv": "tsv", ".txt": "text",
        ".json": "json", ".jsonl": "jsonl", ".xlsx": "xlsx",
        ".xls": "legacy-xls", ".xml": "xml", ".h5": "hdf5",
        ".hdf5": "hdf5", ".nc": "netcdf", ".npy": "numpy",
        ".npz": "numpy-archive", ".mat": "matlab",
        ".parquet": "parquet", ".pdf": "paper",
        ".png": "image", ".jpg": "image", ".jpeg": "image",
    }.get(suffix, "unclassified")

def inspect_archive(archive_path: Path, extract_dir: Path | None = None) -> dict:
    if not archive_path.is_file():
        raise IntakeError("NaCl source ZIP file not found")
    if not archive_path.name.lower().endswith(".zip"):
        raise IntakeError("Expected a ZIP archive")
    archive_sha = sha256_file(archive_path)
    records = []
    seen = set()
    kinds = Counter()
    try:
        with ZipFile(archive_path, "r", allowZip64=True) as z:
            infos = z.infolist()
            if len(infos) > MAX_FILES:
                raise IntakeError("Archive has too many members")
            total = 0
            for info in infos:
                # Do not trust only ZIP central-directory metadata as evidence
                # that an individual member has been read or CRC-verified.
                name = info.filename.rstrip("/") if info.is_dir() else info.filename
                path = safe_member_path(name)
                if name.casefold() in seen:
                    raise IntakeError("Duplicate or case-colliding ZIP path: " + name)
                seen.add(name.casefold())
                if info.flag_bits & 0x1:
                    raise IntakeError("Encrypted ZIP member is unsupported: " + name)
                if info.create_system == 3 and stat.S_ISLNK(info.external_attr >> 16):
                    raise IntakeError("ZIP symbolic link is forbidden: " + name)
                if info.is_dir():
                    continue
                if info.file_size > MAX_MEMBER:
                    raise IntakeError("Oversized member: " + name)
                total += info.file_size
                if total > MAX_TOTAL:
                    raise IntakeError("Archive expansion limit exceeded")
                if info.file_size and (
                    info.compress_size == 0 or
                    info.file_size / info.compress_size > MAX_RATIO
                ):
                    raise IntakeError("Suspicious compression ratio: " + name)
                target = extract_dir.joinpath(*path.parts) if extract_dir else None
                if target is not None:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    if target.exists():
                        raise IntakeError("Refusing to overwrite extracted data: " + str(target))
                digest = hashlib.sha256()
                actual = 0
                try:
                    with z.open(info, "r") as source:
                        if target is None:
                            for chunk in iter(lambda: source.read(CHUNK), b""):
                                actual += len(chunk)
                                digest.update(chunk)
                        else:
                            with target.open("xb") as dest:
                                for chunk in iter(lambda: source.read(CHUNK), b""):
                                    actual += len(chunk)
                                    digest.update(chunk)
                                    dest.write(chunk)
                except (OSError, RuntimeError, BadZipFile) as exc:
                    if target is not None:
                        target.unlink(missing_ok=True)
                    raise IntakeError("Could not CRC-verify member: " + name) from exc
                if actual != info.file_size:
                    raise IntakeError("ZIP declared size differs from streamed bytes: " + name)
                kind = classify(name)
                kinds[kind] += 1
                records.append({
                    "sourcePath": name,
                    "sourceBytes": actual,
                    "sourceSha256": digest.hexdigest(),
                    "kind": kind,
                    "crc32": f"{info.CRC:08x}",
                    "scientificUnit": "unverified",
                    "measurementOrSimulation": "unverified",
                })
    except (OSError, BadZipFile, NotImplementedError) as exc:
        raise IntakeError("Cannot read source ZIP archive") from exc

    return {
        "schema": SCHEMA,
        "sourceArchiveName": archive_path.name,
        "sourceArchiveBytes": archive_path.stat().st_size,
        "sourceArchiveSha256": archive_sha,
        "entries": records,
        "countsByFormat": dict(sorted(kinds.items())),
        "totalSourceMemberBytes": sum(item["sourceBytes"] for item in records),
        "entryCount": len(records),
        "sourceMeasuredStatus": "unverified",
        "sourceLicense": "unverified",
        "scientificComparability": "not_established",
        "physicalModelCalibrated": False,
        "containsRawMeasurementValues": False,
        "warning": (
            "Metadata inventory only. Verify original publication, license, "
            "units, phases, experiment IDs and measurement provenance before "
            "any material-specific model comparison or public data commit."
        ),
    }

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--manifest", type=Path, help="Write private metadata-only JSON")
    parser.add_argument("--extract-private", type=Path,
                        help="Optional private extraction directory; must not be public")
    args = parser.parse_args()
    if args.extract_private is not None and args.extract_private.exists():
        if any(args.extract_private.iterdir()):
            raise IntakeError("Extraction directory must be empty")
    report = inspect_archive(args.archive, args.extract_private)
    if args.manifest:
        if args.manifest.exists():
            raise IntakeError("Refusing to overwrite existing manifest")
        args.manifest.parent.mkdir(parents=True, exist_ok=True)
        args.manifest.write_text(
            json.dumps(report, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8")
    print(json.dumps({
        key: report[key] for key in (
            "schema", "sourceArchiveName", "sourceArchiveBytes",
            "sourceArchiveSha256", "entryCount",
            "countsByFormat", "totalSourceMemberBytes"
        )
    }, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    try:
        main()
    except (IntakeError, OSError) as exc:
        print("NaCl ZIP intake rejected: " + str(exc), file=sys.stderr)
        raise SystemExit(2)
