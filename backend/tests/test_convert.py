import re
from pathlib import Path

import pytest

from app.convert.pdf import ConvertError, convert_pdf
from app.ifmd.parser import parse
from tests.fixtures import build_blank_pdf, build_numberless_pdf, build_sat_pdf, build_table_pdf


def test_converts_sample_pdf(sat_pdf: Path) -> None:
    result = convert_pdf(sat_pdf)
    doc = parse(result.ifmd)

    assert result.question_count == 5 == len(doc.questions)
    assert result.answers_status == "external"
    assert not [w for w in result.warnings if w.startswith("skipped question")], result.warnings


def test_front_matter(sat_pdf: Path) -> None:
    result = convert_pdf(sat_pdf)
    doc = parse(result.ifmd)
    assert doc.meta["ifmd"] == "1"
    assert doc.meta["source"] == "sat-sample.pdf"
    assert doc.meta["answers"] == "external"
    assert doc.meta["lang"] == "en"


def test_material_and_stem_split(sat_pdf: Path) -> None:
    q1 = parse(convert_pdf(sat_pdf).ifmd).questions[0]
    assert q1.no == 1
    assert q1.material and "reservations" in q1.material
    assert q1.stem.startswith("The author's attitude")
    assert q1.letter_options["B"] == "cautiously optimistic"
    assert q1.answer == "A"
    assert q1.source_ref == "p.1"


def test_wrapped_option_is_joined(sat_pdf: Path) -> None:
    q2 = parse(convert_pdf(sat_pdf).ifmd).questions[1]
    assert q2.letter_options["B"] == (
        "well established and widely cited in the field for nearly a decade"
    )
    assert q2.answer == "C"


def test_bitmap_figure_is_extracted_and_placed(sat_pdf: Path) -> None:
    result = convert_pdf(sat_pdf)
    q3 = parse(result.ifmd).questions[2]
    assert "assets/" in q3.stem, q3.stem
    assert q3.images, "image path should be recorded on the question"
    assert len(result.assets) >= 1
    name = q3.images[0].removeprefix("assets/")
    assert name in result.assets
    assert result.assets[name][:8] == b"\x89PNG\r\n\x1a\n"
    assert q3.letter_options["D"] == "30"
    assert q3.answer == "B"


def test_vector_figure_is_screenshotted(sat_pdf: Path) -> None:
    result = convert_pdf(sat_pdf)
    q4 = parse(result.ifmd).questions[3]
    assert "3x + 5" in q4.stem
    assert "assets/" in q4.stem, q4.stem      # the axes drawing was captured
    assert len(result.assets) >= 2


def test_section_heading_sets_sec(sat_pdf: Path) -> None:
    questions = parse(convert_pdf(sat_pdf).ifmd).questions
    assert [q.sec for q in questions[:3]] == ["rw", "rw", "rw"]
    assert [q.sec for q in questions[3:]] == ["math", "math"]


def test_five_option_question_converts(five_option_pdf: Path) -> None:
    """AMC-style: options are not capped at four; A–E all survive and an E key
    backfills like any other letter."""
    result = convert_pdf(five_option_pdf)
    doc = parse(result.ifmd)

    assert result.question_count == 2 == len(doc.questions)
    assert not [w for w in result.warnings if w.startswith("skipped question")], result.warnings

    q1, q2 = doc.questions
    assert list(q1.letter_options) == ["A", "B", "C", "D", "E"]
    assert q1.letter_options["E"] == "7"
    assert q1.answer == "C"
    assert list(q2.letter_options) == ["A", "B", "C", "D", "E"]
    assert q2.answer == "E"


def test_options_on_one_line_and_two_per_line(sat_pdf: Path) -> None:
    questions = parse(convert_pdf(sat_pdf).ifmd).questions
    assert questions[3].letter_options == {"A": "3", "B": "5", "C": "8", "D": "15"}
    assert questions[4].letter_options == {"A": "13", "B": "40", "C": "26", "D": "60"}
    assert questions[4].answer == "A"


def test_answer_key_applies_to_every_question(sat_pdf: Path) -> None:
    answers = [q.answer for q in parse(convert_pdf(sat_pdf).ifmd).questions]
    assert answers == ["A", "C", "B", "D", "A"]


def test_table_figure_is_extracted_with_its_title(tmp_path: Path) -> None:
    result = convert_pdf(build_table_pdf(tmp_path / "table.pdf"))
    q1 = parse(result.ifmd).questions[0]

    assert q1.images, "a bordered table should become a figure"
    assert "assets/" in q1.stem, q1.stem
    name = q1.images[0].removeprefix("assets/")
    assert name in result.assets
    assert result.assets[name][:8] == b"\x89PNG\r\n\x1a\n"

    # cell text is part of the picture, not emitted again as body text
    blob = (q1.material or "") + q1.stem + "".join(q1.letter_options.values())
    for leak in ("43,000,000", "Excitebike"):
        assert leak not in blob, leak
    # the title moves *into the image* and becomes the image's alt text
    assert "![Console and Computer Games](assets/" in blob
    body_only = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", blob)
    assert "Console and Computer Games" not in body_only


