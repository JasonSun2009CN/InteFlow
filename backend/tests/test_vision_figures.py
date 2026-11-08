"""Opt-in vision fallback for clipped figure titles (mocked; no real tokens)."""

from __future__ import annotations

import re
from pathlib import Path

import pymupdf

from app.convert import vision_figures
from app.convert.pdf import convert_pdf
from tests.fixtures import build_table_pdf


def test_vision_caption_and_recrop(tmp_path: Path, monkeypatch) -> None:
    path = build_table_pdf(tmp_path / "table.pdf")
    result = convert_pdf(path)
    ifmd = re.sub(r"!\[[^\]]*\]\(assets/", "![figure](assets/", result.ifmd)
    assert "![figure]" in ifmd

    original = dict(result.assets)

    def fake_ask(page: pymupdf.Page, rect: pymupdf.Rect) -> dict:
        # Include the figure and a little space above; stay on the page.
        box = pymupdf.Rect(
            max(0.0, rect.x0 - 20),
            max(0.0, rect.y0 - 30),
            min(page.rect.x1, rect.x1 + 20),
            min(page.rect.y1, rect.y1 + 20),
        )
        return {"caption": "Console and Computer Games", "box": box}

    monkeypatch.setattr(vision_figures, "_ask", fake_ask)
    warnings: list[str] = []
    updated, assets, used = vision_figures.enhance(
        path, ifmd, dict(result.assets), warnings
    )

    assert used is True
    assert "![Console and Computer Games]" in updated
    assert "![figure]" not in updated
    assert assets  # the asset map is preserved
    assert any("tokens were used" in warning for warning in warnings)
    # Re-cropping keeps the same asset key but may change its bytes.
    assert set(assets) == set(original)


def test_vision_fallback_ignores_good_captions(tmp_path: Path, monkeypatch) -> None:
    path = build_table_pdf(tmp_path / "table.pdf")
    result = convert_pdf(path)

    called = False

    def fake_ask(page: pymupdf.Page, rect: pymupdf.Rect) -> dict:
        nonlocal called
        called = True
        return {"caption": "unused", "box": rect}

    monkeypatch.setattr(vision_figures, "_ask", fake_ask)
    warnings: list[str] = []
    updated, _assets, used = vision_figures.enhance(
        path, result.ifmd, dict(result.assets), warnings
    )

    assert used is False
    assert called is False
    assert updated == result.ifmd
    assert any("no figure that needed repair" in warning for warning in warnings)
