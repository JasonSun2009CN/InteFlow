"""Practice sessions: start, fetch (without answers), grade on submit."""

from __future__ import annotations

import json
import re
import unicodedata

from app.db import db, one, query
from app.repos.documents import list_questions


def create_session(doc_id: int) -> int:
    from app.db import execute

    return execute("INSERT INTO sessions (document_id) VALUES (?)", (doc_id,))


def get_session(session_id: int) -> dict | None:
    row = one("SELECT * FROM sessions WHERE id = ?", (session_id,))
    if row is None:
        return None
    return {
        "id": row["id"],
        "document_id": row["document_id"],
        "started_at": row["started_at"],
        "finished_at": row["finished_at"],
    }


def quiz_questions(doc_id: int) -> list[dict]:
    """Questions for the test UI — correct answers never leave the server."""
    return [
        {k: v for k, v in q.items() if k not in ("answer", "answers")}
        for q in list_questions(doc_id, include_answers=False)
    ]


def submit(session_id: int, answers: dict[int, list[str]]) -> dict:
    """Grade one attempt; stores every response and returns the review payload."""
    return _grade(session_id, answers)


def regrade(session_id: int) -> dict:
    """Re-grade a submitted attempt against the *current* document answers.

    Used by the post-submit answer-key flow: the attempt is stored without a
    key (graded == 0), the user fills the key, then this re-runs grading using
    the choices already recorded in session_items.
    """
    rows = query(
        "SELECT question_id, chosen, chosen_json FROM session_items"
        " WHERE session_id = ? ORDER BY no",
        (session_id,),
    )
    if not rows:
        raise ValueError("session has not been submitted yet")
    chosen = {
        r["question_id"]: _load_chosen(r["chosen_json"], r["chosen"]) for r in rows
    }
    return _grade(session_id, chosen)


def _load_chosen(raw: object, legacy: object) -> list[str]:
    values: list[str] = []
    if raw:
        try:
            parsed = json.loads(raw)  # type: ignore[arg-type]
            if isinstance(parsed, list):
                values = [str(v) for v in parsed if str(v).strip()]
        except (TypeError, ValueError):
            values = []
    if not values and legacy:
        values = [str(legacy)]
    return values


def _normalize_blank(value: str) -> str:
    """Case/width/whitespace-insensitive form so ``2`` matches `` ２ ``."""
    text = unicodedata.normalize("NFKC", value)
    text = text.replace("\u2018", "'").replace("\u2019", "'")
    text = text.replace("\u201c", '"').replace("\u201d", '"')
    return re.sub(r"\s+", " ", text).strip().casefold()


def grade_answer(kind: str, multi: bool, correct: list[str], chosen: list[str]) -> bool:
    """One question's verdict. Order/whitespace-insensitive, no partial credit."""
    if not chosen:
        return False
    if kind == "blank":
        accepted = {_normalize_blank(v) for v in correct if str(v).strip()}
        return bool(accepted) and _normalize_blank(chosen[0]) in accepted
    expected = sorted({str(v).strip().upper() for v in correct if str(v).strip()})
    got = sorted({str(v).strip().upper() for v in chosen if str(v).strip()})
    if not expected:
        return False
    if multi:
        return got == expected
    return bool(got) and got[0] in expected


