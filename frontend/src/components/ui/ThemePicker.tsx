import { Check } from "lucide-react";
import { THEMES, useTheme } from "../../theme";
import { useI18n } from "../../lib/i18n";

/**
 * Theme picker for Settings: one flat swatch card per theme so the choice is
 * visible before switching. The choice applies immediately and is stored in
 * `localStorage`. The full-screen practice screen is unaffected.
 */
export function ThemePicker() {
  const [theme, setTheme] = useTheme();
  const { t } = useI18n();

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-slate-900">{t("Theme")}</p>
        <p className="text-xs text-slate-500">
          {t("The practice screen keeps its own high-contrast look.")}
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label={t("Theme")}
        className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
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
              className={`group cursor-pointer rounded-sm border p-3 text-left transition-colors duration-150 ${
                active
                  ? "border-slate-900 bg-slate-50"
                  : "border-slate-200 bg-transparent hover:border-slate-400"
              }`}
            >
              <span
                aria-hidden="true"
                className="block overflow-hidden rounded-sm border border-black/10"
                style={{ backgroundColor: ground }}
              >
                <span
                  className="flex h-3 items-center gap-1 border-b border-black/5 px-1.5"
                  style={{ backgroundColor: surface }}
                >
                  <span className="h-1 w-1 rounded-full" style={{ backgroundColor: accent }} />
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

              <span className="mt-3 flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-slate-900">
                  {option.label}
                </span>
                {active && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-slate-900" aria-hidden="true" />
                )}
              </span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                {t(option.blurb)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
