# Desktop builds

InteFlow ships as a normal desktop application: a bundled FastAPI backend plus an
Electron window that loads the same React UI as the browser build. Users do not
need Python, Node, or the source checkout.

## Download

Releases are published at:

- Website download page: <https://jasonsun2009cn.github.io/InteFlow/download-en.html>
- GitHub Releases: <https://github.com/JasonSun2009CN/InteFlow/releases>

| Platform | Artifact |
| --- | --- |
| macOS Apple Silicon | `InteFlow-<version>-arm64.dmg` |
| macOS Intel | `InteFlow-<version>-x64.dmg` |
| Windows x64 | `InteFlow-Setup-<version>-x64.exe` |

The builds are **not signed or notarized** yet:

- macOS: first launch → right-click the app → **Open**. If macOS still blocks it,
  run `xattr -dr com.apple.quarantine /Applications/InteFlow.app`.
- Windows: SmartScreen → **More info** → **Run anyway**.

## Data locations

| What | macOS | Windows |
| --- | --- | --- |
| Database, documents, exports | `~/Library/Application Support/InteFlow/data` | `%APPDATA%\InteFlow\data` |
| Merriam-Webster `.eudb` source | `~/Library/Application Support/InteFlow/dictionary` | `%APPDATA%\InteFlow\dictionary` |
| Backend log | `~/Library/Application Support/InteFlow/logs/backend.log` | `%APPDATA%\InteFlow\logs\backend.log` |

Use **File → Open data folder / Open dictionary folder / Show backend log** in the
app menu. The `INTEFLOW_DATA` and `INTEFLOW_DICTIONARY` environment variables still
override these paths for development.

### A fresh install is empty

The installer contains the application code and the bundled sample bank, but **no
user data**: no `app.db`, imported documents, sessions, analyses, vocabulary,
exports or dictionary index. Runtime state is created under the app-data folder
on first launch. `desktop/verify_bundle.py` checks this in CI and fails the build
if a database, `.eudb` file or `data/` tree leaks into the packaged resources.

The bundled SAT sample bank is **hidden by default** (`show_builtin_library`
is `false`), so Library opens with only the import card. Users who want the
sample units can enable **Settings → Show built-in library**.

**File → Reset local data…** (also in Settings → Desktop) stops the backend,
clears the app-data folder, web storage and cache, and restarts into the same
first-run state. Dictionary source files (`dictionary/*.eudb`) are kept; the
derived index lives in `data/` and is rebuilt on demand.

## What is bundled

- The FastAPI backend frozen with PyInstaller (`desktop/InteFlow.spec`).
- The built React frontend (`frontend/dist`).
- The bundled SAT sample bank (present but hidden until **Show built-in library** is enabled).
- MathJax plus the TeX→SVG bridge. There is no separate Node install: the backend
  invokes the Electron binary with `ELECTRON_RUN_AS_NODE=1`.
- macOS: the `pyobjc` Vision framework for OCR.
- Windows: Tesseract (`tesseract.exe`, DLLs, `eng.traineddata`).

WeasyPrint and CairoSVG are intentionally **not** bundled. They need GTK/Pango
system libraries, which are painful on Windows. Instead:

- PDF export renders the same export HTML with Chromium inside the app
  (`desktop/print-pdf.cjs`, exposed to Python as a local PDF bridge).
- DOCX math images use PyMuPDF as a CairoSVG fallback.

The web/`start.sh` build still uses WeasyPrint/CairoSVG, so both paths keep the
same features.

## Build locally

Prerequisites: Node 22+, Python 3.11–3.14, and the platform's normal build tools.

```bash
# 1. frontend
cd frontend && npm ci && npm run build && cd ..

# 2. MathJax bridge
cd backend/app/export/mathjax && npm ci --omit=dev && cd ../../..

# 3. Python build environment
python3 -m venv .venv-build
.venv-build/bin/pip install -r desktop/requirements-desktop.txt   # Windows: .venv-build\Scripts\pip

# 4. frozen backend + staged resources
.venv-build/bin/python desktop/build_backend.py
.venv-build/bin/python desktop/prepare_resources.py

# 5. Electron package (use --x64 on an Intel Mac, --arm64 on Apple Silicon)
cd desktop && npm ci && npx electron-builder --mac --arm64 --publish never
# Windows: npx electron-builder --win --x64 --publish never

# 6. fail if local user data leaked into the bundle
APP=$(ls -d desktop/release/mac*/InteFlow.app | head -1)
python desktop/verify_bundle.py "$APP/Contents/Resources"
# Windows: python desktop/verify_bundle.py "desktop/release/win-unpacked/resources"
```

Artifacts land in `desktop/release/`.

Quick check without packaging:

```bash
cd desktop
INTEFLOW_SMOKE=1 npx electron .
# prints INTEFLOW_SMOKE_OK {"title":"InteFlow","rootChildren":1}
```

## CI and releases

`.github/workflows/desktop.yml` builds three artifacts on every push to `main`
(artifact only) and on every tag `v*` (artifact + GitHub Release):

- `macos-15` → arm64 DMG
- `macos-15-intel` → x64 DMG
- `windows-2025` → x64 NSIS installer

Every build runs `desktop/verify_bundle.py` against the packaged resources so a
bundle that contains local data fails instead of being published. All artifacts
are attached to one GitHub Release by a final job. `workflow_dispatch` builds
the same artifacts without publishing a release.

## Signing / notarization (later)

The macOS app is ad-hoc signed by `desktop/afterPack.cjs` so Apple Silicon will run
it, but it is not notarized. To remove the Gatekeeper prompt you need an Apple
Developer ID certificate, then:

1. Store the certificate (`.p12`) and password in GitHub Secrets.
2. Replace `"identity": null` in `desktop/package.json` with the identity name.
3. Add `notarize` credentials (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`,
   `APPLE_TEAM_ID`) and let electron-builder run `notarytool`.

For Windows, an EV/OV code-signing certificate removes SmartScreen warnings.
