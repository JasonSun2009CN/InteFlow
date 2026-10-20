"""Word exams: build a test from a word list and grade a submission."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import repos, word_exam

router = APIRouter(prefix="/api/documents", tags=["word-exam"])


class StartPayload(BaseModel):
    mode: str
    count: int | None = None          # null = all eligible words


class GradeItem(BaseModel):
    row_id: str
    response: str = ""


class GradePayload(BaseModel):
    mode: str
    items: list[GradeItem]


def _document(doc_id: int) -> dict:
    doc = repos.documents.get_document(doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="document not found")
    return doc


@router.post("/{doc_id}/word-exam")
def start_word_exam(doc_id: int, payload: StartPayload) -> dict:
    doc = _document(doc_id)
    try:
        return word_exam.build_exam(
            doc_id, payload.mode, payload.count, title=doc.get("title", "")
        )
    except word_exam.WordExamError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{doc_id}/word-exam/grade")
def grade_word_exam(doc_id: int, payload: GradePayload) -> dict:
    doc = _document(doc_id)
    try:
        return word_exam.grade_exam(
            doc_id,
            payload.mode,
            [item.model_dump() for item in payload.items],
            title=doc.get("title", ""),
        )
    except word_exam.WordExamError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
