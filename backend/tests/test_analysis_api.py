"""Analysis notebook API: one page per question, saved locally, exported.

Also covers the Sessions page endpoints (list / delete) and the cover-page
display name, since all three were added together.
"""

from __future__ import annotations

from tests.conftest import MINI_IFMD, upload

BLANK_IFMD = """---
ifmd: 1
title: "Blank Bank"
source: "blank.md"
lang: en
answers: none
---

:::q {#Q001 sec=rw no=1}
@stem
The author's tone is best described as ___.

! answer: cautiously optimistic | hopeful
:::

:::q {#Q002 sec=math no=2 multi=1}
@stem
Which values satisfy $x^2 = 4$?

- A. 2
- B. -2
- C. 3
- D. 4

! answer: A, B
:::
"""


def _import(client, name: str = "mini.ifmd.md", text: str = MINI_IFMD) -> int:
    resp = upload(client, name, text)
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def _question_ids(client, doc_id: int) -> list[int]:
    return [q["id"] for q in client.get(f"/api/documents/{doc_id}/questions").json()]


def test_analysis_lists_one_page_per_question(client) -> None:
    doc_id = _import(client)
    ids = _question_ids(client, doc_id)

    body = client.get(f"/api/documents/{doc_id}/analysis").json()
    assert body["document_id"] == doc_id
    assert [p["question_id"] for p in body["pages"]] == ids
    assert [p["position"] for p in body["pages"]] == [0, 1]
    assert all(p["content"] == "" for p in body["pages"])


