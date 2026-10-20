"""SQLite index + lookup for the local Merriam-Webster ``.eudb`` file."""

from __future__ import annotations

import os
import sqlite3
import threading
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

from app.db import DATA_DIR, REPO_ROOT
from app.dictionary.eudb import EudbError, html_to_text, iter_entries

INDEX_VERSION = 1
MAX_DEFINITION = 12_000
SNIPPET = 220
_INVISIBLE = {0x00B7: None, 0x00AD: None, 0x200B: None}

_BUILD_LOCK = threading.Lock()
_STATE_LOCK = threading.Lock()
_BUILDING = False

SCHEMA = """
CREATE TABLE entries (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  headword     TEXT NOT NULL,
  headword_key TEXT NOT NULL,
  definition   TEXT NOT NULL
);
CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
"""


class DictionaryError(RuntimeError):
    """The dictionary is unavailable or could not be indexed."""


# --------------------------------------------------------------------------
# paths / configuration
# --------------------------------------------------------------------------


def source_path() -> Path | None:
    """The configured ``.eudb`` file, or ``None`` when none is installed."""
    configured = os.environ.get("INTEFLOW_DICTIONARY")
    if configured:
        path = Path(configured).expanduser()
    else:
        path = REPO_ROOT / "dictionary"
    if path.is_dir():
        candidates = sorted(path.glob("*.eudb"))
        return candidates[0] if candidates else None
    return path if path.is_file() else None


def index_path() -> Path:
    configured = os.environ.get("INTEFLOW_DICTIONARY_INDEX")
    if configured:
        return Path(configured).expanduser()
    return DATA_DIR / "dictionary" / "mw.db"


def normalize(text: str) -> str:
    """Search key: casefolded, without syllable dots or extra whitespace."""
    text = unicodedata.normalize("NFKC", text or "")
    text = text.translate(_INVISIBLE)
    text = " ".join(text.split()).strip()
    return text.strip(".,;:!?\"'“”‘’()[]{}<>").casefold()


# --------------------------------------------------------------------------
# status
# --------------------------------------------------------------------------


