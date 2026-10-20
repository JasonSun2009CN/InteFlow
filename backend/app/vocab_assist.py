"""Pick the Merriam-Webster sense that best fits a word's context.

The drag-and-drop vocabulary flow is explicit: the user selects a word and
drops it on the vocabulary pane. When an LLM is configured, this module asks it
to choose one of the actual MW senses (candidate ids are validated, so the
model cannot invent an entry). Without a key — or if the call fails — the first
sense is used and the response carries a warning. The import / practice paths
never reach this module, so the 0-token invariant is untouched.
"""

from __future__ import annotations

import json
import re

from app import llm

SYSTEM = (
    "You are a lexicographer helping a student. Given a word, the context in "
    "which it appeared, and candidate Merriam-Webster entries, choose the one "
    "sense that best fits the context. Reply with JSON only, no markdown:\n"
    '{"entry_id": <one of the candidate ids>, "part_of_speech": "<n.|v.|adj.|adv.|prep.|conj.|pron.|interj.>", '
    '"definition": "<one concise definition in English>", "why": "<one short sentence>"}\n'
    "Do not invent a sense; choose one of the candidates."
)

POS_WORDS = {
    "noun": "n.",
    "verb": "v.",
    "adjective": "adj.",
    "adverb": "adv.",
    "preposition": "prep.",
    "conjunction": "conj.",
    "pronoun": "pron.",
    "interjection": "interj.",
    "abbreviation": "abbr.",
    "prefix": "prefix",
    "suffix": "suffix",
}

_HEADER_RE = re.compile(
    r"^(pronunciation|function|inflected form|etymology|date|usage|variant|plural|"
    r"synonyms?|antonyms?|related|first known use|often attributive)\s*:",
    re.I,
)
_POS_LINE_RE = re.compile(r"^(n|v|adj|adv|prep|conj|pron|interj|abbr)\.$", re.I)
_GRAMMAR_RE = re.compile(
    r"^(transitive|intransitive|linking|auxiliary|phrasal)\s+verb$", re.I
)
_FUNC_RE = re.compile(r"^Function\s*:\s*(.+)$", re.I | re.M)
_ANGLE_RE = re.compile(r"<[^>]+>")


def first_pos(definition: str) -> str:
    """Extract the part of speech from a raw MW entry text."""
    lines = [line.strip() for line in definition.splitlines() if line.strip()]
    for line in lines[:5]:
        line = re.sub(r"^\d+\s+", "", line)  # homograph marker: "1 v." -> "v."
        if _POS_LINE_RE.match(line):
            return line.lower()
        word = line.rstrip(".").casefold()
        if word in POS_WORDS:
            return POS_WORDS[word]
    match = _FUNC_RE.search(definition)
    if match:
        value = match.group(1).strip().rstrip(".").casefold()
        value = re.sub(
            r"^(?:transitive|intransitive|linking|auxiliary)\s+verb$", "verb", value
        )
        return POS_WORDS.get(value, value)
    return ""


def first_sense(definition: str) -> str:
    """A concise first definition, without pronunciation/etymology headers."""
    lines = [line.strip() for line in definition.splitlines() if line.strip()]
    fallback: str | None = None
    for line in lines:
        if _HEADER_RE.match(line) or _GRAMMAR_RE.match(line):
            continue
        if line.casefold() in POS_WORDS or _POS_LINE_RE.match(line):
            continue
        if " : " in line:
            sense = line.split(" : ", 1)[1]
        elif line.startswith(": "):
            sense = line[2:]
        elif line.startswith(":"):
            sense = line[1:]
        else:
            if fallback is None and not line.isdigit():
                fallback = line
            continue
        sense = _ANGLE_RE.sub("", sense).strip()
        if sense:
            return sense[:400].strip()
    if fallback:
        return _ANGLE_RE.sub("", fallback).strip()[:400]
    return " ".join(definition.split())[:400]


