import { Check } from "lucide-react";
import { THEMES, useTheme } from "../../theme";
import { useI18n } from "../../lib/i18n";

/**
 * Theme picker for Settings: one mini "window" per theme so the choice is
 * visible before switching. The choice applies immediately (the shell re-skins
 * in place) and is stored in `localStorage`, so it survives reloads without a
 * round trip to the backend. The full-screen practice screen is unaffected.
 */
export function ThemePicker() {
  const [theme, setTheme] = useTheme();
  const { t } = useI18n();

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-ink-900">{t("Theme")}</p>
        <p className="text-[11px] text-ink-400">
          {t("The practice screen keeps its own high-contrast look.")}
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label={t("Theme")}
        className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-10"
      >
        {THEMES.map((option) => {
          const active = option.id === theme;
          const [ground, surface, accent, ink] = option.swatches;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              data-theme-option={option.id}
              onClick={() => setTheme(option.id)}
              className={`group rounded-lg border p-2 text-left transition-all sm:col-span-1 xl:col-span-2 ${
                active
                  ? "border-primary-500 bg-primary-50 shadow-sm"
                  : "border-paper-200 bg-white hover:border-paper-300 hover:bg-paper-50"
              }`}
            >
              {/* A tiny mock of the workspace, painted with the theme's own
                  colours: ground, header bar, an accent mark and text lines. */}
              <span
                aria-hidden="true"
                className="block overflow-hidden rounded-md border border-black/10"
                style={{ backgroundColor: ground }}
              >
                <span
                  className="flex h-3 items-center gap-1 border-b border-black/5 px-1.5"
                  style={{ backgroundColor: surface }}
                >
                  <span
                    className="h-1 w-1 rounded-full"
                    style={{ backgroundColor: accent }}
                  />
                  <span
                    className="h-1 w-3 rounded-full"
                    style={{ backgroundColor: ink, opacity: 0.25 }}
                  />
                </span>
                <span className="block px-1.5 py-2">
                  <span
                    className="block h-1.5 w-3/5 rounded-full"
                    style={{ backgroundColor: ink, opacity: 0.75 }}
                  />
                  <span
                    className="mt-1 block h-1 w-4/5 rounded-full"
                    style={{ backgroundColor: ink, opacity: 0.16 }}
                  />
                  <span
                    className="mt-1 block h-1 w-2/3 rounded-full"
                    style={{ backgroundColor: ink, opacity: 0.16 }}
                  />
                  <span
                    className="mt-1.5 block h-1 w-2/5 rounded-full"
                    style={{ backgroundColor: accent }}
                  />
                </span>
              </span>

              <span className="mt-2 flex items-center justify-between gap-2 px-0.5">
                <span className="truncate text-[13px] font-medium text-ink-900">
                  {option.label}
                </span>
                {active && (
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white">
                    <Check className="h-2.5 w-2.5" aria-hidden="true" />
                  </span>
                )}
              </span>
              <span className="mt-0.5 block px-0.5 text-[11px] leading-4 text-ink-400">
                {t(option.blurb)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
