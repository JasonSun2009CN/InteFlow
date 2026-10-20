"""Vocabulary exams on top of one document's word list.

The exam is built from the same Word / POS / Meaning rows the Vocabulary page
shows. Building and grading are deterministic and local (0 token); the only
network path is the explicit *AI grading* setting, which is used when the user
submits a test. AI grading gets the word list meaning plus Merriam-Webster
references and is asked to be strict, so it cannot accept vague answers.

Both directions exist:

* ``en-zh`` — show the English word, the student writes its meaning (local
  grading is deliberately lenient: exact, segment, or a sufficiently large
  substring match).
* ``zh-en`` — show the meaning, the student spells the English word (compared
  case-insensitively, ignoring spaces/punctuation; a Word cell may list several
  accepted spellings separated by ``;`` / ``/`` / ``|`` / newline).
"""

from __future__ import annotations

import json
import random
import re
import unicodedata

from app import dictionary, llm, vocab_assist
from app.repos import custom_dictionary as custom_repo
from app.repos import settings as settings_repo
from app.repos import words as words_repo

MODES = ("en-zh", "zh-en")
MAX_QUESTIONS = 500
MAX_RESPONSE = 2000
AI_BATCH = 20
AI_REFERENCE = 1600
MIN_MEANING_OVERLAP = 0.4

_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "been",
    "being",
    "but",
    "by",
    "for",
    "from",
    "had",
    "has",
    "have",
    "in",
    "is",
    "it",
    "its",
    "of",
    "on",
    "or",
    "that",
    "the",
    "their",
    "them",
    "this",
    "to",
    "was",
    "were",
    "with",
}

AI_SYSTEM = (
    "You are a strict vocabulary examiner. Grade each student answer against "
    "the target word and the reference definitions (the student's word list and "
    "Merriam-Webster). Do not be generous: vague, overly broad, partially "
    "related, or unrelated answers are incorrect.\n\n"
    'Mode "zh-en": the student saw a definition and had to spell the target '
    "English word. Accept the target word and any accepted spelling listed in "
    "the item. Minor typos may be accepted only when the intended word is "
    "unambiguous; never accept a different word.\n\n"
    'Mode "en-zh": the student saw an English word and had to give its meaning. '
    "Accept only an answer whose meaning matches the reference definitions. "
    "Reject answers that are only loosely associated with the word.\n\n"
    "Reply with JSON only, no markdown:\n"
    '{"results":[{"id": <item id>, "correct": true|false, "reason": "<short>"}]}\n'
    "Include every id exactly once and do not invent ids."
)


class WordExamError(ValueError):
    """Invalid exam request or submission."""


# --------------------------------------------------------------------------
# text helpers
# --------------------------------------------------------------------------


def _mode(mode: str) -> str:
    mode = (mode or "").strip().lower()
    if mode not in MODES:
        raise WordExamError(f"mode must be one of {', '.join(MODES)}")
    return mode


def _normalise(text: str) -> str:
    """Case/punctuation-insensitive text used by the lenient meaning check."""
    text = unicodedata.normalize("NFKC", text or "")
    text = text.replace("’", "'").replace("‘", "'")
    text = re.sub(r"[^\w]+|_", " ", text, flags=re.UNICODE)
    return " ".join(text.split()).casefold().strip()


def _compact(text: str) -> str:
    """Spelling key: letters/numbers only, case-insensitive."""
    text = unicodedata.normalize("NFKC", text or "").casefold()
    return "".join(char for char in text if char.isalnum())


def _spellings(word: str) -> list[str]:
    """Accepted spellings from one Word cell (also strips a trailing POS tag)."""
    parts = [part.strip() for part in re.split(r"[;|/\n]+", word or "") if part.strip()]
    if len(parts) == 1:
        comma = [part.strip() for part in (word or "").split(",") if part.strip()]
        if len(comma) > 1 and all(" " not in part for part in comma):
            parts = comma
    cleaned = [re.sub(r"\s*\([^)]*\)\s*$", "", part).strip() for part in parts]
    return [part for part in cleaned if part] or [(word or "").strip()]


