#!/usr/bin/env python3
"""Fail if a packaged desktop bundle contains local user data.

The desktop app must be a clean, empty install: no SQLite database, imported
documents, exports, dictionary index, Merriam-Webster source files or bundled
copyrighted sample question banks. This script is run by CI (and can be run
locally) against electron-builder's staged resources.

Usage:
    python desktop/verify_bundle.py desktop/build
    python desktop/verify_bundle.py "desktop/release/mac/InteFlow.app/Contents/Resources"
"""

from __future__ import annotations

import sys
from pathlib import Path

FORBIDDEN_FILES = {"app.db", "app.db-wal", "app.db-shm", "mw.db"}
FORBIDDEN_SUFFIXES = {".eudb"}
DATA_MARKERS = ("data/docs/", "data/exports/", "data/dictionary/", "data/jobs/", "data/tmp/")
# Copyrighted sample banks live in the source tree for development only.
BUILTIN_MARKERS = ("app/builtin/", "builtin/sat2025-rw-b")



def find_forbidden(root: Path) -> list[str]:
    """Return relative paths that look like local runtime data."""
    found: set[str] = set()
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(root).as_posix()
        name = path.name.lower()
        if name in FORBIDDEN_FILES or path.suffix.lower() in FORBIDDEN_SUFFIXES:
            found.add(rel)
        elif rel.startswith("data/") or any(marker in f"/{rel}" for marker in DATA_MARKERS):
            found.add(rel)
        elif any(marker in f"/{rel}" for marker in BUILTIN_MARKERS):
            found.add(rel)
    return sorted(found)


def main(argv: list[str]) -> int:
    targets = [Path(arg).expanduser() for arg in argv[1:]]
    if not targets:
        print(__doc__.strip(), file=sys.stderr)
        return 2

    failures = 0
    for root in targets:
        if not root.exists():
            print(f"missing bundle path: {root}", file=sys.stderr)
            failures += 1
            continue
        forbidden = find_forbidden(root)
        if forbidden:
            failures += 1
            print(f"local data found in {root}:", file=sys.stderr)
            for rel in forbidden[:40]:
                print(f"  {rel}", file=sys.stderr)
            if len(forbidden) > 40:
                print(f"  … and {len(forbidden) - 40} more", file=sys.stderr)
        else:
            print(f"clean bundle: {root}")

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
