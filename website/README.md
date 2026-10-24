# InteFlow — project website

A static, multi-page site for InteFlow. No build step, no package manager, no
external fonts or CDNs. Everything is plain HTML, CSS and JavaScript, so it can
be served from GitHub Pages as-is.

## Preview locally

From the repository root:

```bash
python3 -m http.server 4173 --directory website
# open http://localhost:4173
```

Or use any static server (`npx serve website`, `caddy file-server`, …).
Opening `index.html` directly with `file://` mostly works, but iframes, the
download lookup and some browser APIs behave better over HTTP.

## Pages

| Page | Purpose |
| --- | --- |
| `index.html` / `en.html` | Home. Hero, a prominent download strip right below it, a short “why”, and links into the other pages. |
| `download.html` / `download-en.html` | Platform downloads, first-launch notes and source instructions. |
| `features.html` / `features-en.html` | Boundaries, workflow, all 22 features, architecture and FAQ. |
| `demo.html` / `demo-en.html` | Practice demo. |
| `demo-workspace.html` / `demo-workspace-en.html` | Standalone 2-of-4 review workspace. |
| `demo-mistakes.html` / `demo-mistakes-en.html` | Mistake collection with filters, search and mastery. |
| `demo-vocabulary.html` / `demo-vocabulary-en.html` | Vocabulary collection with search, filters and saved words. |
| `themes.html` / `themes-en.html` | The five-theme gallery with live iframe previews. |
| `404.html` | Not-found page with links back to home, downloads and the demo. |

Chinese pages link to their English counterparts and vice versa. Each page has
its own canonical URL and `hreflang` pair. `sitemap.xml` lists all 16 language
pages.

```
website/
├── index.html · en.html
├── download.html · download-en.html
├── features.html · features-en.html
├── demo.html · demo-en.html
├── demo-workspace.html · demo-workspace-en.html
├── demo-mistakes.html · demo-mistakes-en.html
├── demo-vocabulary.html · demo-vocabulary-en.html
├── themes.html · themes-en.html
├── 404.html · robots.txt · sitemap.xml · .nojekyll
├── assets/
│   ├── site.css             # all layout, components, responsive rules
│   ├── site.js              # nav, filters, theme lab, code tabs, copy, demo
│   ├── downloads.js         # latest GitHub release → platform cards
│   └── favicon.svg
└── themes/                  # five standalone theme previews
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

## Downloads and platform links

The home page puts downloads in the first screen: a compact macOS Apple
Silicon / macOS Intel / Windows shortcut row sits directly under the hero
buttons, followed by the full download strip. Every platform card is an
installer link; the fourth card opens the full GitHub **Releases** page.
`downloads.js` upgrades the platform cards to direct release assets. The
download page repeats the cards with first-launch notes. Source instructions
live only in the separate “From source / 开发者选项” section at the bottom.

Platform cards use `data-download-platform` and start with a safe fallback:

- on the home page the fallback is `download.html#mac-arm64`, etc.;
- on the download page the fallback is the GitHub **Releases** page.

`assets/downloads.js` asks GitHub for the latest release and upgrades matching
cards to direct asset URLs. Matching is name-based:

| `data-download-platform` | Asset match |
| --- | --- |
| `mac-arm64` | `.dmg` containing `arm64` or `aarch64` |
| `mac-x64` | `.dmg` containing `x64`, `x86_64` or `amd64` |
| `win-x64` | `.exe` containing `x64`, `x86_64` or `amd64` |

When a release is found, the button text becomes “下载 · size” / “Download ·
size” and `[data-release-status]` shows the version. If the repository has no
release yet, the API returns 404, is rate-limited, or the request fails, the
cards keep their fallbacks and the page tells the visitor to run from source.
There is no build step and no token in the page.

Desktop artifacts are produced by `.github/workflows/desktop.yml` on every push
to `main` (artifact only) and on `v*` tags (artifact + GitHub Release):

- `InteFlow-<version>-arm64.dmg`
- `InteFlow-<version>-x64.dmg`
- `InteFlow-Setup-<version>-x64.exe`

Each build runs `desktop/verify_bundle.py` first, so an installer that contains
local data cannot be published.

Do **not** commit installers to `website/`: GitHub Pages has a 100 MB per-file
limit and the repository should not carry hundreds of megabytes of binaries.
The source ZIP is linked only from the separate developer section on
`download*.html` (it is not a desktop installer).

## Live demo

The demo is split into four pages, one per feature, with a shared tab strip at
the top of each:

1. `demo.html` / `demo-en.html` — **practice**: the app-like exam screen with
   passage + question cards, star-for-review, count-up clock, blue options,
   question palette and previous/next footer. Four sample questions cover
   attitude, words in context, algebra and fill-in-blank. Submitting shows a
   result screen and stores the attempt in `sessionStorage` so the workspace
   page can open the same answers.
2. `demo-workspace.html` / `demo-workspace-en.html` — **2-of-4 workspace**:
   two panes with the Question / Analysis / AI Tutor / Vocabulary tool row.
   Tools switch sides by clicking; choosing a tool already in the other pane
   swaps them. The analysis pane has Write / Preview, AI only appears after a
   click, and the word bank uses the shared saved-word collection. With no
   stored attempt, it opens a seeded sample (2 correct / 4).
