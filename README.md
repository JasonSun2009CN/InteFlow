# InteFlow

> A local-first study workflow: **import a question bank (PDF/DOCX/Markdown) → practice → review every wrong answer → write analysis, look up words, ask AI → export your review notes and vocabulary.**

**中文**: [README-cn.md](README-cn.md)

![License](https://img.shields.io/badge/license-MIT-blue)
![Python](https://img.shields.io/badge/python-3.11%2B-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC?logo=tailwindcss&logoColor=white)
![Tests](https://img.shields.io/badge/pytest-288%20passed-2E7D32)

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
| **Subjects** | User-defined subject groups (e.g. SAT Math, Physics) with a color; assign each paper inline from Library or the answer-key header, create a subject on the spot, manage/rename/recolor/delete it, filter Library and Exams by subject. Deleting a group only moves its papers to Uncategorized |
| **Answer entry** | Per-question letter grid, one button per option (A–E for AMC, A–D for the SAT key; **multi**-select where the question allows it) + **fill-in-the-blank answers** (add extra acceptable spellings with ⊕) + **bulk paste** (`1-A 2-C` / `1. A` / `ACBDA` / multi `3-AC` / `1-E`) + validation + preview, written back to the source file |
| **Practice** | Exam-style fullscreen, **count-up or countdown timer**, single-question view, question palette, flagging, keyboard option letters / `← →`, multi-select and blank answers, submit confirmation |
| **Results / review** | Score / per-section / time stats, **fullscreen review** (no sidebar), `All · Correct · Wrong` filter, collapsible top-left question navigator, question on the left + a **Pages-style analysis editor** on the right (autosave / resume), re-grade after back-filling the key |
| **Workspace** | **2-of-4 pane split** (Question · Analysis · AI Tutor · Vocabulary) with per-pane switching, one analysis page per question (Markdown, formulas/images), drag a word from a question/option into the vocabulary pane (Merriam-Webster sense, optional AI matching), add/edit/delete + export `.xlsx`, export drawer |
| **Vocabulary** | One word list per paper (Word · POS · Meaning · Notes), local Merriam-Webster lookup, drag-to-add, manual add/edit, `.xlsx` export, and a built-in **Word test**: random sample or test all, **English → Chinese** (typed meaning) or **Chinese → English** (spelling), local lenient grading, optional strict AI grading, result table + compact-JSON QR codes |
| **Export** | **PDF** (WeasyPrint: footer page numbers, images, MathJax SVG math), **DOCX** (python-docx), **review notebook md/docx/pdf** (only analysed questions; also saved under `data/exports/`), vocabulary **`.xlsx`** |
| **Settings** | 19 LLM providers catalog, protocol (openai / anthropic), Base URL, API key (masked), model, connectivity test, **your name** (export cover), **AI recognition fallback**, **AI sense matching**, **learner's definitions**, **AI grading for word tests** |

> **Dictionary:** lookups run locally against a user-installed Eudic `.eudb` (Merriam-Webster).
> Put the standard file in `dictionary/`; optionally put a learner's dictionary in `dictionary/learners/`
> and enable **Use learner's definitions**. The index is built automatically on first lookup (0 token).
> See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Two iron rules

1. **The LLM is never on the main path.** Import / parse / grade / export default to deterministic local computation,
   **0 token**. An external API is only called when you explicitly act: click **AI Answer**, run the connectivity test,
   or submit a word test after enabling **AI grading for word tests** in Settings (off by default; failures fall back to local grading).
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

### One command (recommended)

```bash
git clone <your-repo-url> InteFlow
cd InteFlow

# macOS / Linux
./start.sh
```

```powershell
# Windows (PowerShell)
.\start.ps1
```

`start.sh` / `start.ps1` are **idempotent**: the first run creates `.venv` and installs backend +
frontend deps (only what's missing); later runs just start. It brings up **backend :8000** and
**frontend :5173**, waits for the backend health check, and **opens your browser**. Press `Ctrl-C`
to stop both.

- **macOS double-click**: open **`InteFlow.command`** in Finder.
- **Windows double-click**: double-click **`start.bat`**.
- Change ports: `INTEFLOW_BACKEND_PORT=8010 INTEFLOW_FRONTEND_PORT=5174 ./start.sh`
  (Windows: `$env:INTEFLOW_FRONTEND_PORT=5174; .\start.ps1`).
- Missing Python/Node or an occupied port fails fast with a clear message.

- Backend API: <http://localhost:8000> (health check <http://localhost:8000/api/health>)
- Frontend page: <http://localhost:5173> ← **open this in your browser**

<details>
<summary><b>Step by step (setup + dev) and manual start</b></summary>

```bash
# Step 1: create the env + install deps only (idempotent)
./scripts/setup.sh          # Windows: .\scripts\setup.ps1

# Step 2: start the dev environment
./scripts/dev.sh            # Windows: .\scripts\dev.ps1
```

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

Open <http://localhost:5173>. The left sidebar has six tabs: **Exams** (pick one to take),
**Library** (import a file, add the built-in bank, manage your exam list, group papers by subject), **Sessions** (every **submitted**
attempt, searchable/deletable), **Mistakes**, **Vocabulary** and **Settings**. **Mistakes** is a placeholder for now;
**Vocabulary** holds the per-paper word lists and the word test.

1. Open **Library** in the sidebar.
2. **Upload a file**: drop it on *Drag a file here*, or click **choose a file**.
   Supported: `PDF · DOCX · .md · .markdown · .ifmd.md` (≤ 60 MB; questions must be numbered `1.` `2.` …;
   choice questions have two or more labelled options (A, B, C, …, up to 26 — AMC
   prints five) — **no options means it is imported as a fill-in-the-blank**).
3. **Wait for the pipeline**: `detect → convert → review`, with a **per-page report** (text / OCR / low-confidence / no-engine).
   - Clean conversion → committed automatically;
   - Suspicious pages → it pauses at review so you can **Commit** or **Cancel** (0 token throughout).
4. **(Optional) built-in bank**: expand the bank card on the Library page, grouped by date, and click **Add** per unit or **Add all**.
5. **Back home to practice**: return to **Select an exam** and click **Start**.

**Group papers by subject (optional).** In **Library**, each paper's row has a **Subject** dropdown — pick an
existing group or **+ New subject…** to create one (e.g. *SAT Math*) and assign it in the same step. You can also
preselect a subject above the upload box for the next import. **Manage subjects** renames, recolors, or deletes
groups; deleting one moves its papers to *Uncategorized* without touching questions, answers, analysis, or word
lists. The **Exams** home page shows each paper's subject badge and has filter chips, and the answer-key page lets
you change the subject too.

<details>
<summary>No bank file? Write your own IFMD by hand</summary>

The Library page's template card provides a valid `.ifmd.md` template you can copy or download. See
[`docs/IFMD.md`](docs/IFMD.md) for the format.
</details>

### 2. Enter answers

When a document parses into questions but the **answer key is missing/partial**, click **Answers** (`/doc/:id/answers`):

- **Choice grid**: click A/B/C/D for each question; **multi**-select questions (marked `multi`) accept several;
- **Fill in the blank**: type the answer; click **⊕ Add acceptable answer** to list several accepted spellings (any match grades correct);
- **Bulk entry**: paste `1-A 2-C 3-D`, `1. A`, `12B`, a bare letter string `ACBDA`, or multi `3-AC`, then **Apply to grid**;
- Saving validates and writes back to `doc.ifmd.md`; use **Preview** to check first.

> You can also practice first: after submitting, the app guides you here to back-fill the key, then re-grades automatically.

### 3. Practice

From **Select an exam**, click **Start** to reach the start screen:

1. The start screen shows *Ready to begin* + the question count. Choose a **timer mode**:
   - **Count-up** — just track elapsed time;
   - **Countdown** — enter `mm:ss`; the app remembers your last value.
2. Click **Begin — enter fullscreen**; **the timer starts now**. (You can also *Enter answers first*.)
3. Answer with the mouse or the keyboard **`A` `B` `C` `D`** (choice questions); **multi** questions toggle several
   options and **fill-in-the-blank** questions take typed text; use **`←` `→`** to move; the bottom palette jumps
   anywhere; **Mark for review** flags the current question.
4. Click **Submit** → confirm → submit for grading.

### 4. Results & review

After submitting you land on `/session/:sid/result` (**fullscreen review, no sidebar**):

- **Top-left question navigator**: collapsed to a small pill by default; clicking it rotates the chevron and
  **floats open** the whole question list (status colors) with `All` / `Wrong` / `Correct` tabs. Picking a
  question selects it and closes the overlay (`Esc` or a click outside also closes).
- **Split view**: the current question, the correct answer and your pick on the left; a **Pages-style analysis
  editor** (one page per question) on the right.
- **Analysis editor**: Markdown (formulas `$x^2$`, images `![](assets/…)`), `Write` / `Preview`, and
  **autosave** (~0.9 s debounce; `⌘S` or **Save** for immediate). It resumes next time you open the attempt.
- **Notebook**: the top-bar button opens a full-exam preview — the exam title, then every question that already
  has analysis (stem, figures and notes), with export buttons.
- **Toolbar drawer**: `AI` (explicit LLM explain), `Vocabulary` (this paper's word sheet, `.xlsx` export),
  `Export` (review notebook — see §6).
- If the key was missing while you practiced, saving re-grades automatically (regrade).

### 5. Vocabulary & word tests

Open **Vocabulary** in the sidebar. The page has two tabs:

- **Word list** — pick a paper on the left, then edit its word sheet on the right (Word · POS · Meaning · Notes).
  You can add words manually, look them up in the local Merriam-Webster dictionary, drag a word from a question or
  option into the review workspace's vocabulary pane, and export the sheet as `.xlsx`.
- **Word test** — pick the paper (the list follows the selected paper), choose a mode and how many words to test:
  1. **English → Chinese** — the English word is shown; type its meaning. Local grading is deliberately lenient
     (exact, a listed segment, a long-enough substring, or all words of a multi-word answer).
  2. **Chinese → English** — the Meaning column is shown (if empty, the first Merriam-Webster sense); spell the
     English word. Case, spaces and punctuation are ignored. A Word cell may list several accepted spellings
     separated by `;`, `/`, `|`, a newline, or commas when every item is a single word.
  3. Choose a count or **test all**, then start. Questions are sampled randomly from the current paper's list;
     correct answers stay on the server until you submit.
  4. After submitting you get accuracy, the tested word range, and a per-word table with the correct answer and
     yours. The result is also encoded as **compact JSON QR codes** (large tests are split into multiple parts,
     prefixed `IFWT1|<id>|part/total|`), and a `.json` download is offered.
  5. AI grading is **off by default**. Turn on **AI grading for word tests** in Settings to have the model grade
     both modes against the word-list meaning plus Merriam-Webster, with strict instructions to reject vague
     answers; if no key is configured or a call fails, the app falls back to local grading and says so.

### 6. Export

- **Review notebook**: preview it with **Notebook** in the review top bar, then export **Markdown / DOCX / PDF**
  (also available in the **Export** drawer). One notebook per exam (cover with your name and score), containing
  only questions that have analysis; it downloads in the browser and a copy is kept in `data/exports/`, with the
  saved path shown in the UI.
- **Whole document**: export **PDF** / **DOCX** (questions, answers and analysis) from the Library.
- **Vocabulary**: **Export .xlsx**.

### 7. Settings (name / LLM / fallback / vocabulary / word tests)

**Not required for anything except AI explain / word-test AI grading.** Open **Settings** (`/settings`) from the sidebar:

1. **Your name** — used on the review notebook cover;
2. **AI recognition fallback** — LLM fallback when import recognition fails (on by default); with it off, a
   failed import tells you to enable it, then retry once the toggle is on and an API key is set;
3. **Provider** dropdown (19-provider catalog, defaults to **OrcaRouter**, with Base URL + default model);
4. **Base URL** override;
5. **API Key** (write-only, masked);
6. **Model**;
7. **AI sense matching** — let the model choose the Merriam-Webster sense when a word is dragged into the vocabulary pane (off = first sense, no tokens);
8. **Use learner's definitions** — prefer a learner's dictionary installed under `dictionary/learners/` (falls back to the standard dictionary);
9. **AI grading for word tests** — grade submitted word tests with the model (off = local grading, 0 token; failures fall back to local);
10. **Save settings** / **Test connection**.

Base URLs are kept exactly as each vendor documents them: OpenAI-style ones already carry `/v1`, Anthropic-style ones do not (the SDK adds it), and the app inserts `/v1` only when it is missing — so both can be pasted verbatim.

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
| `INTEFLOW_DICTIONARY` | `./dictionary` | Standard Eudic `.eudb` file or folder |
| `INTEFLOW_DICTIONARY_INDEX` | `data/dictionary/mw.db` | Standard dictionary index |
| `INTEFLOW_LEARNER_DICTIONARY` | `./dictionary/learners` | Optional learner's Eudic `.eudb` file or folder |
| `INTEFLOW_LEARNER_DICTIONARY_INDEX` | `data/dictionary/learners.db` | Learner's dictionary index |

Ports: backend `8000`, frontend `5173`.

> ⚠️ `data/` is the real data directory (git-ignored). Back it up before clearing.

## Development

```bash
# backend tests (baseline 288 passed, 1 skipped; uses a temp data dir)
cd backend && ../.venv/bin/python -m pytest -q

# frontend type-check + build (0 errors)
cd frontend && npm run build

# frontend component tests
cd frontend && npm test

# one command: setup if needed + start both (backend :8000 + frontend :5173) + open browser
./start.sh

# or start with the env already in place (no preflight checks)
./scripts/dev.sh
```

## Project layout

```
InteFlow/
├── backend/
│   ├── app/
│   │   ├── main.py            FastAPI wiring (/api/health, 11 routers)
│   │   ├── api/               documents · imports · builtin · sessions · settings · ai · analysis · dictionary · vocabulary · word_exam · subjects
│   │   ├── convert/           pdf · docx · twocolumn · images · normalize · ocr/ · llm_fallback
│   │   ├── ifmd/              InteFlow-MD parser + writer (deterministic state machine; multi / blank)
│   │   ├── export/            PDF (WeasyPrint) · docx · notebook (review) · math_render (+ mathjax bridge)
│   │   ├── repos/ · llm/      persistence · LLM transport
│   │   ├── sections.py        free-form section labels
│   │   ├── providers.py       19-provider catalog
│   │   ├── vocab_assist.py    drag-to-add sense selection (optional AI)
│   │   ├── word_exam.py       word-test build / local grading / optional AI grading
│   │   ├── repos/subjects.py  subject groups: CRUD + paper assignment
│   │   └── builtin/           built-in bank (44 units shipped with the repo)
│   ├── tests/                 pytest (288)
│   └── requirements.txt
├── frontend/                  Vite + React 19 + TS + Tailwind 4
│   ├── src/pages/             ExamHome · Library(Import) · Sessions · Mistakes · Vocabulary · AnswerKey · Practice · Result · Settings
│   ├── src/components/        workspace panes · VocabGrid · WordExamPanel / WordExamResultView · SubjectControls · import/library UI
│   └── src/lib/               wordExamQr (compact JSON + multi-part QR) · subjects (palette) · theme · sections
├── start.sh / start.ps1        one-command start (auto setup + both servers + browser)
├── InteFlow.command           macOS double-click start
├── start.bat                  Windows double-click start
├── scripts/dev.sh             one-command dev environment (no preflight checks)
├── data/                      runtime data (git-ignored)
└── docs/                      ARCHITECTURE · IFMD · IDEAS · legacy/
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `start.sh` / `dev.sh` says a port is in use | `lsof -i :8000` / `:5173`, kill the process, or start on another port (`start.sh` checks first and tells you) |
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
