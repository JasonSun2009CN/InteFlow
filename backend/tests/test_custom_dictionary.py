"""User-managed dictionary: CRUD, import, lookup merge, vocabulary capture."""

from __future__ import annotations

from pathlib import Path

from app import vocab_assist
from app.db import db
from app.repos import settings as settings_repo
from tests.conftest import MINI_IFMD, upload


def _clear_custom() -> None:
    with db() as conn:
        conn.execute("DELETE FROM custom_dictionary_entries WHERE word LIKE 'zz%'")


def _add(client, word: str, definition: str, pos: str = ""):
    resp = client.post(
        "/api/custom-dictionary/entries",
        json={"word": word, "definition": definition, "pos": pos},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_custom_dictionary_crud_and_import(client) -> None:
    _clear_custom()
    try:
        added = _add(client, "zzalpha", "the first test word", "n.")
        assert added["word"] == "zzalpha"
        assert added["definition"] == "the first test word"
        assert added["count"] >= 1

        data = client.get("/api/custom-dictionary", params={"q": "zzalpha"}).json()
        assert data["enabled"] is True
        assert [entry["word"] for entry in data["entries"]] == ["zzalpha"]

        # Re-adding the same word updates it instead of duplicating.
        _add(client, "ZZALPHA", "an updated definition")
        data = client.get("/api/custom-dictionary", params={"q": "zzalpha"}).json()
        assert data["count"] == 1
        assert data["entries"][0]["definition"] == "an updated definition"

        imported = client.post(
            "/api/custom-dictionary/import",
            files={
                "file": (
                    "my-dictionary.csv",
                    b"word,definition,pos\nzzbeta,the second word,adj.\nzzgamma,the third word,\n",
                    "text/csv",
                )
            },
        )
        assert imported.status_code == 200, imported.text
        assert imported.json()["added"] == 2
        assert imported.json()["total"] == 3

        deleted = client.delete(f"/api/custom-dictionary/entries/{added['id']}")
        assert deleted.status_code == 200
        assert deleted.json()["count"] == 2
    finally:
        _clear_custom()


def test_import_rejects_empty_or_invalid_files(client) -> None:
    _clear_custom()
    resp = client.post(
        "/api/custom-dictionary/import",
        files={"file": ("empty.csv", b"", "text/csv")},
    )
    assert resp.status_code == 400
    resp = client.post(
        "/api/custom-dictionary/import",
        files={"file": ("bad.csv", b"word,definition\n,,", "text/csv")},
    )
    assert resp.status_code == 400


def test_custom_lookup_wins_and_falls_back_from_missing_mw(
    client, tmp_path: Path, monkeypatch
) -> None:
    _clear_custom()
    _add(client, "zzmerge", "a user-defined meaning", "n.")
    monkeypatch.setenv("INTEFLOW_DICTIONARY", str(tmp_path / "missing.eudb"))
    monkeypatch.setenv("INTEFLOW_DICTIONARY_INDEX", str(tmp_path / "mw.db"))
    monkeypatch.setattr(settings_repo, "custom_dictionary_enabled", lambda: True)
    try:
        body = client.get("/api/dictionary/lookup", params={"q": "zzmerge"}).json()
        assert body["exact"][0]["headword"] == "zzmerge"
        assert body["exact"][0]["source"] == "custom"
        assert body["exact"][0]["definition"] == "a user-defined meaning"
        assert "Merriam-Webster unavailable" in body["warning"]
    finally:
        _clear_custom()


def test_custom_lookup_can_be_disabled(client, tmp_path: Path, monkeypatch) -> None:
    _clear_custom()
    _add(client, "zzoff", "should not be used")
    monkeypatch.setenv("INTEFLOW_DICTIONARY", str(tmp_path / "missing.eudb"))
    monkeypatch.setenv("INTEFLOW_DICTIONARY_INDEX", str(tmp_path / "mw.db"))
    monkeypatch.setattr(settings_repo, "custom_dictionary_enabled", lambda: False)
    try:
        assert (
            client.get("/api/dictionary/lookup", params={"q": "zzoff"}).status_code
            == 409
        )
    finally:
        _clear_custom()


def test_custom_entry_can_be_added_to_a_word_list(client) -> None:
    _clear_custom()
    try:
        entry = _add(client, "zzcapture", "to capture from my own dictionary", "v.")
        doc = upload(client, "mini.ifmd.md", MINI_IFMD)
        assert doc.status_code == 200, doc.text
        doc_id = doc.json()["id"]

        resp = client.post(
            f"/api/documents/{doc_id}/words/entries/from-entry",
            json={"entry_id": entry["id"], "source": "custom"},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["word"] == "zzcapture"
        assert body["definition"] == "to capture from my own dictionary"
        assert body["source"] == "custom"
    finally:
        _clear_custom()


def test_custom_candidates_are_offered_to_drag_to_vocabulary(
    client, tmp_path: Path, monkeypatch
) -> None:
    _clear_custom()
    _add(client, "zzcandidate", "a user candidate", "n.")
    monkeypatch.setenv("INTEFLOW_DICTIONARY", str(tmp_path / "missing.eudb"))
    monkeypatch.setenv("INTEFLOW_DICTIONARY_INDEX", str(tmp_path / "mw.db"))
    monkeypatch.setattr(settings_repo, "custom_dictionary_enabled", lambda: True)
    try:
        candidates = vocab_assist.candidates_for("zzcandidate")
        assert candidates[0]["source"] == "custom"
        assert candidates[0]["id"].startswith("custom:")
        choice = vocab_assist.choose_definition(
            "zzcandidate", "zzcandidate", candidates, use_ai=False
        )
        assert choice["definition"] == "a user candidate"
    finally:
        _clear_custom()
