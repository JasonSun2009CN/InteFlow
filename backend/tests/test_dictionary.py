"""Local Merriam-Webster dictionary: container parser, index, lookup API."""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

import pytest

from app import dictionary
from app.dictionary import eudb, store

SEPARATOR = eudb.SEPARATOR


def _entry(headword: str, body: str) -> bytes:
    return f"<B>{headword}</B><DIV>{body}</DIV></DIV>".encode("utf-8")


def build_eudb(
    path: Path,
    entries: list[tuple[str, str]],
    *,
    title: str = "Test Webster",
    author: str = "Test Author",
) -> Path:
    """Write a minimal but structurally valid ``.eudb`` container."""
    meta = (
        f"<title>{title}</title><author>{author}</author>"
    ).encode("utf-8")
    blocks = [
        zlib.compress(_entry(headword, body) + (SEPARATOR if i < len(entries) - 1 else b""))
        for i, (headword, body) in enumerate(entries)
    ]

    prefix = 20 + eudb.PADDING + len(meta) + 4 + len(blocks) * 8
    offsets: list[int] = []
    cursor = prefix
    for block in blocks:
        offsets.append(cursor)
        cursor += len(block)

    out = bytearray()
    out += eudb.MAGIC
    out += struct.pack("<iii", len(meta), 1, 2)
    out += b"\x00\x00"
    out += struct.pack("<I", 1)
    out += b"\x00" * eudb.PADDING
    out += meta
    out += struct.pack("<i", len(blocks))
    out += b"".join(struct.pack("<Q", offset) for offset in offsets)
    out += b"".join(blocks)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(bytes(out))
    return path


@pytest.fixture()
def eudb_file(tmp_path: Path) -> Path:
    return build_eudb(
        tmp_path / "webster.eudb",
        [
            ("u\u00b7biq\u00b7ui\u00b7tous", "adj.<br>Function: adjective<br>: existing everywhere"),
            ("abate", "v.<br>Function: verb<br>: to make less in amount"),
            ("abatement", "n.<br>Function: noun<br>: the act of abating"),
        ],
    )


@pytest.fixture()
def dictionary_env(tmp_path: Path, eudb_file: Path, monkeypatch):
    index = tmp_path / "index" / "mw.db"
    monkeypatch.setenv("INTEFLOW_DICTIONARY", str(eudb_file))
    monkeypatch.setenv("INTEFLOW_DICTIONARY_INDEX", str(index))
    return index


# --------------------------------------------------------------------------
# container parser
# --------------------------------------------------------------------------


def test_parse_header_reads_metadata(eudb_file: Path) -> None:
    meta, count, offsets, size = eudb.parse_header(eudb_file)
    assert meta == {"title": "Test Webster", "author": "Test Author"}
    assert count == 3
    assert len(offsets) == 3
    assert offsets == tuple(sorted(offsets))
    assert offsets[-1] < size


def test_parse_header_rejects_non_eudb(tmp_path: Path) -> None:
    bad = tmp_path / "notes.txt"
    bad.write_text("not a dictionary")
    with pytest.raises(eudb.EudbError):
        eudb.parse_header(bad)


def test_iter_entries_cleans_headwords_and_html(eudb_file: Path) -> None:
    entries = list(eudb.iter_entries(eudb_file))

    assert [entry.headword for entry in entries] == ["ubiquitous", "abate", "abatement"]
    text = eudb.html_to_text(entries[0].body)
    assert "Function: adjective" in text
    assert "existing everywhere" in text
    assert "<" not in text


def test_clean_headword_strips_syllable_dots_and_homograph() -> None:
    raw = "run<sup>1</sup>".encode()
    assert eudb.clean_headword(raw) == "run"
    assert eudb.clean_headword("u\u00b7biq\u00b7ui\u00b7tous".encode()) == "ubiquitous"


def test_html_to_text_splits_nested_homographs() -> None:
    body = (
        b"<B>: </B>to fill with joy or pride"
        b"<DIV><B><SUP>2</SUP>elate</B> 2 <I>v.</I></DIV>"
    )
    text = eudb.html_to_text(body)
    assert "to fill with joy or pride\n" in text
    assert "pride2elate" not in text
    assert "2elate" in text.splitlines()[1]


