"""Highlights and per-question notes (local, deterministic, 0 token)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.repos import annotations as annotations_repo
from app.repos import documents as documents_repo

router = APIRouter(prefix="/api/documents", tags=["annotations"])


class HighlightPayload(BaseModel):
    question_id: int
    field: str = "material"
    quote: str
    occurrence: int = 0
    color: str = "yellow"
    note: str = ""
    start: int = 0
    end: int = 0


class HighlightPatch(BaseModel):
    color: str | None = None
    note: str | None = None


class NotePayload(BaseModel):
    content: str = ""


def _fail(message: str, status: int = 422) -> None:
    raise HTTPException(status_code=status, detail=message)


def _check_document(doc_id: int) -> None:
    if documents_repo.get_document(doc_id) is None:
        _fail("document not found", 404)


@router.get("/{doc_id}/annotations")
def list_annotations(doc_id: int) -> dict:
    _check_document(doc_id)
    return {
        "highlights": annotations_repo.list_for_document(doc_id),
        "notes": {
            str(question_id): content
            for question_id, content in annotations_repo.notes_for_document(doc_id).items()
        },
    }


@router.post("/{doc_id}/annotations")
def create_annotation(doc_id: int, payload: HighlightPayload) -> dict:
    _check_document(doc_id)
    try:
        created = annotations_repo.create(
            doc_id,
            payload.question_id,
            payload.field,
            payload.quote,
            payload.occurrence,
            payload.color,
            payload.note,
            payload.start,
            payload.end,
        )
    except ValueError as exc:
        _fail(str(exc))
        raise                                          # pragma: no cover
    if created is None:
        _fail("question not found", 404)
        raise                                          # pragma: no cover
    return created


@router.patch("/{doc_id}/annotations/{annotation_id}")
def patch_annotation(doc_id: int, annotation_id: int, payload: HighlightPatch) -> dict:
    _check_document(doc_id)
    try:
        updated = annotations_repo.update(
            annotation_id, color=payload.color, note=payload.note
        )
    except ValueError as exc:
        _fail(str(exc))
        raise                                          # pragma: no cover
    if updated is None or updated["document_id"] != doc_id:
        _fail("annotation not found", 404)
        raise                                          # pragma: no cover
    return updated


@router.delete("/{doc_id}/annotations/{annotation_id}")
def delete_annotation(doc_id: int, annotation_id: int) -> dict:
    _check_document(doc_id)
    existing = [
        row
        for row in annotations_repo.list_for_document(doc_id)
        if row["id"] == annotation_id
    ]
    if not existing:
        _fail("annotation not found", 404)
    annotations_repo.delete(annotation_id)
    return {"deleted": 1}


@router.put("/{doc_id}/questions/{question_id}/note")
def put_note(doc_id: int, question_id: int, payload: NotePayload) -> dict:
    _check_document(doc_id)
    try:
        content = annotations_repo.set_note(doc_id, question_id, payload.content)
    except KeyError:
        _fail("question not found", 404)
        raise                                          # pragma: no cover
    return {"question_id": question_id, "content": content}
