"""Per-question study annotations: text highlights and a question note.

Highlights are stored as a quotation + occurrence rather than raw character
offsets. The browser renders Markdown, so visible text does not map 1:1 to the
stored source; a quote survives re-renders and is easy to re-locate. Offsets are
kept only as a tie-breaker for repeated quotes.
"""

from __future__ import annotations

from app.db import db, one, query

COLORS = ("yellow", "green", "blue", "pink")
FIELDS = ("material", "material2", "stem")


def _field_ok(field: str) -> bool:
    return field in FIELDS or (
        field.startswith("option:") and len(field) == len("option:") + 1
    )


def _row(row) -> dict:
    return {
        "id": int(row["id"]),
        "document_id": int(row["document_id"]),
        "question_id": int(row["question_id"]),
        "field": row["field"],
        "quote": row["quote"],
        "occurrence": int(row["occurrence"]),
        "color": row["color"],
        "note": row["note"] or "",
        "start": int(row["start"] or 0),
        "end": int(row["end"] or 0),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def list_for_document(doc_id: int) -> list[dict]:
    rows = query(
        "SELECT * FROM question_annotations WHERE document_id = ?"
        " ORDER BY question_id, start, id",
        (doc_id,),
    )
    return [_row(row) for row in rows]


def notes_for_document(doc_id: int) -> dict[int, str]:
    rows = query(
        "SELECT question_id, content FROM notes"
        " WHERE document_id = ? AND question_id IS NOT NULL AND content != ''"
        " ORDER BY id",
        (doc_id,),
    )
    out: dict[int, str] = {}
    for row in rows:
        out[int(row["question_id"])] = row["content"]
    return out


def create(
    doc_id: int,
    question_id: int,
    field: str,
    quote: str,
    occurrence: int,
    color: str,
    note: str,
    start: int,
    end: int,
) -> dict | None:
    if not _field_ok(field):
        raise ValueError(f"invalid field {field!r}")
    if color not in COLORS:
        raise ValueError(f"invalid color {color!r}")
    quote = " ".join(quote.split()).strip()
    if not quote:
        raise ValueError("quote must not be empty")
    note = note.strip()[:4000]
    with db() as conn:
        owned = conn.execute(
            "SELECT 1 FROM questions WHERE id = ? AND document_id = ?",
            (question_id, doc_id),
        ).fetchone()
        if owned is None:
            return None
        cur = conn.execute(
            "INSERT INTO question_annotations"
            " (document_id, question_id, field, quote, occurrence, color, note,"
            "  start, \"end\")"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                doc_id,
                question_id,
                field,
                quote,
                max(0, int(occurrence)),
                color,
                note,
                max(0, int(start)),
                max(0, int(end)),
            ),
        )
        row = conn.execute(
            "SELECT * FROM question_annotations WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
    return _row(row) if row else None


def update(annotation_id: int, *, color: str | None, note: str | None) -> dict | None:
    changes: list[str] = []
    params: list[object] = []
    if color is not None:
        if color not in COLORS:
            raise ValueError(f"invalid color {color!r}")
        changes.append("color = ?")
        params.append(color)
    if note is not None:
        changes.append("note = ?")
        params.append(note.strip()[:4000])
    if not changes:
        row = one("SELECT * FROM question_annotations WHERE id = ?", (annotation_id,))
        return _row(row) if row else None
    changes.append("updated_at = datetime('now')")
    params.append(annotation_id)
    with db() as conn:
        cur = conn.execute(
            f"UPDATE question_annotations SET {', '.join(changes)} WHERE id = ?",
            tuple(params),
        )
        if cur.rowcount == 0:
            return None
        row = conn.execute(
            "SELECT * FROM question_annotations WHERE id = ?", (annotation_id,)
        ).fetchone()
    return _row(row) if row else None


def delete(annotation_id: int) -> bool:
    with db() as conn:
        cur = conn.execute(
            "DELETE FROM question_annotations WHERE id = ?", (annotation_id,)
        )
        return cur.rowcount > 0


def get_note(doc_id: int, question_id: int) -> str:
    row = one(
        "SELECT content FROM notes WHERE document_id = ? AND question_id = ?"
        " ORDER BY id DESC LIMIT 1",
        (doc_id, question_id),
    )
    return row["content"] if row else ""


def set_note(doc_id: int, question_id: int, content: str) -> str:
    content = content[:20000]
    with db() as conn:
        owned = conn.execute(
            "SELECT 1 FROM questions WHERE id = ? AND document_id = ?",
            (question_id, doc_id),
        ).fetchone()
        if owned is None:
            raise KeyError("question not found")
        row = conn.execute(
            "SELECT id FROM notes WHERE document_id = ? AND question_id = ?"
            " ORDER BY id DESC LIMIT 1",
            (doc_id, question_id),
        ).fetchone()
        if row is None:
            if content.strip():
                conn.execute(
                    "INSERT INTO notes (document_id, question_id, content)"
                    " VALUES (?, ?, ?)",
                    (doc_id, question_id, content),
                )
        elif content.strip():
            conn.execute(
                "UPDATE notes SET content = ?, updated_at = datetime('now') WHERE id = ?",
                (content, row["id"]),
            )
        else:
            conn.execute("DELETE FROM notes WHERE id = ?", (row["id"],))
    return content
