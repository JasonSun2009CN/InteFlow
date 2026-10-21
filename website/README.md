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
├── index.html               # the landing page
├── 404.html
├── assets/
│   ├── site.css             # all layout, components, responsive rules
│   ├── site.js              # nav, filters, theme lab, code tabs, copy
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

- **Copy and features** live in `index.html`. Feature cards use
  `data-cat="import|practice|review|vocab|output"`; update the counts in the
  filter bar and the `data-filter-count` default if you add or remove cards.
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
  native `<details>`, and the first theme preview still renders.
- Theme buttons use `role="tab"` and support arrow keys.
- The preview iframes are decorative (`pointer-events: none`, `tabindex="-1"`);
  each has an **Open full page** link for real interaction.
- `prefers-reduced-motion` disables reveal animations, count-ups and smooth
  scrolling.
