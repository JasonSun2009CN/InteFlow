"""Local dictionary lookup: custom words first, then Merriam-Webster."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app import dictionary
from app.repos import custom_dictionary as custom_repo
from app.repos import settings as settings_repo

router = APIRouter(prefix="/api/dictionary", tags=["dictionary"])

SOURCE_CHOICES = ("auto", "standard")


def _mark(entry: dict) -> dict:
    return {**entry, "source": entry.get("source") or "standard"}


def _headwords(entries: list[dict]) -> set[str]:
    return {dictionary.normalize(entry.get("headword") or "") for entry in entries}


@router.get("/status")
def dictionary_status() -> dict:
    standard = dictionary.status("standard")
    standard["learner_count"] = int(standard.get("learner_count") or 0)
    standard["learner_enabled"] = settings_repo.learner_definitions_enabled()
    standard["custom_dictionary"] = {
        "enabled": settings_repo.custom_dictionary_enabled(),
        "count": custom_repo.count_entries(),
    }
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

    custom_enabled = (
        source == "auto" and settings_repo.custom_dictionary_enabled()
    )
    custom = (
        custom_repo.lookup(q, limit=limit)
        if custom_enabled
        else {"exact": [], "matches": [], "entry_count": custom_repo.count_entries()}
    )

    warning = ""
    try:
        merriam = dictionary.lookup(q, limit=limit)
    except dictionary.DictionaryError as exc:
        if not custom["exact"] and not custom["matches"]:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        merriam = {"exact": [], "matches": [], "entry_count": 0}
        warning = f"Merriam-Webster unavailable ({exc}); showing only your dictionary."

    custom_exact = [_mark(entry) for entry in custom["exact"]]
    hidden = _headwords(custom_exact)
    merriam_exact = [
        _mark(entry)
        for entry in merriam["exact"]
        if dictionary.normalize(entry.get("headword") or "") not in hidden
    ]
    exact = [*custom_exact, *merriam_exact]

    seen = {(entry["source"], entry["id"]) for entry in exact}
    matches = [entry for entry in custom["matches"] if (entry["source"], entry["id"]) not in seen]
    seen.update((entry["source"], entry["id"]) for entry in matches)
    for entry in merriam["matches"]:
        marked = _mark(entry)
        key = (marked["source"], marked["id"])
        if key in seen:
            continue
        matches.append(marked)
        seen.add(key)
        if len(matches) >= limit:
            break

    return {
        "query": q,
        "exact": exact,
        "matches": matches[:limit],
        "entry_count": merriam["entry_count"],
        "source": "standard",
        "learner_enabled": settings_repo.learner_definitions_enabled(),
        "custom_dictionary": {
            "enabled": settings_repo.custom_dictionary_enabled(),
            "count": custom["entry_count"],
        },
        "warning": warning,
    }
