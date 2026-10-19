import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_THEME, THEMES } from "./theme";

/** Each case gets a fresh module instance (the store caches the last choice). */
async function freshTheme() {
  vi.resetModules();
  return await import("./theme");
}

const getItem = () => vi.mocked(window.localStorage.getItem);
const setItem = () => vi.mocked(window.localStorage.setItem);

beforeEach(() => {
  getItem().mockReset();
  setItem().mockReset();
  delete document.documentElement.dataset.theme;
});

describe("theme store", () => {
  it("falls back to the default theme when nothing is stored", async () => {
    const theme = await freshTheme();

    expect(theme.getTheme()).toBe(DEFAULT_THEME);
    expect(DEFAULT_THEME).toBe("clear-blue");
  });

  it("reads a stored theme", async () => {
    getItem().mockReturnValue("midnight-navy");
    const theme = await freshTheme();

    expect(theme.getTheme()).toBe("midnight-navy");
  });

  it("ignores an unknown stored value", async () => {
    getItem().mockReturnValue("acid-green");
    const theme = await freshTheme();

    expect(theme.getTheme()).toBe(DEFAULT_THEME);
  });

  it("persists the choice and mirrors it on <html>", async () => {
    const theme = await freshTheme();

    theme.setTheme("warm-editorial");

    expect(setItem()).toHaveBeenCalledWith(theme.THEME_STORAGE_KEY, "warm-editorial");
    expect(document.documentElement.dataset.theme).toBe("warm-editorial");
    expect(theme.getTheme()).toBe("warm-editorial");
  });

  it("initTheme applies the stored theme before the first render", async () => {
    getItem().mockReturnValue("paper-ink");
    const theme = await freshTheme();

    expect(theme.initTheme()).toBe("paper-ink");
    expect(document.documentElement.dataset.theme).toBe("paper-ink");
  });

  it("survives storage that throws (private mode)", async () => {
    getItem().mockImplementation(() => {
      throw new Error("denied");
    });
    setItem().mockImplementation(() => {
      throw new Error("denied");
    });
    const theme = await freshTheme();

    expect(theme.getTheme()).toBe(DEFAULT_THEME);
    expect(() => theme.setTheme("minimal-light")).not.toThrow();
    expect(theme.getTheme()).toBe("minimal-light");
  });

  it("accepts every advertised theme id", async () => {
    const theme = await freshTheme();

    expect(THEMES).toHaveLength(5);
    for (const option of THEMES) {
      expect(theme.isThemeId(option.id)).toBe(true);
      expect(theme.themeInfo(option.id).label).toBe(option.label);
    }
    expect(theme.isThemeId("nope")).toBe(false);
  });
});
