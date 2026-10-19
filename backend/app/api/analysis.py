"""Wrong-answer analysis: one notebook per exam, one page per question.

Also serves the user's display name (page 1 of every exported notebook) and the
notebook exports (Markdown / DOCX / PDF), all deterministic and 0 token.
"""

from __future__ import annotations

import re
from io import BytesIO

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from app.db import EXPORTS_DIR
from app.export.notebook import (
    build_notebook,
    render_notebook_docx,
    render_notebook_markdown,
    render_notebook_pdf,
)
from app.repos import analyses as analyses_repo
from app.repos import documents as doc_repo
from app.repos import sessions as session_repo
from app.repos import settings as settings_repo

router = APIRouter(prefix="/api/documents", tags=["analysis"])

MEDIA_TYPES = {
    "md": "text/markdown; charset=utf-8",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "pdf": "application/pdf",
}
EXPORT_FORMATS = tuple(MEDIA_TYPES)


class PagePayload(BaseModel):
    content: str = ""


def _fail(message: str, status: int = 422) -> None:
    raise HTTPException(status_code=status, detail=message)


def _require_document(doc_id: int) -> dict:
    doc = doc_repo.get_document(doc_id)
    if doc is None:
        _fail("document not found", 404)
        raise                                          # pragma: no cover
    return doc


@router.get("/{doc_id}/analysis")
def list_analysis(doc_id: int) -> dict:
    """Every page of the exam's notebook (question order, lazily created)."""
    doc = _require_document(doc_id)
    return {
        "document_id": doc_id,
        "title": doc["title"],
        "pages": analyses_repo.list_pages(doc_id),
    }


@router.get("/{doc_id}/analysis/export/{fmt}")
def export_analysis(
    doc_id: int,
    fmt: str,
    session_id: int | None = None,
    only_analyzed: bool = False,
) -> Response:
    """Download the notebook and keep a copy under ``data/exports``."""
    if fmt not in EXPORT_FORMATS:
        _fail("format must be md, docx or pdf", 400)
        raise                                          # pragma: no cover
    doc = _require_document(doc_id)
    notebook = build_notebook(
        doc_id, session_id=session_id, only_analyzed=only_analyzed
    )
    if notebook is None:                               # pragma: no cover
        _fail("document not found", 404)
        raise

    if fmt == "md":
        content = render_notebook_markdown(notebook).encode("utf-8")
    elif fmt == "docx":
        content = render_notebook_docx(notebook)
    else:
        content = render_notebook_pdf(notebook)

    filename = f"{_slugify(doc['title'])}-analysis.{fmt}"
    EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (EXPORTS_DIR / filename).write_bytes(content)
    return Response(
        content=content,
        media_type=MEDIA_TYPES[fmt],
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Export-Path": str(EXPORTS_DIR / filename),
        },
    )


@router.get("/{doc_id}/analysis/{question_id}")
def get_analysis_page(doc_id: int, question_id: int) -> dict:
    _require_document(doc_id)
    page = analyses_repo.get_page(doc_id, question_id)
    if page is None:
        _fail("question not found", 404)
        raise                                          # pragma: no cover
    return page


@router.put("/{doc_id}/analysis/{question_id}")
def put_analysis_page(doc_id: int, question_id: int, payload: PagePayload) -> dict:
    _require_document(doc_id)
    try:
        return analyses_repo.save_page(doc_id, question_id, payload.content)
    except analyses_repo.AnalysisError as exc:
        _fail(str(exc), 404 if "not found" in str(exc) else 400)
        raise                                          # pragma: no cover


@router.delete("/{doc_id}/analysis/{question_id}")
def delete_analysis_page(doc_id: int, question_id: int) -> dict:
    _require_document(doc_id)
    if not analyses_repo.delete_page(doc_id, question_id):
        _fail("analysis page not found", 404)
        raise                                          # pragma: no cover
    return {"deleted": question_id}


# --------------------------------------------------------------------------
# display name (page 1 of an exported notebook)
# --------------------------------------------------------------------------


class NamePayload(BaseModel):
    name: str = ""


@router.get("/{doc_id}/analysis-meta")
def analysis_meta(doc_id: int) -> dict:
    """Display name + attempts of one exam, for the notebook cover page."""
    doc = _require_document(doc_id)
    return {
        "document_id": doc_id,
        "title": doc["title"],
        "user_name": settings_repo.get_all().get("user_name", ""),
        "sessions": session_repo.history(doc_id),
    }


@router.put("/{doc_id}/analysis-meta")
def put_analysis_meta(doc_id: int, payload: NamePayload) -> dict:
    _require_document(doc_id)
    name = payload.name.strip()
    if len(name) > 80:
        _fail("name is longer than 80 characters", 400)
        raise                                          # pragma: no cover
    settings_repo.set_values({"user_name": name})
    return analysis_meta(doc_id)


def _slugify(title: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9._-]+", "-", title).strip("-.")[:60]
    return slug or "document"
