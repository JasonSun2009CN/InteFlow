"""two-column profile: detection, pairing, options, chrome, figures."""

from pathlib import Path

import pymupdf

from app.convert import twocolumn
from app.convert.pdf import convert_pdf
from app.ifmd.parser import parse
from tests.fixtures import build_twocolumn_pdf, build_twocolumn_table_pdf


def _convert(path: Path):
    return convert_pdf(path)


def test_detects_twocolumn_layout(tmp_path: Path) -> None:
    path = build_twocolumn_pdf(tmp_path / "twocolumn.pdf")
    doc = pymupdf.open(path)
    try:
        assert twocolumn.detect(doc) is True
    finally:
        doc.close()


def test_plain_pdf_is_not_twocolumn(sat_pdf: Path) -> None:
    doc = pymupdf.open(sat_pdf)
    try:
        assert twocolumn.detect(doc) is False
    finally:
        doc.close()


def test_converts_every_badge(tmp_path: Path) -> None:
    path = build_twocolumn_pdf(tmp_path / "twocolumn.pdf")
    result = _convert(path)
    doc = parse(result.ifmd)

    assert result.question_count == 4 == len(doc.questions)
    assert [q.no for q in doc.questions] == [1, 2, 3, 4]
    assert [q.sec for q in doc.questions] == ["rw", "rw", "rw", "rw"]
    assert not [w for w in result.warnings if w.startswith("skipped question #1")]


def test_rows_pair_passage_with_question(tmp_path: Path) -> None:
    path = build_twocolumn_pdf(tmp_path / "twocolumn.pdf")
    doc = parse(_convert(path).ifmd)

    q1, q2 = doc.questions[0], doc.questions[1]
    assert q1.material and "hummingbirds" in q1.material
    assert q2.material and "bioacoustics" in q2.material
    # the second row's passage must not leak into the first row
    assert "bioacoustics" not in (q1.material or "")
    assert q1.letter_options["B"] == (
        "well established and widely cited in the field for nearly a decade"
    )


def test_option_continuation_joined(tmp_path: Path) -> None:
    path = build_twocolumn_pdf(tmp_path / "twocolumn.pdf")
    doc = parse(_convert(path).ifmd)
    assert doc.questions[0].letter_options == {
        "A": "elusive",
        "B": "well established and widely cited in the field for nearly a decade",
        "C": "indifferent",
        "D": "hostile",
    }


def test_page_chrome_never_reaches_questions(tmp_path: Path) -> None:
    path = build_twocolumn_pdf(tmp_path / "twocolumn.pdf")
    doc = parse(_convert(path).ifmd)
    blob = "".join(
        (q.material or "") + q.stem + "".join(q.letter_options.values())
        for q in doc.questions
    )
    for leak in ("Section 1, Module", "September 13", "Reading and Writing"):
        assert leak not in blob, leak


def test_stray_digit_is_skipped_not_promoted(tmp_path: Path) -> None:
    path = build_twocolumn_pdf(tmp_path / "twocolumn.pdf")
    result = _convert(path)
    assert result.question_count == 4
    assert any("skipped question #42" in w for w in result.warnings), result.warnings


def test_table_bands_to_nearest_badge(tmp_path: Path) -> None:
    """A left-column table goes to the badge it sits closest to, not by band."""
    path = build_twocolumn_table_pdf(tmp_path / "twocolumn-table.pdf")
    doc = parse(_convert(path).ifmd)

    q1, q2 = doc.questions[0], doc.questions[1]
    assert not q1.images, "the table is nearer badge #2"
    assert q2.images, "table should be captured for question #2"
    assert "assets/" in (q2.material or "")


def test_left_column_bitmap_attached_to_row(tmp_path: Path) -> None:
    path = build_twocolumn_pdf(tmp_path / "twocolumn.pdf")
    result = _convert(path)
    q4 = parse(result.ifmd).questions[3]
    assert q4.images, "bitmap in Q4's material should be extracted"
    name = q4.images[0].removeprefix("assets/")
    assert name in result.assets
    assert "assets/" in (q4.material or "")


def test_answers_status_is_none_and_warned(tmp_path: Path) -> None:
    path = build_twocolumn_pdf(tmp_path / "twocolumn.pdf")
    result = _convert(path)
    assert result.answers_status == "none"
    assert any("no answers in the source" in w for w in result.warnings)
    assert all(q.answer is None for q in parse(result.ifmd).questions)