def test_analysis_page_round_trip(client) -> None:
    doc_id = _import(client)
    qid = _question_ids(client, doc_id)[0]

    saved = client.put(
        f"/api/documents/{doc_id}/analysis/{qid}",
        json={"content": "## Why B\n\nBecause **two** completes it."},
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["content"].startswith("## Why B")

    fetched = client.get(f"/api/documents/{doc_id}/analysis/{qid}").json()
    assert fetched["content"].startswith("## Why B")

    # the notebook view reflects the saved page, the other one stays empty
    pages = client.get(f"/api/documents/{doc_id}/analysis").json()["pages"]
    assert pages[0]["content"].startswith("## Why B")
    assert pages[1]["content"] == ""


def test_analysis_page_is_per_question(client) -> None:
    """Saving Q1 must never leak into Q2 — one page per question."""
    doc_id = _import(client)
    first, second = _question_ids(client, doc_id)

    client.put(f"/api/documents/{doc_id}/analysis/{first}", json={"content": "first"})
    client.put(f"/api/documents/{doc_id}/analysis/{second}", json={"content": "second"})

    assert client.get(f"/api/documents/{doc_id}/analysis/{first}").json()["content"] == "first"
    assert client.get(f"/api/documents/{doc_id}/analysis/{second}").json()["content"] == "second"


def test_analysis_delete_clears_the_page(client) -> None:
    doc_id = _import(client)
    qid = _question_ids(client, doc_id)[0]
    client.put(f"/api/documents/{doc_id}/analysis/{qid}", json={"content": "text"})

    resp = client.delete(f"/api/documents/{doc_id}/analysis/{qid}")
    assert resp.status_code == 200
    assert client.get(f"/api/documents/{doc_id}/analysis/{qid}").json()["content"] == ""
    assert client.delete(f"/api/documents/{doc_id}/analysis/{qid}").status_code == 404


def test_analysis_unknown_ids(client) -> None:
    doc_id = _import(client)
    assert client.get(f"/api/documents/{doc_id}/analysis/99999").status_code == 404
    assert client.get("/api/documents/99999/analysis").status_code == 404
    assert (
        client.put(f"/api/documents/{doc_id}/analysis/99999", json={"content": "x"}).status_code
        == 404
    )


def test_legacy_explain_is_migrated_into_the_page(client) -> None:
    doc_id = _import(client)
    qid = _question_ids(client, doc_id)[0]
    client.put(f"/api/documents/{doc_id}/questions/{qid}/explain", json={"content": "old note"})

    page = client.get(f"/api/documents/{doc_id}/analysis/{qid}").json()
    assert page["content"] == "old note"
    assert page["id"] is None            # not persisted until the user saves


def test_analysis_meta_carries_the_display_name(client) -> None:
    doc_id = _import(client)
    body = client.put(f"/api/documents/{doc_id}/analysis-meta", json={"name": "Alex"}).json()
    assert body["user_name"] == "Alex"
    assert client.get("/api/settings").json()["user_name"] == "Alex"


def test_analysis_export_keeps_a_copy_and_reports_the_path(client) -> None:
    doc_id = _import(client)
    qid = _question_ids(client, doc_id)[0]
    client.put(f"/api/documents/{doc_id}/analysis/{qid}", json={"content": "my analysis"})

    resp = client.get(f"/api/documents/{doc_id}/analysis/export/md")
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"].startswith("text/markdown")
    path = resp.headers["X-Export-Path"]
    assert path.endswith("-analysis.md")

    from pathlib import Path

    assert Path(path).is_file()
    text = Path(path).read_text(encoding="utf-8")
    assert "my analysis" in text
    assert "# Mini Bank" in text


def test_analysis_export_rejects_unknown_format(client) -> None:
    doc_id = _import(client)
    assert client.get(f"/api/documents/{doc_id}/analysis/export/xlsx").status_code == 400


def test_analysis_export_can_keep_only_analyzed_questions(client) -> None:
    """The in-app notebook preview exports only questions that have a page."""
    doc_id = _import(client)
    first, second = _question_ids(client, doc_id)
    client.put(f"/api/documents/{doc_id}/analysis/{first}", json={"content": "page one"})

    full = client.get(f"/api/documents/{doc_id}/analysis/export/md").text
    assert "Which choice best completes the sentence?" in full
    assert "What is the value of" in full

    only = client.get(
        f"/api/documents/{doc_id}/analysis/export/md", params={"only_analyzed": "true"}
    ).text
    assert "Which choice best completes the sentence?" in only
    assert "What is the value of" not in only
    assert "page one" in only
    assert first != second


# --------------------------------------------------------------------------
# sessions list / delete (the Sessions page)
# --------------------------------------------------------------------------


def test_sessions_list_and_delete(client) -> None:
    doc_id = _import(client)
    start = client.post("/api/sessions", json={"document_id": doc_id}).json()
    session_id = start["session_id"]
    first = str(start["questions"][0]["id"])
    client.post(f"/api/sessions/{session_id}/submit", json={"answers": {first: "A"}})

    rows = client.get("/api/sessions").json()
    assert any(r["session_id"] == session_id for r in rows)
    row = next(r for r in rows if r["session_id"] == session_id)
    assert row["document_id"] == doc_id
    assert row["document_title"] == "Mini Bank"
    assert row["answered"] == 2

    assert client.delete(f"/api/sessions/{session_id}").status_code == 200
    assert all(r["session_id"] != session_id for r in client.get("/api/sessions").json())
    assert client.delete(f"/api/sessions/{session_id}").status_code == 404


def test_starting_an_exam_does_not_record_an_attempt(client) -> None:
    """Opening practice creates a session row, but only submit makes an attempt."""
    doc_id = _import(client)
    start = client.post("/api/sessions", json={"document_id": doc_id}).json()
    session_id = start["session_id"]

    # Merely starting never shows up...
    assert all(r["session_id"] != session_id for r in client.get("/api/sessions").json())
    assert all(
        h["session_id"] != session_id
        for h in client.get(f"/api/documents/{doc_id}/history").json()
    )

    # ...until the attempt is actually submitted.
    first = str(start["questions"][0]["id"])
    client.post(f"/api/sessions/{session_id}/submit", json={"answers": {first: "A"}})
    assert any(r["session_id"] == session_id for r in client.get("/api/sessions").json())
    assert any(
        h["session_id"] == session_id
        for h in client.get(f"/api/documents/{doc_id}/history").json()
    )


# --------------------------------------------------------------------------
# blank / multi answers
# --------------------------------------------------------------------------


def test_blank_and_multi_answers_round_trip(client) -> None:
    doc_id = _import(client, "blank.ifmd.md", BLANK_IFMD)
    questions = client.get(f"/api/documents/{doc_id}/questions").json()

    assert questions[0]["kind"] == "blank"
    assert questions[0]["options"] == []
    assert questions[0]["answers"] == ["cautiously optimistic", "hopeful"]
    assert questions[1]["kind"] == "choice"
    assert questions[1]["multi"] is True
    assert questions[1]["answers"] == ["A", "B"]


def test_blank_answer_grading_is_forgiving(client) -> None:
    doc_id = _import(client, "blank.ifmd.md", BLANK_IFMD)
    start = client.post("/api/sessions", json={"document_id": doc_id}).json()
    ids = [q["id"] for q in start["questions"]]

    result = client.post(
        f"/api/sessions/{start['session_id']}/submit",
        json={
            "answers": {
                str(ids[0]): "  Hopeful ",
                str(ids[1]): ["B", "A"],
            }
        },
    ).json()

    assert result["graded"] == 2
    assert result["correct"] == 2
    assert [i["chosen_answers"] for i in result["items"]] == [["  Hopeful "], ["B", "A"]]


def test_multi_answer_requires_every_letter(client) -> None:
    doc_id = _import(client, "blank.ifmd.md", BLANK_IFMD)
    start = client.post("/api/sessions", json={"document_id": doc_id}).json()
    ids = [q["id"] for q in start["questions"]]

    result = client.post(
        f"/api/sessions/{start['session_id']}/submit",
        json={"answers": {str(ids[1]): ["A"]}},
    ).json()

    assert result["items"][1]["is_correct"] is False


def test_answer_key_accepts_several_blank_spellings(client) -> None:
    doc_id = _import(client, "blank.ifmd.md", BLANK_IFMD)
    resp = client.put(
        f"/api/documents/{doc_id}/answers",
        json={"answers": {"Q001": ["cautiously optimistic", "optimistic"], "Q002": ["A", "B"]}},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["answered_count"] == 2


def test_answer_key_rejects_two_letters_on_a_single_answer(client) -> None:
    doc_id = _import(client)
    resp = client.put(
        f"/api/documents/{doc_id}/answers",
        json={"answers": {"Q001": ["A", "B"]}},
    )
    assert resp.status_code == 400
    assert "multi" in resp.json()["detail"]


def test_answer_key_rejects_empty_blank(client) -> None:
    doc_id = _import(client, "blank.ifmd.md", BLANK_IFMD)
    resp = client.put(
        f"/api/documents/{doc_id}/answers",
        json={"answers": {"Q001": ["   "]}},
    )
    assert resp.status_code == 400
