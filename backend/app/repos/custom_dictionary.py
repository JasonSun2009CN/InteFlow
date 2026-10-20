"""A user-managed dictionary stored in the app database (0 token).

This is deliberately separate from Merriam-Webster: the user can import or add
their own words/definitions and use them **before** the local MW dictionary.
Lookups fall back to MW when the custom dictionary has no hit.

One global custom dictionary keeps the feature easy to understand: import a
CSV/JSON/TSV file, add words by hand, then turn it on in Settings. A word is
unique (case-insensitive) and re-importing the same word updates its definition.
"""

from __future__ import annotations

import csv
import io
import json

from app.db import db, one, query

MAX_WORD = 120
MAX_DEFINITION = 8_000
MAX_ENTRIES = 10_000
MAX_IMPORT_BYTES = 3 * 1024 * 1024


class CustomDictionaryError(ValueError):
    """Invalid custom-dictionary payload or import file."""


def _clean_word(value: object) -> str:
    word = " ".join(str(value or "").split())
    if not word:
        raise CustomDictionaryError("word must not be empty")
    if len(word) > MAX_WORD:
        raise CustomDictionaryError(f"word must be at most {MAX_WORD} characters")
    return word


def _clean_definition(value: object) -> str:
    definition = str(value or "").strip()
    if not definition:
        raise CustomDictionaryError("definition must not be empty")
    if len(definition) > MAX_DEFINITION:
        raise CustomDictionaryError(
            f"definition must be at most {MAX_DEFINITION} characters"
        )
    return definition


def _clean_pos(value: object) -> str:
    return " ".join(str(value or "").split())[:40]


def _key(word: str) -> str:
    from app.dictionary.store import normalize

    return normalize(word)


def _entry(row: object) -> dict:
    data = dict(row)  # type: ignore[arg-type]
    definition = data.get("definition") or ""
    return {
        "id": int(data["id"]),
        "headword": data["word"],
        "definition": definition,
        "learner_definition": None,
        "pos": data.get("pos") or "",
        "snippet": " ".join(definition.split())[:220],
        "source": "custom",
    }


def count_entries() -> int:
    row = one("SELECT COUNT(*) AS n FROM custom_dictionary_entries")
    return int(row["n"] if row else 0)


def list_entries(search: str = "", limit: int = 500) -> list[dict]:
    limit = max(1, min(int(limit), 2000))
    text = search.strip()
    if text:
        pattern = f"%{text}%"
        rows = query(
            "SELECT id, word, pos, definition, created_at, updated_at"
            " FROM custom_dictionary_entries"
            " WHERE word LIKE ? OR definition LIKE ?"
            " ORDER BY word COLLATE NOCASE, id LIMIT ?",
            (pattern, pattern, limit),
        )
    else:
        rows = query(
            "SELECT id, word, pos, definition, created_at, updated_at"
            " FROM custom_dictionary_entries"
            " ORDER BY word COLLATE NOCASE, id LIMIT ?",
            (limit,),
        )
    return [dict(row) for row in rows]


def get_entry(entry_id: int) -> dict | None:
    row = one(
        "SELECT id, word, pos, definition, created_at, updated_at"
        " FROM custom_dictionary_entries WHERE id = ?",
        (entry_id,),
    )
    return dict(row) if row else None


def upsert_entry(word: object, definition: object, pos: object = "") -> dict:
    cleaned_word = _clean_word(word)
    cleaned_definition = _clean_definition(definition)
    cleaned_pos = _clean_pos(pos)
    key = _key(cleaned_word)
    if not key:
        raise CustomDictionaryError("word must contain letters or numbers")
    if get_entry_by_key(key) is None and count_entries() >= MAX_ENTRIES:
        raise CustomDictionaryError(f"the custom dictionary is limited to {MAX_ENTRIES} words")
    with db() as conn:
        conn.execute(
            "INSERT INTO custom_dictionary_entries (word, word_key, pos, definition)"
            " VALUES (?, ?, ?, ?)"
            " ON CONFLICT(word_key) DO UPDATE SET"
            " word = excluded.word, pos = excluded.pos,"
            " definition = excluded.definition, updated_at = datetime('now')",
            (cleaned_word, key, cleaned_pos, cleaned_definition),
        )
        row = conn.execute(
            "SELECT id, word, pos, definition, created_at, updated_at"
            " FROM custom_dictionary_entries WHERE word_key = ?",
            (key,),
        ).fetchone()
    return dict(row) if row else {}


def get_entry_by_key(key: str) -> dict | None:
    row = one(
        "SELECT id, word, pos, definition, created_at, updated_at"
        " FROM custom_dictionary_entries WHERE word_key = ?",
        (key,),
    )
    return dict(row) if row else None


def delete_entry(entry_id: int) -> bool:
    with db() as conn:
        cur = conn.execute(
            "DELETE FROM custom_dictionary_entries WHERE id = ?", (entry_id,)
        )
        return cur.rowcount > 0


