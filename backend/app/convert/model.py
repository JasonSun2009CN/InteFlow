"""Shared data structures for the PDF -> InteFlow-MD conversion profiles.

Kept in their own module so the plain-text profile (pdf.py) and the
two-column profile (twocolumn.py) can reference them without
circular imports.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Item:
    text: str
    page: int
    chunk: int
    y0: float
    y1: float
    size: float


@dataclass
class BuiltQuestion:
    material: str | None
    material2: str | None
    stem: str
    options: dict[str, str]
    no: int | None
    sec: str
    answer: str | None
    source: str
    kind: str = "choice"                      # choice | blank
    multi: bool = False                       # several correct letters
    answers: list[str] = field(default_factory=list)   # blank: accepted strings


@dataclass
class PageReport:
    """Per-page conversion outcome, surfaced by the import pipeline UI.

    ``status`` is one of: ``text`` (text layer), ``ocr_ok``, ``low_confidence``,
    ``ocr_unavailable`` (no engine), ``ocr_failed`` (engine errored), ``empty``
    (OCR ran but read nothing). ``confidence`` is the engine's real mean word
    confidence in 0–1, or ``None`` when the source has no such signal.
    """

    no: int
    status: str
    source: str | None = None
    confidence: float | None = None
    reason: str | None = None