3. `demo-mistakes.html` / `demo-mistakes-en.html` — **mistakes**: six sample
   wrong answers, filter chips (all / reading / math / writing / to review /
   mastered), search, a list-detail layout, analysis and a mastery toggle.
4. `demo-vocabulary.html` / `demo-vocabulary-en.html` — **vocabulary**: ten
   sample words with search, learning / mastered / collected filters, a detail
   pane, save/remove and mark-known controls.

The demo is intentionally a *taste* of the app, not a second implementation.
State is browser-only: saved words use
`inteflow.website.demo.vocab`, mistake mastery uses
`inteflow.website.demo.masteredMistakes`, word mastery uses
`inteflow.website.demo.masteredWords`, and the latest attempt uses
`sessionStorage` under `inteflow.website.demo.attempt`. Nothing is uploaded and
no model is called.

The practice page keeps the detailed "DEMO ≠ FULL APP" note: four fixed
questions, no backend, canned AI, simplified review (no drag-to-resize,
autosave, Notebook or export) and only the default Clear Blue theme. Other demo
pages carry a short version of the same note. Notebook and Export buttons in the
workspace only show a short toast.

All demo copy and test data live in `assets/site.js`: `DEMO.ui`,
`DEMO.questions`, `DEMO.hub`, `DEMO.mistakes` and `DEMO.vocabulary`, with
English and Chinese variants. The HTML pages provide the hub and shell; the JS
fills `[data-demo-body]` based on `data-demo-start` (`practice`, `workspace`,
`mistakes` or `vocabulary`). With JavaScript disabled, a note inside each shell
explains that the full app runs locally.

## Relative paths and GitHub Pages

The Pages workflow at `.github/workflows/pages.yml` publishes the `website/`
directory on every push to `main` that touches it (or manually via
**Actions → Deploy website to GitHub Pages → Run workflow**).

- Every internal link and asset path is **relative** (`assets/site.css`,
  `download.html`, `themes/clear-blue.html`). Do not add leading `/` paths:
  project Pages are served under `/InteFlow/`, not the domain root.
- All HTML pages live at the site root, so `assets/...` works from every page.
  Theme previews are one level deeper and use `../assets/...`.
- `downloads.js` only calls `https://api.github.com/...`; release assets link
  to `github.com`, never to a local path.
- Old single-page bookmarks such as `/#demo`, `/#features`, `/#themes` or
  `/#quickstart` redirect to the new pages from `assets/site.js`.
- `404.html` resolves its links against `/InteFlow/` when deployed, and falls
  back to `./` for local previews.
- `website/.nojekyll` is included so Pages serves the files without Jekyll
  processing.

One-time setup:

1. Open the repository on GitHub → **Settings** → **Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push to `main`, or run the workflow manually.
4. The site will be available at `https://<user>.github.io/InteFlow/`.

## Editing

- **Copy** lives in paired pages, not a central CMS. Keep the Chinese and
  English pages in sync: same sections, ids, card counts and links, only the
  human-visible copy changes. Shared header and footer markup is repeated in
  each page; update all ten pages when a nav item changes.
- **Feature cards** use `data-cat="import|practice|review|vocab|output"`; update
  the counts in the filter bar and the `data-filter-count` default if you add or
  remove cards.
- **Downloads** are the `data-download-platform` cards plus the matching rules
  in `assets/downloads.js`. Add a platform to both language download pages and
  add a rule in `matchAsset`.
- **The interactive demo** is the `DEMO` object in `assets/site.js`. Each
  language has its own `ui`, `hub`, `questions`, `mistakes` and `vocabulary`
  data; keep the answer keys (`answer`, `accept`) and the language arrays in
  sync. The render functions live below the config and branch on
  `data-demo-start`. Sample analysis and word entries are plain text
  (paragraphs separated by a blank line); saved-word, mistake-mastery and
  word-mastery state persist in `localStorage`, while analysis edits stay in
  memory.
- **Theme metadata** for the interactive lab is the `THEMES` object near the
  top of `assets/site.js`. The five preview pages themselves keep their own copy
  of `THEMES` in `themes/assets/mock.js` for the in-preview switcher.
- **Visual tokens** (`--paper`, `--ink`, `--accent`, type stacks) are at the top
  of `assets/site.css`.
- Update `sitemap.xml` when adding or renaming a language page.

## Accessibility notes

- Pages are usable without JavaScript: content, native `<details>` FAQ and the
  first theme preview remain. The demo and the release-version lookup are the
  only parts that need JS; their shells contain fallback copy.
- Download cards are real links with visible labels; release lookup failures
  leave a working fallback instead of an empty button.
- The demo uses real buttons with `aria-pressed` / `aria-selected`, a visible
  focus ring, and text labels alongside every colour cue. Review questions can
  be reached with the keyboard; Enter in the fill-in field moves to the next
  question (or submits on the last one).
- Theme buttons use `role="tab"` and support arrow keys.
- The preview iframes are decorative (`pointer-events: none`, `tabindex="-1"`);
  each has an **Open full page** link for real interaction.
- `prefers-reduced-motion` disables reveal animations, count-ups and smooth
  scrolling.