def _meaning_matches(response: str, expected: str) -> bool:
    """Local, forgiving comparison for an English → Chinese answer.

    Exact equality is rare for a definition, so a response also counts when it
    is a large enough substring of the reference (or one of its ``;`` / ``/``
    segments). All-word containment is accepted for multi-word answers. The
    overlap threshold keeps a single generic word ("joy") from passing.
    """
    response = _normalise(response)
    if not response:
        return False

    candidates = [expected, *re.split(r"[;|/\n]+", expected or "")]
    for candidate in candidates:
        candidate = _normalise(candidate)
        if not candidate:
            continue
        if response == candidate:
            return True
        if len(response) >= 2 and len(candidate) >= 2:
            short, long = (
                (response, candidate)
                if len(response) <= len(candidate)
                else (candidate, response)
            )
            if short in long and len(short) / len(long) >= MIN_MEANING_OVERLAP:
                return True

    response_tokens = response.split()
    reference = _normalise(expected)
    if len(response_tokens) >= 2:
        reference_tokens = set(reference.split())
        if all(token in reference_tokens for token in response_tokens) and any(
            token not in _STOPWORDS for token in response_tokens
        ):
            return True
    return False


def _spelling_matches(response: str, expected: str) -> bool:
    key = _compact(response)
    return bool(key) and any(key == _compact(item) for item in _spellings(expected))


# --------------------------------------------------------------------------
# dictionary references
# --------------------------------------------------------------------------


def _dictionary_reference(word: str, cache: dict[str, dict | None]) -> dict | None:
    """First exact dictionary sense for a word (cached per request).

    The user dictionary wins; then MW's in-entry learner section (when enabled);
    then the normal MW definition.
    """
    key = (word or "").casefold().strip()
    if not key:
        return None
    if key in cache:
        return cache[key]

    reference: dict | None = None
    if settings_repo.custom_dictionary_enabled():
        try:
            custom = custom_repo.lookup(word, limit=1)
        except Exception:  # noqa: BLE001 - custom dictionary is advisory
            custom = {"exact": []}
        exact = custom.get("exact") or []
        if exact:
            entry = exact[0]
            definition = entry.get("definition") or ""
            sense = vocab_assist.first_sense(definition)
            if sense:
                reference = {
                    "sense": sense,
                    "pos": entry.get("pos") or vocab_assist.first_pos(definition),
                    "definition": definition,
                    "source": "custom",
                    "headword": entry.get("headword") or word,
                }

    if reference is None:
        try:
            result = dictionary.lookup(word, limit=3)
        except dictionary.DictionaryError:
            result = {"exact": []}
        exact = result.get("exact") or []
        if exact:
            entry = exact[0]
            definition = entry.get("definition") or ""
            learner = entry.get("learner_definition") or ""
            use_learner = settings_repo.learner_definitions_enabled()
            preferred = learner if use_learner and learner else definition
            sense = vocab_assist.first_sense(preferred)
            if sense:
                reference = {
                    "sense": sense,
                    "pos": vocab_assist.first_pos(definition),
                    "definition": preferred,
                    "source": "learner" if use_learner and learner else "standard",
                    "headword": entry.get("headword") or word,
                }

    cache[key] = reference
    return reference


def _resolve_meaning(
    entry: dict, cache: dict[str, dict | None]
) -> tuple[str, str, str]:
    """Return ``(meaning, pos, prompt_source)`` for one word-list row."""
    meaning = (entry.get("meaning") or "").strip()
    pos = (entry.get("pos") or "").strip()
    source = "list"
    if not meaning:
        reference = _dictionary_reference(entry.get("word") or "", cache)
        if reference:
            meaning = reference["sense"]
            pos = pos or reference["pos"]
            source = "dictionary"
    return meaning, pos, source


# --------------------------------------------------------------------------
# build
# --------------------------------------------------------------------------


