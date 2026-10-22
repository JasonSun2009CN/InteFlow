import { LANGUAGES, useI18n } from "../../lib/i18n";

/**
 * Language section for Settings. Applies immediately and lives in
 * `localStorage` (same pattern as the theme) — no backend round trip.
 */
export function LanguagePicker() {
  const { language, setLanguage, t } = useI18n();

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">{t("Language")}</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {t(
            "Choose the language used by the workspace. Exam content and your own notes are never translated.",
          )}
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label={t("Interface language")}
        className="grid gap-2 sm:grid-cols-2"
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
              className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                active
                  ? "border-primary-500 bg-primary-50"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span className="text-sm font-medium text-slate-900">{option.native}</span>
              {active && (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-primary-700">
                  {t("Active")}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