def lookup(search: str, limit: int = 20) -> dict:
    """Exact + prefix/contains matches from the custom dictionary."""
    from app.dictionary.store import _escape_like

    key = _key(search)
    limit = max(1, min(int(limit), 50))
    if not key:
        return {"exact": [], "matches": [], "entry_count": count_entries()}

    exact = query(
        "SELECT id, word, pos, definition FROM custom_dictionary_entries"
        " WHERE word_key = ? ORDER BY id LIMIT 5",
        (key,),
    )
    seen = {int(row["id"]) for row in exact}
    matches = query(
        "SELECT id, word, pos, definition FROM custom_dictionary_entries"
        " WHERE word_key LIKE ? ESCAPE '\\'"
        " ORDER BY length(word_key), word_key LIMIT ?",
        (key + "%", limit + len(seen)),
    )
    rows = [*exact, *matches]
    if len(rows) < 8:
        contains = query(
            "SELECT id, word, pos, definition FROM custom_dictionary_entries"
            " WHERE word_key LIKE ? ESCAPE '\\'"
            " ORDER BY length(word_key), word_key LIMIT ?",
            ("%" + _escape_like(key) + "%", limit + len(seen)),
        )
        rows = [*rows, *contains]
    out_matches: list[dict] = []
    for row in rows:
        entry_id = int(row["id"])
        if entry_id in seen:
            continue
        seen.add(entry_id)
        out_matches.append(_entry(row))
    return {
        "exact": [_entry(row) for row in exact],
        "matches": out_matches[:limit],
        "entry_count": count_entries(),
    }


def _rows_from_text(filename: str, raw: bytes) -> list[dict]:
    if len(raw) > MAX_IMPORT_BYTES:
        raise CustomDictionaryError("the import file is larger than 3 MB")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise CustomDictionaryError("the import file must be UTF-8 text") from exc

    suffix = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if suffix == "json":
        try:
            value = json.loads(text)
        except ValueError as exc:
            raise CustomDictionaryError(f"invalid JSON: {exc}") from exc
        rows: list[dict] = []
        if isinstance(value, dict):
            for word, definition in value.items():
                if isinstance(definition, dict):
                    rows.append({"word": word, **definition})
                else:
                    rows.append({"word": word, "definition": definition})
        elif isinstance(value, list):
            rows = [item for item in value if isinstance(item, dict)]
        else:
            raise CustomDictionaryError("JSON must be an object or a list of objects")
        return rows

    delimiter = "\t" if suffix in ("tsv", "tab") else ","
    if suffix in ("txt", "text"):
        rows = []
        for line in text.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "\t" in line:
                parts = [part.strip() for part in line.split("\t")]
            elif ":" in line:
                parts = [line.split(":", 1)[0].strip(), line.split(":", 1)[1].strip()]
            else:
                continue
            rows.append({"word": parts[0], "definition": parts[1] if len(parts) > 1 else ""})
        return rows

    sample = text[:4096]
    if suffix not in ("csv", "tsv") and sample.count("\t") > sample.count(","):
        delimiter = "\t"
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    all_rows = list(reader)
    if not all_rows:
        return []
    header = [cell.strip().casefold() for cell in all_rows[0]]
    word_col = next(
        (i for i, cell in enumerate(header) if cell in ("word", "headword", "term")),
        None,
    )
    def_col = next(
        (
            i
            for i, cell in enumerate(header)
            if cell in ("definition", "meaning", "gloss", "explanation")
        ),
        None,
    )
    pos_col = next(
        (i for i, cell in enumerate(header) if cell in ("pos", "part of speech")),
        None,
    )
    if word_col is not None and def_col is not None:
        data_rows = all_rows[1:]
    else:
        word_col, def_col, pos_col = 0, 1, 2 if len(header) > 2 else None
        data_rows = all_rows

    rows = []
    for cells in data_rows:
        if not any(cell.strip() for cell in cells):
            continue
        rows.append(
            {
                "word": cells[word_col] if word_col < len(cells) else "",
                "definition": cells[def_col] if def_col is not None and def_col < len(cells) else "",
                "pos": cells[pos_col] if pos_col is not None and pos_col < len(cells) else "",
            }
        )
    return rows


def import_file(filename: str, raw: bytes) -> dict:
    rows = _rows_from_text(filename, raw)
    if not rows:
        raise CustomDictionaryError("no words were found in the file")
    if len(rows) > MAX_ENTRIES:
        raise CustomDictionaryError(f"import at most {MAX_ENTRIES} words at a time")

    cleaned: dict[str, dict] = {}
    skipped = 0
    for row in rows:
        try:
            word = _clean_word(
                row.get("word") or row.get("headword") or row.get("term")
            )
            definition = _clean_definition(
                row.get("definition") or row.get("meaning") or row.get("gloss")
            )
            pos = _clean_pos(row.get("pos") or row.get("part of speech"))
        except CustomDictionaryError:
            skipped += 1
            continue
        key = _key(word)
        if not key:
            skipped += 1
            continue
        cleaned[key] = {"word": word, "definition": definition, "pos": pos}

    if not cleaned:
        raise CustomDictionaryError("no valid word/definition rows were found")

    existing = {
        row["word_key"]
        for row in query("SELECT word_key FROM custom_dictionary_entries")
    }
    added = sum(1 for key in cleaned if key not in existing)
    updated = len(cleaned) - added
    with db() as conn:
        conn.executemany(
            "INSERT INTO custom_dictionary_entries (word, word_key, pos, definition)"
            " VALUES (?, ?, ?, ?)"
            " ON CONFLICT(word_key) DO UPDATE SET"
            " word = excluded.word, pos = excluded.pos,"
            " definition = excluded.definition, updated_at = datetime('now')",
            [
                (row["word"], key, row["pos"], row["definition"])
                for key, row in cleaned.items()
            ],
        )
    return {
        "added": added,
        "updated": updated,
        "skipped": skipped,
        "total": count_entries(),
    }