def build_exam(
    doc_id: int,
    mode: str,
    count: int | None,
    *,
    title: str = "",
) -> dict:
    """Create a random word exam (answers stay on the server)."""
    mode = _mode(mode)
    if count is not None:
        if isinstance(count, bool) or not isinstance(count, int):
            raise WordExamError("count must be a whole number or null (all words)")
        if count < 1 or count > MAX_QUESTIONS:
            raise WordExamError(f"count must be between 1 and {MAX_QUESTIONS}")

    rows = words_repo.entries(doc_id)
    if not rows:
        raise WordExamError("this word list is empty — add words before taking a test")

    cache: dict[str, dict | None] = {}
    candidates: list[dict] = []
    skipped = 0
    for row in rows:
        meaning, pos, source = _resolve_meaning(row, cache)
        if not meaning:
            skipped += 1
            continue
        candidates.append(
            {
                **row,
                "meaning": meaning,
                "resolved_pos": pos,
                "prompt_source": source,
            }
        )

    if not candidates:
        raise WordExamError(
            "none of these words has a meaning yet — add meanings or install the "
            "local Merriam-Webster dictionary"
        )

    if count is None or count >= len(candidates):
        selected = list(candidates)
        random.shuffle(selected)
    else:
        selected = random.sample(candidates, count)

    questions = []
    for item in selected:
        prompt = item["word"] if mode == "en-zh" else item["meaning"]
        questions.append(
            {
                "row_id": item["row_id"],
                "position": item["position"],
                "prompt": prompt,
                "prompt_source": "word" if mode == "en-zh" else item["prompt_source"],
                "pos": item["resolved_pos"],
            }
        )

    positions = [item["position"] for item in selected]
    return {
        "document_id": doc_id,
        "title": title,
        "mode": mode,
        "total_words": len(rows),
        "eligible_words": len(candidates),
        "requested_count": count,
        "count": len(questions),
        "skipped": skipped,
        "scope": {
            "tested": len(questions),
            "eligible": len(candidates),
            "total": len(rows),
            "skipped": skipped,
            "positions": positions,
            "all": len(questions) == len(candidates),
        },
        "questions": questions,
        "ai_grading": settings_repo.word_exam_ai_grading_enabled(),
        "ai_available": llm.configured(),
    }


# --------------------------------------------------------------------------
# grade
# --------------------------------------------------------------------------


def _ai_reference(meaning: str, reference: dict | None) -> str:
    parts: list[str] = []
    if meaning:
        parts.append(f"Word list: {meaning}")
    if reference:
        definition = " ".join((reference.get("definition") or "").split())
        if definition:
            source = reference.get("source")
            label = (
                "My dictionary"
                if source == "custom"
                else "Definition for English Learners"
                if source == "learner"
                else "Merriam-Webster"
            )
            parts.append(
                f"{label} ({reference.get('headword')}): "
                f"{definition[:AI_REFERENCE]}"
            )
    return "\n".join(parts)


def _parse_json(text: str) -> dict | None:
    text = (text or "").strip()
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


def _judge_with_ai(
    mode: str, items: list[dict]
) -> tuple[dict[int, dict], str]:
    """Ask the model to grade non-empty answers, in bounded batches."""
    decisions: dict[int, dict] = {}
    warnings: list[str] = []

    for offset in range(0, len(items), AI_BATCH):
        batch = items[offset : offset + AI_BATCH]
        user = json.dumps({"mode": mode, "items": batch}, ensure_ascii=False)
        raw = llm.complete(AI_SYSTEM, [{"role": "user", "content": user}])
        parsed = _parse_json(raw)
        results = parsed.get("results") if parsed else None
        if not isinstance(results, list):
            warnings.append(
                "AI returned an unusable answer; local grading was used for that batch."
            )
            continue

        valid_ids = {int(item["id"]) for item in batch}
        for result in results:
            if not isinstance(result, dict):
                continue
            try:
                item_id = int(result.get("id"))
            except (TypeError, ValueError):
                continue
            correct = result.get("correct")
            if item_id not in valid_ids or not isinstance(correct, bool):
                continue
            decisions[item_id] = {
                "correct": correct,
                "reason": str(result.get("reason") or "")[:300],
            }

        if not any(item["id"] in decisions for item in batch):
            warnings.append(
                "AI returned no usable verdicts for a batch; local grading was used."
            )

    return decisions, " ".join(warnings)


