"""User-defined subject labels used to group exam papers."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.repos import subjects as subjects_repo

router = APIRouter(prefix="/api/subjects", tags=["subjects"])


class SubjectCreate(BaseModel):
    name: str
    color: str | None = None


class SubjectPatch(BaseModel):
    name: str | None = None
    color: str | None = None


@router.get("")
def list_subjects() -> list[dict]:
    return subjects_repo.list_subjects()


@router.post("")
def create_subject(payload: SubjectCreate) -> dict:
    try:
        return subjects_repo.create_subject(payload.name, payload.color)
    except subjects_repo.SubjectExists as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except subjects_repo.SubjectError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/{subject_id}")
def update_subject(subject_id: int, payload: SubjectPatch) -> dict:
    fields = payload.model_fields_set
    try:
        subject = subjects_repo.update_subject(
            subject_id,
            name=payload.name,
            color=payload.color,
            update_name="name" in fields,
            update_color="color" in fields,
        )
    except subjects_repo.SubjectExists as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except subjects_repo.SubjectError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if subject is None:
        raise HTTPException(status_code=404, detail="subject not found")
    return subject


@router.delete("/{subject_id}")
def delete_subject(subject_id: int) -> dict:
    if not subjects_repo.delete_subject(subject_id):
        raise HTTPException(status_code=404, detail="subject not found")
    return {"deleted": subject_id}