def test_figure_crop_absorbs_title_and_axis_labels(tmp_path: Path) -> None:
    """A table/chart is cropped together with its title and y-axis labels."""
    import pymupdf

    from app.convert import images as _images

    path = build_table_pdf(tmp_path / "table.pdf")
    doc = pymupdf.open(path)
    try:
        page = doc.load_page(0)
        pdict = page.get_text("dict")
        figs = [f for f in _images.collect_images(page, pdict, 1, set()) if f.vector]
        title = next(
            ln["bbox"]
            for b in pdict["blocks"] if b["type"] == 0
            for ln in b.get("lines", [])
            if "Console and Computer Games" in "".join(s["text"] for s in ln["spans"])
        )
    finally:
        doc.close()

    assert any(
        f.rect[0] <= title[0] + 1 and f.rect[1] <= title[1] + 1 and f.rect[2] >= title[2] - 1
        for f in figs
    ), "the title line must be inside the captured figure crop"


def test_questions_without_options_become_blanks(tmp_path: Path) -> None:
    """No options in the source -> fill-in-the-blank, never a skipped question."""
    path = build_blank_pdf(tmp_path / "blank.pdf")
    result = convert_pdf(path)
    doc = parse(result.ifmd)

    assert [q.kind for q in doc.questions] == ["choice", "blank", "blank"]
    blank = doc.questions[1]
    assert blank.options == []
    assert blank.stem == "The committee reached a decision that was entirely ___."
    assert not [w for w in result.warnings if w.startswith("skipped question")]

    # the rendered block survives a round trip through the parser
    assert "kind=blank" in result.ifmd


def test_numberless_pdf_is_rejected(tmp_path: Path) -> None:
    path = build_numberless_pdf(tmp_path / "no-numbers.pdf")
    with pytest.raises(ConvertError, match="no numbered questions"):
        convert_pdf(path)


def test_non_pdf_is_rejected(tmp_path: Path) -> None:
    junk = tmp_path / "junk.pdf"
    junk.write_text("not a pdf at all")
    with pytest.raises(ConvertError):
        convert_pdf(junk)


def test_missing_file_is_rejected(tmp_path: Path) -> None:
    with pytest.raises(ConvertError):
        convert_pdf(tmp_path / "absent.pdf")

def _paired_pdf(path: Path) -> Path:
    import pymupdf

    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)
    page.insert_text((60, 80), "1. The two texts discuss planting street trees.", fontsize=10)
    page.insert_text((60, 110), "Text 1", fontsize=10)
    page.insert_text((60, 125), "Cities should plant more trees: shade improves at once.", fontsize=10)
    page.insert_text((60, 155), "Text 2", fontsize=10)
    page.insert_text((60, 170), "Maintenance budgets are routinely underestimated.", fontsize=10)
    page.insert_text((60, 200), "How would the author of Text 2 respond to Text 1?", fontsize=10)
    for i, opt in enumerate([
        "A. By accepting the benefits but questioning the budget",
        "B. By denying that trees provide shade",
        "C. By proposing a different city",
        "D. By citing a third study",
    ]):
        page.insert_text((80, 220 + i * 15), opt, fontsize=10)
    doc.save(path)
    doc.close()
    return path


def test_paired_passages_are_split_into_material2(tmp_path: Path) -> None:
    q = parse(convert_pdf(_paired_pdf(tmp_path / "paired.pdf")).ifmd).questions[0]
    assert q.material is not None and "Dates" not in q.material
    assert "Cities should plant" in (q.material or "")
    assert q.material2 is not None and "Maintenance budgets" in q.material2
    assert "Text 1" not in (q.material or "")
    assert "Text 2" not in q.material2


def test_poem_lines_keep_their_breaks(tmp_path: Path) -> None:
    import pymupdf

    path = tmp_path / "poem.pdf"
    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)
    page.insert_text((60, 80), "1. The following text is adapted from a poem.", fontsize=10)
    for i, line in enumerate([
        "The little fern-leaf, bending",
        "Upon the brink, its green reflection greets,",
        "And kisses soft the shadow that it meets",
        "With touch so fine,",
        "The border line",
    ]):
        page.insert_text((60, 110 + i * 14), line, fontsize=10)
    page.insert_text((60, 210), "As used in the text, what does \"define\" most nearly mean?", fontsize=10)
    for i, opt in enumerate(["A. Abbreviate", "B. Reword", "C. Explain", "D. Perceive"]):
        page.insert_text((80, 230 + i * 15), opt, fontsize=10)
    doc.save(path)
    doc.close()

    q = parse(convert_pdf(path).ifmd).questions[0]
    assert q.material is not None
    assert "bending\nUpon the brink" in q.material

def test_builtin_harder_b_q7_chart_categories_are_in_bar_order() -> None:
    """The cropped chart lost its x-axis labels; their textual fallback must
    follow the bars left-to-right (self-dealing first, excess holdings last)."""
    doc_path = (
        Path(__file__).resolve().parents[1]
        / "app/builtin/sat2025-rw-b/2510-us-harder-b/doc.ifmd.md"
    )
    q = next(q for q in parse(doc_path.read_text(encoding="utf-8")).questions if q.no == 7)
    material = q.material or ""
    assert (
        "self-dealing · undistributed income · taxable expenditures · excess business holdings"
        in material
    )
    assert "excess business holdings\n\ntaxable expenditures" not in material

