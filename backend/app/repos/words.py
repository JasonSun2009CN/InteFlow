"""Free-form vocabulary grid (Numbers/Excel-style) per document.

One grid per document. **v2** (batch 10) stores stable per-column/per-row ids,
per-column widths and a view (sort + filter) next to the cell text, so the
front-end can persist layout/preferences without losing data identity. Legacy
**v1** grids (``headers`` + array-of-arrays rows) are read and upgraded
transparently, so pre-existing databases keep working.
"""

from __future__ import annotations

import json
import uuid

from app.db import db, one, query

GRID_VERSION = 2

#: Default grid shown for a document that has no vocabulary yet.
DEFAULT_COLUMNS = [
    {"id": "c1", "name": "Word", "width": 180},
    {"id": "c2", "name": "Meaning", "width": 260},
    {"id": "c3", "name": "Notes", "width": 220},
]

DEFAULT_WIDTH = 180
MIN_WIDTH = 60
MAX_WIDTH = 800
MAX_HEADERS = 12
MAX_ROWS = 500
MAX_CELL = 2000
MAX_NAME = 200


class GridError(ValueError):
    """Invalid grid payload (columns/rows out of bounds or malformed)."""


def default_grid() -> dict:
    """A fresh, empty v2 grid (deep copy of the defaults)."""
    return {
        "version": GRID_VERSION,
        "columns": [dict(c) for c in DEFAULT_COLUMNS],
        "rows": [],
        "view": {"sort": None, "filter": {}},
    }


def get_grid(doc_id: int) -> dict:
    row = one(
        "SELECT headers, rows_json, columns_json, view_json, version"
        " FROM word_grids WHERE document_id = ?",
        (doc_id,),
    )
    if row is None:
        return default_grid()
    if (row["version"] or 1) >= GRID_VERSION and row["columns_json"]:
        return {
            "version": GRID_VERSION,
            "columns": _loads(row["columns_json"], []),
            "rows": _loads(row["rows_json"], []),
            "view": _loads(row["view_json"], {"sort": None, "filter": {}}),
        }
    return _upgrade_v1(_loads(row["headers"], []), _loads(row["rows_json"], []))


def save_grid(doc_id: int, payload: dict) -> dict:
    """Validate + normalise a v2 (or legacy v1) payload and store it."""
    if not isinstance(payload, dict):
        raise GridError("grid payload must be an object")

    if payload.get("columns") is not None:
        columns = _normalize_columns(payload["columns"])
    elif payload.get("headers") is not None:          # legacy v1 body
        columns = _normalize_columns(payload["headers"])
    else:
        columns = [dict(c) for c in DEFAULT_COLUMNS]

    rows = _normalize_rows(payload.get("rows"), columns)
    view = _normalize_view(payload.get("view"), columns)
    grid = {"version": GRID_VERSION, "columns": columns, "rows": rows, "view": view}

    with db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO word_grids"
            " (document_id, headers, rows_json, columns_json, view_json, version, updated_at)"
            " VALUES (?, ?, ?, ?, ?, ?, datetime('now'))",
            (
                doc_id,
                json.dumps([c["name"] for c in columns], ensure_ascii=False),
                json.dumps(rows, ensure_ascii=False),
                json.dumps(columns, ensure_ascii=False),
                json.dumps(view, ensure_ascii=False),
                GRID_VERSION,
            ),
        )
    return grid


# --------------------------------------------------------------------------
# normalisation
# --------------------------------------------------------------------------


def _normalize_columns(raw: object) -> list[dict]:
    if not isinstance(raw, list) or not (1 <= len(raw) <= MAX_HEADERS):
        raise GridError(f"columns must be 1-{MAX_HEADERS} columns")

    out: list[dict] = []
    used: set[str] = set()
    for i, item in enumerate(raw):
        if isinstance(item, str):                     # tolerate "Name" shorthand
            item = {"name": item}
        if not isinstance(item, dict):
            raise GridError(f"column {i + 1} must be an object")

        name = _cell(item.get("name"), f"column {i + 1} name")
        if not name:
            raise GridError(f"column {i + 1} name must not be empty")
        if len(name) > MAX_NAME:
            raise GridError(f"column {i + 1} name is too long")

        cid = item.get("id")
        cid = cid.strip() if isinstance(cid, str) else ""
        if not cid or cid in used:
            cid = _next_id("c", i + 1, used)
        used.add(cid)
        out.append({"id": cid, "name": name, "width": _clamp_width(item.get("width"))})
    return out


