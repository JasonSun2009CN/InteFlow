"""Paired-passage ("Text 1" / "Text 2") detection for SAT dual-text questions.

The SAT prints two short texts above one question; students must use both. The
source labels them *Text 1* / *Text 2* (older papers: *Passage 1* / *Passage 2*)
on their own lines. Conversion splits those labels into ``material`` and
``material2`` so the reader can show them as two labelled blocks.

Deterministic and conservative: when both labels are not present in order the
text is left untouched — a stray "Text 2" in a normal passage must never
silently truncate a question.
"""

from __future__ import annotations

import re

_LABEL_RE = re.compile(
    r"^\s*(?:text|passage)\s*([12])\b[\s:：.\-–—]*(?P<rest>.*)$",
    re.IGNORECASE,
)


def split_paired_material(material: str | None) -> tuple[str | None, str | None]:
    """``"Text 1 … Text 2 …"`` -> ``(text1, text2)``; otherwise ``(material, None)``."""
    if not material:
        return material, None
    lines = material.splitlines()
    first: tuple[int, str] | None = None
    second: tuple[int, str] | None = None
    for i, line in enumerate(lines):
        m = _LABEL_RE.match(line)
        if not m:
            continue
        rest = (m.group("rest") or "").strip()
        if m.group(1) == "1" and first is None:
            first = (i, rest)
        elif m.group(1) == "2" and second is None:
            second = (i, rest)

    if first is None or second is None or second[0] <= first[0]:
        return material, None

    # Keep an intro sentence printed above "Text 1" with the first text; the
    # label line itself is dropped because the reader draws its own.
    body = lines[: first[0]] + ([first[1]] if first[1] else [])
    body += lines[first[0] + 1 : second[0]]
    tail = ([second[1]] if second[1] else []) + lines[second[0] + 1 :]

    text1 = "\n".join(body).strip()
    text2 = "\n".join(tail).strip()
    if not text1 or not text2:
        return material, None
    return text1, text2
