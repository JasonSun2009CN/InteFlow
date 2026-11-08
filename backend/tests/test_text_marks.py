"""Source emphasis: PDF annotations/drawn rules and Word run properties."""

from __future__ import annotations

from pathlib import Path

import pymupdf

from app.convert.docx import convert_docx
from app.convert.pdf import convert_pdf
from app.ifmd.parser import parse


def _underline_pdf(path: Path) -> Path:
    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)
    page.insert_text(
        (60, 100),
        "1. The museum claims the presentations are only for games.",
        fontsize=10,
    )
    page.insert_text(
        (60, 120),
        "Which choice best describes the underlined portion?",
        fontsize=10,
    )
    for index, option in enumerate(["A. one", "B. two", "C. three", "D. four"]):
        page.insert_text((80, 140 + index * 15), option, fontsize=10)

    # Exact glyph boxes let the test select "presentations" and "games".
    text = "1. The museum claims the presentations are only for games."
    chars = page.get_text("rawdict")["blocks"][0]["lines"][0]["spans"][0]["chars"]
    target = "presentations"
    start = text.index(target)
    end = start + len(target) - 1
    page.add_underline_annot(
        pymupdf.Rect(
            chars[start]["bbox"][0] - 0.5,
            chars[start]["bbox"][1],
            chars[end]["bbox"][2] + 0.5,
            chars[end]["bbox"][3],
        )
    )

    start = text.index("games")
    end = start + len("games") - 1
    baseline = chars[start]["origin"][1]
    page.draw_line(
        (chars[start]["bbox"][0] - 0.5, baseline + 1.2),
        (chars[end]["bbox"][2] + 0.5, baseline + 1.2),
        color=(0, 0, 0),
        width=0.8,
    )
    doc.save(path)
    doc.close()
    return path


def test_pdf_annotation_and_drawn_underline(tmp_path: Path) -> None:
    result = convert_pdf(_underline_pdf(tmp_path / "underline.pdf"))
    question = parse(result.ifmd).questions[0]
    material = question.material or ""

    assert "<u>presentations</u>" in material
    assert "<u>games</u>" in material


def test_docx_underline_and_strike(tmp_path: Path) -> None:
    from docx import Document

    doc = Document()
    paragraph = doc.add_paragraph()
    paragraph.add_run("1. The museum claims ")
    underlined = paragraph.add_run("the presentations")
    underlined.underline = True
    paragraph.add_run(" are ")
    struck = paragraph.add_run("only for games")
    struck.font.strike = True
    paragraph.add_run(".")
    for option in ["A. one", "B. two", "C. three", "D. four"]:
        doc.add_paragraph(option)
    path = tmp_path / "marks.docx"
    doc.save(path)

    question = parse(convert_docx(path).ifmd).questions[0]
    assert "<u>the presentations</u>" in question.stem
    assert "<s>only for games</s>" in question.stem