def _normalize_rows(raw: object, columns: list[dict]) -> list[dict]:
    if raw is None:
        raw = []
    if not isinstance(raw, list) or len(raw) > MAX_ROWS:
        raise GridError(f"rows must be at most {MAX_ROWS}")

    col_ids = [c["id"] for c in columns]
    out: list[dict] = []
    used: set[str] = set()
    for r, row in enumerate(raw):
        if isinstance(row, list):                     # tolerate array rows (v1)
            src: object = {col_ids[i]: row[i] for i in range(min(len(row), len(col_ids)))}
            rid = None
        elif isinstance(row, dict):
            src = row.get("cells")
            rid = row.get("id")
        else:
            raise GridError(f"row {r + 1} must be an object")
        if src is None:
            src = {}
        if not isinstance(src, dict):
            raise GridError(f"row {r + 1} cells must be an object")

        cells: dict[str, str] = {}
        for cid in col_ids:
            cells[cid] = _cell(src.get(cid), f"row {r + 1}")

        rid = rid.strip() if isinstance(rid, str) else ""
        if not rid or rid in used:
            rid = _next_id("r", r + 1, used)
        used.add(rid)
        out.append({"id": rid, "cells": cells})
    return out


def _normalize_view(raw: object, columns: list[dict]) -> dict:
    col_ids = {c["id"] for c in columns}
    if not isinstance(raw, dict):
        return {"sort": None, "filter": {}}

    sort = raw.get("sort")
    if not (
        isinstance(sort, dict)
        and sort.get("columnId") in col_ids
        and sort.get("direction") in ("asc", "desc")
    ):
        sort = None

    filt: dict[str, str] = {}
    raw_filter = raw.get("filter")
    if isinstance(raw_filter, dict):
        for key, value in raw_filter.items():
            if key in col_ids and isinstance(value, str) and value.strip():
                filt[key] = value.strip()

    return {"sort": sort, "filter": filt}


def _upgrade_v1(headers: object, rows: object) -> dict:
    names = [h for h in headers if isinstance(h, str)] if isinstance(headers, list) else []
    if not (1 <= len(names) <= MAX_HEADERS):
        names = [c["name"] for c in DEFAULT_COLUMNS]
    columns = [
        {"id": f"c{i + 1}", "name": name or f"Column {i + 1}", "width": DEFAULT_WIDTH}
        for i, name in enumerate(names)
    ]
    col_ids = [c["id"] for c in columns]

    out_rows: list[dict] = []
    if isinstance(rows, list):
        for r, row in enumerate(rows):
            if not isinstance(row, list):
                continue
            cells = {
                cid: (row[i].strip() if i < len(row) and isinstance(row[i], str) else "")
                for i, cid in enumerate(col_ids)
            }
            out_rows.append({"id": f"r{r + 1}", "cells": cells})

    return {
        "version": GRID_VERSION,
        "columns": columns,
        "rows": out_rows,
        "view": {"sort": None, "filter": {}},
    }


# --------------------------------------------------------------------------
# structured vocabulary helpers
# --------------------------------------------------------------------------

WORD_NAMES = ("word", "term", "headword", "vocabulary", "expression")
POS_NAMES = ("pos", "part of speech", "part-of-speech", "partofspeech", "word class")
MEANING_NAMES = ("meaning", "definition", "translation", "gloss", "explanation")
NOTES_NAMES = ("notes", "note", "example", "examples", "context", "usage")

MAX_ENTRY_WORD = 200
POS_WIDTH = 96
MEANING_WIDTH = 320
NOTES_WIDTH = 260


class EntryNotFound(LookupError):
    """The requested vocabulary row does not exist."""


def _find_column(columns: list[dict], names: tuple[str, ...]) -> dict | None:
    wanted = {name.casefold() for name in names}
    for column in columns:
        if column["name"].strip().casefold() in wanted:
            return column
    return None


def _new_column_id(columns: list[dict]) -> str:
    used = {c["id"] for c in columns}
    index = len(columns) + 1
    while f"c{index}" in used:
        index += 1
    return f"c{index}"


def _new_row_id(rows: list[dict]) -> str:
    used = {r["id"] for r in rows}
    index = len(rows) + 1
    while f"r{index}" in used:
        index += 1
    return f"r{index}"


def _add_column(
    grid: dict,
    name: str,
    width: int,
    after_id: str | None = None,
) -> dict:
    """Append (or insert) a column and give every row an empty cell for it."""
    columns: list[dict] = grid["columns"]
    existing = next((c for c in columns if c["name"].casefold() == name.casefold()), None)
    if existing is not None:
        return existing

    column = {"id": _new_column_id(columns), "name": name, "width": width}
    at = len(columns)
    if after_id is not None:
        at = next((i + 1 for i, c in enumerate(columns) if c["id"] == after_id), at)
    columns.insert(at, column)
    for row in grid["rows"]:
        row.setdefault("cells", {})[column["id"]] = ""
    return column


