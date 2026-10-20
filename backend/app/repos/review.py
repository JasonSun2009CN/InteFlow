"""Two review collections built on top of practice sessions:

* **Mistakes** — every question missed in a submitted attempt, de-duplicated to
  the most recent miss (newest attempt wins).
* **Starred** — questions the user explicitly starred while practising or
  reviewing (``question_stars``), whether or not they were ever attempted.

Both return the same item shape used by the review workspace, plus the paper
title/subject, the relevant attempt, starred state, and every saved analysis.
"""

from __future__ import annotations

import json

from app.db import db, one, query

MAX_ITEMS = 1000


def _json(raw: object, fallback: object) -> object:
    if not raw:
        return fallback
    try:
        return json.loads(raw)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return fallback


def _values(raw: object, legacy: object = None) -> list[str]:
    parsed = _json(raw, [])
    values = [str(v) for v in parsed if str(v).strip()] if isinstance(parsed, list) else []
    if not values and legacy is not None and str(legacy).strip():
        values = [str(legacy)]
    return values


def _subject(row: object) -> dict | None:
    keys = row.keys()  # type: ignore[attr-defined]
    if "subject_id" not in keys or row["subject_id"] is None:  # type: ignore[index]
        return None
    return {
        "id": row["subject_id"],  # type: ignore[index]
        "name": row["subject_name"],  # type: ignore[index]
        "color": row["subject_color"],  # type: ignore[index]
    }


def _analyses(question_ids: list[int]) -> dict[int, list[dict]]:
    """All saved analyses per question (current pages + legacy rows)."""
    if not question_ids:
        return {}
    marks = ",".join("?" * len(question_ids))
    params = tuple(question_ids)
    pages = query(
        "SELECT question_id, id, content, updated_at, 'page' AS source"
        f" FROM analysis_pages WHERE question_id IN ({marks})"
        " AND content IS NOT NULL AND content != '' ORDER BY position, id",
        params,
    )
    legacy = query(
        "SELECT question_id, id, content, updated_at, 'legacy' AS source"
        f" FROM analyses WHERE question_id IN ({marks})"
        " AND content IS NOT NULL AND content != '' ORDER BY id",
        params,
    )
    out: dict[int, list[dict]] = {}
    for row in [*pages, *legacy]:
        out.setdefault(int(row["question_id"]), []).append(
            {
                "source": row["source"],
                "content": row["content"],
                "updated_at": row["updated_at"],
            }
        )
    return out


def _item(row: object, analyses: dict[int, list[dict]]) -> dict:
    question_id = int(row["question_id"])  # type: ignore[index]
    answers = _values(row["answers_json"])  # type: ignore[index]
    chosen = _values(row["chosen_json"], row["chosen"])  # type: ignore[index]
    saved = analyses.get(question_id, [])
    if not saved and row["explain"]:  # type: ignore[index]
        saved = [
            {
                "source": "explain",
                "content": row["explain"],  # type: ignore[index]
                "updated_at": None,
            }
        ]
    primary = saved[0]["content"] if saved else ""
    return {
        "question_id": question_id,
        "document_id": int(row["document_id"]),  # type: ignore[index]
        "document_title": row["document_title"],  # type: ignore[index]
        "subject": _subject(row),
        "no": row["no"] if row["no"] is not None else (row["order_idx"] + 1),  # type: ignore[index]
        "source_no": row["no"],  # type: ignore[index]
        "sec": row["sec"],  # type: ignore[index]
        "kind": row["kind"] or "choice",  # type: ignore[index]
        "multi": bool(row["multi"]),  # type: ignore[index]
        "material": row["material"],  # type: ignore[index]
        "stem": row["stem"],  # type: ignore[index]
        "options": _json(row["options_json"], []),  # type: ignore[index]
        "images": _json(row["images_json"], []),  # type: ignore[index]
        "source": row["source_ref"],  # type: ignore[index]
        "explain": row["explain"],  # type: ignore[index]
        "chosen": row["chosen"],  # type: ignore[index]
        "chosen_answers": chosen,
        "answer": answers[0] if len(answers) == 1 else None,
        "answers": answers,
        "is_correct": (
            bool(row["is_correct"]) if row["is_correct"] is not None else None  # type: ignore[index]
        ),
        "session_id": row["session_id"],  # type: ignore[index]
        "answered_at": row["answered_at"],  # type: ignore[index]
        "finished_at": row["finished_at"],  # type: ignore[index]
        "starred": bool(row["starred"]),  # type: ignore[index]
        "starred_at": row["starred_at"],  # type: ignore[index]
        "analysis": primary,
        "analyses": saved,
    }


