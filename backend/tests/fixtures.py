"""Build a small SAT-like PDF used by the converter tests.

Covers: instructions before Q1, section headings, multi-paragraph material,
wrapped lines, wrapped options, one-line and two-per-line options, an embedded
bitmap, a vector figure, and an answer key on the last page.
"""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

import pymupdf

W, H = 612, 792


def _bitmap() -> bytes:
    pix = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 60, 40))
    for y in range(40):
        for x in range(60):
            pix.set_pixel(x, y, (40 + x * 3, 90 + y * 3, 160))
    return pix.tobytes("png")


def build_sat_pdf(path: Path) -> Path:
    doc = pymupdf.open()
    p1 = doc.new_page(width=W, height=H)
    p1.insert_text((60, 50), "SAT Practice Test — Sample", fontsize=16)
    p1.insert_text((60, 70), "Instructions: Choose the best answer for each question.",
                   fontsize=11)
    p1.insert_text((60, 95), "Section 1: Reading and Writing", fontsize=13)

    # Q1 — multi-paragraph material, question, one option per line
    p1.insert_text((60, 125), "1. Despite the committee's reservations about the cost, the new policy was",
                   fontsize=10)
    p1.insert_text((60, 140), "adopted without amendment. Critics called the decision premature, but",
                   fontsize=10)
    p1.insert_text((60, 155), "supporters insisted that the available data justified action.", fontsize=10)
    p1.insert_text((60, 180), "The author's attitude toward the committee is best described as",
                   fontsize=10)
    for i, opt in enumerate(["A. dismissive", "B. cautiously optimistic",
                             "C. indifferent", "D. hostile"]):
        p1.insert_text((80, 195 + i * 15), opt, fontsize=10)

    # Q2 — a wrapped option line
    p1.insert_text((60, 275), "2. The scientist's findings were considered ___ by her peers.",
                   fontsize=10)
    p1.insert_text((80, 290), "A. unprecedented", fontsize=10)
    p1.insert_text((80, 305), "B. well established and widely cited in the", fontsize=10)
    p1.insert_text((80, 317), "field for nearly a decade", fontsize=10)
    p1.insert_text((80, 332), "C. poorly funded", fontsize=10)
    p1.insert_text((80, 347), "D. overly cautious", fontsize=10)

    # Q3 — embedded bitmap between the stem and the options
    p1.insert_text((60, 375), "3. Based on the graph, how many students chose option B?", fontsize=10)
    p1.insert_image(pymupdf.Rect(80, 385, 240, 445), stream=_bitmap())
    for i, opt in enumerate(["A. 12", "B. 18", "C. 24", "D. 30"]):
        p1.insert_text((80, 465 + i * 15), opt, fontsize=10)

    # Section 2 — Math
    p1.insert_text((60, 560), "Section 2: Math", fontsize=13)

    # Q4 — vector figure (axes) + all four options on one line
    p1.insert_text((60, 585), "4. If 3x + 5 = 20, what is the value of x?", fontsize=10)
    p1.draw_line((80, 630), (300, 630), color=(0, 0, 0), width=1)      # x axis
    p1.draw_line((80, 630), (80, 580), color=(0, 0, 0), width=1)      # y axis
    p1.draw_line((80, 630), (300, 605), color=(0.6, 0.1, 0.1), width=1)
    for t in range(0, 6):
        p1.draw_line((80 + t * 40, 630), (80 + t * 40, 624), color=(0, 0, 0), width=1)
    p1.insert_text((80, 655), "(A) 3     (B) 5     (C) 8     (D) 15", fontsize=10)

    # Q5 — two options per line
    p1.insert_text((60, 685), "5. What is the area of a rectangle with length 8 and width 5?",
                   fontsize=10)
    p1.insert_text((80, 700), "A. 13     B. 40", fontsize=10)
    p1.insert_text((80, 715), "C. 26     D. 60", fontsize=10)

    p2 = doc.new_page(width=W, height=H)
    p2.insert_text((60, 50), "Answer Key", fontsize=13)
    p2.insert_text((60, 80), "1. A   2. C   3. B   4. D   5. A", fontsize=11)

    doc.save(path)
    doc.close()
    return path


