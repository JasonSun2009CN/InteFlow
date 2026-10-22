#!/usr/bin/env python3
"""Stage web assets and the MathJax bridge for electron-builder.

Usage:
    python desktop/build_backend.py       # frozen backend
    python desktop/prepare_resources.py   # web + mathjax + placeholders
    cd desktop && npx electron-builder …
"""

from __future__ import annotations

import shutil
from pathlib import Path

DESKTOP = Path(__file__).resolve().parent
ROOT = DESKTOP.parent
BUILD = DESKTOP / "build"


def copy_tree(source: Path, target: Path) -> None:
    if target.exists():
        shutil.rmtree(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source, target)
    print(f"staged {source} -> {target}")


def main() -> int:
    BUILD.mkdir(parents=True, exist_ok=True)

    web = ROOT / "frontend" / "dist"
    if not (web / "index.html").is_file():
        raise SystemExit("frontend/dist is missing — run `npm run build` first")
    copy_tree(web, BUILD / "web")

    mathjax_src = ROOT / "backend" / "app" / "export" / "mathjax"
    mathjax_dst = BUILD / "mathjax"
    if mathjax_dst.exists():
        shutil.rmtree(mathjax_dst)
    mathjax_dst.mkdir(parents=True)
    for name in ("render.mjs", "package.json", "package-lock.json"):
        shutil.copy2(mathjax_src / name, mathjax_dst / name)

    # electron-builder deliberately ignores node_modules inside extraResources,
    # so ship the packages as a plain "vendor" folder. render.mjs imports
    # MathJax by relative path; NODE_PATH lets MathJax's own require() calls
    # resolve the remaining packages (mhchemparser, etc.).
    modules = mathjax_src / "node_modules"
    if modules.is_dir():
        vendor = mathjax_dst / "vendor"
        vendor.mkdir(parents=True, exist_ok=True)
        for package in sorted(modules.iterdir()):
            if package.name.startswith(".") or not package.is_dir():
                continue
            shutil.copytree(package, vendor / package.name)
        print("staged MathJax -> build/mathjax/vendor")
    else:
        print("warning: MathJax node_modules missing; formulas will fall back to text")

    (BUILD / "tesseract").mkdir(parents=True, exist_ok=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
