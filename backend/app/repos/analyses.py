"""Wrong-answer analysis pages — one document per exam, one page per question.

A review workspace is a "notebook": every question of an exam owns exactly one
analysis page (its body may be as long as the user likes). Pages are ordered by
the question order in the exam, so "Question 7" always sits after the earlier
questions and the notebook reads like the paper it reviews.

The legacy ``questions.explain`` column is migrated into a page on first read,
so existing hand-written explanations are never lost.
"""

from __future__ import annotations

from app.db import db, one, query
from app.repos.documents import get_document, list_questions

MAX_CONTENT = 200_000


class AnalysisError(ValueError):
    """Invalid analysis payload."""


def list_pages(doc_id: int) -> list[dict]:
    """Every analysis page of one exam, in question order (lazily created)."""
    questions = list_questions(doc_id)
    rows = query(
        "SELECT id, question_id, position, content, created_at, updated_at"
        " FROM analysis_pages WHERE document_id = ? ORDER BY position, id",
        (doc_id,),
    )
    by_question = {row["question_id"]: row for row in rows}
    out: list[dict] = []
    for index, q in enumerate(questions):
        row = by_question.get(q["id"])
        out.append(
            {
                "id": row["id"] if row else None,
                "document_id": doc_id,
                "question_id": q["id"],
                "position": row["position"] if row else index,
                "content": row["content"] if row else (q.get("explain") or ""),
                "created_at": row["created_at"] if row else None,
                "updated_at": row["updated_at"] if row else None,
            }
        )
    return out


def get_page(doc_id: int, question_id: int) -> dict | None:
    questions = list_questions(doc_id)
    question = next((q for q in questions if q["id"] == question_id), None)
    if question is None:
        return None
    row = one(
        "SELECT id, question_id, position, content, created_at, updated_at"
        " FROM analysis_pages WHERE document_id = ? AND question_id = ?"
        " ORDER BY position LIMIT 1",
        (doc_id, question_id),
    )
    if row is not None:
        return dict(row)
    position = next(i for i, q in enumerate(questions) if q["id"] == question_id)
    return {
        "id": None,
        "document_id": doc_id,
        "question_id": question_id,
        "position": position,
        "content": question.get("explain") or "",
        "created_at": None,
        "updated_at": None,
    }


def save_page(doc_id: int, question_id: int, content: str) -> dict:
    """Create or update one question's analysis page."""
    if get_document(doc_id) is None:
        raise AnalysisError("document not found")
    if len(content) > MAX_CONTENT:
        raise AnalysisError(f"analysis is longer than {MAX_CONTENT} characters")

    questions = list_questions(doc_id)
    position = next((i for i, q in enumerate(questions) if q["id"] == question_id), None)
    if position is None:
        raise AnalysisError("question not found")

    with db() as conn:
        existing = conn.execute(
            "SELECT id FROM analysis_pages WHERE document_id = ? AND question_id = ?",
            (doc_id, question_id),
        ).fetchone()
        if existing is None:
            cur = conn.execute(
                "INSERT INTO analysis_pages (document_id, question_id, position, content)"
                " VALUES (?, ?, ?, ?)",
                (doc_id, question_id, position, content),
            )
            page_id = cur.lastrowid
        else:
            page_id = existing["id"]
            conn.execute(
                "UPDATE analysis_pages SET content = ?, position = ?,"
                " updated_at = datetime('now') WHERE id = ?",
                (content, position, page_id),
            )
        # keep the legacy column in sync so old export paths keep working
        conn.execute(
            "UPDATE questions SET explain = ? WHERE id = ? AND document_id = ?",
            (content.strip() or None, question_id, doc_id),
        )

    row = one("SELECT * FROM analysis_pages WHERE id = ?", (page_id,))
    return dict(row) if row is not None else {}


def delete_page(doc_id: int, question_id: int) -> bool:
    with db() as conn:
        cur = conn.execute(
            "DELETE FROM analysis_pages WHERE document_id = ? AND question_id = ?",
            (doc_id, question_id),
        )
        conn.execute(
            "UPDATE questions SET explain = NULL WHERE id = ? AND document_id = ?",
            (question_id, doc_id),
        )
        return cur.rowcount > 0
