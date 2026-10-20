"""Vocabulary collection overview: one summary per exam."""

from __future__ import annotations

from fastapi import APIRouter

from app.repos import words as words_repo

router = APIRouter(prefix="/api/vocabulary", tags=["vocabulary"])


@router.get("")
def vocabulary_overview() -> dict:
    documents = words_repo.summaries()
    return {
        "documents": documents,
        "total_documents": len(documents),
        "total_words": sum(d["word_count"] for d in documents),
    }
