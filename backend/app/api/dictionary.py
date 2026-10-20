"""Local Merriam-Webster dictionary: status + lookup (0 token)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app import dictionary
from app.repos import settings as settings_repo

router = APIRouter(prefix="/api/dictionary", tags=["dictionary"])

SOURCE_CHOICES = ("auto", "standard", "learner")


@router.get("/status")
def dictionary_status() -> dict:
    standard = dictionary.status("standard")
    standard["learner"] = dictionary.status("learner")
    standard["learner_enabled"] = settings_repo.learner_definitions_enabled()
    return standard


@router.get("/lookup")
def dictionary_lookup(
    q: str = Query(..., min_length=1, max_length=200),
    limit: int = Query(20, ge=1, le=50),
    source: str = Query("auto"),
) -> dict:
    if source not in SOURCE_CHOICES:
        raise HTTPException(
            status_code=400,
            detail=f"source must be one of {', '.join(SOURCE_CHOICES)}",
        )

    kind = source
    fallback = ""
    if kind == "auto":
        learner = dictionary.status("learner")
        use_learner = settings_repo.learner_definitions_enabled() and learner["available"]
        kind = "learner" if use_learner else "standard"

    try:
        result = dictionary.lookup(q, limit=limit, kind=kind)
    except dictionary.DictionaryError as exc:
        if source == "auto" and kind == "learner":
            try:
                result = dictionary.lookup(q, limit=limit, kind="standard")
            except dictionary.DictionaryError as fallback_exc:
                raise HTTPException(status_code=409, detail=str(fallback_exc)) from fallback_exc
            fallback = (
                f"Learner's dictionary unavailable ({exc}); "
                "used the standard dictionary."
            )
        else:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    result["fallback"] = fallback
    result["learner"] = result["source"] == "learner"
    return result
