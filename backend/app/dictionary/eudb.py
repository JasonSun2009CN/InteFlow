"""Reader for the Eudic ``.eudb`` container (Merriam-Webster edition).

Layout (little-endian)::

    magic        2 bytes  0x56 0x11
    meta_len     int32
    first_block  int32    (informational; we recompute it)
    kind         int32    (2 for this dictionary)
    flags        2 bytes
    version      uint32
    padding      1018 bytes
    metadata     meta_len bytes (UTF-8 title/author XML)
    count        int32
    offsets      count * uint64 (compressed block offsets)
    blocks       zlib streams, each decompressing to <= 16 KiB of HTML

Entries are HTML fragments separated by an Eudic ``dict_msg`` div::

    <B>headword</B><DIV>...</DIV></DIV>
    <DIV class=msg id=dict_msg_...>© 2005 Merriam-Webster, Incorporated
    <B>next</B><DIV>...</DIV></DIV>

The parser is deliberately streaming: only one decompressed block plus the
current partial entry are held in memory.
"""

from __future__ import annotations

import html
import re
import struct
import zlib
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

MAGIC = b"\x56\x11"
HEADER_FIXED = 20
PADDING = 1018
BLOCK_SIZE = 16 * 1024
MAX_BLOCKS = 2_000_000
MAX_META = 10 * 1024 * 1024

SEPARATOR = b"<DIV class=msg id=dict_msg_"

_BR_RE = re.compile(r"(?i)<br\s*/?>")
_CELL_RE = re.compile(r"(?i)</t[dh]>")
_BLOCK_END_RE = re.compile(r"(?i)</(?:div|tr|p|table|tbody|ul|ol|li)>")
#: A nested homograph headword (``<B><SUP>2</SUP>elate</B>``) starts a new
#: dictionary headword inside the same block; keep it on its own line so a
#: definition never runs into the next sense (e.g. "pride2elate 2 v.").
_HOMOGRAPH_RE = re.compile(r"(?i)<B>\s*<SUP[^>]*>\s*\d+\s*</SUP>\s*[^<]+</B>")
_TAG_RE = re.compile(r"<[^>]+>")
_BYTES_TAG_RE = re.compile(rb"<[^>]+>")
_SUP_RE = re.compile(rb"(?is)<sup[^>]*>.*?</sup>")
_SPACE_RE = re.compile(r"[ \t]+")
_WS_RE = re.compile(r"\s+")

#: U+00B7 is the syllable separator MW prints inside headwords
#: (``ubiq·ui·tous``); U+00AD / U+200B are invisible break hints.
_INVISIBLE = {0x00B7: None, 0x00AD: None, 0x200B: None}


class EudbError(ValueError):
    """The file is not a readable Eudic dictionary."""


@dataclass(frozen=True)
class RawEntry:
    headword: str
    body: bytes


def clean_headword(raw: bytes) -> str:
    """Turn a raw ``<B>…</B>`` payload into a searchable headword."""
    raw = _SUP_RE.sub(b"", raw)
    text = html.unescape(_BYTES_TAG_RE.sub(b"", raw).decode("utf-8", "replace"))
    text = text.translate(_INVISIBLE)
    return _WS_RE.sub(" ", text).strip()


def html_to_text(body: bytes) -> str:
    """Readable plain text for one MW entry (tables become labelled lines)."""
    text = body.decode("utf-8", "replace")
    text = _HOMOGRAPH_RE.sub(lambda match: "\n" + match.group(0), text)
    text = _BR_RE.sub("\n", text)
    text = _CELL_RE.sub("\t", text)
    text = _BLOCK_END_RE.sub("\n", text)
    text = _TAG_RE.sub("", text)
    text = html.unescape(text).replace("\xa0", " ")

    lines: list[str] = []
    for line in text.split("\n"):
        line = _SPACE_RE.sub(" ", line).strip()
        if line:
            lines.append(line)
    return "\n".join(lines)


