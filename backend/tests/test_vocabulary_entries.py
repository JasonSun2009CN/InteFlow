"""Structured vocabulary entries + drag-to-vocabulary sense selection."""

from __future__ import annotations

import pytest

from app import dictionary, llm, vocab_assist
from app.repos import words as words_repo
from tests.conftest import MINI_IFMD, upload

DEFINITIONS = [
    {
        "id": 11,
        "headword": "elate",
        "definition": "v.\nFunction: verb\n: to fill with joy or pride",
    },
    {
        "id": 12,
        "headword": "elate",
        "definition": "adj.\nFunction: adjective\n: elated; in high spirits",
    },
]


def _doc(client) -> tuple[int, list[dict]]:
    resp = upload(client, "mini.ifmd.md", MINI_IFMD)
    assert resp.status_code == 200, resp.text
    doc_id = resp.json()["id"]
    questions = client.get(f"/api/documents/{doc_id}/questions").json()
    return doc_id, questions


def _cells_by_name(grid: dict, row: dict) -> dict[str, str]:
    names = {column["id"]: column["name"] for column in grid["columns"]}
    return {names[key]: value for key, value in row["cells"].items()}


# --------------------------------------------------------------------------
# repo
# --------------------------------------------------------------------------


def test_add_entry_creates_standard_columns_and_deduplicates(client) -> None:
    doc_id, _ = _doc(client)

    first = words_repo.add_entry(
        doc_id,
        word="elate",
        pos="v.",
        meaning="to fill with joy",
        context="The victory elated the team.",
        source="elate",
        question_no=1,
    )
    columns = [column["name"] for column in first["grid"]["columns"]]
    assert columns == ["Word", "POS", "Meaning", "Notes"]
    assert first["created"] is True
    cells = _cells_by_name(first["grid"], first["row"])
    assert cells["Word"] == "elate"
    assert cells["POS"] == "v."
    assert cells["Meaning"] == "to fill with joy"
    assert cells["Notes"].startswith("Q1 · MW: elate")

    # Re-adding fills only empty cells and appends new context; no duplicate row.
    second = words_repo.add_entry(
        doc_id, word="Elate", meaning="to make proud", notes="second encounter"
    )
    assert second["created"] is False
    assert len(second["grid"]["rows"]) == 1
    cells = _cells_by_name(second["grid"], second["row"])
    assert cells["Meaning"] == "to fill with joy"          # existing value kept
    assert "second encounter" in cells["Notes"]


def test_add_entry_into_a_custom_grid_uses_name_mapping(client) -> None:
    doc_id, _ = _doc(client)
    client.put(
        f"/api/documents/{doc_id}/words",
        json={
            "columns": [
                {"name": "Term", "width": 200},
                {"name": "Definition", "width": 300},
            ],
            "rows": [],
        },
    )

    result = words_repo.add_entry(
        doc_id,
        word="abate",
        pos="v.",
        meaning="to lessen",
        context="The storm abated by noon.",
        source="abate",
        question_no=2,
    )
    names = [column["name"] for column in result["grid"]["columns"]]
    assert names == ["Term", "POS", "Definition", "Notes"]
    cells = _cells_by_name(result["grid"], result["row"])
    assert cells["Term"] == "abate"
    assert cells["Definition"] == "to lessen"
    assert cells["Notes"].startswith("Q2 · MW: abate")


def test_update_and_delete_entry(client) -> None:
    doc_id, _ = _doc(client)
    added = words_repo.add_entry(doc_id, word="abate")

    updated = words_repo.update_entry(
        doc_id, added["row_id"], {"pos": "v.", "meaning": "to lessen"}
    )
    cells = _cells_by_name(updated["grid"], updated["row"])
    assert cells["POS"] == "v."
    assert cells["Meaning"] == "to lessen"

    with pytest.raises(words_repo.GridError):
        words_repo.update_entry(doc_id, added["row_id"], {"word": "  "})
    with pytest.raises(words_repo.EntryNotFound):
        words_repo.update_entry(doc_id, "nope", {"word": "x"})
    with pytest.raises(words_repo.EntryNotFound):
        words_repo.delete_entry(doc_id, "nope")

    words_repo.delete_entry(doc_id, added["row_id"])
    assert words_repo.get_grid(doc_id)["rows"] == []