def _candidate_prompt(candidates: list[dict]) -> str:
    blocks: list[str] = []
    for candidate in candidates[:6]:
        definition = (candidate.get("definition") or "")[:1600]
        blocks.append(
            f"[{candidate['id']}] {candidate['headword']}\n{definition}"
        )
    return "\n\n".join(blocks)


def _parse_json(text: str) -> dict | None:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        value = json.loads(text[start : end + 1])
    except (TypeError, ValueError):
        return None
    return value if isinstance(value, dict) else None


def choose_definition(
    word: str,
    context: str,
    candidates: list[dict],
    *,
    use_ai: bool = True,
) -> dict:
    """Return ``{entry_id, pos, definition, used_ai, reason, warning}``."""
    if not candidates:
        return {
            "entry_id": None,
            "pos": "",
            "definition": "",
            "used_ai": False,
            "reason": "",
            "warning": "",
        }

    fallback = candidates[0]
    fallback_pos = first_pos(fallback.get("definition") or "")
    fallback_definition = first_sense(fallback.get("definition") or "")

    if not use_ai:
        return {
            "entry_id": fallback["id"],
            "pos": fallback_pos,
            "definition": fallback_definition,
            "used_ai": False,
            "reason": "",
            "warning": "AI sense matching is off; used the first Merriam-Webster sense.",
        }

    if not llm.configured():
        return {
            "entry_id": fallback["id"],
            "pos": fallback_pos,
            "definition": fallback_definition,
            "used_ai": False,
            "reason": "",
            "warning": "AI is not configured; used the first Merriam-Webster sense.",
        }

    user = (
        f"Word: {word}\n"
        f"Context: {context[:2400]}\n\n"
        f"Candidates:\n{_candidate_prompt(candidates)}"
    )
    try:
        raw = llm.complete(SYSTEM, [{"role": "user", "content": user}])
    except llm.LLMError as exc:
        return {
            "entry_id": fallback["id"],
            "pos": fallback_pos,
            "definition": fallback_definition,
            "used_ai": False,
            "reason": "",
            "warning": f"AI could not choose a sense ({exc}); used the first one.",
        }

    parsed = _parse_json(raw)
    valid_ids = {c["id"] for c in candidates}
    if not parsed or parsed.get("entry_id") not in valid_ids:
        return {
            "entry_id": fallback["id"],
            "pos": fallback_pos,
            "definition": fallback_definition,
            "used_ai": False,
            "reason": "",
            "warning": "AI returned an unusable answer; used the first Merriam-Webster sense.",
        }

    chosen = next(c for c in candidates if c["id"] == parsed["entry_id"])
    pos = str(parsed.get("part_of_speech") or parsed.get("pos") or "").strip()
    definition = str(parsed.get("definition") or "").strip()
    if not definition:
        definition = first_sense(chosen.get("definition") or "")
    if not pos:
        pos = first_pos(chosen.get("definition") or "")

    return {
        "entry_id": chosen["id"],
        "pos": pos[:40],
        "definition": definition[:600],
        "used_ai": True,
        "reason": str(parsed.get("why") or "")[:300],
        "warning": "",
    }


def candidates_for(
    word: str, limit: int = 6, kind: str = "standard"
) -> list[dict]:
    """Full definitions for the exact/prefix matches of one word.

    ``DictionaryError`` is intentionally not swallowed: the caller can tell the
    user whether the file is missing or the index could not be built.
    """
    from app import dictionary

    result = dictionary.lookup(word, limit=limit, kind=kind)

    seen: set[int] = set()
    out: list[dict] = []
    for entry in result.get("exact", []):
        if entry["id"] not in seen:
            out.append(entry)
            seen.add(entry["id"])
    for suggestion in result.get("matches", []):
        if len(out) >= limit:
            break
        if suggestion["id"] in seen:
            continue
        full = dictionary.get_entry(suggestion["id"], kind=kind)
        if full:
            out.append(full)
            seen.add(full["id"])
    return out[:limit]
