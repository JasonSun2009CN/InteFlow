# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for the InteFlow desktop backend.

WeasyPrint and CairoSVG are deliberately excluded: the desktop app renders
PDFs with Chromium (desktop/print-pdf.cjs) and math images with PyMuPDF, so
the bundle has no GTK/Pango system-library dependency on macOS or Windows.
"""

import os
import sys

from PyInstaller.utils.hooks import collect_submodules

ROOT = os.path.abspath(os.path.join(SPECPATH, ".."))
BACKEND = os.path.join(ROOT, "backend")

hiddenimports = collect_submodules("app")
hiddenimports += [
    "uvicorn.logging",
    "uvicorn.loops.auto",
    "uvicorn.loops.asyncio",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.http.h11_impl",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan.on",
]

if sys.platform == "darwin":
    # Native macOS OCR (optional, but shipped in the desktop build).
    hiddenimports += ["Vision", "Quartz", "Foundation", "objc"]

# Data shipped inside app/: templates, catalogues, etc. Copyrighted sample
# question banks under app/builtin are deliberately NOT packaged — they stay in
# the source tree for local development only (verify_bundle.py re-checks this).
BUILTIN_DIR = os.path.abspath(os.path.join(BACKEND, "app", "builtin"))
datas = []
for base, dirs, files in os.walk(os.path.join(BACKEND, "app")):
    base_abs = os.path.abspath(base)
    if base_abs == BUILTIN_DIR or base_abs.startswith(BUILTIN_DIR + os.sep):
        dirs[:] = []
        continue
    for name in files:
        if name.endswith((".md", ".json", ".yaml", ".yml", ".txt", ".html")):
            source = os.path.join(base, name)
            target = os.path.relpath(base, BACKEND).replace("\\", "/")
            datas.append((source, target))

a = Analysis(
    [os.path.join(SPECPATH, "backend_entry.py")],
    pathex=[BACKEND],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["weasyprint", "cairosvg", "pytest", "tkinter", "matplotlib"],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="inteflow-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name="inteflow-backend",
)