# --------------------------------------------------------------------------
# API
# --------------------------------------------------------------------------


def test_entry_api_crud(client) -> None:
    doc_id, questions = _doc(client)
    qno = questions[0]["no"]

    created = client.post(
        f"/api/documents/{doc_id}/words/entries",
        json={
            "word": "elate",
            "pos": "v.",
            "meaning": "to fill with joy",
            "context": "The result elated the researchers.",
            "question_no": qno,
        },
    )
    assert created.status_code == 200, created.text
    body = created.json()
    row_id = body["row_id"]
    assert body["created"] is True

    patched = client.patch(
        f"/api/documents/{doc_id}/words/entries/{row_id}",
        json={"notes": "SAT favourite"},
    )
    assert patched.status_code == 200, patched.text
    names = [c["name"] for c in patched.json()["grid"]["columns"]]
    assert names == ["Word", "POS", "Meaning", "Notes"]
    notes_col = next(c["id"] for c in patched.json()["grid"]["columns"] if c["name"] == "Notes")
    assert patched.json()["row"]["cells"][notes_col] == "SAT favourite"

    missing = client.patch(
        f"/api/documents/{doc_id}/words/entries/nope", json={"word": "x"}
    )
    assert missing.status_code == 404

    deleted = client.delete(f"/api/documents/{doc_id}/words/entries/{row_id}")
    assert deleted.status_code == 200
    assert deleted.json()["deleted"] == 1
    assert client.delete(f"/api/documents/{doc_id}/words/entries/{row_id}").status_code == 404


def test_entry_api_unknown_document(client) -> None:
    assert client.post(
        "/api/documents/999999/words/entries", json={"word": "x"}
    ).status_code == 404
    assert client.patch(
        "/api/documents/999999/words/entries/r1", json={"word": "x"}
    ).status_code == 404
    assert client.delete("/api/documents/999999/words/entries/r1").status_code == 404


def test_vocabulary_overview(client) -> None:
    doc_id, _ = _doc(client)
    words_repo.add_entry(doc_id, word="abate", meaning="to lessen")
    words_repo.add_entry(doc_id, word="elate", meaning="to lift")

    overview = client.get("/api/vocabulary").json()
    mine = next(d for d in overview["documents"] if d["document_id"] == doc_id)
    assert mine["word_count"] == 2
    assert mine["preview"] == ["abate", "elate"]
    assert overview["total_words"] >= 2


# --------------------------------------------------------------------------
# from-selection
# --------------------------------------------------------------------------


