import { LANGUAGES, useI18n } from "../../lib/i18n";

/**
 * Language control for Settings: a two-stop text switch. Applies immediately
 * and lives in `localStorage` (same pattern as the theme) — no backend call.
 */
export function LanguagePicker() {
  const { language, setLanguage, t } = useI18n();

  return (
    <div
      role="radiogroup"
      aria-label={t("Interface language")}
      className="inline-flex shrink-0 gap-4 border-b border-slate-200"
    >
      {LANGUAGES.map((option) => {
        const active = option.id === language;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setLanguage(option.id)}
            className={`relative cursor-pointer px-1 pb-2 text-sm transition-colors duration-150 ${
              active
                ? "font-medium text-slate-900 after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-slate-900"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {option.native}
          </button>
        );
      })}
    </div>
  );
}
