"""Detect underlines / strike-throughs in a PDF page and mark the text.

SAT reading questions frequently say "the underlined portion", but the PDF text
layer stores only glyphs: the line itself is a drawing stroke or an annotation.
This module turns those decorations into two tiny inline HTML tags (``<u>`` and
``<s>``) while the text is still being read, so every downstream surface
(practice, review, notebook, exports) renders the same emphasis. Fully
deterministic — no model, 0 token.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from html import escape

import pymupdf

# A drawn decoration is a thin horizontal rule. Thicker strokes are borders,
# bars or chart geometry, never an underline.
MAX_RULE_HEIGHT = 2.5
MIN_RULE_WIDTH = 2.0

# Vertical windows relative to the glyph baseline (0 = baseline, negative = up).
UNDERLINE_BELOW = 0.05       # a rule may sit a hair above the baseline
UNDERLINE_ABOVE = 0.36       # ... and up to about a third of the font below it
STRIKE_ABOVE = 0.12          # strike-throughs sit around the x-height
STRIKE_BELOW = 0.48

# An annotation rectangle is the whole selected text box, not a line, so its
# intersection with a glyph box is the signal.
MIN_VERTICAL_OVERLAP = 0.35


@dataclass
class Decoration:
    rect: pymupdf.Rect
    kind: str                     # underline | strike
    annotation: bool = False


@dataclass
class PageMarks:
    decorations: list[Decoration] = field(default_factory=list)

    def underlines(self) -> list[Decoration]:
        return [d for d in self.decorations if d.kind == "underline"]

    def strikes(self) -> list[Decoration]:
        return [d for d in self.decorations if d.kind == "strike"]


def _rect_from_points(a: pymupdf.Point, b: pymupdf.Point) -> pymupdf.Rect:
    return pymupdf.Rect(min(a.x, b.x), min(a.y, b.y), max(a.x, b.x), max(a.y, b.y))


def _drawing_rule(item: tuple) -> pymupdf.Rect | None:
    """Return a thin horizontal rule for one drawing item, else None."""
    kind = item[0] if item else ""
    if kind == "l":
        rect = _rect_from_points(item[1], item[2])
    elif kind == "re":
        rect = pymupdf.Rect(item[1])
    elif kind == "qu":
        rect = pymupdf.Quad(item[1]).rect
    else:
        return None
    if rect.height > MAX_RULE_HEIGHT or rect.width < MIN_RULE_WIDTH:
        return None
    return rect


def collect(page: pymupdf.Page) -> PageMarks:
    """Every underline / strike decoration on one page."""
    marks = PageMarks()

    try:
        annotations = page.annots() or []
    except Exception:                       # pragma: no cover - malformed page
        annotations = []
    for annot in annotations:
        try:
            name = annot.type[1]
        except (AttributeError, TypeError, IndexError):  # pragma: no cover
            continue
        if name in ("Underline", "Squiggly"):
            marks.decorations.append(Decoration(pymupdf.Rect(annot.rect), "underline", True))
        elif name == "StrikeOut":
            marks.decorations.append(Decoration(pymupdf.Rect(annot.rect), "strike", True))

    try:
        drawings = page.get_drawings()
    except Exception:                       # pragma: no cover - malformed page
        drawings = []
    for drawing in drawings:
        for item in drawing.get("items", []):
            rect = _drawing_rule(item)
            if rect is not None:
                # A page-wide rule is a table/frame border, not text emphasis.
                if rect.width > page.rect.width * 0.92:
                    continue
                marks.decorations.append(Decoration(rect, "underline"))

    return marks


def _horizontal_hit(bbox: pymupdf.Rect, rect: pymupdf.Rect) -> bool:
    centre = (bbox.x0 + bbox.x1) / 2
    return rect.x0 - 0.6 <= centre <= rect.x1 + 0.6


def _vertical_hit(bbox: pymupdf.Rect, baseline: float, size: float,
                  deco: Decoration) -> bool:
    if deco.annotation:
        overlap = min(bbox.y1, deco.rect.y1) - max(bbox.y0, deco.rect.y0)
        return overlap >= (bbox.y1 - bbox.y0) * MIN_VERTICAL_OVERLAP
    y = (deco.rect.y0 + deco.rect.y1) / 2
    if deco.kind == "strike":
        return baseline - size * STRIKE_BELOW <= y <= baseline - size * STRIKE_ABOVE
    return baseline - size * UNDERLINE_BELOW <= y <= baseline + size * UNDERLINE_ABOVE


def _marked(bbox: pymupdf.Rect, baseline: float, size: float,
            deco: Decoration) -> bool:
    return _horizontal_hit(bbox, deco.rect) and _vertical_hit(bbox, baseline, size, deco)


def _span_chars(span: dict) -> list[tuple[str, pymupdf.Rect, float]]:
    """(char, bbox, baseline) for one span; tolerates dict/rawdict spans."""
    chars = span.get("chars")
    if chars:
        return [
            (char.get("c", ""), pymupdf.Rect(char["bbox"]), float(char["origin"][1]))
            for char in chars
        ]
    text = span.get("text", "")
    if not text:
        return []
    bbox = pymupdf.Rect(span["bbox"])
    baseline = float(span.get("origin", (bbox.x0, bbox.y1))[1])
    # No per-character boxes: split the span's width evenly. This is only a
    # fallback for text layers that omit the raw glyph geometry.
    step = (bbox.x1 - bbox.x0) / max(len(text), 1)
    return [
        (
            ch,
            pymupdf.Rect(bbox.x0 + i * step, bbox.y0, bbox.x0 + (i + 1) * step, bbox.y1),
            baseline,
        )
        for i, ch in enumerate(text)
    ]


def _wrap(chars: list[tuple[str, bool, bool]]) -> str:
    """Render chars with alternating ``<u>`` / ``<s>`` runs."""
    out: list[str] = []
    current: tuple[bool, bool] | None = None
    buffer: list[str] = []

    def flush() -> None:
        nonlocal buffer, current
        if not buffer:
            return
        text = escape("".join(buffer), quote=False)
        if current and (current[0] or current[1]):
            # Keep edge spaces outside the tag: `the <u>words</u> here`, not
            # `<u> words </u>`, so line joining keeps normal word spacing.
            core = text.strip()
            leading = text[: len(text) - len(text.lstrip())]
            trailing = text[len(text.rstrip()) :]
            out.append(leading)
            if core:
                tag = "s" if current[1] else "u"
                out.append(f"<{tag}>{core}</{tag}>")
            out.append(trailing)
        else:
            out.append(text)
        buffer = []

    for ch, underline, strike in chars:
        key = (underline, strike)
        if key != current:
            flush()
            current = key
        buffer.append(ch)
    flush()
    return "".join(out)


def span_text(span: dict, marks: PageMarks) -> str:
    """The text of one span with decorations turned into inline tags."""
    size = float(span.get("size", 10.0) or 10.0)
    underlines = marks.underlines()
    strikes = marks.strikes()
    if not underlines and not strikes:
        return escape("".join(ch for ch, _, _ in _span_chars(span)), quote=False)

    marked: list[tuple[str, bool, bool]] = []
    for ch, bbox, baseline in _span_chars(span):
        underline = any(_marked(bbox, baseline, size, d) for d in underlines)
        strike = any(_marked(bbox, baseline, size, d) for d in strikes)
        marked.append((ch, underline, strike))
    return _wrap(marked)


def line_text(line: dict, marks: PageMarks) -> str:
    return "".join(span_text(span, marks) for span in line.get("spans", []))


def block_lines(block: dict, marks: PageMarks) -> list[str]:
    """Non-empty text lines of a text block, decorations preserved."""
    out: list[str] = []
    for line in block.get("lines", []):
        text = line_text(line, marks)
        if text.strip():
            out.append(text)
    return out
