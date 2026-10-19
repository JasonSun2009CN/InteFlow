import { useSyncExternalStore } from "react";

/**
 * Themes.
 *
 * A theme is a set of semantic CSS variables (see `.app-theme[data-theme=…]`
 * in `index.css`); every Tailwind colour family in the app is mapped onto those
 * variables, so switching the attribute re-skins the whole workspace without
 * touching components. The preference lives in `localStorage` — no server, no
 * account, consistent with the rest of the app.
 *
 * The full-screen practice screen deliberately renders *outside* the themed
 * wrapper: a real test keeps the untouched slate/blue look (see `AppShell`).
 */
export type ThemeId =
  | "clear-blue"
  | "paper-ink"
  | "minimal-light"
  | "midnight-navy"
  | "warm-editorial";

export interface ThemeInfo {
  id: ThemeId;
  label: string;
  /** One line for the picker in Settings. */
  blurb: string;
  /** Four preview chips: ground, surface, accent, ink. */
  swatches: [string, string, string, string];
}

export const THEMES: ThemeInfo[] = [
  {
    id: "clear-blue",
    label: "Clear Blue",
    blurb: "Blue on white, crisp rules and square corners. The calm default.",
    swatches: ["#f2f5f9", "#ffffff", "#0057b8", "#101c30"],
  },
  {
    id: "paper-ink",
    label: "Paper & Ink",
    blurb: "Warm paper, serif headings, seal-red accents. A printed booklet.",
    swatches: ["#faf8f3", "#fffdf8", "#9a402c", "#1c1916"],
  },
  {
    id: "minimal-light",
    label: "Minimal Light",
    blurb: "Neutral greys, no decoration, near-black accents. Notion-quiet.",
    swatches: ["#ffffff", "#fbfbfa", "#1f1f1f", "#191919"],
  },
  {
    id: "midnight-navy",
    label: "Midnight Navy",
    blurb: "Deep navy ground with a soft blue highlight. For late sessions.",
    swatches: ["#0a1120", "#111a2c", "#7aa2f7", "#e8edf7"],
  },
  {
    id: "warm-editorial",
    label: "Warm Editorial",
    blurb: "Cream paper, terracotta accents, magazine-scale headings.",
    swatches: ["#f7efe2", "#fffbf3", "#b4552b", "#241c15"],
  },
];

export const DEFAULT_THEME: ThemeId = "clear-blue";

export const THEME_STORAGE_KEY = "inteflow.theme";

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}

export function themeInfo(id: ThemeId): ThemeInfo {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}

function readStoredTheme(): ThemeId {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(raw) ? raw : DEFAULT_THEME;
  } catch {
    // Private mode / disabled storage: fall back to the default in memory.
    return DEFAULT_THEME;
  }
}

let current: ThemeId | null = null;
const listeners = new Set<() => void>();

function paintPageLevelInfo(id: ThemeId) {
  // Page-level bits (root scrollbar colours, the overscroll area) can't be
  // styled from inside the themed wrapper, so mirror the id on <html>; the
  // small `html[data-theme=…]` rules in index.css read it. The wrapper itself
  // also carries `data-theme`, which is what the app's own styles key off.
  document.documentElement.dataset.theme = id;
}

export function getTheme(): ThemeId {
  // Read through on every call: the value only changes through `setTheme`, so
  // the snapshot `useSyncExternalStore` compares stays stable between renders.
  return current ?? readStoredTheme();
}

/** Apply the stored theme to <html> — call once, before the first render. */
export function initTheme(): ThemeId {
  const id = getTheme();
  paintPageLevelInfo(id);
  return id;
}

export function setTheme(id: ThemeId) {
  if (!isThemeId(id)) return;
  const changed = id !== current;
  current = id;
  paintPageLevelInfo(id);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    // Nothing to do: the choice simply won't survive a reload.
  }
  if (changed) listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Current theme plus a setter; re-renders when it changes. */
export function useTheme(): [ThemeId, (id: ThemeId) => void] {
  const id = useSyncExternalStore(subscribe, getTheme, getTheme);
  return [id, setTheme];
}
