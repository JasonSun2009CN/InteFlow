"""Local Merriam-Webster dictionary: status + lookup (0 token)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app import dictionary

router = APIRouter(prefix="/api/dictionary", tags=["dictionary"])


@router.get("/status")
def dictionary_status() -> dict:
    return dictionary.status()


@router.get("/lookup")
def dictionary_lookup(
    q: str = Query(..., min_length=1, max_length=200),
    limit: int = Query(20, ge=1, le=50),
) -> dict:
    try:
        return dictionary.lookup(q, limit=limit)
    except dictionary.DictionaryError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