def _grade(session_id: int, answers: dict[int, list[str] | str]) -> dict:
    session = get_session(session_id)
    if session is None:
        raise KeyError(f"session {session_id} not found")
    questions = list_questions(session["document_id"])
    if not questions:
        raise KeyError("document has no questions")

    graded = correct = 0
    items: list[dict] = []
    with db() as conn:
        conn.execute("DELETE FROM session_items WHERE session_id = ?", (session_id,))
        for idx, q in enumerate(questions, start=1):
            raw = answers.get(q["id"], answers.get(str(q["id"])))
            if isinstance(raw, str):
                chosen = [raw] if raw.strip() else []
            else:
                chosen = [str(v) for v in (raw or []) if str(v).strip()]

            correct_answers = q.get("answers") or ([q["answer"]] if q.get("answer") else [])
            kind = q.get("kind") or "choice"
            multi = bool(q.get("multi"))
            is_correct: int | None = None
            if correct_answers:
                graded += 1
                is_correct = 1 if grade_answer(kind, multi, correct_answers, chosen) else 0
                correct += is_correct

            legacy = chosen[0] if kind == "choice" and len(chosen) == 1 else None
            conn.execute(
                "INSERT INTO session_items (session_id, question_id, no, chosen, chosen_json,"
                " is_correct, answered_at)"
                " VALUES (?, ?, ?, ?, ?, ?, datetime('now'))",
                (
                    session_id,
                    q["id"],
                    idx,
                    legacy,
                    json.dumps(chosen, ensure_ascii=False),
                    is_correct,
                ),
            )
            items.append(
                {
                    "question_id": q["id"],
                    "no": idx,
                    "source_no": q["no"],
                    "sec": q["sec"],
                    "kind": kind,
                    "multi": multi,
                    "material": q["material"],
                    "stem": q["stem"],
                    "options": q["options"],
                    "images": q["images"],
                    "source": q["source"],
                    "chosen": legacy,
                    "chosen_answers": chosen,
                    "answer": correct_answers[0] if len(correct_answers) == 1 else None,
                    "answers": correct_answers,
                    "is_correct": bool(is_correct) if is_correct is not None else None,
                    "explain": q["explain"],
                }
            )
        conn.execute(
            "UPDATE sessions SET finished_at = COALESCE(finished_at, datetime('now'))"
            " WHERE id = ?",
            (session_id,),
        )

    return {
        "session_id": session_id,
        "total": len(items),
        "graded": graded,
        "correct": correct,
        "items": items,
    }


def history(doc_id: int, limit: int = 20) -> list[dict]:
    """Submitted attempts of one exam, newest first (unfinished ones are hidden)."""
    rows = query(
        "SELECT s.id, s.started_at, s.finished_at,"
        " SUM(si.is_correct) AS correct, COUNT(si.is_correct) AS graded"
        " FROM sessions s LEFT JOIN session_items si ON si.session_id = s.id"
        " WHERE s.document_id = ? AND s.finished_at IS NOT NULL"
        " GROUP BY s.id ORDER BY s.id DESC LIMIT ?",
        (doc_id, limit),
    )
    return [
        {
            "session_id": r["id"],
            "started_at": r["started_at"],
            "finished_at": r["finished_at"],
            "correct": r["correct"] or 0,
            "graded": r["graded"] or 0,
        }
        for r in rows
    ]


def list_sessions(limit: int = 200) -> list[dict]:
    """Every submitted attempt across all exams, newest first (the Sessions page).

    A session row is created when practice *starts* so the client can post to it;
    only attempts with a ``finished_at`` (i.e. actually submitted) are listed here,
    so simply opening an exam never shows up as an attempt.
    """
    rows = query(
        "SELECT s.id, s.document_id, s.started_at, s.finished_at,"
        " d.title AS document_title,"
        " SUM(si.is_correct) AS correct, COUNT(si.is_correct) AS graded,"
        " COUNT(si.question_id) AS answered"
        " FROM sessions s"
        " JOIN documents d ON d.id = s.document_id"
        " LEFT JOIN session_items si ON si.session_id = s.id"
        " WHERE s.finished_at IS NOT NULL"
        " GROUP BY s.id ORDER BY s.id DESC LIMIT ?",
        (limit,),
    )
    return [
        {
            "session_id": r["id"],
            "document_id": r["document_id"],
            "document_title": r["document_title"],
            "started_at": r["started_at"],
            "finished_at": r["finished_at"],
            "correct": r["correct"] or 0,
            "graded": r["graded"] or 0,
            "answered": r["answered"] or 0,
        }
        for r in rows
    ]


def delete_session(session_id: int) -> bool:
    if get_session(session_id) is None:
        return False
    from app.db import execute

    execute("DELETE FROM sessions WHERE id = ?", (session_id,))
    return True


def get_student_answer(session_id: int, question_id: int) -> str | None:
    """Get the student's chosen answer for a question in a session."""
    row = one(
        "SELECT chosen, chosen_json FROM session_items"
        " WHERE session_id = ? AND question_id = ?",
        (session_id, question_id),
    )
    if row is None:
        return None
    values = _load_chosen(row["chosen_json"], row["chosen"])
    return ", ".join(values) if values else None