_MISTAKES_SQL = """
WITH ranked AS (
  SELECT si.question_id, si.session_id, si.chosen, si.chosen_json,
         si.is_correct, si.answered_at,
         ROW_NUMBER() OVER (
           PARTITION BY si.question_id
           ORDER BY s.id DESC, si.answered_at DESC
         ) AS rn
  FROM session_items si
  JOIN sessions s ON s.id = si.session_id
  WHERE s.finished_at IS NOT NULL
)
SELECT r.question_id, r.session_id, r.chosen, r.chosen_json, r.is_correct,
       r.answered_at, s.finished_at,
       q.document_id, q.no, q.sec, q.kind, q.multi, q.material, q.stem,
       q.options_json, q.answers_json, q.explain, q.source_ref, q.images_json,
       q.order_idx, d.title AS document_title,
       subj.id AS subject_id, subj.name AS subject_name, subj.color AS subject_color,
       CASE WHEN st.question_id IS NULL THEN 0 ELSE 1 END AS starred,
       st.created_at AS starred_at
FROM ranked r
JOIN questions q ON q.id = r.question_id
JOIN sessions s ON s.id = r.session_id
JOIN documents d ON d.id = q.document_id
LEFT JOIN subjects subj ON subj.id = d.subject_id
LEFT JOIN question_stars st ON st.question_id = q.id
WHERE r.rn = 1 AND r.is_correct = 0
ORDER BY s.id DESC, q.order_idx
LIMIT ?
"""

_STARRED_SQL = """
SELECT st.question_id, latest.session_id, latest.chosen, latest.chosen_json,
       latest.is_correct, latest.answered_at, ls.finished_at,
       q.document_id, q.no, q.sec, q.kind, q.multi, q.material, q.stem,
       q.options_json, q.answers_json, q.explain, q.source_ref, q.images_json,
       q.order_idx, d.title AS document_title,
       subj.id AS subject_id, subj.name AS subject_name, subj.color AS subject_color,
       1 AS starred, st.created_at AS starred_at
FROM question_stars st
JOIN questions q ON q.id = st.question_id
JOIN documents d ON d.id = q.document_id
LEFT JOIN subjects subj ON subj.id = d.subject_id
LEFT JOIN (
  SELECT si.question_id, si.session_id, si.chosen, si.chosen_json,
         si.is_correct, si.answered_at,
         ROW_NUMBER() OVER (
           PARTITION BY si.question_id ORDER BY s.id DESC
         ) AS rn
  FROM session_items si
  JOIN sessions s ON s.id = si.session_id
  WHERE s.finished_at IS NOT NULL
) latest ON latest.question_id = st.question_id AND latest.rn = 1
LEFT JOIN sessions ls ON ls.id = latest.session_id
ORDER BY st.created_at DESC, st.question_id DESC
LIMIT ?
"""


def list_mistakes() -> list[dict]:
    rows = query(_MISTAKES_SQL, (MAX_ITEMS,))
    analyses = _analyses([int(row["question_id"]) for row in rows])
    return [_item(row, analyses) for row in rows]


def list_starred() -> list[dict]:
    rows = query(_STARRED_SQL, (MAX_ITEMS,))
    analyses = _analyses([int(row["question_id"]) for row in rows])
    return [_item(row, analyses) for row in rows]


def starred_ids(doc_id: int) -> list[int]:
    rows = query(
        "SELECT question_id FROM question_stars WHERE document_id = ?"
        " ORDER BY created_at, question_id",
        (doc_id,),
    )
    return [int(row["question_id"]) for row in rows]


def star_question(question_id: int) -> dict | None:
    row = one("SELECT id, document_id FROM questions WHERE id = ?", (question_id,))
    if row is None:
        return None
    with db() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO question_stars (question_id, document_id)"
            " VALUES (?, ?)",
            (question_id, row["document_id"]),
        )
    return {"question_id": question_id, "starred": True}


def unstar_question(question_id: int) -> dict | None:
    row = one("SELECT id FROM questions WHERE id = ?", (question_id,))
    if row is None:
        return None
    with db() as conn:
        conn.execute("DELETE FROM question_stars WHERE question_id = ?", (question_id,))
    return {"question_id": question_id, "starred": False}