def grade_exam(
    doc_id: int,
    mode: str,
    items: list[dict],
    *,
    title: str = "",
) -> dict:
    """Grade a submitted exam, optionally with AI support (explicit setting)."""
    mode = _mode(mode)
    if not isinstance(items, list) or not items:
        raise WordExamError("no answers submitted")
    if len(items) > MAX_QUESTIONS:
        raise WordExamError(f"at most {MAX_QUESTIONS} answers can be graded at once")

    rows = {row["row_id"]: row for row in words_repo.entries(doc_id)}
    cache: dict[str, dict | None] = {}
    seen: set[str] = set()
    graded: list[dict] = []
    ai_items: list[dict] = []

    for raw in items:
        if not isinstance(raw, dict):
            raise WordExamError("each answer must be an object")
        row_id = str(raw.get("row_id") or "").strip()
        if not row_id:
            raise WordExamError("each answer needs a row_id")
        if row_id in seen:
            raise WordExamError(f"duplicate answer for {row_id}")
        seen.add(row_id)

        row = rows.get(row_id)
        if row is None:
            raise WordExamError(f"word row {row_id!r} is not in this list")

        response = raw.get("response") or ""
        if not isinstance(response, str):
            raise WordExamError("answers must be text")
        response = response.strip()[:MAX_RESPONSE]

        meaning, pos, _source = _resolve_meaning(row, cache)
        if mode == "zh-en":
            prompt = meaning
            expected = row["word"]
            is_correct = _spelling_matches(response, expected)
            method = "spelling"
        else:
            prompt = row["word"]
            expected = meaning
            is_correct = bool(expected) and _meaning_matches(response, expected)
            method = "lenient"

        item = {
            "row_id": row_id,
            "position": row["position"],
            "word": row["word"],
            "prompt": prompt,
            "expected": expected,
            "response": response,
            "is_correct": is_correct,
            "method": method,
            "reason": "",
            "pos": pos,
        }
        graded.append(item)

        if response:
            reference = _dictionary_reference(row["word"], cache)
            ai_items.append(
                {
                    "id": len(graded) - 1,
                    "word": row["word"],
                    "prompt": prompt,
                    "expected": expected,
                    "answer": response,
                    "accepted": _spellings(row["word"]) if mode == "zh-en" else [],
                    "reference": _ai_reference(meaning, reference),
                    "part_of_speech": pos,
                }
            )

    ai_requested = settings_repo.word_exam_ai_grading_enabled()
    ai_available = llm.configured()
    ai_used = False
    warnings: list[str] = []

    if ai_requested and not ai_available:
        warnings.append(
            "AI grading is on, but no model is configured; local grading was used."
        )
    elif ai_requested and ai_available and ai_items:
        try:
            decisions, ai_warning = _judge_with_ai(mode, ai_items)
        except llm.LLMError as exc:
            warnings.append(f"AI grading failed ({exc}); local grading was used.")
        else:
            if ai_warning:
                warnings.append(ai_warning)
            for item_id, decision in decisions.items():
                item = graded[item_id]
                item["is_correct"] = decision["correct"]
                item["method"] = "ai"
                item["reason"] = decision["reason"]
                ai_used = True
            if ai_used:
                for item in graded:
                    if item["method"] in ("lenient", "spelling") and item["response"]:
                        item["method"] = "fallback"

    correct = sum(1 for item in graded if item["is_correct"])
    return {
        "document_id": doc_id,
        "title": title,
        "mode": mode,
        "total": len(graded),
        "correct": correct,
        "accuracy": round(correct / len(graded) * 100, 1),
        "ai_requested": ai_requested,
        "ai_available": ai_available,
        "ai_grading": ai_used,
        "warning": " ".join(warnings),
        "items": graded,
    }
