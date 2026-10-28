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
    blurb: "Cool white paper with a quiet blue accent. The calm default.",
    swatches: ["#f7f7f5", "#ffffff", "#2f5588", "#171715"],
  },
  {
    id: "paper-ink",
    label: "Paper & Ink",
    blurb: "Warm off-white paper and a single seal-red accent.",
    swatches: ["#faf9f6", "#fffefb", "#9a402c", "#1b1916"],
  },
  {
    id: "minimal-light",
    label: "Minimal Light",
    blurb: "Pure white, grey rules and full-ink accents. Nothing else.",
    swatches: ["#ffffff", "#ffffff", "#191917", "#191917"],
  },
  {
    id: "midnight-navy",
    label: "Midnight Navy",
    blurb: "Near-black ground with a pale blue accent. For late sessions.",
    swatches: ["#131416", "#17181b", "#9db8dd", "#f0f1f3"],
  },
  {
    id: "warm-editorial",
    label: "Warm Editorial",
    blurb: "Cream paper and a restrained terracotta accent.",
    swatches: ["#f8f5ee", "#fffdf8", "#a5512e", "#1d1a14"],
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