def _clip(value: str, limit: int) -> str:
    value = value.strip()
    return value if len(value) <= limit else value[: limit - 1].rstrip() + "…"


def _entry_note(context: str, question_no: int | None, source: str) -> str:
    prefix: list[str] = []
    if question_no:
        prefix.append(f"Q{question_no}")
    if source:
        prefix.append(f"MW: {source}")
    label = " · ".join(prefix)
    body = " ".join(context.split())
    if label and body:
        return _clip(f"{label} — {body}", MAX_CELL)
    return _clip(label or body, MAX_CELL)


def _columns_for(grid: dict) -> dict[str, dict | None]:
    columns: list[dict] = grid["columns"]
    word = _find_column(columns, WORD_NAMES) or (columns[0] if columns else None)
    pos = _find_column(columns, POS_NAMES)
    meaning = _find_column(columns, MEANING_NAMES) or (
        columns[2] if len(columns) > 2 else (columns[1] if len(columns) > 1 else None)
    )
    notes = _find_column(columns, NOTES_NAMES) or (
        columns[3] if len(columns) > 3 else None
    )
    return {"word": word, "pos": pos, "meaning": meaning, "notes": notes}


def summaries() -> list[dict]:
    """One row per document, with its vocabulary count and a short preview."""
    rows = query(
        "SELECT d.id AS document_id, d.title, d.created_at,"
        " wg.headers, wg.rows_json, wg.columns_json, wg.view_json,"
        " wg.version, wg.updated_at"
        " FROM documents d"
        " LEFT JOIN word_grids wg ON wg.document_id = d.id"
        " ORDER BY d.title COLLATE NOCASE"
    )
    out: list[dict] = []
    for row in rows:
        version = row["version"] or 1
        columns = _loads(row["columns_json"], []) if version >= GRID_VERSION else []
        grid_rows = _loads(row["rows_json"], [])
        if not columns:
            grid = _upgrade_v1(_loads(row["headers"], []), grid_rows)
            columns = grid["columns"]
            grid_rows = grid["rows"]
        fields = _columns_for({"columns": columns, "rows": grid_rows})
        word_col = fields["word"]

        preview: list[str] = []
        count = 0
        for grid_row in grid_rows:
            cells = grid_row.get("cells", {}) if isinstance(grid_row, dict) else {}
            word = cells.get(word_col["id"], "") if word_col else ""
            if word.strip():
                count += 1
                if len(preview) < 4:
                    preview.append(word.strip())

        out.append(
            {
                "document_id": row["document_id"],
                "title": row["title"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"] or row["created_at"],
                "word_count": count,
                "preview": preview,
                "columns": [{"id": c["id"], "name": c["name"]} for c in columns],
                "has_grid": bool(row["columns_json"] or row["headers"] or row["rows_json"]),
            }
        )
    return out


def add_entry(
    doc_id: int,
    *,
    word: str,
    meaning: str = "",
    pos: str = "",
    notes: str = "",
    context: str = "",
    source: str = "",
    question_no: int | None = None,
) -> dict:
    """Add one structured entry to a document's grid (de-duplicating by word).

    The grid is intentionally still free-form: the standard columns are found
    by name and created on demand. Re-adding an existing word updates only the
    empty cells, so re-practising an exam enriches the same list instead of
    creating duplicates.
    """
    word = _cell(word, "word")
    if not word:
        raise GridError("word must not be empty")
    word = _clip(word, MAX_ENTRY_WORD)
    meaning = _clip(meaning, MAX_CELL)
    pos = _clip(pos, MAX_CELL)
    notes = _clip(notes, MAX_CELL)
    source = _clip(source, MAX_NAME)

    grid = get_grid(doc_id)
    fields = _columns_for(grid)
    if fields["word"] is None:
        fields["word"] = _add_column(grid, "Word", DEFAULT_WIDTH)

    if pos and fields["pos"] is None:
        fields["pos"] = _add_column(grid, "POS", POS_WIDTH, after_id=fields["word"]["id"])
    if meaning and fields["meaning"] is None:
        after = fields["pos"]["id"] if fields["pos"] else fields["word"]["id"]
        fields["meaning"] = _add_column(grid, "Meaning", MEANING_WIDTH, after_id=after)
    note_text = _entry_note(context, question_no, source)
    if (notes or note_text) and fields["notes"] is None:
        fields["notes"] = _add_column(grid, "Notes", NOTES_WIDTH)

    existing = None
    for row in grid["rows"]:
        current = row["cells"].get(fields["word"]["id"], "")
        if current.strip().casefold() == word.casefold():
            existing = row
            break

    created = existing is None
    changed = False
    if existing is None:
        row = {"id": _new_row_id(grid["rows"]), "cells": {c["id"]: "" for c in grid["columns"]}}
        row["cells"][fields["word"]["id"]] = word
        grid["rows"].append(row)
        changed = True
    else:
        row = existing

    def fill(column: dict | None, value: str) -> None:
        nonlocal changed
        if column is None or not value:
            return
        if not row["cells"].get(column["id"], "").strip():
            row["cells"][column["id"]] = value
            changed = True

    fill(fields["pos"], pos)
    fill(fields["meaning"], meaning)

    if fields["notes"] is not None:
        extra = notes or note_text
        if extra:
            current_notes = row["cells"].get(fields["notes"]["id"], "").strip()
            if not current_notes:
                row["cells"][fields["notes"]["id"]] = extra
                changed = True
            elif extra not in current_notes:
                row["cells"][fields["notes"]["id"]] = _clip(
                    f"{current_notes} · {extra}", MAX_CELL
                )
                changed = True

    if changed:
        saved = save_grid(doc_id, grid)
    else:
        saved = grid

    saved_row = next((r for r in saved["rows"] if r["id"] == row["id"]), row)
    return {
        "grid": saved,
        "row": saved_row,
        "row_id": saved_row["id"],
        "word": saved_row["cells"].get(fields["word"]["id"], word),
        "created": created,
    }


def update_entry(doc_id: int, row_id: str, fields: dict) -> dict:
    """Update one row's standard fields; returns the saved grid and row."""
    grid = get_grid(doc_id)
    target = next((r for r in grid["rows"] if r["id"] == row_id), None)
    if target is None:
        raise EntryNotFound("vocabulary entry not found")

    columns = _columns_for(grid)
    word_col = columns["word"]
    if word_col is None:
        word_col = _add_column(grid, "Word", DEFAULT_WIDTH)
        columns["word"] = word_col

    if "pos" in fields and fields["pos"] and columns["pos"] is None:
        columns["pos"] = _add_column(grid, "POS", POS_WIDTH, after_id=word_col["id"])
    if "meaning" in fields and fields["meaning"] and columns["meaning"] is None:
        after = columns["pos"]["id"] if columns["pos"] else word_col["id"]
        columns["meaning"] = _add_column(grid, "Meaning", MEANING_WIDTH, after_id=after)
    if "notes" in fields and fields["notes"] and columns["notes"] is None:
        columns["notes"] = _add_column(grid, "Notes", NOTES_WIDTH)

    limits = {"word": MAX_ENTRY_WORD, "pos": MAX_NAME, "meaning": MAX_CELL, "notes": MAX_CELL}
    for key, column in (
        ("word", columns["word"]),
        ("pos", columns["pos"]),
        ("meaning", columns["meaning"]),
        ("notes", columns["notes"]),
    ):
        if key not in fields or column is None:
            continue
        value = fields[key]
        if value is None:
            value = ""
        if not isinstance(value, str):
            raise GridError(f"{key} must be text")
        value = _clip(value, limits[key])
        if key == "word" and not value:
            raise GridError("word must not be empty")
        target["cells"][column["id"]] = value

    saved = save_grid(doc_id, grid)
    saved_row = next(r for r in saved["rows"] if r["id"] == row_id)
    return {"grid": saved, "row": saved_row, "row_id": row_id}


def delete_entry(doc_id: int, row_id: str) -> dict:
    grid = get_grid(doc_id)
    remaining = [r for r in grid["rows"] if r["id"] != row_id]
    if len(remaining) == len(grid["rows"]):
        raise EntryNotFound("vocabulary entry not found")
    grid["rows"] = remaining
    saved = save_grid(doc_id, grid)
    return {"grid": saved, "deleted": 1}


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------


def _clamp_width(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return DEFAULT_WIDTH
    return max(MIN_WIDTH, min(MAX_WIDTH, int(value)))


def _cell(value: object, what: str) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        raise GridError(f"{what} must be text")
    text = value.strip()
    if len(text) > MAX_CELL:
        raise GridError(f"{what} is longer than {MAX_CELL} characters")
    return text


def _next_id(prefix: str, index: int, used: set[str]) -> str:
    """Prefer the deterministic ``c3``/``r7`` form, fall back to a random id."""
    candidate = f"{prefix}{index}"
    if candidate not in used:
        return candidate
    return _gen_id(prefix, used)


def _gen_id(prefix: str, used: set[str]) -> str:
    while True:
        candidate = f"{prefix}{uuid.uuid4().hex[:8]}"
        if candidate not in used:
            used.add(candidate)
            return candidate


def _loads(value: object, default: object) -> object:
    if not value:
        return default
    try:
        return json.loads(value)                       # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default