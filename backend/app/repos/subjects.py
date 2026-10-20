"""User-defined subject labels for exam papers (0 token, local only).

A subject is a lightweight label ("SAT Math", "Physics", …) that a paper can
belong to. Subjects are global (not per document) so renaming one updates every
paper that uses it, and deleting one moves its papers to *Uncategorized*.
"""

from __future__ import annotations

import sqlite3

from app.db import db, one, query

MAX_NAME = 40

#: Palette ids accepted by the API. The frontend maps these to Tailwind tones.
SUBJECT_COLORS = (
    "blue",
    "emerald",
    "amber",
    "rose",
    "violet",
    "cyan",
    "lime",
    "slate",
)


class SubjectError(ValueError):
    """Invalid subject payload."""


class SubjectExists(SubjectError):
    """A subject with the same (case-insensitive) name already exists."""


def _clean_name(name: object) -> str:
    value = " ".join(str(name or "").split())
    if not value:
        raise SubjectError("subject name must not be empty")
    if len(value) > MAX_NAME:
        raise SubjectError(f"subject name must be at most {MAX_NAME} characters")
    return value


def _clean_color(color: object) -> str | None:
    if color is None:
        return None
    value = str(color).strip().lower()
    if value not in SUBJECT_COLORS:
        raise SubjectError(f"color must be one of {', '.join(SUBJECT_COLORS)}")
    return value


def _row_dict(row: object) -> dict:
    data = dict(row)  # type: ignore[arg-type]
    data["document_count"] = int(data.get("document_count") or 0)
    return data


def list_subjects() -> list[dict]:
    rows = query(
        "SELECT s.id, s.name, s.color, s.created_at,"
        " COUNT(d.id) AS document_count"
        " FROM subjects s LEFT JOIN documents d ON d.subject_id = s.id"
        " GROUP BY s.id"
        " ORDER BY s.name COLLATE NOCASE, s.id"
    )
    return [_row_dict(row) for row in rows]


def get_subject(subject_id: int) -> dict | None:
    row = one(
        "SELECT s.id, s.name, s.color, s.created_at,"
        " COUNT(d.id) AS document_count"
        " FROM subjects s LEFT JOIN documents d ON d.subject_id = s.id"
        " WHERE s.id = ? GROUP BY s.id",
        (subject_id,),
    )
    return _row_dict(row) if row else None


def exists(subject_id: int) -> bool:
    return one("SELECT 1 FROM subjects WHERE id = ?", (subject_id,)) is not None


def create_subject(name: object, color: object = None) -> dict:
    cleaned = _clean_name(name)
    chosen = _clean_color(color)
    if chosen is None:
        count = one("SELECT COUNT(*) AS n FROM subjects")
        chosen = SUBJECT_COLORS[int(count["n"] if count else 0) % len(SUBJECT_COLORS)]
    try:
        with db() as conn:
            cur = conn.execute(
                "INSERT INTO subjects (name, color) VALUES (?, ?)",
                (cleaned, chosen),
            )
            subject_id = int(cur.lastrowid)
    except sqlite3.IntegrityError as exc:
        raise SubjectExists(f'a subject named "{cleaned}" already exists') from exc
    subject = get_subject(subject_id)
    if subject is None:  # pragma: no cover - inserted row must be readable
        raise SubjectError("could not create subject")
    return subject


def update_subject(
    subject_id: int,
    *,
    name: object = None,
    color: object = None,
    update_name: bool = False,
    update_color: bool = False,
) -> dict | None:
    if not update_name and not update_color:
        raise SubjectError("nothing to update")
    if get_subject(subject_id) is None:
        return None

    sets: list[str] = []
    values: list[object] = []
    if update_name:
        sets.append("name = ?")
        values.append(_clean_name(name))
    if update_color:
        cleaned_color = _clean_color(color)
        if cleaned_color is None:
            raise SubjectError("color must not be empty")
        sets.append("color = ?")
        values.append(cleaned_color)

    try:
        with db() as conn:
            conn.execute(
                f"UPDATE subjects SET {', '.join(sets)} WHERE id = ?",
                (*values, subject_id),
            )
    except sqlite3.IntegrityError as exc:
        raise SubjectExists(f'a subject named "{name}" already exists') from exc
    return get_subject(subject_id)


def delete_subject(subject_id: int) -> bool:
    with db() as conn:
        cur = conn.execute("DELETE FROM subjects WHERE id = ?", (subject_id,))
        return cur.rowcount > 0
