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
