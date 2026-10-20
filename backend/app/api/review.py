"""Review collections: mistakes across attempts + explicitly starred questions."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.repos import review as review_repo

router = APIRouter(prefix="/api/review", tags=["review"])


@router.get("/mistakes")
def list_mistakes() -> list[dict]:
    return review_repo.list_mistakes()


@router.get("/starred")
def list_starred() -> list[dict]:
    return review_repo.list_starred()


@router.get("/starred/ids")
def starred_ids(document_id: int) -> dict:
    return {"question_ids": review_repo.starred_ids(document_id)}


@router.post("/starred/{question_id}")
def star_question(question_id: int) -> dict:
    result = review_repo.star_question(question_id)
    if result is None:
        raise HTTPException(status_code=404, detail="question not found")
    return result


@router.delete("/starred/{question_id}")
def unstar_question(question_id: int) -> dict:
    result = review_repo.unstar_question(question_id)
    if result is None:
        raise HTTPException(status_code=404, detail="question not found")
    return result