def _read_meta(index: Path) -> dict[str, str]:
    if not index.is_file():
        return {}
    try:
        conn = sqlite3.connect(f"file:{index}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        try:
            rows = conn.execute("SELECT key, value FROM meta").fetchall()
        finally:
            conn.close()
        return {row["key"]: row["value"] for row in rows}
    except sqlite3.Error:
        return {}


def _status_unlocked() -> dict:
    source = source_path()
    index = index_path()
    meta = _read_meta(index)
    indexed = bool(meta)
    stale = True
    if source is None:
        return {
            "available": False,
            "indexed": indexed,
            "stale": True,
            "source": None,
            "source_name": None,
            "index_path": str(index),
            "entry_count": int(meta.get("entry_count", 0) or 0),
            "built_at": meta.get("built_at"),
            "title": meta.get("title") or None,
            "author": meta.get("author") or None,
            "building": _is_building(),
        }

    stat = source.stat()
    if indexed:
        try:
            same = (
                int(meta.get("source_size", -1)) == stat.st_size
                and int(meta.get("source_mtime_ns", -1)) == stat.st_mtime_ns
            )
        except ValueError:
            same = False
        stale = not same

    return {
        "available": True,
        "indexed": indexed,
        "stale": stale,
        "source": str(source),
        "source_name": source.name,
        "index_path": str(index),
        "entry_count": int(meta.get("entry_count", 0) or 0),
        "built_at": meta.get("built_at"),
        "title": meta.get("title") or None,
        "author": meta.get("author") or None,
        "building": _is_building(),
    }


def _is_building() -> bool:
    with _STATE_LOCK:
        return _BUILDING


def status() -> dict:
    """Describe the dictionary without building anything."""
    return _status_unlocked()


# --------------------------------------------------------------------------
# index build
# --------------------------------------------------------------------------


def ensure_index(force: bool = False) -> dict:
    """Build the derived SQLite index if it is missing or stale."""
    global _BUILDING

    with _BUILD_LOCK:
        current = _status_unlocked()
        if current["available"] and current["indexed"] and not current["stale"] and not force:
            return current
        if not current["available"]:
            raise DictionaryError("no Merriam-Webster .eudb file was found")

        source = source_path()
        if source is None:  # pragma: no cover - guarded by status
            raise DictionaryError("no Merriam-Webster .eudb file was found")

        with _STATE_LOCK:
            _BUILDING = True
        try:
            _build(source, index_path())
        except (EudbError, OSError, sqlite3.Error) as exc:
            raise DictionaryError(f"could not index the dictionary: {exc}") from exc
        finally:
            with _STATE_LOCK:
                _BUILDING = False

    return _status_unlocked()


def _build(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    temp = target.with_name(target.name + ".tmp")
    if temp.exists():
        temp.unlink()

    meta, count, _offsets, _size = _read_header(source)
    stat = source.stat()
    built_at = datetime.now(timezone.utc).isoformat(timespec="seconds")

    conn = sqlite3.connect(temp)
    try:
        conn.executescript(
            "PRAGMA journal_mode=OFF;"
            "PRAGMA synchronous=OFF;"
            "PRAGMA temp_store=MEMORY;"
            + SCHEMA
        )
        batch: list[tuple[str, str, str]] = []
        inserted = 0
        for entry in iter_entries(source):
            batch.append((entry.headword, normalize(entry.headword), html_to_text(entry.body)))
            if len(batch) >= 500:
                conn.executemany(
                    "INSERT INTO entries (headword, headword_key, definition) VALUES (?, ?, ?)",
                    batch,
                )
                inserted += len(batch)
                batch.clear()
        if batch:
            conn.executemany(
                "INSERT INTO entries (headword, headword_key, definition) VALUES (?, ?, ?)",
                batch,
            )
            inserted += len(batch)

        conn.execute("CREATE INDEX ix_entries_key ON entries(headword_key)")
        conn.executemany(
            "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)",
            [
                ("version", str(INDEX_VERSION)),
                ("source", str(source)),
                ("source_size", str(stat.st_size)),
                ("source_mtime_ns", str(stat.st_mtime_ns)),
                ("built_at", built_at),
                ("entry_count", str(inserted or count)),
                ("title", meta.get("title", "")),
                ("author", meta.get("author", "")),
            ],
        )
        conn.commit()
    finally:
        conn.close()

    os.replace(temp, target)


def _read_header(source: Path):
    from app.dictionary.eudb import parse_header

    return parse_header(source)


# --------------------------------------------------------------------------
# lookup
# --------------------------------------------------------------------------


def _connect(index: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(f"file:{index}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _row(row: sqlite3.Row, full: bool = False) -> dict:
    definition = row["definition"] or ""
    return {
        "id": row["id"],
        "headword": row["headword"],
        "definition": definition[:MAX_DEFINITION] if full else None,
        "snippet": " ".join(definition.split())[:SNIPPET],
    }


def lookup(query: str, limit: int = 20) -> dict:
    """Exact matches plus prefix/contains suggestions for one query."""
    key = normalize(query)
    limit = max(1, min(int(limit), 50))
    if not key:
        return {"query": query, "exact": [], "matches": [], "entry_count": 0}

    current = ensure_index()
    index = index_path()
    if not index.is_file():  # pragma: no cover - ensure_index guarantees it
        raise DictionaryError("the dictionary index is missing")

    pattern = _escape_like(key)
    with _connect(index) as conn:
        exact = conn.execute(
            "SELECT id, headword, definition FROM entries"
            " WHERE headword_key = ? ORDER BY id LIMIT 3",
            (key,),
        ).fetchall()

        matches: list[sqlite3.Row] = []
        seen = {row["id"] for row in exact}
        prefix = conn.execute(
            "SELECT id, headword, definition FROM entries"
            " WHERE headword_key LIKE ? ESCAPE '\\'"
            " ORDER BY length(headword_key), headword_key LIMIT ?",
            (pattern + "%", limit + len(seen)),
        ).fetchall()
        for row in prefix:
            if row["id"] not in seen:
                matches.append(row)
                seen.add(row["id"])

        if len(matches) < 8:
            contains = conn.execute(
                "SELECT id, headword, definition FROM entries"
                " WHERE headword_key LIKE ? ESCAPE '\\'"
                " ORDER BY length(headword_key), headword_key LIMIT ?",
                ("%" + pattern + "%", limit + len(seen)),
            ).fetchall()
            for row in contains:
                if row["id"] not in seen:
                    matches.append(row)
                    seen.add(row["id"])
                if len(matches) >= limit:
                    break

    return {
        "query": query,
        "exact": [_row(row, full=True) for row in exact],
        "matches": [_row(row) for row in matches[:limit]],
        "entry_count": current["entry_count"],
    }


def get_entry(entry_id: int) -> dict | None:
    """One full entry by id (used to feed candidate senses to the LLM)."""
    index = index_path()
    if not index.is_file():
        ensure_index()
    with _connect(index) as conn:
        row = conn.execute(
            "SELECT id, headword, definition FROM entries WHERE id = ?",
            (int(entry_id),),
        ).fetchone()
    return _row(row, full=True) if row else None
