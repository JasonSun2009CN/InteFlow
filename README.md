# InteFlow

> A local-first study workflow: **import a question bank (PDF/DOCX/Markdown) → practice → review every wrong answer → write analysis, look up words, ask AI → export your review notes and vocabulary.**

**中文**: [README-cn.md](README-cn.md)

![License](https://img.shields.io/badge/license-MIT-blue)
![Python](https://img.shields.io/badge/python-3.11%2B-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC?logo=tailwindcss&logoColor=white)
![Tests](https://img.shields.io/badge/pytest-187%20passed-2E7D32)

---

## Table of contents

- [What it is](#what-it-is)
- [Features](#features)
- [Two iron rules](#two-iron-rules)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Usage](#usage)
- [Optional features](#optional-features)
- [Configuration](#configuration)
- [Development](#development)
- [Project layout](#project-layout)
- [Troubleshooting](#troubleshooting)
- [Docs](#docs)
- [License](#license)

---

## What it is

InteFlow is a **web app that runs on your own machine** (FastAPI backend + React frontend + a single SQLite file).
Drop in a question bank (PDF / Word / Markdown), and it parses it into structured questions **locally, for zero tokens**.
Then you practice in a clean, exam-style fullscreen UI, get graded automatically, and work through every wrong
answer in a review workspace: write your own analysis, collect vocabulary, and — only when you explicitly click —
ask an AI to explain. Finally, export your review and vocabulary as files.

It grew out of an SAT practice tool, but it is **not SAT-only**: a question's *section* is a free-form label
(`rw`, `math`, `physics`, `history`, ...), and any numbered 4-option question bank works.

```
import PDF / DOCX / Markdown ──► local parse (0 token) ──► fill in answers
        ──► exam-style fullscreen practice ──► grading + review workspace
        ──► analysis / vocabulary / AI explain ──► export notes · vocabulary
```

## Features

| Area | Capability |
|---|---|
| **Import** | PDF (PyMuPDF deterministic conversion: columns / numbering / options / **answer-key back-fill** / image extraction), DOCX (paragraphs / tables / images + zip safety checks), `.md` / `.ifmd.md`, **scanned-page OCR** (macOS Vision or system `tesseract`), import pipeline (per-page report, cancelable), 60 MB cap |
| **Built-in bank** | `SAT机考25年语文合集（下）` — **44 units / 1186 questions**, one-click **Add** / **Add all**, offline, 0 token, idempotent |
| **Library** | Document list (question count, answered count, answer status), practice history, cascade delete |
| **Answer entry** | Per-question A–D grid + **bulk paste** (`1-A 2-C` / `1. A` / `ACBDA`) + validation + preview, written back to the source file |
| **Practice** | Exam-style fullscreen, **count-up or countdown timer**, single-question view, question palette, flagging, keyboard `A–D` / `← →`, submit confirmation |
| **Results / review** | Score / per-section / time stats, `All · Correct · Wrong` filter, three-pane master–detail, re-grade after back-filling the key |
| **Workspace** | Hand-written analysis (stored locally), vocabulary sheet `Word \| Meaning \| Notes` (add/edit/delete + export `.xlsx`), **AI explain** (explicit click), export entry points |
| **Export** | **PDF** (WeasyPrint: footer page numbers, images, MathJax SVG math), **DOCX** (python-docx), vocabulary **`.xlsx`** |
| **Settings** | 16 LLM providers catalog, protocol (openai / anthropic), Base URL, API key (masked), model, connectivity test |

> **Planned (placeholders in place, details TBD):** in-app **dictionary lookup** for selected words, and a
> dedicated **wrong-answer analysis export**. See [`docs/IDEAS.md`](docs/IDEAS.md) and [`ROADMAP.md`](ROADMAP.md).

## Two iron rules

1. **The LLM is never on the main path.** Import / parse / grade / export are all deterministic local computation,
   **0 token**. An external API is only called when you explicitly click **AI Answer** (or run the connectivity test).
2. **Local-first.** All data lives under `data/` in this repo (`app.db` + each document's `doc.ifmd.md` and images).
   Nothing is uploaded to any cloud.

## Requirements

| Dependency | Version | Purpose |
|---|---|---|
| Python | **3.11+** (tested on 3.13) | Backend |
| Node.js | **18+** | Frontend build / dev server; (optional) export math rendering |
| `pip install -r backend/requirements.txt` | — | fastapi · uvicorn · pymupdf · httpx · weasyprint · python-docx · openpyxl · cairosvg … |
| `npm install` (in `frontend/`) | — | React 19 + Vite 7 + Tailwind 4 |

<details>
<summary><b>System libraries WeasyPrint (PDF export) needs</b></summary>

PDF export depends on pango / cairo / gdk-pixbuf / harfbuzz:

```bash
# macOS
brew install pango cairo gdk-pixbuf harfbuzz

# Debian / Ubuntu
sudo apt install libpango-1.0-0 libpangoft2-1.0-0 libcairo2 libgdk-pixbuf-2.0-0 libharfbuzz0b
```

Without them **only PDF export fails**; everything else keeps working.
</details>

## Quick start

### macOS / Linux

```bash
git clone <your-repo-url> InteFlow
cd InteFlow

# First run: create the env + install deps (idempotent)
./scripts/setup.sh

# Start the dev environment (backend :8000 + frontend :5173)
./scripts/dev.sh
```

### Windows (PowerShell)

```powershell
git clone <your-repo-url> InteFlow
cd InteFlow

.\scripts\setup.ps1
.\scripts\dev.ps1
```

- Backend API: <http://localhost:8000> (health check <http://localhost:8000/api/health>)
- Frontend page: <http://localhost:5173> ← **open this in your browser**

Press `Ctrl-C` to stop both.

<details>
<summary><b>Starting manually (without dev.sh / dev.ps1)</b></summary>

```bash
# 1) backend (terminal A)
python3 -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn app.main:app --app-dir backend --reload --port 8000

# 2) frontend (terminal B)
cd frontend
npm install
npm run dev
```
</details>

## Usage

> The interface is in English; the button/page names below match the UI.

### 1. Import a question bank

Open <http://localhost:5173>. The home page is **Select an exam** (only imported exams are listed).
Management (import / built-in bank / settings) lives behind the unobtrusive **Manage** link at the bottom right (`/manage`).

1. Click **Manage**.
2. **Upload a file**: drop it on *Drag a file here*, or click **choose a file**.
   Supported: `PDF · DOCX · .md · .markdown · .ifmd.md` (≤ 60 MB; questions must be numbered `1.` `2.` …, each with four options).
3. **Wait for the pipeline**: `detect → convert → review`, with a **per-page report** (text / OCR / low-confidence / no-engine).
   - Clean conversion → committed automatically;
   - Suspicious pages → it pauses at review so you can **Commit** or **Cancel** (0 token throughout).
4. **(Optional) built-in bank**: expand the bank card on the Manage page, grouped by date, and click **Add** per unit or **Add all**.
5. **Back home to practice**: return to **Select an exam** and click **Start**.

<details>
<summary>No bank file? Write your own IFMD by hand</summary>

The Manage page's template card provides a valid `.ifmd.md` template you can copy or download. See
[`docs/IFMD.md`](docs/IFMD.md) for the format.
</details>

### 2. Enter answers

When a document parses into questions but the **answer key is missing/partial**, click **Answers** (`/doc/:id/answers`):

- **Per-question grid**: click A/B/C/D for each question;
- **Bulk entry**: paste `1-A 2-C 3-D`, `1. A`, `12B`, or a bare letter string `ACBDA`, then **Apply to grid**;
- Saving validates (A–D only) and writes back to `doc.ifmd.md`; use **Preview** to check first.

> You can also practice first: after submitting, the app guides you here to back-fill the key, then re-grades automatically.

### 3. Practice

From **Select an exam**, click **Start** to reach the start screen:

1. The start screen shows *Ready to begin* + the question count. Choose a **timer mode**:
   - **Count-up** — just track elapsed time;
   - **Countdown** — enter `mm:ss`; the app remembers your last value.
2. Click **Begin — enter fullscreen**; **the timer starts now**. (You can also *Enter answers first*.)
3. Answer with the mouse or the keyboard **`A` `B` `C` `D`**; use **`←` `→`** to move; the bottom palette jumps anywhere;
   **Mark for review** flags the current question.
4. Click **Submit** → confirm → submit for grading.

### 4. Results & review

After submitting you land on `/session/:sid/result`:

- **Stats**: Score, one card per section actually present in the paper, and Time; plus **Wrong answers** chips (click to jump).
- **Filter tabs**: `All` / `Correct` / `Wrong`.
- **Three panes**: question index (status colors) → single question (`←` `→`, `n / total`) → the persistent workspace.

**Workspace (right side):**

| Section | Use |
|---|---|
| **Explanation** | Write your own analysis for the current question; saved straight to the DB (0 token) |
| **Vocabulary** | `Word \| Meaning \| Notes` sheet, add/remove rows/columns, edit and save; **Export .xlsx** |
| **AI Answer** | Calls the LLM only on an explicit click (stem + correct option as context) |
| **Export** | **Export .pdf** / **Export .docx** of the questions, answers and analysis (no AI involved) |

### 5. Export

- **Whole document**: the workspace **Export** section → `Export .pdf` or `Export .docx`.
- **Vocabulary**: **Export .xlsx**.

### 6. Configure the LLM (optional)

**Not required for anything except AI explain.** Open **⚙ Settings** (`/settings`) from the Manage page:

1. **Provider** dropdown (16-provider catalog with Base URL + default model);
2. **Base URL** override;
3. **API Key** (write-only, masked);
4. **Model**;
5. **Save settings** / **Test connection**.

## Optional features

| Feature | What it does | Install |
|---|---|---|
| **Scanned-PDF OCR** | Per-page text-density detection; low-density pages are rasterized and recognized, coordinates normalized back into the pipeline | Either system `tesseract` or, on macOS, `pip install pyobjc-framework-Vision`. Without one, the import page says so and never crashes |
| **Export math** | TeX → SVG (inline in PDF / PNG in DOCX) | `cd backend/app/export/mathjax && npm install` (missing → falls back to plain text, export never fails) |

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `INTEFLOW_DATA` | `./data` | Data root (`app.db`, `docs/<id>/`, `tmp/`, `exports/`, `jobs/`). Tests use isolated temp dirs |
| `INTEFLOW_API` | `http://localhost:8000` | Vite dev-proxy backend target |
| `INTEFLOW_OCR_LANG` | `eng` | Tesseract OCR language |
| `INTEFLOW_DEFAULT_SECTION` | `rw` | Fallback section label when the converter finds no section heading |

Ports: backend `8000`, frontend `5173`.

> ⚠️ `data/` is the real data directory (git-ignored). Back it up before clearing.

## Development

```bash
# backend tests (baseline 187 passed, 1 skipped; uses a temp data dir)
cd backend && ../.venv/bin/python -m pytest -q

# frontend type-check + build (0 errors)
cd frontend && npm run build

# frontend component tests
cd frontend && npm test

# local dev (backend :8000 + frontend :5173)
./scripts/dev.sh
```

## Project layout

```
InteFlow/
├── backend/
│   ├── app/
│   │   ├── main.py            FastAPI wiring (/api/health, 6 routers)
│   │   ├── api/               documents · imports · builtin · sessions · settings · ai
│   │   ├── convert/           pdf · docx · twocolumn · images · normalize · ocr/ · llm_fallback
│   │   ├── ifmd/              InteFlow-MD parser + writer (deterministic state machine)
│   │   ├── export/            PDF (WeasyPrint) · docx · math_render (+ mathjax bridge)
│   │   ├── repos/ · llm/      persistence · LLM transport
│   │   ├── sections.py        free-form section labels
│   │   ├── providers.py       16-provider catalog
│   │   └── builtin/           built-in bank (44 units shipped with the repo)
│   ├── tests/                 pytest (187)
│   └── requirements.txt
├── frontend/                  Vite + React 19 + TS + Tailwind 4
│   └── src/pages/             ExamHome · Import(Manage) · AnswerKey · Practice · Result · Settings
├── scripts/dev.sh             one-command dev environment
├── data/                      runtime data (git-ignored)
└── docs/                      ARCHITECTURE · IFMD · IDEAS · legacy/
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `dev.sh` says a port is in use | `lsof -i :8000` / `:5173`, kill the process, or start on another port |
| Page stuck on Loading / can't reach the backend | Confirm the backend is alive at <http://localhost:8000/api/health>; if the backend is elsewhere set `INTEFLOW_API` and restart Vite |
| Scanned PDF needs OCR | Install `tesseract`, or on macOS `pip install pyobjc-framework-Vision`, restart the backend, re-import |
| DOCX rejected | Uploads get a zip safety check (entry count / total uncompressed size / compression ratio / macros); unusual or encrypted files are rejected |
| PDF export fails | Install the WeasyPrint system libraries (see [Requirements](#requirements)) |
| Math renders as plain text on export | `cd backend/app/export/mathjax && npm install`, then retry |
| `npm run build` type errors | `cd frontend && npm install`, then retry |
| Start over from scratch | Back up and delete `data/` (or point `INTEFLOW_DATA` at a new dir); the backend recreates the DB on start |

## Docs

- [`README-cn.md`](README-cn.md) — Chinese README
- [`AGENT.md`](AGENT.md) — project handoff / working notes for AI agents and contributors (Chinese)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — architecture, data model, API surface
- [`docs/IFMD.md`](docs/IFMD.md) — the InteFlow-MD question format
- [`docs/IDEAS.md`](docs/IDEAS.md) — a running list of modification ideas
- [`ROADMAP.md`](ROADMAP.md) — roadmap and known gaps
- [`docs/legacy/`](docs/legacy) — historical planning docs from the predecessor project (reference only)

## License

[MIT](LICENSE)
