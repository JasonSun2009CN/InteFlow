"""Paired passages (`@material2`) and verse line breaks at the format/convert level."""

from __future__ import annotations

import sqlite3

import pytest

from app.convert.normalize import join_paragraph, looks_like_verse
from app.convert.paired import split_paired_material
from app.db import SCHEMA, _migrate
from app.ifmd.parser import IfmdError, parse
from app.ifmd.writer import render

OPTIONS = """\
- A. By conceding the benefits but questioning the budget
- B. By rejecting the premise entirely
- C. By citing a third study
- D. By changing the subject
! answer: A
"""

PAIRED = """---
ifmd: 1
title: "Paired"
source: "paired.pdf"
lang: en
answers: inline
---

:::q {#Q001 sec=rw no=1}
@material
Text 1: The first passage argues that cities should plant more trees.

@material2
Text 2: The second passage stresses the cost of maintaining them.

@stem
How would the author of Text 2 respond to the claim in Text 1?

""" + OPTIONS + """:::
"""


def _doc(body: str) -> str:
    return (
        '---\nifmd: 1\ntitle: "T"\nsource: "t.pdf"\nlang: en\nanswers: none\n---\n\n'
        ":::q {#Q001 sec=rw no=1}\n" + body + ":::\n"
    )


def test_parse_reads_material2() -> None:
    q = parse(PAIRED).questions[0]
    assert q.material is not None and "first passage" in q.material
    assert q.material2 is not None and "second passage" in q.material2
    assert q.images == []


def test_writer_round_trips_material2() -> None:
    first = parse(PAIRED)
    second = parse(render(first))
    assert second.questions[0].material2 == first.questions[0].material2
    assert render(second) == render(first)


def test_material2_requires_material() -> None:
    body = "@material2\nSecond text.\n\n@stem\nQuestion?\n\n" + OPTIONS
    with pytest.raises(IfmdError, match="@material2 requires"):
        parse(_doc(body))


def test_material2_must_come_after_material() -> None:
    body = (
        "@material2\nSecond text.\n\n@material\nFirst text.\n\n@stem\nQuestion?\n\n" + OPTIONS
    )
    with pytest.raises(IfmdError, match="@material2 must come after"):
        parse(_doc(body))


def test_material2_must_come_before_stem() -> None:
    body = (
        "@material\nFirst text.\n\n@stem\nQuestion?\n\n@material2\nSecond text.\n\n" + OPTIONS
    )
    with pytest.raises(IfmdError, match="@material2 must come before"):
        parse(_doc(body))


def test_duplicate_material_marker_rejected() -> None:
    body = (
        "@material\nOne.\n\n@material\nTwo.\n\n@material2\nThree.\n\n@stem\nQ?\n\n" + OPTIONS
    )
    with pytest.raises(IfmdError, match="duplicate @material"):
        parse(_doc(body))


def test_empty_material2_rejected() -> None:
    body = "@material\nFirst text.\n\n@material2\n\n@stem\nQuestion?\n\n" + OPTIONS
    with pytest.raises(IfmdError, match="@material2 must not be empty"):
        parse(_doc(body))


def test_split_paired_material_by_labels() -> None:
    text = (
        "Intro sentence that frames both texts.\n\n"
        "Text 1\n\n"
        "First body.\n\n"
        "Text 2\n\n"
        "Second body."
    )
    first, second = split_paired_material(text)
    assert first is not None and "Intro sentence" in first and "First body" in first
    assert second == "Second body."


def test_split_paired_material_keeps_inline_after_label() -> None:
    first, second = split_paired_material("Passage 1: alpha\n\nPassage 2: beta")
    assert first == "alpha"
    assert second == "beta"


def test_split_paired_material_leaves_plain_text_alone() -> None:
    text = "A normal passage mentions Text 2 only once, in passing."
    assert split_paired_material(text) == (text, None)
    assert split_paired_material(None) == (None, None)


def test_split_paired_material_needs_both_labels_in_order() -> None:
    text = "Text 2 comes first.\n\nText 1 comes second."
    assert split_paired_material(text) == (text, None)


def test_looks_like_verse_and_keeps_breaks() -> None:
    lines = [
        "The little fern-leaf, bending",
        "Upon the brink, its green reflection greets,",
        "And kisses soft the shadow that it meets",
        "With touch so fine,",
        "The border line",
    ]
    assert looks_like_verse(lines)
    assert join_paragraph(lines) == "\n".join(lines)


def test_wrapped_prose_is_still_joined() -> None:
    lines = [
        "Scientists have long debated the origin of the trait, and the newest",
        "evidence suggests that it evolved independently in several lineages",
        "across the continent, which complicates the older migration model.",
    ]
    assert not looks_like_verse(lines)
    assert join_paragraph(lines).count("\n") == 0


def test_migration_adds_material2() -> None:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    conn.execute(
        "INSERT INTO documents (id, title, source_filename, answers_status, question_count,"
        " ifmd_path) VALUES (1, 'legacy', 'legacy.pdf', 'none', 1, 'x')"
    )
    conn.execute(
        "INSERT INTO questions (document_id, ext_id, stem, order_idx)"
        " VALUES (1, 'Q001', 'stem', 0)"
    )
    # Simulate a database created before paired passages existed.
    conn.execute("ALTER TABLE questions DROP COLUMN material2")
    _migrate(conn)
    cols = {row["name"] for row in conn.execute("PRAGMA table_info(questions)")}
    assert "material2" in cols