def test_parse_meta_handles_eudic_prefix(tmp_path: Path) -> None:
    raw = (
        "somedict@A concise dictionary\n\u4f5c\u8005\uff1aSomeone\n"
        "<?xml version=\"1.0\"?><title>XML Title</title>"
    ).encode("utf-8")
    meta = eudb._parse_meta(raw)
    assert meta["title"] == "somedict"
    assert meta["author"] == "Someone"


def test_parse_meta_strips_binary_frame_from_this_edition() -> None:
    raw = (
        b"!\x1d\x08z8\x01\x00\x00\xe9\x9f\xa6\xe6\xb0\x8f\xe5\xa4\xa7\xe5\xad\xa6"
        b"\xe8\xaf\x8d\xe5\x85\xb8@Description text\r\n\r\n"
        b"\xe4\xbd\x9c\xe8\x80\x85\xef\xbc\x9aMerriam-Webster Inc."
        b"\x9f\xb72\x01\x00\x00\x00\x00\x00"
    )
    meta = eudb._parse_meta(raw)
    assert meta["title"] == "\u97e6\u6c0f\u5927\u5b66\u8bcd\u5178"
    assert meta["author"] == "Merriam-Webster Inc."


# --------------------------------------------------------------------------
# index + lookup
# --------------------------------------------------------------------------


def test_normalize_removes_dots_and_case() -> None:
    assert store.normalize("  U\u00b7biq\u00b7ui\u00b7tous. ") == "ubiquitous"
    assert store.normalize("\u201cAbate\u201d") == "abate"


def test_status_before_and_after_index(dictionary_env: Path) -> None:
    before = dictionary.status()
    assert before["available"] is True
    assert before["indexed"] is False
    assert before["entry_count"] == 0

    built = dictionary.ensure_index()
    assert built["indexed"] is True
    assert built["stale"] is False
    assert built["entry_count"] == 3
    assert built["title"] == "Test Webster"
    assert dictionary_env.is_file()


def test_lookup_exact_prefix_and_contains(dictionary_env: Path) -> None:
    result = dictionary.lookup("ubiquitous")
    assert result["entry_count"] == 3
    assert [entry["headword"] for entry in result["exact"]] == ["ubiquitous"]
    assert "existing everywhere" in result["exact"][0]["definition"]

    prefix = dictionary.lookup("abat")
    assert [entry["headword"] for entry in prefix["exact"]] == []
    assert [entry["headword"] for entry in prefix["matches"]][:2] == ["abate", "abatement"]

    partial = dictionary.lookup("quitou")
    assert "ubiquitous" in [entry["headword"] for entry in partial["matches"]]


def test_lookup_rebuilds_a_stale_index(dictionary_env: Path, eudb_file: Path) -> None:
    dictionary.ensure_index()
    before = dictionary.status()
    assert before["stale"] is False

    # Rewrite the source with a different size: the index must be rebuilt.
    build_eudb(eudb_file, [("neoteric", "adj.<br>Function: adjective<br>: recent")])
    assert dictionary.status()["stale"] is True

    result = dictionary.lookup("neoteric")
    assert [entry["headword"] for entry in result["exact"]] == ["neoteric"]
    assert dictionary.status()["entry_count"] == 1


