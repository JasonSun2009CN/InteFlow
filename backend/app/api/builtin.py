"""Installed question banks: shipped samples (development) + user imports.

A bank is a folder with ``manifest.json`` and one folder per unit
(``<unit>/doc.ifmd.md`` + ``assets/``). Adding a unit reuses the regular ifmd
import path (parse -> insert -> write_ifmd -> write_assets) and is idempotent
via ``documents.builtin_key``.

Two roots exist:

* ``BANKS_DIR``       — banks shipped with the source tree (never packaged);
* ``USER_BANKS_DIR``  — banks installed by the user from a ZIP (``data/banks``).

Import is deterministic and offline: a ZIP is validated, normalised into the
same folder layout, and parsed before it is installed. No LLM, 0 token.
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import re
import shutil
import sqlite3
import uuid
import zipfile
from pathlib import Path, PurePosixPath

from fastapi import APIRouter, File, HTTPException, UploadFile

from app import repos
from app.db import BANKS_DIR as USER_BANKS_DIR
from app.ifmd.parser import IfmdError, parse

router = APIRouter(prefix="/api/builtin", tags=["builtin"])

# Shipped with the source tree; excluded from the desktop bundle by InteFlow.spec.
BANKS_DIR = Path(__file__).resolve().parents[1] / "builtin"
_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
ANSWER_STATUSES = {"inline", "external", "none"}

MAX_BANK_BYTES = 80 * 1024 * 1024
MAX_BANK_UNCOMPRESSED = 400 * 1024 * 1024
MAX_BANK_ENTRIES = 5000
MAX_RATIO = 200
ASSET_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}


def _fail(message: str, status: int) -> None:
    raise HTTPException(status_code=status, detail=message)


def _bank_roots() -> tuple[tuple[Path, str], ...]:
    """User banks first, then the samples shipped with the source tree."""
    return ((USER_BANKS_DIR, "user"), (BANKS_DIR, "builtin"))


def _find_bank_dir(bank_id: str) -> tuple[Path | None, str | None]:
    if not _ID_RE.match(bank_id):
        return None, None
    for root, origin in _bank_roots():
        candidate = root / bank_id
        if (candidate / "manifest.json").is_file():
            return candidate, origin
    return None, None


def _load_manifest(bank_id: str) -> tuple[dict, Path, str]:
    bank_dir, origin = _find_bank_dir(bank_id)
    if bank_dir is None or origin is None:
        _fail("bank not found", 404)
    try:
        manifest = json.loads((bank_dir / "manifest.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        _fail("bank manifest is unreadable", 500)
        raise                                          # pragma: no cover
    if not isinstance(manifest, dict) or not isinstance(manifest.get("units"), list):
        _fail("bank manifest is malformed", 500)
        raise                                          # pragma: no cover
    return manifest, bank_dir, origin


def _bank_view(bank_dir: Path, manifest: dict, origin: str) -> dict:
    bank_id = manifest.get("id") or bank_dir.name
    units = [u for u in manifest.get("units", []) if isinstance(u, dict) and u.get("id")]
    return {
        "id": bank_id,
        "title": manifest.get("title") or bank_dir.name,
        "source": manifest.get("source") or "",
        "origin": origin,
        "removable": origin == "user",
        "units": [
            {
                "id": u["id"],
                "title": u.get("title") or u["id"],
                "module": u.get("module"),
                "questions": int(u.get("questions") or 0),
                "assets": int(u.get("assets") or 0),
                "added": False,
                "document_id": None,
            }
            for u in units
        ],
    }


@router.get("")
def list_banks() -> list[dict]:
    """Every installed bank with per-unit "already in the library" status."""
    banks: list[dict] = []
    seen: set[str] = set()
    for root, origin in _bank_roots():
        if not root.is_dir():
            continue
        for bank_dir in sorted(root.iterdir()):
            manifest_path = bank_dir / "manifest.json"
            if not bank_dir.is_dir() or not manifest_path.is_file():
                continue
            try:
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            if not isinstance(manifest, dict) or not isinstance(manifest.get("units"), list):
                continue
            view = _bank_view(bank_dir, manifest, origin)
            if view["id"] in seen:
                continue
            seen.add(view["id"])
            banks.append(view)

    keys = [f"{b['id']}/{u['id']}" for b in banks for u in b["units"]]
    existing = repos.documents.get_builtin_keys(keys)
    for bank in banks:
        for unit in bank["units"]:
            doc_id = existing.get(f"{bank['id']}/{unit['id']}")
            if doc_id is not None:
                unit["added"] = True
                unit["document_id"] = doc_id
    return banks


def _resolve_unit(bank_id: str, unit_id: str) -> tuple[dict, Path]:
    manifest, bank_dir, _origin = _load_manifest(bank_id)
    if not _ID_RE.match(unit_id):
        _fail("unit not found", 404)
    unit = next(
        (u for u in manifest["units"] if isinstance(u, dict) and u.get("id") == unit_id),
        None,
    )
    if unit is None:
        _fail("unit not found", 404)
        raise                                          # pragma: no cover
    unit_dir = bank_dir / unit_id
    if not (unit_dir / "doc.ifmd.md").is_file():
        _fail("unit files are missing from this installation", 404)
        raise                                          # pragma: no cover
    return unit, unit_dir


def _import_unit(bank_id: str, unit_id: str, unit: dict, unit_dir: Path) -> tuple[int, bool]:
    """Add one unit as a document; returns (document_id, created)."""
    key = f"{bank_id}/{unit_id}"
    existing = repos.documents.get_by_builtin_key(key)
    if existing is not None:
        return existing, False

    try:
        ifmd = (unit_dir / "doc.ifmd.md").read_text(encoding="utf-8")
        assets: dict[str, bytes] = {}
        assets_path = unit_dir / "assets"
        if assets_path.is_dir():
            for p in sorted(assets_path.iterdir()):
                if p.is_file():
                    assets[p.name] = p.read_bytes()
    except OSError:
        _fail("unit files are unreadable", 500)
        raise                                          # pragma: no cover

    try:
        parsed = parse(ifmd)
    except IfmdError as exc:
        _fail(f"bank unit is invalid (line {exc.line}): {exc.message}", 500)
        raise                                          # pragma: no cover

    status = parsed.meta.get("answers", "none")
    if status not in ANSWER_STATUSES:
        status = "none"
    title = parsed.meta.get("title") or unit.get("title") or unit_id

    try:
        doc_id = repos.documents.create_document(
            title=title,
            source_filename=f"builtin:{key}",
            answers_status=status,
            question_count=len(parsed.questions),
            builtin_key=key,
        )
    except sqlite3.IntegrityError:
        # lost a race with a concurrent add — the other request owns the key
        winner = repos.documents.get_by_builtin_key(key)
        if winner is None:
            _fail("could not register the bank unit", 500)
            raise                                      # pragma: no cover
        return winner, False

    repos.documents.set_ifmd_path(doc_id)
    repos.documents.write_ifmd(doc_id, ifmd)
    repos.documents.write_assets(doc_id, assets)
    repos.documents.insert_questions(doc_id, parsed.questions)
    return doc_id, True


@router.post("/{bank_id}/units/{unit_id}")
def add_unit(bank_id: str, unit_id: str) -> dict:
    unit, unit_dir = _resolve_unit(bank_id, unit_id)
    doc_id, created = _import_unit(bank_id, unit_id, unit, unit_dir)
    return {"document_id": doc_id, "added": created}


@router.post("/{bank_id}/add-all")
def add_all(bank_id: str) -> dict:
    manifest, _bank_dir, _origin = _load_manifest(bank_id)
    added = 0
    already = 0
    doc_ids: list[int] = []
    for unit in manifest["units"]:
        if not isinstance(unit, dict) or not unit.get("id"):
            continue
        unit_id = str(unit["id"])
        _, unit_dir = _resolve_unit(bank_id, unit_id)
        doc_id, created = _import_unit(bank_id, unit_id, unit, unit_dir)
        doc_ids.append(doc_id)
        added += int(created)
        already += int(not created)
    return {"added": added, "already": already, "document_ids": doc_ids}


# --------------------------------------------------------------------------
# importing a bank ZIP
# --------------------------------------------------------------------------


def _read_zip(data: bytes) -> dict[str, bytes]:
    """Validate a bank archive, return {relative_path: bytes} below its root."""
    if not data:
        _fail("the file is empty", 400)
    if len(data) > MAX_BANK_BYTES:
        _fail("the bank ZIP is larger than 80 MB", 413)
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        _fail("the file is not a valid ZIP archive", 400)
        raise                                          # pragma: no cover

    with zf:
        infos = zf.infolist()
        if len(infos) > MAX_BANK_ENTRIES:
            _fail("the bank ZIP contains too many files", 400)
        total = sum(max(0, info.file_size) for info in infos)
        if total > MAX_BANK_UNCOMPRESSED:
            _fail("the bank ZIP expands to more than 400 MB", 413)
        if total > 1_000_000 and total / max(len(data), 1) > MAX_RATIO:
            _fail("the bank ZIP looks like a compressed archive bomb", 400)

        names = [info.filename.replace("\\", "/") for info in infos]
        for name in names:                      # validate before stripping a wrapper
            if name.startswith("/") or ".." in PurePosixPath(name).parts:
                _fail("the bank ZIP contains an unsafe path", 400)
        prefix = _bank_prefix(names)
        out: dict[str, bytes] = {}
        for info, name in zip(infos, names):
            if info.is_dir() or not name.startswith(prefix):
                continue
            rel = name[len(prefix) :].lstrip("/")
            if not rel or any(part in ("", ".", "..") for part in PurePosixPath(rel).parts):
                if ".." in PurePosixPath(rel).parts:
                    _fail("the bank ZIP contains an unsafe path", 400)
                continue
            if name.startswith("/") or ".." in PurePosixPath(name).parts:
                _fail("the bank ZIP contains an unsafe path", 400)
            if (info.external_attr >> 16) & 0o170000 == 0o120000:
                _fail("the bank ZIP contains a symlink", 400)
            leaf = PurePosixPath(rel).name
            if leaf.startswith("."):
                continue                              # .DS_Store, __MACOSX noise
            if rel.endswith(".ifmd.md") or leaf == "manifest.json" or PurePosixPath(rel).suffix.lower() in ASSET_SUFFIXES:
                out[rel] = zf.read(info)
            else:
                _fail(f"unsupported file in bank ZIP: {rel}", 400)
    if not out:
        _fail("the bank ZIP contains no question files", 400)
    return out


def _bank_prefix(names: list[str]) -> str:
    """Strip the single wrapper folder produced by 'Compress this folder'."""
    if "manifest.json" in names:
        return ""
    manifests = [n for n in names if n.endswith("/manifest.json")]
    if len(manifests) == 1:
        return manifests[0].rsplit("/", 1)[0] + "/"
    if manifests:
        _fail("the bank ZIP contains more than one manifest.json", 400)
    if names and all("/" in n for n in names):
        tops = {n.split("/", 1)[0] for n in names}
        if len(tops) == 1:
            return next(iter(tops)) + "/"
    return ""


def _safe_id(value: object, fallback: str) -> str:
    raw = re.sub(r"[^A-Za-z0-9._-]+", "-", str(value or "")).strip("-._")
    if raw and _ID_RE.match(raw):
        return raw[:80]
    return fallback


def _asset_files(files: dict[str, bytes], source_dir: str) -> dict[str, bytes]:
    """Image files under ``<source_dir>/assets/`` (or ``assets/`` at the root)."""
    base = f"{source_dir}/assets/" if source_dir else "assets/"
    out: dict[str, bytes] = {}
    for path, blob in files.items():
        if not path.startswith(base):
            continue
        name = path[len(base) :]
        if "/" in name or not name:
            continue
        if PurePosixPath(name).suffix.lower() in ASSET_SUFFIXES:
            out[name] = blob
    return out


def _normalise_bank(
    files: dict[str, bytes], filename: str
) -> tuple[str, dict, dict[str, tuple[str, dict[str, bytes]]]]:
    """Validate the archive and return (bank_id, manifest, units).

    ``units`` maps unit_id -> (ifmd text, assets). Everything is parsed here so
    a broken unit never lands on disk.
    """
    raw_manifest: dict = {}
    if "manifest.json" in files:
        try:
            loaded = json.loads(files["manifest.json"].decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            _fail("manifest.json is not valid UTF-8 JSON", 400)
            raise                                      # pragma: no cover
        if not isinstance(loaded, dict):
            _fail("manifest.json must contain an object", 400)
            raise                                      # pragma: no cover
        raw_manifest = loaded
        if "units" not in raw_manifest:
            _fail("manifest.json must list its units", 400)

    declared = raw_manifest.get("units")
    units: dict[str, tuple[str, dict[str, bytes]]] = {}
    unit_meta: list[dict] = []

    if declared is not None:
        if not isinstance(declared, list) or not declared:
            _fail("manifest.json must list at least one unit", 400)
        for entry in declared:
            if not isinstance(entry, dict) or not entry.get("id"):
                _fail("manifest.json contains a unit without an id", 400)
            unit_id = str(entry["id"])
            if not _ID_RE.match(unit_id):
                _fail(f"invalid unit id in manifest: {unit_id!r}", 400)
            if unit_id in units:
                _fail(f"duplicate unit id in manifest: {unit_id}", 400)
            doc_path = f"{unit_id}/doc.ifmd.md"
            if doc_path not in files:
                _fail(f"unit {unit_id} is missing {doc_path}", 400)
            try:
                text = files[doc_path].decode("utf-8")
                parsed = parse(text)
            except (UnicodeDecodeError, IfmdError) as exc:
                detail = f"line {exc.line}: {exc.message}" if isinstance(exc, IfmdError) else "not UTF-8"
                _fail(f"unit {unit_id} is invalid ({detail})", 400)
                raise                                  # pragma: no cover
            if not parsed.questions:
                _fail(f"unit {unit_id} contains no questions", 400)
            assets = _asset_files(files, unit_id)
            units[unit_id] = (text, assets)
            unit_meta.append(
                {
                    "id": unit_id,
                    "title": entry.get("title") or parsed.meta.get("title") or unit_id,
                    "module": entry.get("module"),
                    "questions": len(parsed.questions),
                    "assets": len(assets),
                }
            )
    else:
        docs = sorted(path for path in files if path.endswith(".ifmd.md"))
        if not docs:
            _fail("the bank ZIP contains no .ifmd.md files", 400)
        for doc_path in docs:
            parent = str(PurePosixPath(doc_path).parent)
            source_dir = "" if parent == "." else parent
            leaf = PurePosixPath(doc_path).name
            if leaf == "doc.ifmd.md" and source_dir:
                # Standard layout: <unit-id>/doc.ifmd.md
                base = PurePosixPath(source_dir).name
            else:
                base = leaf[: -len(".ifmd.md")]
            unit_id = _safe_id(base, f"unit-{uuid.uuid4().hex[:8]}")
            if unit_id in units:
                unit_id = f"{unit_id}-{uuid.uuid4().hex[:6]}"
            try:
                text = files[doc_path].decode("utf-8")
                parsed = parse(text)
            except (UnicodeDecodeError, IfmdError) as exc:
                detail = f"line {exc.line}: {exc.message}" if isinstance(exc, IfmdError) else "not UTF-8"
                _fail(f"{doc_path} is invalid ({detail})", 400)
                raise                                  # pragma: no cover
            if not parsed.questions:
                _fail(f"{doc_path} contains no questions", 400)
            assets = _asset_files(files, source_dir)
            units[unit_id] = (text, assets)
            unit_meta.append(
                {
                    "id": unit_id,
                    "title": parsed.meta.get("title") or unit_id,
                    "module": None,
                    "questions": len(parsed.questions),
                    "assets": len(assets),
                }
            )

    fallback = f"bank-{hashlib.sha1(files.get('manifest.json', b'') + filename.encode('utf-8')).hexdigest()[:8]}"
    bank_id = _safe_id(raw_manifest.get("id") or raw_manifest.get("title"), fallback)
    title = raw_manifest.get("title") or Path(filename).stem or bank_id
    manifest = {
        "id": bank_id,
        "title": title,
        "source": raw_manifest.get("source") or filename,
        "units": unit_meta,
    }
    return bank_id, manifest, units


@router.post("/import")
async def import_bank(file: UploadFile = File(...)) -> dict:
    """Install a question-bank ZIP as a local bank (no LLM, 0 token)."""
    data = await file.read(MAX_BANK_BYTES + 1)
    filename = Path(file.filename or "bank.zip").name
    if not filename.lower().endswith(".zip"):
        _fail("question banks must be .zip archives", 400)
    if len(data) > MAX_BANK_BYTES:
        _fail("the bank ZIP is larger than 80 MB", 413)

    files = _read_zip(data)
    bank_id, manifest, units = _normalise_bank(files, filename)
    existing, _origin = _find_bank_dir(bank_id)
    if existing is not None:
        _fail(f"a bank with id {bank_id!r} is already installed", 409)

    USER_BANKS_DIR.mkdir(parents=True, exist_ok=True)
    staging = USER_BANKS_DIR.parent / "tmp" / f"bank-{uuid.uuid4().hex}"
    destination = USER_BANKS_DIR / bank_id
    try:
        for unit_id, (text, assets) in units.items():
            unit_dir = staging / unit_id
            unit_dir.mkdir(parents=True, exist_ok=True)
            (unit_dir / "doc.ifmd.md").write_text(text, encoding="utf-8")
            if assets:
                assets_dir = unit_dir / "assets"
                assets_dir.mkdir()
                for name, blob in assets.items():
                    (assets_dir / name).write_bytes(blob)
        (staging / "manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        os.replace(staging, destination)
    except OSError as exc:
        shutil.rmtree(staging, ignore_errors=True)
        _fail(f"could not install the bank: {exc}", 500)
        raise                                          # pragma: no cover

    return {
        "bank_id": bank_id,
        "title": manifest["title"],
        "units": len(units),
        "questions": sum(u["questions"] for u in manifest["units"]),
        "assets": sum(u["assets"] for u in manifest["units"]),
    }


@router.delete("/{bank_id}")
def remove_bank(bank_id: str) -> dict:
    """Remove an imported bank (shipped sample banks are read-only)."""
    bank_dir, origin = _find_bank_dir(bank_id)
    if bank_dir is None or origin is None:
        _fail("bank not found", 404)
    if origin != "user":
        _fail("banks shipped with the app cannot be removed", 403)
    try:
        shutil.rmtree(bank_dir)
    except OSError as exc:
        _fail(f"could not remove the bank: {exc}", 500)
        raise                                          # pragma: no cover
    return {"deleted": 1}
