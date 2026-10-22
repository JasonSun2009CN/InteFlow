# InteFlow — project website

A static landing page for InteFlow. No build step, no package manager, no
external fonts or CDNs. Everything is plain HTML, CSS and JavaScript, so it can
be served from GitHub Pages as-is.

## Preview locally

From the repository root:

```bash
python3 -m http.server 4173 --directory website
# open http://localhost:4173
```

Or use any static server (`npx serve website`, `caddy file-server`, …).
Opening `index.html` directly with `file://` mostly works, but iframes and
some browser APIs behave better over HTTP.

## What is here

```
website/
├── index.html               # Chinese landing page
├── en.html                  # English landing page (language switch in the header)
├── 404.html
├── assets/
│   ├── site.css             # all layout, components, responsive rules
│   ├── site.js              # nav, filters, theme lab, code tabs, copy, demo
│   └── favicon.svg
└── themes/                  # five live theme previews
    ├── clear-blue.html
    ├── paper-ink.html
    ├── minimal-light.html
    ├── midnight-navy.html
    ├── warm-editorial.html
    └── assets/
        ├── base.css         # component layout copied from theme-examples/
        ├── mock.js          # the same mock data, six-tab navigation
        └── themes/*.css     # one token block per theme
```

The theme previews are adapted from `/theme-examples` so the gallery shows the
real CSS tokens and component layout, not screenshots. Each preview is a
standalone page: the theme picker inside it switches to the other previews, and
the brand links back to the landing page.

## Live demo (`#demo`)

Between the workflow and the feature index, both landing pages embed a small
interactive practice demo. It is intentionally a *taste* of the app, not a
second implementation, but it is laid out like the real product:

- a practice screen modelled on the app: document header, passage + question
  cards, star-for-review, count-up clock, blue option cards, question palette
  and previous/next footer;
- four sample questions: attitude, words in context, algebra and fill-in-blank;
- a result screen with a score, per-question answers and links into review;
- a review screen modelled on the 2-of-4 workspace: two panes, the same four
  tool tabs (Question / Analysis / AI Tutor / Vocabulary), a switchable right
  pane, an editable sample analysis, canned AI text and a small word bank.
  Saved words are stored in `localStorage` under
  `inteflow.website.demo.vocab`; nothing is uploaded and no API is called.

The copy column next to the demo states the differences explicitly: four fixed
questions, no backend or saved attempts, canned AI, simplified review
(no drag-to-resize, autosave, Notebook or export) and only the default Clear
Blue theme. Notebook and Export buttons in the demo only show a short note.

All demo copy and questions live in the `DEMO` object in `assets/site.js`
(English and Chinese variants). The section shell is in `index.html` /
`en.html`; the JS fills `[data-demo-body]`. With JavaScript disabled, a note
inside the shell explains that the full app runs locally.

## Download ZIP

The hero, demo section and quick-start CTA link to GitHub's source archive
(`https://github.com/JasonSun2009CN/InteFlow/archive/refs/heads/main.zip`).
There is no ZIP checked into this directory, so the site stays small and the
download always matches the `main` branch. The archive does **not** include the
gitignored `data/` directory or dictionary files, which is what a fresh install
expects.

## GitHub Pages

The workflow at `.github/workflows/pages.yml` publishes the `website/`
directory on every push to `main` that touches it (or manually via
**Actions → Deploy website to GitHub Pages → Run workflow**).

One-time setup:

1. Open the repository on GitHub → **Settings** → **Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push to `main`, or run the workflow manually.
4. The site will be available at `https://<user>.github.io/InteFlow/`.

`website/.nojekyll` is included so Pages serves the files without Jekyll
processing. All URLs are relative, so the site works both at a project path
(`/InteFlow/`) and at a domain root.

## Editing

- **Copy and features** live in `index.html` (Chinese) and `en.html` (English).
  Feature cards use `data-cat="import|practice|review|vocab|output"`; update the
  counts in the filter bar and the `data-filter-count` default if you add or
  remove cards. Keep both language pages in sync: same sections, cards, ids and
  links, only the human-visible copy differs. Dynamic labels (filter counts,
  theme notes, copy feedback, demo UI) are picked from `assets/site.js` based on
  `<html lang>`.
- **The interactive demo** is the `DEMO` object in `assets/site.js`. Each
  language has its own `ui` labels and `questions` array (including the canned
  `ai` hint); keep the answer keys (`answer`, `accept`) and the two arrays in
  sync. The render functions live below the config: practice, result and the
  two-pane review workspace. Sample analysis and word entries are plain text
  (paragraphs separated by a blank line); the word bank persists term names
  only, while analysis edits stay in memory.
- **Theme metadata** for the interactive lab is the `THEMES` object near the
  top of `assets/site.js`. The five preview pages themselves keep their own copy
  of `THEMES` in `themes/assets/mock.js` for the in-preview switcher.
- **Visual tokens** (`--paper`, `--ink`, `--accent`, type stacks) are at the top
  of `assets/site.css`.
- The page intentionally avoids webfonts: display type uses Iowan Old Style /
  Palatino / Songti, UI type uses the system stack, and code uses SF Mono /
  Menlo. This keeps the site fast and works offline.

## Accessibility notes

- The page is usable without JavaScript: all feature cards show, the FAQ uses
  native `<details>`, and the first theme preview still renders. The demo is the
  only part that needs JS; its shell shows a short no-script note instead.
- The demo uses real buttons with `aria-pressed` / `aria-selected`, a visible
  focus ring, and text labels alongside every colour cue. Review questions can
  be reached with the keyboard; Enter in the fill-in field moves to the next
  question (or submits on the last one).
- Theme buttons use `role="tab"` and support arrow keys.
- The preview iframes are decorative (`pointer-events: none`, `tabindex="-1"`);
  each has an **Open full page** link for real interaction.
- `prefers-reduced-motion` disables reveal animations, count-ups and smooth
  scrolling.