def test_lookup_without_source_raises(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("INTEFLOW_DICTIONARY", str(tmp_path / "missing.eudb"))
    monkeypatch.setenv("INTEFLOW_DICTIONARY_INDEX", str(tmp_path / "mw.db"))
    with pytest.raises(dictionary.DictionaryError):
        dictionary.lookup("abate")


def test_ensure_index_reports_missing_source(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("INTEFLOW_DICTIONARY", str(tmp_path / "missing.eudb"))
    monkeypatch.setenv("INTEFLOW_DICTIONARY_INDEX", str(tmp_path / "mw.db"))
    with pytest.raises(dictionary.DictionaryError, match="no Merriam-Webster"):
        dictionary.ensure_index()


# --------------------------------------------------------------------------
# API
# --------------------------------------------------------------------------


def test_learner_dictionary_has_its_own_index(
    dictionary_env: Path, tmp_path: Path, monkeypatch
) -> None:
    learner = build_eudb(
        tmp_path / "learners" / "advanced-learner.eudb",
        [("abate", "v.<br>Function: verb<br>: to become weaker : decrease")],
        title="Merriam-Webster's Advanced Learner's English Dictionary",
    )
    learner_index = tmp_path / "index" / "learners.db"
    monkeypatch.setenv("INTEFLOW_LEARNER_DICTIONARY", str(learner))
    monkeypatch.setenv("INTEFLOW_LEARNER_DICTIONARY_INDEX", str(learner_index))

    before = dictionary.status("learner")
    assert before["available"] is True
    assert before["indexed"] is False

    result = dictionary.lookup("abate", kind="learner")
    assert result["source"] == "learner"
    assert "become weaker" in result["exact"][0]["definition"]
    assert learner_index.is_file()

    status = dictionary.status("learner")
    assert status["kind"] == "learner"
    assert status["entry_count"] == 1
    assert status["title"].startswith("Merriam-Webster's Advanced")


def test_learner_source_is_optional(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("INTEFLOW_LEARNER_DICTIONARY", str(tmp_path / "missing.eudb"))
    status = dictionary.status("learner")
    assert status["available"] is False
    with pytest.raises(dictionary.DictionaryError, match="learner's dictionary"):
        dictionary.ensure_index(kind="learner")


def test_dictionary_api_status_and_lookup(client, dictionary_env: Path) -> None:
    status = client.get("/api/dictionary/status")
    assert status.status_code == 200
    assert status.json()["available"] is True
    assert status.json()["indexed"] is False

    found = client.get("/api/dictionary/lookup", params={"q": "abate"})
    assert found.status_code == 200, found.text
    body = found.json()
    assert body["exact"][0]["headword"] == "abate"
    assert "less in amount" in body["exact"][0]["definition"]

    assert client.get("/api/dictionary/lookup", params={"q": ""}).status_code == 422


def test_dictionary_api_auto_uses_learner_when_enabled(
    client, dictionary_env: Path, tmp_path: Path, monkeypatch
) -> None:
    from app.repos import settings as settings_repo

    learner = build_eudb(
        tmp_path / "learners" / "learner.eudb",
        [("abate", "v.<br>Function: verb<br>: to become weaker")],
        title="Learner's Dictionary",
    )
    monkeypatch.setenv("INTEFLOW_LEARNER_DICTIONARY", str(learner))
    monkeypatch.setenv(
        "INTEFLOW_LEARNER_DICTIONARY_INDEX", str(tmp_path / "index" / "learners.db")
    )
    monkeypatch.setattr(settings_repo, "learner_definitions_enabled", lambda: True)

    status = client.get("/api/dictionary/status").json()
    assert status["learner_enabled"] is True
    assert status["learner"]["available"] is True

    body = client.get("/api/dictionary/lookup", params={"q": "abate"}).json()
    assert body["source"] == "learner"
    assert body["learner"] is True
    assert "become weaker" in body["exact"][0]["definition"]

    explicit = client.get(
        "/api/dictionary/lookup", params={"q": "abate", "source": "standard"}
    ).json()
    assert explicit["source"] == "standard"
    assert "make less" in explicit["exact"][0]["definition"]


def test_dictionary_api_rejects_an_unknown_source(client, dictionary_env: Path) -> None:
    resp = client.get(
        "/api/dictionary/lookup", params={"q": "abate", "source": "learner-plus"}
    )
    assert resp.status_code == 400


def test_dictionary_api_missing_file_is_409(client, tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("INTEFLOW_DICTIONARY", str(tmp_path / "missing.eudb"))
    monkeypatch.setenv("INTEFLOW_DICTIONARY_INDEX", str(tmp_path / "mw.db"))
    resp = client.get("/api/dictionary/lookup", params={"q": "abate"})
    assert resp.status_code == 409
    assert "no Merriam-Webster" in resp.json()["detail"]
