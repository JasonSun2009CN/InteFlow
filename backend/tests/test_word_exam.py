"""Word exams: deterministic build/grade plus optional, strict AI grading."""

from __future__ import annotations

import pytest

from app import dictionary, llm, word_exam
from app.repos import settings as settings_repo
from app.repos import words as words_repo
from tests.conftest import MINI_IFMD, upload


@pytest.fixture(autouse=True)
def ai_grading_off() -> None:
    settings_repo.set_values({"vocab_exam_ai_grading": "0"})


@pytest.fixture(autouse=True)
def isolated_dictionary(monkeypatch, tmp_path) -> None:
    """Never build the real Merriam-Webster index while running these tests."""
    monkeypatch.setenv("INTEFLOW_DICTIONARY", str(tmp_path / "missing.eudb"))
    monkeypatch.setenv("INTEFLOW_DICTIONARY_INDEX", str(tmp_path / "mw.db"))


def _doc(client) -> int:
    resp = upload(client, "mini.ifmd.md", MINI_IFMD)
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def _words(client, meanings: bool = True) -> tuple[int, dict[str, str]]:
    doc_id = _doc(client)
    rows: dict[str, str] = {}
    for word, meaning, pos in (
        ("elate", "to fill with joy", "v."),
        ("abate", "to become less", "v."),
        ("lucid", "clear and easy to understand", "adj."),
    ):
        result = words_repo.add_entry(
            doc_id,
            word=word,
            meaning=meaning if meanings else "",
            pos=pos,
        )
        rows[word] = result["row_id"]
    return doc_id, rows


