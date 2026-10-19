"""InteFlow-MD -> structured questions. Deterministic state machine, no LLM (PLAN.md §3)."""

from __future__ import annotations

import re
from dataclasses import dataclass, field

FORMAT_VERSION = 1
# Option letters, in order. A choice question may have any number of options
# (AMC has 5, some contests 6), always starting at A and contiguous; a question
# with no options is a blank. Letters beyond "D" are equally valid answers.
OPTION_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
MAX_OPTIONS = len(OPTION_LETTERS)
ANSWERS = tuple(OPTION_LETTERS)
DIFFICULTIES = ("e", "m", "h")

_FRONT_MATTER_RE = re.compile(r"^---\s*$")
_ATTR_RE = re.compile(r"""(?:#(?P<id>[\w.-]+))|(?P<key>\w+)=(?P<val>"[^"]*"|'[^']*'|\S+)""")
# Bullet is optional; three spellings accepted: "- A. x", "A. x", "(A) x".
_OPTION_RE = re.compile(
    r"^\s*(?:[-*]\s*)?\(?([A-Z])\)(?:\s*[.)]\s*|\s+)(?P<in_paren>.*)"
    r"|^\s*(?:[-*]\s*)?([A-Z])[.)]\s*(?P<bare>.*)"
)
_META_RE = re.compile(r"^\s*!\s*([A-Za-z_][\w-]*)\s*:\s*(.*)$")
# Any A-Z line-start that the option regex refuses (e.g. "E. ...") is a hard error,
# so unknown letters never silently leak into the stem.
_ANY_LETTER_OPT_RE = re.compile(r"^\s*(?:[-*]\s*)?\(?([A-Z])[.)]\s*")
_IMAGE_RE = re.compile(r"!\[[^\]]*\]\(([^)]+)\)")
_QUESTION_START_RE = re.compile(r"^:::q\s*\{(.*)\}\s*$")
# Blank answers are separated by "|" (text may contain spaces/commas).
_BLANK_ANSWER_SPLIT_RE = re.compile(r"\s*\|\s*")
_CHOICE_ANSWER_SPLIT_RE = re.compile(r"[\s,;/]+")


class IfmdError(ValueError):
    """Structural error in a InteFlow-MD document, carrying a 1-based line number."""

    def __init__(self, message: str, line: int):
        super().__init__(f"line {line}: {message}")
        self.line = line
        self.message = message


@dataclass
class Question:
    ext_id: str
    sec: str
    stem: str
    options: list[str]                       # "A. text" list for a choice, [] for a blank
    no: int | None = None
    type: str | None = None
    difficulty: str | None = None
    material: str | None = None
    answer: str | None = None                # legacy single letter (choice only)
    answers: list[str] = field(default_factory=list)   # letters (choice) or text (blank)
    kind: str = "choice"                     # choice | blank
    multi: bool = False                      # several correct letters
    explain: str | None = None
    source_ref: str | None = None
    images: list[str] = field(default_factory=list)
    meta: dict[str, str] = field(default_factory=dict)   # unknown ! keys, preserved
    line: int = 0                             # line of ":::q" in source

    @property
    def letter_options(self) -> dict[str, str]:
        """{'A': 'text', ...} with the leading "A. " stripped."""
        out: dict[str, str] = {}
        for opt in self.options:
            m = re.match(r"^([A-Z])[.)]\s*(.*)$", opt)
            if m:
                out[m.group(1)] = m.group(2)
        return out


@dataclass
class ParsedDoc:
    meta: dict[str, str]
    questions: list[Question]
    preamble: str = ""          # free text before the first block (ignored by the app)


