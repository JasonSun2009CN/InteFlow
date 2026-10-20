"""Mistakes + starred collections (review)."""

from __future__ import annotations

from app.db import db
from tests.conftest import MINI_IFMD, upload


def _doc(client) -> tuple[int, list[dict]]:
    resp = upload(client, "mini.ifmd.md", MINI_IFMD)
    assert resp.status_code == 200, resp.text
    doc_id = resp.json()["id"]
    # MINI_IFMD ships without a key; fill it so submit can grade.
    key = client.put(
        f"/api/documents/{doc_id}/answers",
        json={"answers": {"Q001": "B", "Q002": "D"}},
    )
    assert key.status_code == 200, key.text
    questions = client.get(f"/api/documents/{doc_id}/questions").json()
    return doc_id, questions


def _start(client, doc_id: int) -> dict:
    resp = client.post("/api/sessions", json={"document_id": doc_id})
    assert resp.status_code == 200, resp.text
    return resp.json()


def _submit(client, session: dict, values: dict[str, str]) -> dict:
    resp = client.post(
        f"/api/sessions/{session['session_id']}/submit",
        json={"answers": values},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def _miss(client, questions: list[dict], chosen: str = "A") -> dict:
    """One attempt: Q001 wrong (A), Q002 correct (D)."""
    session = _start(client, questions[0]["document_id"])
    by_ext = {q["ext_id"]: q for q in questions}
    values = {
        str(by_ext["Q001"]["id"]): chosen,
        str(by_ext["Q002"]["id"]): "D",
    }
    return _submit(client, session, values)


def _mistake(client, question_id: int) -> dict | None:
    items = client.get("/api/review/mistakes").json()
    return next((item for item in items if item["question_id"] == question_id), None)


def test_mistakes_keep_the_latest_wrong_attempt(client) -> None:
    doc_id, questions = _doc(client)
    for q in questions:
        q["document_id"] = doc_id
    first = _miss(client, questions, "A")
    second = _miss(client, questions, "C")

    item = _mistake(client, questions[0]["id"])
    assert item is not None
    assert item["document_id"] == doc_id
    assert item["document_title"] == "Mini Bank"
    assert item["answers"] == ["B"]
    assert item["chosen_answers"] == ["C"]        # latest miss wins
    assert item["is_correct"] is False
    assert item["session_id"] == second["session_id"] != first["session_id"]
    assert item["starred"] is False


def test_a_later_correct_attempt_removes_the_mistake(client) -> None:
    doc_id, questions = _doc(client)
    for q in questions:
        q["document_id"] = doc_id
    _miss(client, questions, "A")
    assert _mistake(client, questions[0]["id"]) is not None

    session = _start(client, doc_id)
    by_ext = {q["ext_id"]: q for q in questions}
    _submit(
        client,
        session,
        {str(by_ext["Q001"]["id"]): "B", str(by_ext["Q002"]["id"]): "D"},
    )

    assert _mistake(client, questions[0]["id"]) is None


def test_mistakes_only_include_wrong_questions(client) -> None:
    doc_id, questions = _doc(client)
    for q in questions:
        q["document_id"] = doc_id
    _miss(client, questions)
    items = client.get("/api/review/mistakes").json()
    assert all(item["question_id"] != questions[1]["id"] for item in items)


def test_starred_questions_and_ids(client) -> None:
    doc_id, questions = _doc(client)
    question_id = questions[0]["id"]

    resp = client.post(f"/api/review/starred/{question_id}")
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"question_id": question_id, "starred": True}

    ids = client.get(f"/api/review/starred/ids?document_id={doc_id}").json()
    assert question_id in ids["question_ids"]

    starred = client.get("/api/review/starred").json()
    item = next(i for i in starred if i["question_id"] == question_id)
    assert item["starred"] is True
    assert item["document_title"] == "Mini Bank"
    assert item["is_correct"] is None             # never attempted
    assert item["analyses"] == []

    assert client.delete(f"/api/review/starred/{question_id}").status_code == 200
    assert question_id not in client.get(
        f"/api/review/starred/ids?document_id={doc_id}"
    ).json()["question_ids"]


def test_starred_items_include_saved_analyses(client) -> None:
    doc_id, questions = _doc(client)
    question_id = questions[0]["id"]
    client.post(f"/api/review/starred/{question_id}")
    saved = client.put(
        f"/api/documents/{doc_id}/analysis/{question_id}",
        json={"content": "Why B: the contrast turns at *but*."},
    )
    assert saved.status_code == 200, saved.text

    item = next(
        i
        for i in client.get("/api/review/starred").json()
        if i["question_id"] == question_id
    )
    assert item["analysis"] == "Why B: the contrast turns at *but*."
    assert item["analyses"][0]["content"] == item["analysis"]
    assert item["analyses"][0]["source"] == "page"


def test_multiple_analyses_are_all_returned(client) -> None:
    doc_id, questions = _doc(client)
    question_id = questions[0]["id"]
    client.post(f"/api/review/starred/{question_id}")
    client.put(
        f"/api/documents/{doc_id}/analysis/{question_id}",
        json={"content": "Current page analysis."},
    )
    with db() as conn:
        conn.execute(
            "INSERT INTO analyses (question_id, content) VALUES (?, ?)",
            (question_id, "Legacy analysis one."),
        )
        conn.execute(
            "INSERT INTO analyses (question_id, content) VALUES (?, ?)",
            (question_id, "Legacy analysis two."),
        )

    item = next(
        i
        for i in client.get("/api/review/starred").json()
        if i["question_id"] == question_id
    )
    contents = [a["content"] for a in item["analyses"]]
    assert item["analysis"] == "Current page analysis."
    assert "Legacy analysis one." in contents
    assert "Legacy analysis two." in contents


def test_deleting_a_document_removes_its_stars(client) -> None:
    doc_id, questions = _doc(client)
    question_id = questions[0]["id"]
    client.post(f"/api/review/starred/{question_id}")
    assert client.delete(f"/api/documents/{doc_id}").status_code == 200
    assert question_id not in [
        item["question_id"] for item in client.get("/api/review/starred").json()
    ]


def test_unknown_questions_are_rejected(client) -> None:
    assert client.post("/api/review/starred/999999").status_code == 404
    assert client.delete("/api/review/starred/999999").status_code == 404
