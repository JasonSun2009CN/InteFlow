import { THEMES, useTheme } from "../../theme";
import { useI18n } from "../../lib/i18n";

/**
 * Appearance section for Settings: pick one of the built-in themes.
 *
 * The choice applies immediately (the shell re-skins in place) and is stored in
 * `localStorage`, so it survives reloads without a round trip to the backend.
 * The full-screen practice screen is unaffected by design.
 */
export function ThemePicker() {
  const [theme, setTheme] = useTheme();
  const { t } = useI18n();

  return (
    <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">{t("Appearance")}</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {t(
            "Applies to the whole workspace — the practice screen keeps its own high-contrast look. Saved locally on this machine.",
          )}
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label={t("Theme")}
        className="grid gap-2 sm:grid-cols-2"
      >
        {THEMES.map((option) => {
          const active = option.id === theme;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              data-theme-option={option.id}
              onClick={() => setTheme(option.id)}
              className={`flex items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                active
                  ? "border-primary-500 bg-primary-50"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span
                className="mt-0.5 flex shrink-0 overflow-hidden rounded border border-black/10"
                aria-hidden="true"
              >
                {option.swatches.map((color) => (
                  <span
                    key={color}
                    className="h-6 w-3"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">
                    {option.label}
                  </span>
                  {active && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary-700">
                      {t("Active")}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                  {t(option.blurb)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