def build_five_option_pdf(path: Path) -> Path:
    """An AMC-style page: five options A–E per question, answer key backfilled."""
    doc = pymupdf.open()
    page = doc.new_page(width=W, height=H)
    page.insert_text((60, 50), "AMC Practice — Sample", fontsize=16)

    page.insert_text((60, 100), "1. What is the value of 2 + 3?", fontsize=10)
    for i, opt in enumerate(["A. 3", "B. 4", "C. 5", "D. 6", "E. 7"]):
        page.insert_text((80, 120 + i * 15), opt, fontsize=10)

    page.insert_text((60, 230), "2. How many degrees are in a right angle?", fontsize=10)
    for i, opt in enumerate(["A. 45", "B. 60", "C. 90", "D. 120", "E. 180"]):
        page.insert_text((80, 250 + i * 15), opt, fontsize=10)

    p2 = doc.new_page(width=W, height=H)
    p2.insert_text((60, 50), "Answer Key", fontsize=13)
    p2.insert_text((60, 75), "This key lists the correct choice for each question.", fontsize=10)
    p2.insert_text((60, 100), "1. C   2. E", fontsize=11)
    doc.save(path)
    doc.close()
    return path


def build_numberless_pdf(path: Path) -> Path:
    """A PDF whose questions are not numbered — must be rejected cleanly."""
    doc = pymupdf.open()
    page = doc.new_page(width=W, height=H)
    page.insert_text((60, 50), "No numbering here", fontsize=14)
    page.insert_text((60, 80), "Which of the following is true?", fontsize=10)
    for i, opt in enumerate(["A. one", "B. two", "C. three", "D. four"]):
        page.insert_text((80, 100 + i * 15), opt, fontsize=10)
    doc.save(path)
    doc.close()
    return path


BW, BH = 610, 790          # exam-style page geometry


def build_blank_pdf(path: Path) -> Path:
    """A PDF mixing a choice question with a fill-in-the-blank (no options)."""
    doc = pymupdf.open()
    page = doc.new_page(width=W, height=H)
    page.insert_text((60, 50), "Section 1: Reading and Writing", fontsize=13)
    page.insert_text((60, 90), "1. The author's tone is best described as ___.", fontsize=10)
    for i, opt in enumerate(["A. dismissive", "B. hopeful", "C. indifferent", "D. hostile"]):
        page.insert_text((80, 110 + i * 15), opt, fontsize=10)
    page.insert_text((60, 200), "2. The committee reached a decision that was entirely ___.", fontsize=10)
    page.insert_text((60, 260), "3. Name the process by which plants make food: ___.", fontsize=10)
    doc.save(path)
    doc.close()
    return path


def _grid(page, x0: float, y0: float, x1: float, y1: float,
          rows: int, cols: int) -> None:
    """Draw a table as zero-area vector rules (as the scanned exports do)."""
    for r in range(rows + 1):
        y = y0 + (y1 - y0) * r / rows
        page.draw_line((x0, y), (x1, y), color=(0, 0, 0), width=0.7)
    for c in range(cols + 1):
        x = x0 + (x1 - x0) * c / cols
        page.draw_line((x, y0), (x, y1), color=(0, 0, 0), width=0.7)


def build_table_pdf(path: Path) -> Path:
    """A question whose figure is a bordered table with a title above the grid.

    Mirrors the scanned collection: table rules are line strokes, cells carry
    text, and a centered title sits just above the top border.
    """
    doc = pymupdf.open()
    page = doc.new_page(width=W, height=H)
    page.insert_text((60, 50), "SAT Practice Test — Sample", fontsize=16)
    page.insert_text((60, 95), "Section 1: Reading and Writing", fontsize=13)

    page.insert_text((60, 130),
                     "1. A student is researching 1980s console games. Based on the",
                     fontsize=10)
    page.insert_text((60, 145), "data in the table, which genre sold the most units?",
                     fontsize=10)

    title_y = 175
    page.insert_text((150, title_y), "Console and Computer Games", fontsize=10)
    x0, y0, x1, y1 = 90, title_y + 6, 380, title_y + 6 + 66
    _grid(page, x0, y0, x1, y1, 3, 2)
    cells = [("Tetris", "43,000,000"), ("Excitebike", "4,160,000"),
             ("The Last Ninja", "4,000,000")]
    col_w, row_h = (x1 - x0) / 2, (y1 - y0) / 3
    for r, row in enumerate(cells):
        for c, text in enumerate(row):
            page.insert_text((x0 + c * col_w + 6, y0 + r * row_h + row_h - 4),
                             text, fontsize=8)

    for i, opt in enumerate(["A. puzzle", "B. racing", "C. platformer", "D. adventure"]):
        page.insert_text((80, y1 + 30 + i * 16), opt, fontsize=10)

    doc.save(path)
    doc.close()
    return path