def parse_header(source: Path) -> tuple[dict[str, str], int, tuple[int, ...], int]:
    """Return ``(metadata, count, offsets, size)`` for one ``.eudb`` file."""
    size = source.stat().st_size
    with source.open("rb") as handle:
        head = handle.read(HEADER_FIXED)
        if len(head) < HEADER_FIXED or head[:2] != MAGIC:
            raise EudbError("not an Eudic dictionary (bad magic)")

        meta_len, _first, kind = struct.unpack_from("<iii", head, 2)
        _flags = head[14:16]
        _version = struct.unpack_from("<I", head, 16)[0]
        if not (0 < meta_len <= MAX_META) or not (1 <= kind <= 32):
            raise EudbError("unsupported Eudic dictionary header")

        padding = handle.read(PADDING)
        if len(padding) != PADDING:
            raise EudbError("truncated Eudic header")

        meta_raw = handle.read(meta_len)
        if len(meta_raw) != meta_len:
            raise EudbError("truncated dictionary metadata")

        count_raw = handle.read(4)
        if len(count_raw) != 4:
            raise EudbError("truncated dictionary index")
        count = struct.unpack("<i", count_raw)[0]
        if not (0 < count <= MAX_BLOCKS):
            raise EudbError("invalid dictionary entry count")

        table_raw = handle.read(count * 8)
        if len(table_raw) != count * 8:
            raise EudbError("truncated dictionary offset table")
        offsets = struct.unpack(f"<{count}Q", table_raw)

    first_expected = HEADER_FIXED + PADDING + meta_len + 4 + count * 8
    if offsets[0] < first_expected or offsets[-1] >= size:
        raise EudbError("dictionary offsets are out of range")
    if any(b <= a for a, b in zip(offsets, offsets[1:])):
        raise EudbError("dictionary offsets are not increasing")

    meta = _parse_meta(meta_raw)
    return meta, count, offsets, size


def _clean_text(value: str) -> str:
    """Strip the binary frame Eudic wraps around title/author metadata."""
    value = value.strip()
    # The tail after the human-readable text is binary (decodes to U+FFFD or
    # C0 controls); cut it, but never at a leading control run before the text.
    tail = re.search(r"\ufffd|[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", value)
    if tail and tail.start() > 0 and any(ch.isalpha() for ch in value[: tail.start()]):
        value = value[: tail.start()]
    value = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]+", "", value).strip()
    # This edition prefixes the title with an 8-byte binary header.
    cjk = re.search(r"[\u3400-\u9fff]", value)
    if cjk and cjk.start() > 0 and len(value[: cjk.start()]) <= 16:
        value = value[cjk.start() :]
    return value.strip()


def _parse_meta(raw: bytes) -> dict[str, str]:
    text = raw.decode("utf-8", "replace")
    title = ""
    author = ""
    match = re.search(r"<title>(.*?)</title>", text, re.I | re.S)
    if match:
        title = html.unescape(match.group(1)).strip()
    match = re.search(r"<author>(.*?)</author>", text, re.I | re.S)
    if match:
        author = html.unescape(match.group(1)).strip()

    # This edition stores ``<binary prefix>title@description\n作者：author``
    # before the XML blob. Strip control bytes from the title.
    head = text.split("<?xml", 1)[0]
    if "@" in head:
        raw_title, rest = head.split("@", 1)
        cleaned = _clean_text(raw_title)
        if cleaned:
            title = cleaned
        author_match = re.search(r"(?:作者|Author)\s*[:：]\s*(.+)", rest)
        if author_match:
            cleaned_author = _clean_text(author_match.group(1).splitlines()[0])
            if cleaned_author:
                author = cleaned_author
    return {"title": _clean_text(title), "author": _clean_text(author)}


def _parse_chunk(chunk: bytes) -> RawEntry | None:
    start = chunk.find(b"<B>")
    if start < 0:
        return None
    chunk = chunk[start:]
    end = chunk.find(b"</B>")
    if end < 0:
        return None

    headword = clean_headword(chunk[3:end])
    if not headword:
        return None

    body = chunk[end + 4 :]
    marker = body.find(SEPARATOR)
    if marker >= 0:
        body = body[:marker]
    return RawEntry(headword=headword, body=body)


def iter_entries(source: Path) -> Iterator[RawEntry]:
    """Yield every dictionary entry in file order."""
    _meta, count, offsets, size = parse_header(source)

    with source.open("rb") as handle:
        pending = b""
        for index, offset in enumerate(offsets):
            end = offsets[index + 1] if index + 1 < count else size
            handle.seek(offset)
            compressed = handle.read(end - offset)
            try:
                pending += zlib.decompress(compressed)
            except zlib.error as exc:  # pragma: no cover - corrupt user file
                raise EudbError(f"could not decompress block {index + 1}: {exc}") from exc

            while True:
                split = pending.find(SEPARATOR)
                if split < 0:
                    break
                chunk, pending = pending[:split], pending[split + len(SEPARATOR) :]
                entry = _parse_chunk(chunk)
                if entry is not None:
                    yield entry

        # The final entry has no trailing separator.
        entry = _parse_chunk(pending)
        if entry is not None:
            yield entry
