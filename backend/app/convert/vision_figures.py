"""Optional vision fallback for figures whose title/axis labels were clipped.

The deterministic importer is good at clipping a chart's plot area, but a
figure whose labels live in a separate text layer can still lose its header.
When the user explicitly enables **Vision figure fallback** (Settings) they can
ask a vision-capable model to inspect the affected page: it returns a caption
and a full-page bounding box, which is used to re-crop the PNG.

This module is never part of the default import path and consumes tokens only
when :func:`app.imports.run_vision_figures` is called.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pymupdf

from app import llm
from app.convert import images as _images

MAX_FIGURES = 8
MAX_ALT = 150
_RENDER_ZOOM = 2.0
_MAX_SIDE = 1600

SYSTEM = """\
You are inspecting a page from an exam PDF. You help repair a cropped figure
(chart, graph or table) that may have lost its title, axis labels, legend or
table header.

Reply with ONLY a JSON object, no markdown fences and no prose:
{"caption": "...", "box": [x0, y0, x1, y1]}

`box` is the smallest rectangle that contains the COMPLETE figure including its
title, axis labels, legend and category labels. Coordinates are normalized to
the full page (0 = left/top, 1 = right/bottom). Do not include the question stem
or surrounding prose. `caption` is a short, natural title (at most 120
characters). When the region does not contain a figure, reply
{"caption": "", "box": null}.
"""

_IMAGE_RE = re.compile(r"!\[([^\]]*)\]\(assets/([^)\s]+)\)")
_PAGE_RE = re.compile(r"^p(\d+)-")


def _caption_ok(caption: str) -> bool:
    text = caption.strip()
    if not text or text.lower() == "figure":
        return False
    words = re.findall(r"[A-Za-z]{3,}", text)
    if not words:
        return False
    if len(text) < 12:
        return False
    if len(re.findall(r"\b\d+\b", text)) >= 4 and len(words) <= 4:
        return False
    if text.count(";") >= 2 and len(words) <= 5:
        return False
    return True


def _figure_index(doc: pymupdf.Document) -> dict[str, tuple[int, pymupdf.Rect]]:
    """Asset stem -> (page number, page-space rect) for this PDF.

    Mirrors the deterministic scan (shared hash de-duplication, same page
    order) so the names in the staged ifmd resolve to the right figure.
    """
    index: dict[str, tuple[int, pymupdf.Rect]] = {}
    seen: set[str] = set()
    for number in range(doc.page_count):
        page = doc.load_page(number)
        try:
            page_dict = page.get_text("dict", sort=False)
        except Exception:                        # pragma: no cover - broken page
            continue
        for fig in _images.collect_images(page, page_dict, number + 1, seen):
            index[Path(fig.name).stem] = (number + 1, pymupdf.Rect(fig.rect))
    return index


def _json_object(raw: str) -> dict | None:
    match = re.search(r"\{.*\}", raw, re.S)
    if not match:
        return None
    try:
        value = json.loads(match.group(0))
    except ValueError:
        return None
    return value if isinstance(value, dict) else None


def _normalized_box(value: object, page_rect: pymupdf.Rect,
                    original: pymupdf.Rect) -> pymupdf.Rect | None:
    if not isinstance(value, (list, tuple)) or len(value) != 4:
        return None
    try:
        x0, y0, x1, y1 = (float(v) for v in value)
    except (TypeError, ValueError):
        return None
    if not all(0.0 <= v <= 1.0 for v in (x0, y0, x1, y1)):
        return None
    if x1 - x0 < 0.03 or y1 - y0 < 0.03:
        return None
    box = pymupdf.Rect(
        page_rect.x0 + x0 * page_rect.width,
        page_rect.y0 + y0 * page_rect.height,
        page_rect.x0 + x1 * page_rect.width,
        page_rect.y0 + y1 * page_rect.height,
    )
    # A model sometimes returns the plot only or a wildly different region.
    # Require the proposed crop to contain the figure centre.
    centre = pymupdf.Point(
        (original.x0 + original.x1) / 2,
        (original.y0 + original.y1) / 2,
    )
    if not (box.x0 - 8 <= centre.x <= box.x1 + 8
            and box.y0 - 8 <= centre.y <= box.y1 + 8):
        return None
    if box.get_area() > page_rect.get_area() * 0.9:
        return None
    return box & page_rect


def _clean_caption(raw: object) -> str:
    if not isinstance(raw, str):
        return ""
    text = re.sub(r"[\[\]()|]", " ", raw)
    text = " ".join(text.split()).strip()
    return text[:MAX_ALT]


def _ask(page: pymupdf.Page, rect: pymupdf.Rect) -> dict | None:
    """Return ``{caption, box}`` for one figure, or None when unusable."""
    page_rect = page.rect
    longest = max(page_rect.width, page_rect.height, 1.0)
    zoom = min(_RENDER_ZOOM, _MAX_SIDE / longest)
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
    png = pix.tobytes("png")
    prompt = (
        "The figure to repair is approximately at normalized box "
        f"[{rect.x0 / page_rect.width:.3f}, {rect.y0 / page_rect.height:.3f}, "
        f"{rect.x1 / page_rect.width:.3f}, {rect.y1 / page_rect.height:.3f}]. "
        "Return the complete figure's box and caption as JSON."
    )
    raw = llm.complete_vision(SYSTEM, prompt, png)
    data = _json_object(raw)
    if data is None:
        return None
    caption = _clean_caption(data.get("caption"))
    box = _normalized_box(data.get("box"), page_rect, rect)
    if not caption and box is None:
        return None
    return {"caption": caption, "box": box}


def enhance(
    pdf_path: Path,
    ifmd: str,
    assets: dict[str, bytes],
    warnings: list[str],
) -> tuple[str, dict[str, bytes], bool]:
    """Repair suspect figures in a staged result.

    Returns ``(ifmd, assets, used_ai)``. Failures are warnings, not fatal: an
    unhelpful model must never discard an otherwise valid import.
    """
    refs = list(_IMAGE_RE.finditer(ifmd))
    if not refs:
        warnings.append("Vision figure fallback: no figure references found")
        return ifmd, assets, False

    try:
        doc = pymupdf.open(pdf_path)
    except Exception as exc:
        raise ValueError(f"cannot reopen the PDF for vision fallback: {exc}") from exc

    used = False
    changed = 0
    attempted = 0
    try:
        index = _figure_index(doc)
        seen: set[str] = set()
        for match in refs:
            alt, name = match.group(1), Path(match.group(2)).name
            stem = Path(name).stem
            if stem in seen or _caption_ok(alt):
                continue
            seen.add(stem)
            located = index.get(stem)
            # PDF results key assets by the referenced filename (with .png);
            # older/IFMD-derived results may use the bare stem.
            asset_key = name if name in assets else stem
            if located is None or asset_key not in assets:
                continue
            if attempted >= MAX_FIGURES:
                warnings.append(
                    f"Vision figure fallback stopped after {MAX_FIGURES} figures"
                )
                break
            page_no, rect = located
            page = doc.load_page(page_no - 1)
            attempted += 1
            try:
                reply = _ask(page, rect)
            except llm.LLMError as exc:
                warnings.append(f"Vision figure fallback failed: {exc}")
                break
            used = True
            if reply is None:
                warnings.append(
                    f"Vision figure fallback: no usable answer for p.{page_no}"
                )
                continue

            caption = reply["caption"]
            box = reply["box"]
            if box is not None:
                padded = pymupdf.Rect(
                    box.x0 - 2, box.y0 - 2, box.x1 + 2, box.y1 + 2
                ) & page.rect
                png = _images._clip_png(page, padded)
                if png:
                    assets[asset_key] = png
                    changed += 1
            if caption:
                old = match.group(0)
                new = f"![{caption}](assets/{name})"
                ifmd = ifmd.replace(old, new)
                changed += 1
    finally:
        doc.close()

    if used:
        warnings.append(
            f"Vision figure fallback repaired or labelled {changed} figure(s) "
            f"on {attempted} attempt(s) — tokens were used"
        )
    else:
        warnings.append(
            "Vision figure fallback found no figure that needed repair"
        )
    return ifmd, assets, used