def _twocolumn_row(page, no: int, top: float, passage: tuple[str, ...],
                  stem: tuple[str, ...], options: dict[str, tuple[str, str | None]]) -> None:
    """One two-column row: passage left, badge + stem + options right."""
    for i, line in enumerate(passage):
        page.insert_text((57, top + 8 + i * 15), line, fontsize=10)
    page.insert_text((319, top + 20), f" {no}", fontsize=11)         # detached badge (own baseline+size)
    for i, line in enumerate(stem):
        page.insert_text((319, top + 40 + i * 15), line, fontsize=10)
    y = top + 40 + len(stem) * 15 + 16
    for letter, (first, cont) in options.items():
        page.insert_text((327, y), f"{letter} {first}", fontsize=10)
        if cont:
            page.insert_text((347, y + 12), cont, fontsize=10)
            y += 12
        y += 18


def build_twocolumn_pdf(path: Path) -> Path:
    """two-column export mimicking real exam-scrap PDFs.

    Detached digit badges in the right column, lowercase options with an
    indented continuation line, page chrome (header, footer date, book page
    numbers), a stray mid-right digit that must not become a question, and an
    interior bitmap figure in the left column.
    """
    doc = pymupdf.open()
    rows = {
        1: (("Like all hummingbirds feed on nectar daily",),
            ("Which choice completes the text with the most logical",),
            {"a": ("elusive", None),
             "b": ("well established and widely cited in the", "field for nearly a decade"),
             "c": ("indifferent", None), "d": ("hostile", None)}),
        2: (("Emerging bioacoustics tools track wildlife",),
            ("Which choice completes the text with the most logical",),
            {"a": ("attributed", None), "b": ("underpinned", None),
             "c": ("surmounted", None), "d": ("subjugated", None)}),
        3: (("As scholarship, the volume breaks new ground",),
            ("The author's attitude toward the volume is best described",),
            {"a": ("admiring", None), "b": ("skeptical", None),
             "c": ("neutral", None), "d": ("baffled", None)}),
        4: (("The ______ of leaf-vein architectures matters",),
            ("Which choice completes the text with the most logical",),
            {"a": ("multifariousness", None), "b": ("obstinacy", None),
             "c": ("entanglement", None), "d": ("terseness", None)}),
    }

    def content_page(page, page_nos: tuple[int, int]) -> None:
        page.insert_text((57, 50), "Section 1, Module 2: Reading and Writing", fontsize=12)
        _twocolumn_row(page, page_nos[0], 90, *rows[page_nos[0]])
        _twocolumn_row(page, page_nos[1], 410, *rows[page_nos[1]])
        page.insert_text((299, 723), str(40 + page_nos[0]), fontsize=10)   # book page no.
        page.insert_text((454, 722), "September 13, 2025 (US)", fontsize=9)

    p1 = doc.new_page(width=BW, height=BH)
    content_page(p1, (1, 2))
    # stray standalone digit in the right column between the two rows:
    # a candidate badge whose row has no options — must be skipped, not break Q2
    p1.insert_text((400, 355), "42", fontsize=10)

    p2 = doc.new_page(width=BW, height=BH)
    content_page(p2, (3, 4))
    # interior bitmap figure inside row 2's left column (Q4 material)
    p2.insert_image(pymupdf.Rect(60, 445, 170, 495), stream=_bitmap())

    doc.save(path)
    doc.close()
    return path


