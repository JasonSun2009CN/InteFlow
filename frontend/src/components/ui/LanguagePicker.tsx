import { LANGUAGES, useI18n } from "../../lib/i18n";

/**
 * Language control for Settings: a two-stop segmented switch. Applies
 * immediately and lives in `localStorage` (same pattern as the theme) — no
 * backend round trip.
 */
export function LanguagePicker() {
  const { language, setLanguage, t } = useI18n();

  return (
    <div
      role="radiogroup"
      aria-label={t("Interface language")}
      className="inline-flex shrink-0 rounded-lg border border-paper-200 bg-paper-50 p-1"
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
            className={`rounded-md px-3.5 py-1.5 text-sm transition-all ${
              active
                ? "bg-white font-medium text-ink-900 shadow-sm ring-1 ring-paper-200"
                : "text-ink-500 hover:text-ink-900"
            }`}
          >
            {option.native}
          </button>
        );
      })}
    </div>
  );
}
