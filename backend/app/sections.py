"""Section / subject labels.

A question's ``sec`` is a **free-form label** (any short token: ``rw``, ``math``,
``physics``, ``history`` ...). InteFlow is not SAT-only, so nothing validates the
value against a fixed list anymore.

The only thing that is SAT-shaped is the *display* mapping below: a few well-known
labels get a friendly name, everything else is shown verbatim. The PDF converter's
heuristics (``app.convert.normalize``) still *guess* ``rw``/``math`` from section
headings; ``INTEFLOW_DEFAULT_SECTION`` overrides the fallback used when no heading
is found.
"""

from __future__ import annotations

import os

# Friendly display names for well-known labels. Unknown labels render as-is.
KNOWN_LABELS: dict[str, str] = {
    "rw": "Reading & Writing",
    "math": "Math",
    "general": "General",
}

# Fallback used by the converters when no section heading was detected.
DEFAULT_SECTION = os.environ.get("INTEFLOW_DEFAULT_SECTION", "rw")


def label(sec: str | None) -> str:
    """Human-readable label for a section token (falls back to the raw token)."""
    if not sec:
        return ""
    return KNOWN_LABELS.get(sec, sec)
