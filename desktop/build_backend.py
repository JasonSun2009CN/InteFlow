#!/usr/bin/env python3
"""Build the frozen FastAPI backend and stage it for Electron.

Usage:
    python desktop/build_backend.py

Produces desktop/backend-dist/inteflow-backend/ (PyInstaller onedir) and
copies it to desktop/build/backend/ where electron-builder picks it up.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

DESKTOP = Path(__file__).resolve().parent
DIST = DESKTOP / "backend-dist"
BUILD = DESKTOP / "build"
STAGE = BUILD / "backend"


def main() -> int:
    subprocess.run(
        [
            sys.executable,
            "-m",
            "PyInstaller",
            str(DESKTOP / "InteFlow.spec"),
            "--noconfirm",
            "--clean",
            "--distpath",
            str(DIST),
            "--workpath",
            str(DESKTOP / "build-tmp"),
        ],
        cwd=DESKTOP,
        check=True,
    )

    source = DIST / "inteflow-backend"
    if not source.is_dir():
        print(f"PyInstaller output missing: {source}", file=sys.stderr)
        return 1

    if STAGE.exists():
        shutil.rmtree(STAGE)
    STAGE.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source, STAGE)

    # electron-builder needs every extraResources source to exist.
    (BUILD / "tesseract").mkdir(parents=True, exist_ok=True)

    print(f"Staged backend -> {STAGE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
