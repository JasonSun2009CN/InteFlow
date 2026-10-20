"""Key-value settings persistence (LLM API configuration, PLAN.md §6)."""

from __future__ import annotations

import sqlite3

from app.db import db

ALLOWED_KEYS = (
    "provider",
    "protocol",
    "base_url",
    "api_key",
    "model",
    "user_name",
    "llm_fallback",
    "vocab_ai_sense",
    "vocab_learner_definitions",
    "vocab_exam_ai_grading",
    "custom_dictionary_enabled",
)


def get_all() -> dict[str, str]:
    with db() as conn:
        try:
            rows = conn.execute("SELECT key, value FROM settings").fetchall()
        except sqlite3.OperationalError:      # DB not initialised yet (bare unit tests)
            return {}
    return {row["key"]: row["value"] for row in rows}


def set_values(values: dict[str, str]) -> None:
    with db() as conn:
        for key, value in values.items():
            if key not in ALLOWED_KEYS:
                continue
            conn.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?)"
                " ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (key, value),
            )


def llm_fallback_enabled() -> bool:
    """Whether AI may rescue an import whose deterministic parse failed."""
    return get_all().get("llm_fallback", "1") != "0"


def vocabulary_ai_sense_enabled() -> bool:
    """Whether drag-to-vocabulary may call the LLM to choose the best sense."""
    return get_all().get("vocab_ai_sense", "1") != "0"


def learner_definitions_enabled() -> bool:
    """Whether to prefer the in-entry "Definition for English Learners" section."""
    return get_all().get("vocab_learner_definitions", "0") == "1"


def custom_dictionary_enabled() -> bool:
    """Whether the user's own dictionary is consulted before Merriam-Webster."""
    return get_all().get("custom_dictionary_enabled", "1") != "0"


def word_exam_ai_grading_enabled() -> bool:
    """Whether submitting a word test may ask the LLM to grade answers."""
    return get_all().get("vocab_exam_ai_grading", "0") == "1"
