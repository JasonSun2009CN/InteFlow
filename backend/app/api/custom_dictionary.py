"""The user's own dictionary: a small global word list stored in ``app.db``."""

from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from pydantic import BaseModel

from app.repos import custom_dictionary as custom_repo
from app.repos import settings as settings_repo

router = APIRouter(prefix="/api/custom-dictionary", tags=["custom-dictionary"])


class EntryPayload(BaseModel):
    word: str
    definition: str
    pos: str = ""


@router.get("")
def get_custom_dictionary(
    q: str = Query("", max_length=200),
    limit: int = Query(500, ge=1, le=2000),
) -> dict:
    return {
        "enabled": settings_repo.custom_dictionary_enabled(),
        "count": custom_repo.count_entries(),
        "entries": custom_repo.list_entries(q, limit),
    }


@router.post("/entries")
def upsert_entry(payload: EntryPayload) -> dict:
    try:
        entry = custom_repo.upsert_entry(
            payload.word, payload.definition, payload.pos
        )
    except custom_repo.CustomDictionaryError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {**entry, "count": custom_repo.count_entries()}


@router.delete("/entries/{entry_id}")
def delete_entry(entry_id: int) -> dict:
    if not custom_repo.delete_entry(entry_id):
        raise HTTPException(status_code=404, detail="custom entry not found")
    return {"deleted": entry_id, "count": custom_repo.count_entries()}


@router.post("/import")
async def import_dictionary(file: UploadFile = File(...)) -> dict:
    raw = await file.read()
    try:
        result = custom_repo.import_file(file.filename or "dictionary.csv", raw)
    except custom_repo.CustomDictionaryError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return result