def build_twocolumn_table_pdf(path: Path) -> Path:
    """Two-column export with a vector table owned by the *nearest* badge.

    The table sits low in the left column, closer to the second row's badge
    than the first row's, so band-based assignment used to hand it to the
    wrong question.
    """
    doc = pymupdf.open()
    rows = {
        1: (("Like all hummingbirds feed on nectar daily",),
            ("Which choice completes the text with the most logical",),
            {"a": ("elusive", None), "b": ("well established", None),
             "c": ("indifferent", None), "d": ("hostile", None)}),
        2: (("The ______ of leaf-vein architectures matters",),
            ("Which choice completes the text with the most logical",),
            {"a": ("multifariousness", None), "b": ("obstinacy", None),
             "c": ("entanglement", None), "d": ("terseness", None)}),
        3: (("As scholarship, the volume breaks new ground",),
            ("The author's attitude toward the volume is best described",),
            {"a": ("admiring", None), "b": ("skeptical", None),
             "c": ("neutral", None), "d": ("baffled", None)}),
        4: (("Emerging bioacoustics tools track wildlife",),
            ("Which choice completes the text with the most logical",),
            {"a": ("attributed", None), "b": ("underpinned", None),
             "c": ("surmounted", None), "d": ("subjugated", None)}),
    }

    def content_page(page, page_nos: tuple[int, int]) -> None:
        page.insert_text((57, 50), "Section 1, Module 2: Reading and Writing", fontsize=12)
        _twocolumn_row(page, page_nos[0], 90, *rows[page_nos[0]])
        _twocolumn_row(page, page_nos[1], 410, *rows[page_nos[1]])

    p1 = doc.new_page(width=BW, height=BH)
    content_page(p1, (1, 2))
    # table low in row 2's left column: center ~y 330 is nearer badge #2
    title_y = 300
    p1.insert_text((70, title_y), "Genre Sales", fontsize=10)
    _grid(p1, 70, title_y + 6, 240, title_y + 66, 3, 2)
    for r, (name, units) in enumerate(
        [("Tetris", "43,000,000"), ("Excitebike", "4,160,000"),
         ("The Last Ninja", "4,000,000")]
    ):
        p1.insert_text((76, title_y + 6 + r * 20 + 16), name, fontsize=8)
        p1.insert_text((166, title_y + 6 + r * 20 + 16), units, fontsize=8)

    p2 = doc.new_page(width=BW, height=BH)
    content_page(p2, (3, 4))

    doc.save(path)
    doc.close()
    return path


def build_sat_docx(path: Path) -> Path:
    """A Word counterpart of build_sat_pdf: headings, material, wrapped option,
    an inline image, one-line/two-per-line options and an answer-key table."""
    from docx import Document

    doc = Document()
    doc.add_paragraph("SAT Practice Test — Sample")
    doc.add_paragraph("Instructions: Choose the best answer for each question.")
    doc.add_paragraph("Reading and Writing")

    doc.add_paragraph(
        "1. Despite the committee's reservations about the cost, the new policy "
        "was adopted without amendment."
    )
    doc.add_paragraph(
        "Critics called the decision premature, but supporters insisted that the "
        "available data justified action."
    )
    doc.add_paragraph("The author's attitude toward the committee is best described as")
    for opt in ["A. dismissive", "B. cautiously optimistic", "C. indifferent", "D. hostile"]:
        doc.add_paragraph(opt)

    doc.add_paragraph("2. The scientist's findings were considered ___ by her peers.")
    doc.add_paragraph("A. questionable")
    doc.add_paragraph("B. well established and widely cited in the")
    doc.add_paragraph("field for nearly a decade")
    doc.add_paragraph("C. tentative")
    doc.add_paragraph("D. hostile")

    doc.add_paragraph("3. The graph below shows a linear function. What is y when x = 4?")
    doc.add_picture(BytesIO(_bitmap()))
    for opt in ["A. 10", "B. 12", "C. 14", "D. 16"]:
        doc.add_paragraph(opt)

    doc.add_paragraph("Math")
    doc.add_paragraph("4. If 3x + 5 = 20, what is the value of x?")
    doc.add_paragraph("A. 3     B. 5     C. 8     D. 15")
    doc.add_paragraph("5. What is the area of a rectangle with length 8 and width 5?")
    doc.add_paragraph("A. 13     B. 40")
    doc.add_paragraph("C. 26     D. 60")

    doc.add_paragraph("Answer Key")
    table = doc.add_table(rows=1, cols=5)
    for column, (no, letter) in enumerate(
        [(1, "A"), (2, "C"), (3, "B"), (4, "D"), (5, "A")]
    ):
        table.rows[0].cells[column].text = f"{no}. {letter}"

    doc.save(path)
    return path


def build_scanned_pdf(path: Path) -> Path:
    """Rasterize the text fixture into an image-only (no text layer) PDF.

    This is what a scanner/photocopier produces: each page is a bitmap, so the
    deterministic text extractor finds nothing and OCR is required.
    """
    source = build_sat_pdf(path.with_name("scan-source.pdf"))
    src = pymupdf.open(source)
    out = pymupdf.open()
    for page in src:
        pix = page.get_pixmap(matrix=pymupdf.Matrix(3, 3), alpha=False)
        new_page = out.new_page(width=page.rect.width, height=page.rect.height)
        new_page.insert_image(new_page.rect, stream=pix.tobytes("png"))
    out.save(path)
    out.close()
    src.close()
    return path
