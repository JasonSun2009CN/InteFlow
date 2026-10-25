"""Figure crop growth: titles, axis labels and category rows join the screenshot."""

from __future__ import annotations

import pymupdf

from app.convert.images import _absorb


def _line(text: str, x0: float, y0: float, x1: float, y1: float) -> dict:
    return {"bbox": (x0, y0, x1, y1), "spans": [{"text": text}]}


def test_absorbs_title_above() -> None:
    box = pymupdf.Rect(100, 100, 300, 200)
    lines = [_line("Projected change", 120, 85, 280, 97)]
    grown, titles = _absorb(pymupdf.Rect(box), lines)
    assert grown.y0 == 85
    assert titles and "Projected" in titles[0]["spans"][0]["text"]


def test_absorbs_short_category_label_below() -> None:
    box = pymupdf.Rect(100, 100, 300, 200)
    lines = [_line("Argentina", 140, 204, 200, 216)]
    grown, _ = _absorb(pymupdf.Rect(box), lines)
    assert grown.y1 == 216


def test_never_absorbs_wrapped_prose_below() -> None:
    box = pymupdf.Rect(100, 100, 300, 200)
    prose = (
        "A tariff is a tax on imported goods intended to protect domestic "
        "producers of similar goods."
    )
    lines = [_line(prose, 100, 204, 300, 216)]
    grown, _ = _absorb(pymupdf.Rect(box), lines)
    assert grown.y1 == 200


def test_absorbs_y_axis_ticks_left() -> None:
    box = pymupdf.Rect(100, 100, 300, 200)
    lines = [_line("40", 80, 140, 95, 152)]
    grown, _ = _absorb(pymupdf.Rect(box), lines)
    assert grown.x0 == 80


def test_absorbs_column_header_above_table() -> None:
    box = pymupdf.Rect(100, 100, 300, 200)
    lines = [
        _line("Percent change in", 120, 70, 200, 88),
        _line("total production", 210, 70, 290, 88),
    ]
    grown, titles = _absorb(pymupdf.Rect(box), lines)
    assert grown.y0 == 70
    assert titles

def test_absorbs_rotated_category_label_below() -> None:
    box = pymupdf.Rect(100, 100, 400, 220)
    # Rotated 90°: narrow bbox, tall, set a little below the axis.
    lines = [_line("self-dealing", 140, 240, 152, 330)]
    grown, _ = _absorb(pymupdf.Rect(box), lines)
    assert grown.y1 == 330


def test_never_absorbs_a_short_question_below() -> None:
    box = pymupdf.Rect(100, 100, 400, 220)
    lines = [_line("What is the value of x?", 100, 240, 260, 252)]
    grown, _ = _absorb(pymupdf.Rect(box), lines)
    assert grown.y1 == 220

