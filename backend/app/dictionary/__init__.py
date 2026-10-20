"""Merriam-Webster (Eudic ``.eudb``) local dictionary.

The user drops an Eudic dictionary file under ``dictionary/``. Eudic stores the
entries as a small binary header followed by a table of zlib-compressed HTML
blocks. This package parses that container **locally** (no network, no tokens)
and builds a small SQLite index under ``data/dictionary/`` for fast lookups.

The original ``.eudb`` remains the source of truth; the index is derived data
and can be rebuilt at any time.
"""

from app.dictionary.store import (
    KINDS,
    DictionaryError,
    ensure_index,
    get_entry,
    index_path,
    lookup,
    normalize,
    source_path,
    status,
)

__all__ = [
    "KINDS",
    "DictionaryError",
    "ensure_index",
    "get_entry",
    "index_path",
    "lookup",
    "normalize",
    "source_path",
    "status",
]