def _grade(client, doc_id: int, mode: str, answers: list[tuple[str, str]]) -> dict:
    resp = client.post(
        f"/api/documents/{doc_id}/word-exam/grade",
        json={
            "mode": mode,
            "items": [{"row_id": row_id, "response": value} for row_id, value in answers],
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


# --------------------------------------------------------------------------
# building an exam
# --------------------------------------------------------------------------


def test_build_exam_without_leaking_answers(client) -> None:
    doc_id, _rows = _words(client)

    exam = client.post(
        f"/api/documents/{doc_id}/word-exam",
        json={"mode": "en-zh", "count": 2},
    ).json()

    assert exam["mode"] == "en-zh"
    assert exam["count"] == 2
    assert len(exam["questions"]) == 2
    assert {q["prompt"] for q in exam["questions"]} <= {"elate", "abate", "lucid"}
    assert all(q["prompt_source"] == "word" for q in exam["questions"])
    assert all("answer" not in q and "meaning" not in q and "word" not in q for q in exam["questions"])
    assert exam["scope"]["positions"] == [q["position"] for q in exam["questions"]]
    assert exam["scope"]["all"] is False
    assert exam["ai_grading"] is False


def test_build_all_uses_every_eligible_word(client) -> None:
    doc_id, _rows = _words(client)
    exam = client.post(
        f"/api/documents/{doc_id}/word-exam",
        json={"mode": "zh-en", "count": None},
    ).json()

    assert exam["count"] == 3
    assert exam["scope"]["all"] is True
    assert all(q["prompt_source"] == "list" for q in exam["questions"])
    assert {q["prompt"] for q in exam["questions"]} == {
        "to fill with joy",
        "to become less",
        "clear and easy to understand",
    }


def test_build_exam_uses_dictionary_when_meaning_is_empty(client, monkeypatch) -> None:
    doc_id, _rows = _words(client, meanings=False)
    monkeypatch.setattr(
        word_exam.dictionary,
        "status",
        lambda kind="standard": {"available": False},
    )
    monkeypatch.setattr(
        word_exam.dictionary,
        "lookup",
        lambda word, **kwargs: {
            "exact": [
                {
                    "id": 1,
                    "headword": word,
                    "definition": "v.\nFunction: verb\n: to become less",
                }
            ],
            "matches": [],
            "source": "standard",
        },
    )

    exam = client.post(
        f"/api/documents/{doc_id}/word-exam",
        json={"mode": "zh-en", "count": 1},
    ).json()

    assert exam["count"] == 1
    assert exam["questions"][0]["prompt"] == "to become less"
    assert exam["questions"][0]["prompt_source"] == "dictionary"


def test_build_exam_reports_words_it_cannot_use(client, monkeypatch) -> None:
    doc_id, _rows = _words(client, meanings=False)
    monkeypatch.setattr(
        word_exam.dictionary,
        "status",
        lambda kind="standard": {"available": False},
    )
    monkeypatch.setattr(
        word_exam.dictionary,
        "lookup",
        lambda word, **kwargs: {"exact": [], "matches": [], "source": "standard"},
    )

    resp = client.post(
        f"/api/documents/{doc_id}/word-exam",
        json={"mode": "zh-en", "count": None},
    )
    assert resp.status_code == 400
    assert "meaning" in resp.json()["detail"]


def test_build_exam_rejects_an_empty_list(client) -> None:
    doc_id = _doc(client)
    resp = client.post(
        f"/api/documents/{doc_id}/word-exam", json={"mode": "en-zh"}
    )
    assert resp.status_code == 400
    assert "empty" in resp.json()["detail"]


def test_build_exam_validates_mode_and_count(client) -> None:
    doc_id, _rows = _words(client)
    assert client.post(
        f"/api/documents/{doc_id}/word-exam", json={"mode": "fr-en"}
    ).status_code == 400
    assert client.post(
        f"/api/documents/{doc_id}/word-exam", json={"mode": "en-zh", "count": 0}
    ).status_code == 400
    assert client.post(
        "/api/documents/999999/word-exam", json={"mode": "en-zh"}
    ).status_code == 404


# --------------------------------------------------------------------------
# local grading
# --------------------------------------------------------------------------


def test_spelling_grade_is_case_and_punctuation_insensitive(client) -> None:
    doc_id, rows = _words(client)
    body = _grade(
        client,
        doc_id,
        "zh-en",
        [
            (rows["elate"], "  ELATE "),
            (rows["abate"], "aba-te"),
            (rows["lucid"], "lucidity"),
        ],
    )

    assert body["total"] == 3
    assert body["correct"] == 2
    assert body["accuracy"] == 66.7
    assert [item["method"] for item in body["items"]] == ["spelling"] * 3
    assert [item["is_correct"] for item in body["items"]] == [True, True, False]


def test_word_cell_can_list_several_accepted_spellings(client) -> None:
    doc_id = _doc(client)
    added = words_repo.add_entry(
        doc_id, word="abate; abase", meaning="to become less", pos="v."
    )
    body = _grade(
        client, doc_id, "zh-en", [(added["row_id"], "ABASE")]
    )
    assert body["items"][0]["is_correct"] is True


def test_meaning_grade_is_lenient_but_rejects_generic_answers(client) -> None:
    doc_id, rows = _words(client)
    body = _grade(
        client,
        doc_id,
        "en-zh",
        [
            (rows["elate"], "to fill with joy"),
            (rows["abate"], "to become less"),
            (rows["lucid"], "joy"),
        ],
    )

    assert [item["is_correct"] for item in body["items"]] == [True, True, False]
    assert body["items"][0]["method"] == "lenient"

    # The same segment/substring rules work for Chinese meanings.
    doc_id2 = _doc(client)
    chinese = words_repo.add_entry(
        doc_id2, word="elate", meaning="使高兴", pos="v."
    )
    chinese_body = _grade(
        client, doc_id2, "en-zh", [(chinese["row_id"], "高兴")]
    )
    assert chinese_body["items"][0]["is_correct"] is True


def test_grade_rejects_unknown_or_duplicate_rows(client) -> None:
    doc_id, rows = _words(client)
    assert client.post(
        f"/api/documents/{doc_id}/word-exam/grade",
        json={"mode": "en-zh", "items": [{"row_id": "nope", "response": "x"}]},
    ).status_code == 400
    assert client.post(
        f"/api/documents/{doc_id}/word-exam/grade",
        json={
            "mode": "en-zh",
            "items": [
                {"row_id": rows["elate"], "response": "x"},
                {"row_id": rows["elate"], "response": "y"},
            ],
        },
    ).status_code == 400
    assert client.post(
        f"/api/documents/{doc_id}/word-exam/grade",
        json={"mode": "en-zh", "items": []},
    ).status_code == 400
    assert client.post(
        "/api/documents/999999/word-exam/grade",
        json={"mode": "en-zh", "items": [{"row_id": "r1", "response": "x"}]},
    ).status_code == 404


# --------------------------------------------------------------------------
# AI grading
# --------------------------------------------------------------------------


def test_ai_grading_overrides_local_results_and_gets_references(
    client, monkeypatch
) -> None:
    doc_id, rows = _words(client)
    settings_repo.set_values({"vocab_exam_ai_grading": "1"})
    monkeypatch.setattr(word_exam.llm, "configured", lambda: True)
    monkeypatch.setattr(
        word_exam,
        "_dictionary_reference",
        lambda word, cache: {
            "id": 1,
            "headword": word,
            "definition": "v.\nFunction: verb\n: to fill with joy",
            "sense": "to fill with joy",
            "pos": "v.",
            "source": "standard",
        },
    )
    captured: dict[str, str] = {}

    def fake_complete(system: str, messages: list[dict[str, str]]) -> str:
        captured["system"] = system
        captured["user"] = messages[0]["content"]
        return (
            '{"results":[{"id":0,"correct":false,"reason":"too vague"},'
            '{"id":1,"correct":true,"reason":"exact"}]}'
        )

    monkeypatch.setattr(word_exam.llm, "complete", fake_complete)

    body = _grade(
        client,
        doc_id,
        "en-zh",
        [(rows["elate"], "joy"), (rows["abate"], "to become less")],
    )

    assert body["ai_requested"] is True
    assert body["ai_available"] is True
    assert body["ai_grading"] is True
    assert body["correct"] == 1
    assert [item["method"] for item in body["items"]] == ["ai", "ai"]
    assert body["items"][0]["is_correct"] is False
    assert body["items"][0]["reason"] == "too vague"
    assert "strict vocabulary examiner" in captured["system"]
    assert "to fill with joy" in captured["user"]
    assert "Merriam-Webster" in captured["user"]


def test_ai_grading_can_judge_spelling(client, monkeypatch) -> None:
    doc_id, rows = _words(client)
    settings_repo.set_values({"vocab_exam_ai_grading": "1"})
    monkeypatch.setattr(word_exam.llm, "configured", lambda: True)
    monkeypatch.setattr(
        word_exam.llm,
        "complete",
        lambda system, messages: (
            '{"results":[{"id":0,"correct":true,"reason":"minor typo"}]}'
        ),
    )

    body = _grade(client, doc_id, "zh-en", [(rows["elate"], "elat")])
    assert body["items"][0]["is_correct"] is True
    assert body["items"][0]["method"] == "ai"


def test_ai_grading_is_off_by_default(client, monkeypatch) -> None:
    doc_id, rows = _words(client)
    monkeypatch.setattr(word_exam.llm, "configured", lambda: True)

    def must_not_call(*args, **kwargs):
        raise AssertionError("AI must not be called when AI grading is off")

    monkeypatch.setattr(word_exam.llm, "complete", must_not_call)
    body = _grade(client, doc_id, "en-zh", [(rows["elate"], "to fill with joy")])
    assert body["ai_requested"] is False
    assert body["ai_grading"] is False
    assert body["items"][0]["method"] == "lenient"


def test_ai_grading_failure_falls_back_to_local(client, monkeypatch) -> None:
    doc_id, rows = _words(client)
    settings_repo.set_values({"vocab_exam_ai_grading": "1"})
    monkeypatch.setattr(word_exam.llm, "configured", lambda: True)

    def broken(*args, **kwargs):
        raise llm.LLMError("network down")

    monkeypatch.setattr(word_exam.llm, "complete", broken)
    body = _grade(client, doc_id, "en-zh", [(rows["elate"], "to fill with joy")])

    assert body["ai_grading"] is False
    assert body["items"][0]["is_correct"] is True
    assert "local grading was used" in body["warning"]


def test_ai_grading_without_a_key_warns_and_uses_local(client, monkeypatch) -> None:
    doc_id, rows = _words(client)
    settings_repo.set_values({"vocab_exam_ai_grading": "1"})
    monkeypatch.setattr(word_exam.llm, "configured", lambda: False)

    body = _grade(client, doc_id, "en-zh", [(rows["elate"], "to fill with joy")])
    assert body["ai_grading"] is False
    assert "no model is configured" in body["warning"]


def test_ai_grading_invalid_json_falls_back(client, monkeypatch) -> None:
    doc_id, rows = _words(client)
    settings_repo.set_values({"vocab_exam_ai_grading": "1"})
    monkeypatch.setattr(word_exam.llm, "configured", lambda: True)
    monkeypatch.setattr(
        word_exam.llm, "complete", lambda system, messages: "not json"
    )
    body = _grade(client, doc_id, "en-zh", [(rows["elate"], "to fill with joy")])
    assert body["ai_grading"] is False
    assert "unusable" in body["warning"]
    assert body["items"][0]["is_correct"] is True


# --------------------------------------------------------------------------
# settings + grid helpers
# --------------------------------------------------------------------------


def test_ai_grading_setting_defaults_off_and_roundtrips(client) -> None:
    body = client.get("/api/settings").json()
    assert body["vocab_exam_ai_grading"] is False

    saved = client.put(
        "/api/settings", json={"vocab_exam_ai_grading": True}
    ).json()
    assert saved["vocab_exam_ai_grading"] is True
    assert client.get("/api/settings").json()["vocab_exam_ai_grading"] is True


def test_words_entries_keep_the_full_grid_position(client) -> None:
    doc_id = _doc(client)
    first = words_repo.add_entry(doc_id, word="elate", meaning="to fill with joy")
    # Insert a blank row before the second word to prove positions count it.
    grid = words_repo.get_grid(doc_id)
    grid["rows"].insert(
        0, {"id": "blank", "cells": {column["id"]: "" for column in grid["columns"]}}
    )
    words_repo.save_grid(doc_id, grid)
    second = words_repo.add_entry(doc_id, word="abate", meaning="to become less")

    entries = {entry["word"]: entry for entry in words_repo.entries(doc_id)}
    assert entries["elate"]["position"] == 2
    assert entries["abate"]["position"] == 3
    assert entries["elate"]["row_id"] == first["row_id"]
    assert entries["abate"]["row_id"] == second["row_id"]