def test_from_selection_without_dictionary_still_adds(client, monkeypatch) -> None:
    doc_id, _ = _doc(client)

    monkeypatch.setattr(
        dictionary,
        "status",
        lambda: {"available": False, "indexed": False, "entry_count": 0},
    )

    def missing(_text):
        raise dictionary.DictionaryError("no Merriam-Webster .eudb file was found")

    monkeypatch.setattr(vocab_assist, "candidates_for", missing)

    resp = client.post(
        f"/api/documents/{doc_id}/words/entries/from-selection",
        json={"text": "  \u201celusive\u201d,  "},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["matched"] is False
    assert body["word"] == "elusive"
    assert "Merriam-Webster" in body["warning"]
    assert words_repo.get_grid(doc_id)["rows"][0]["cells"]["c1"] == "elusive"


def test_from_selection_falls_back_to_first_sense_without_ai(
    client, monkeypatch
) -> None:
    doc_id, questions = _doc(client)
    monkeypatch.setattr(vocab_assist, "candidates_for", lambda word: DEFINITIONS)
    monkeypatch.setattr(llm, "configured", lambda: False)

    body = client.post(
        f"/api/documents/{doc_id}/words/entries/from-selection",
        json={
            "text": "elate",
            "question_id": questions[0]["id"],
            "context": "The victory served to elate the whole team.",
        },
    ).json()

    assert body["matched"] is True
    assert body["used_ai"] is False
    assert body["entry_id"] == 11
    assert body["pos"] == "v."
    assert body["definition"] == "to fill with joy or pride"
    assert body["dictionary_word"] == "elate"
    assert body["warning"]

    cells = _cells_by_name(body["grid"], body["row"])
    assert cells["Word"] == "elate"
    assert cells["POS"] == "v."
    assert cells["Meaning"] == "to fill with joy or pride"
    assert "The victory served to elate" in cells["Notes"]


def test_from_selection_uses_ai_chosen_sense(client, monkeypatch) -> None:
    doc_id, _ = _doc(client)
    monkeypatch.setattr(vocab_assist, "candidates_for", lambda word: DEFINITIONS)
    monkeypatch.setattr(llm, "configured", lambda: True)

    captured: dict = {}

    def fake_complete(system: str, messages: list[dict[str, str]]) -> str:
        captured["system"] = system
        captured["user"] = messages[0]["content"]
        return (
            '{"entry_id": 12, "part_of_speech": "adj.", '
            '"definition": "in high spirits", "why": "describes the team"}'
        )

    monkeypatch.setattr(llm, "complete", fake_complete)

    body = client.post(
        f"/api/documents/{doc_id}/words/entries/from-selection",
        json={"text": "elate", "context": "The elate team celebrated."},
    ).json()

    assert body["matched"] is True
    assert body["used_ai"] is True
    assert body["entry_id"] == 12
    assert body["pos"] == "adj."
    assert body["definition"] == "in high spirits"
    assert body["reason"] == "describes the team"
    cells = _cells_by_name(body["grid"], body["row"])
    assert cells["POS"] == "adj."
    assert cells["Meaning"] == "in high spirits"
    assert "[12] elate" in captured["user"]
    assert "Merriam-Webster" in captured["system"]


def test_from_entry_adds_the_chosen_sense_without_ai(client, monkeypatch) -> None:
    doc_id, _ = _doc(client)
    monkeypatch.setattr(
        dictionary,
        "get_entry",
        lambda entry_id: {
            "id": entry_id,
            "headword": "ubiquitous",
            "definition": (
                "adj.\nPronunciation: yü-'bi-kwə-təs\nFunction: adjective\n"
                ": existing or being everywhere at the same time"
            ),
        },
    )

    body = client.post(
        f"/api/documents/{doc_id}/words/entries/from-entry",
        json={"entry_id": 42, "context": "Smartphones are ubiquitous today."},
    ).json()

    assert body["matched"] is True
    assert body["used_ai"] is False
    assert body["entry_id"] == 42
    assert body["pos"] == "adj."
    assert body["definition"] == "existing or being everywhere at the same time"
    cells = _cells_by_name(body["grid"], body["row"])
    assert cells["Word"] == "ubiquitous"
    assert cells["Meaning"] == "existing or being everywhere at the same time"


def test_from_entry_unknown_entry_is_404(client, monkeypatch) -> None:
    doc_id, _ = _doc(client)
    monkeypatch.setattr(dictionary, "get_entry", lambda entry_id: None)
    resp = client.post(
        f"/api/documents/{doc_id}/words/entries/from-entry",
        json={"entry_id": 999},
    )
    assert resp.status_code == 404


def test_from_selection_rejects_empty_text(client) -> None:
    doc_id, _ = _doc(client)
    resp = client.post(
        f"/api/documents/{doc_id}/words/entries/from-selection",
        json={"text": "   ,.  "},
    )
    assert resp.status_code == 400


def test_choose_definition_rejects_invented_entry(monkeypatch) -> None:
    monkeypatch.setattr(llm, "configured", lambda: True)
    monkeypatch.setattr(
        llm, "complete", lambda system, messages: '{"entry_id": 999, "definition": "made up"}'
    )
    choice = vocab_assist.choose_definition("elate", "context", DEFINITIONS)
    assert choice["used_ai"] is False
    assert choice["entry_id"] == 11
    assert "unusable" in choice["warning"]


def test_first_pos_and_sense_handle_real_mw_shapes() -> None:
    definition = (
        "1 v.\nPronunciation: i-'lāt\nFunction: transitive verb\n"
        "Date: circa 1619\n: to fill with joy or pride2elate 2 v.\n"
        "Function: adjective\n: ELATED"
    )
    assert vocab_assist.first_pos(definition) == "v."
    assert vocab_assist.first_sense(definition) == "to fill with joy or pride2elate 2 v."

    # With the nested-homograph newline produced by the parser, the sense ends
    # where the next headword begins.
    parsed = definition.replace("pride2elate", "pride\n2elate")
    assert vocab_assist.first_sense(parsed) == "to fill with joy or pride"