def _unquote(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        return value[1:-1]
    return value


def _parse_front_matter(lines: list[str]) -> tuple[dict[str, str], int]:
    """Returns (meta, index_of_first_line_after_front_matter)."""
    if not lines or not _FRONT_MATTER_RE.match(lines[0]):
        raise IfmdError("missing front matter opening '---'", 1)
    meta: dict[str, str] = {}
    for i in range(1, len(lines)):
        line = lines[i]
        if _FRONT_MATTER_RE.match(line):
            if "ifmd" not in meta:
                raise IfmdError("front matter missing required 'ifmd' version", i + 1)
            version = meta["ifmd"]
            if not version.isdigit() or int(version) != FORMAT_VERSION:
                raise IfmdError(
                    f"unsupported InteFlow-MD version {version!r} (expected {FORMAT_VERSION})", i + 1
                )
            return meta, i + 1
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if ":" not in line:
            raise IfmdError(f"invalid front matter line: {line.strip()!r}", i + 1)
        key, _, value = line.partition(":")
        meta[key.strip()] = _unquote(value.strip())
    raise IfmdError("front matter closing '---' not found", len(lines))


def _parse_attrs(attr_text: str, line: int) -> dict[str, str]:
    attrs: dict[str, str] = {}
    pos = 0
    while pos < len(attr_text):
        m = _ATTR_RE.match(attr_text, pos)
        if not m:
            if attr_text[pos].isspace():
                pos += 1
                continue
            raise IfmdError(f"cannot parse attribute near: {attr_text[pos:]!r}", line)
        if m.group("id"):
            attrs["id"] = m.group("id")
        else:
            attrs[m.group("key")] = _unquote(m.group("val"))
        pos = m.end()
    return attrs


def _split_body(body_lines: list[str], start_line: int) -> tuple[str | None, str]:
    """Split block body into (material, stem_or_rest) around optional @material/@stem markers."""
    mat_idx = next((i for i, l in enumerate(body_lines) if l.strip() == "@material"), None)
    stem_idx = next((i for i, l in enumerate(body_lines) if l.strip() == "@stem"), None)

    if mat_idx is None and stem_idx is None:
        return None, "\n".join(body_lines).strip()
    if mat_idx is not None and stem_idx is not None:
        if stem_idx <= mat_idx:
            raise IfmdError("@stem must come after @material", start_line + stem_idx)
        material = "\n".join(body_lines[mat_idx + 1 : stem_idx]).strip()
        stem = "\n".join(body_lines[stem_idx + 1 :]).strip()
        return (material or None), stem
    if mat_idx is not None:
        raise IfmdError("@material requires a following @stem", start_line + mat_idx)
    if stem_idx is not None:
        before = "\n".join(body_lines[:stem_idx]).strip()
        stem = "\n".join(body_lines[stem_idx + 1 :]).strip()
        if before:
            # No @material marker: content before @stem is the material.
            return before, stem
        return None, stem
    # @material without @stem: everything after it is material+stem in one go -> treat as stem.
    material = "\n".join(body_lines[mat_idx + 1 :]).strip()
    return None, material


def parse(text: str) -> ParsedDoc:
    lines = text.splitlines()
    meta, start = _parse_front_matter(lines)

    questions: list[Question] = []
    preamble_lines: list[str] = []
    i = start
    while i < len(lines):
        line = lines[i]
        m = _QUESTION_START_RE.match(line)
        if not m:
            if lines and not questions:
                preamble_lines.append(line)
            i += 1
            continue

        block_start = i + 1                     # 1-based line number of ":::q"
        attrs = _parse_attrs(m.group(1), i + 1)
        if "id" not in attrs:
            raise IfmdError("question block missing #id", block_start)
        if "sec" not in attrs:
            raise IfmdError("question block missing sec= label", block_start)
        if not attrs["sec"].strip():
            raise IfmdError("question block has an empty sec= label", block_start)

        body: list[str] = []
        i += 1
        closed = False
        while i < len(lines):
            if lines[i].strip() == ":::":
                closed = True
                i += 1
                break
            if _QUESTION_START_RE.match(lines[i]):
                raise IfmdError("nested ':::q' block", i + 1)
            body.append(lines[i])
            i += 1
        if not closed:
            raise IfmdError("unterminated question block (missing ':::')", block_start)

        options: list[str] = []
        meta_kv: dict[str, str] = {}
        unknown_kv: dict[str, str] = {}
        body_wo_opts: list[str] = []
        for offset, bline in enumerate(body):
            bline_no = block_start + 1 + offset
            om = _OPTION_RE.match(bline)
            if om:
                letter = om.group(1) or om.group(3)
                expected = OPTION_LETTERS[len(options)]
                if letter != expected and not options:
                    # Lettered prose before any option (e.g. "L. Leann Kanda")
                    # is body text, not an option.
                    om = None
            if om:
                content = (om.group("in_paren") if om.group(1) else om.group("bare")) or ""
                if len(options) >= MAX_OPTIONS:
                    raise IfmdError("question has more than 26 options", bline_no)
                if letter != expected:
                    raise IfmdError(
                        f"expected option {expected}., got {letter}.", bline_no
                    )
                options.append(f"{letter}. {content.strip()}")
                continue
            # Once options have started, any other line-start letter marker is a
            # hard error so unknown letters never silently leak into the stem.
            # (Before the first option, prose may legitimately begin a line with
            # "T. S. Eliot" or "Q. What ...".)
            bm = _ANY_LETTER_OPT_RE.match(bline) if options else None
            if bm:
                raise IfmdError(
                    f"unexpected option letter {bm.group(1)!r} after options", bline_no
                )
            km = _META_RE.match(bline)
            if km:
                key, value = km.group(1).lower(), km.group(2).strip()
                if key in ("answer", "explain", "source"):
                    meta_kv[key] = value
                else:
                    unknown_kv[key] = value     # preserved verbatim, see InteFlow-MD §3.3
                continue
            body_wo_opts.append(bline)

        # A question with no options is a blank (fill-in); two or more options make
        # it a choice. A single option is ambiguous and rejected — partial option
        # lists are never guessed into either kind.
        kind_attr = (attrs.get("kind") or "").strip().lower()
        if kind_attr not in ("", "choice", "blank"):
            raise IfmdError(f"invalid kind={kind_attr!r} (expected choice|blank)", block_start)
        if len(options) == 1:
            raise IfmdError("a choice question needs at least 2 options", block_start)
        kind = kind_attr or ("choice" if options else "blank")
        if kind == "choice" and not options:
            raise IfmdError("a choice question needs options", block_start)
        if kind == "blank" and options:
            raise IfmdError("a blank question must not have options", block_start)

        multi_raw = (attrs.get("multi") or "").strip().lower()
        if multi_raw not in ("", "0", "1", "true", "false", "yes", "no"):
            raise IfmdError(f"invalid multi={multi_raw!r} (expected 0|1)", block_start)
        multi = multi_raw in ("1", "true", "yes")

        raw_answer = meta_kv.get("answer")
        answers: list[str] = []
        if raw_answer is not None:
            if kind == "blank":
                answers = [part.strip() for part in _BLANK_ANSWER_SPLIT_RE.split(raw_answer) if part.strip()]
                if not answers:
                    raise IfmdError("blank answer must not be empty", block_start)
            else:
                answers = [
                    part.strip().upper()
                    for part in _CHOICE_ANSWER_SPLIT_RE.split(raw_answer)
                    if part.strip()
                ]
                bad = [a for a in answers if a not in ANSWERS]
                if bad:
                    raise IfmdError(
                        f"invalid answer {bad[0]!r} (expected A-Z)", block_start
                    )
                allowed = set(OPTION_LETTERS[: len(options)])
                unknown = [a for a in answers if a not in allowed]
                if unknown:
                    raise IfmdError(
                        f"answer {unknown[0]!r} has no matching option", block_start
                    )
                answers = sorted(dict.fromkeys(answers))
                if len(answers) > 1 and not multi:
                    raise IfmdError(
                        "multiple answers need multi=1 on the question block", block_start
                    )
                if not multi and len(answers) > 1:  # pragma: no cover - guarded above
                    answers = answers[:1]

        material, stem = _split_body(body_wo_opts, block_start + 1)
        if not stem:
            raise IfmdError("question has empty stem", block_start)

        no_raw = attrs.get("no")
        no: int | None = None
        if no_raw is not None:
            if not no_raw.isdigit():
                raise IfmdError(f"invalid no={no_raw!r} (expected integer)", block_start)
            no = int(no_raw)

        difficulty = attrs.get("difficulty")
        if difficulty is not None and difficulty not in DIFFICULTIES:
            raise IfmdError(
                f"invalid difficulty={difficulty!r} (expected e|m|h)", block_start
            )

        images = _IMAGE_RE.findall(material or "") + _IMAGE_RE.findall(stem)
        for opt in options:
            images += _IMAGE_RE.findall(opt)

        questions.append(
            Question(
                ext_id=attrs["id"],
                sec=attrs["sec"],
                stem=stem.strip(),
                options=options,
                no=no,
                type=attrs.get("type"),
                difficulty=difficulty,
                material=(material.strip() or None) if material else None,
                answer=answers[0] if kind == "choice" and len(answers) == 1 else None,
                answers=answers,
                kind=kind,
                multi=multi,
                explain=meta_kv.get("explain"),
                source_ref=meta_kv.get("source"),
                images=images,
                meta=dict(unknown_kv),
                line=block_start,
            )
        )

    seen: set[str] = set()
    for q in questions:
        if q.ext_id in seen:
            raise IfmdError(f"duplicate question id #{q.ext_id}", q.line)
        seen.add(q.ext_id)
    if not questions:
        raise IfmdError("document contains no ':::q' blocks", start + 1)

    return ParsedDoc(meta=meta, questions=questions, preamble="\n".join(preamble_lines).strip())


def format_answer_line(kind: str, answers: list[str]) -> str:
    """Render the ``! answer:`` value for a question kind."""
    if kind == "blank":
        return " | ".join(answers)
    return ", ".join(answers)


def set_answers(text: str, ext_id: str, kind: str, answers: list[str]) -> str:
    """Insert or replace `! answer:` for one question, preserving the rest of the file.

    ``answers`` is a list of letters (choice) or accepted strings (blank); an
    empty list removes the line.
    """
    cleaned: list[str] = []
    if kind == "blank":
        cleaned = [a.strip() for a in answers if a.strip()]
    else:
        for a in answers:
            letter = a.strip().upper()
            if letter not in ANSWERS:
                raise ValueError(f"invalid answer {letter!r}")
            if letter not in cleaned:
                cleaned.append(letter)
        cleaned.sort()

    value = format_answer_line(kind, cleaned)
    lines = text.splitlines()
    pending = f"! answer: {value}" if cleaned else None
    out: list[str] = []
    block_start: int | None = None     # index in `out` of the target ":::q" line
    touched = False

    for line in lines:
        m = _QUESTION_START_RE.match(line)
        if m:
            attrs = _parse_attrs(m.group(1), 0)
            block_start = len(out) if attrs.get("id") == ext_id else None
            out.append(line)
            continue
        if block_start is not None and line.strip() == ":::":
            existing = next(
                (
                    j
                    for j in range(len(out) - 1, block_start, -1)
                    if (km := _META_RE.match(out[j])) and km.group(1).lower() == "answer"
                ),
                None,
            )
            if pending is None:
                if existing is not None:
                    out.pop(existing)
            elif existing is not None:
                out[existing] = pending
            else:
                out.insert(len(out), pending)
            touched = True
            block_start = None
            out.append(line)
            continue
        out.append(line)

    if not touched:
        raise KeyError(f"question #{ext_id} not found")
    return "\n".join(out) + "\n"


def set_answer(text: str, ext_id: str, answer: str) -> str:
    """Single-letter answer (choice questions) — kept for existing callers."""
    return set_answers(text, ext_id, "choice", [answer])
