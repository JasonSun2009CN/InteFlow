import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  ApiError,
  type AppSettings,
  type ProbeResult,
  type ProviderInfo,
  type SettingsInput,
} from "../api/client";
import { Button, LanguagePicker, ThemePicker } from "../components/ui";
import CustomDictionaryManager from "../components/CustomDictionaryManager";
import { useI18n } from "../lib/i18n";

/** Typing pause before a field is persisted; toggles land on the same timer. */
const AUTOSAVE_DELAY = 600;

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

function errText(err: unknown): string {
  return err instanceof ApiError ? err.message : String(err);
}

export default function SettingsPage() {
  const { t } = useI18n();
  const [provider, setProvider] = useState("orcarouter");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [userName, setUserName] = useState("");
  const [analysisTemplate, setAnalysisTemplate] = useState("");
  const [llmFallback, setLlmFallback] = useState(true);
  const [vocabAiSense, setVocabAiSense] = useState(true);
  const [vocabLearner, setVocabLearner] = useState(false);
  const [vocabExamAi, setVocabExamAi] = useState(false);
  const [customDictionary, setCustomDictionary] = useState(true);
  const [showBuiltin, setShowBuiltin] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [stored, setStored] = useState<AppSettings | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [providersLoaded, setProvidersLoaded] = useState(false);
  const [version, setVersion] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [busy, setBusy] = useState<"test" | "remove" | null>(null);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [probe, setProbe] = useState<ProbeResult | null>(null);

  // Auto-save bookkeeping: the fingerprint of the last persisted form lets us
  // ignore hydration and no-op edits, while pending/saving refs serialize
  // overlapping keystrokes into one in-flight request at a time.
  const lastSavedRef = useRef<string | null>(null);
  const pendingRef = useRef<SettingsInput | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    Promise.all([api.getSettings(), api.listProviders()])
      .then(([s, list]) => {
        setStored(s);
        setProvider(s.provider);
        setBaseUrl(s.base_url);
        setModel(s.model);
        setUserName(s.user_name);
        setAnalysisTemplate(s.analysis_template);
        setLlmFallback(s.llm_fallback);
        setVocabAiSense(s.vocab_ai_sense);
        setVocabLearner(s.vocab_learner_definitions);
        setVocabExamAi(s.vocab_exam_ai_grading);
        setCustomDictionary(s.custom_dictionary_enabled);
        setShowBuiltin(s.show_builtin_library);
        setProviders(list);
        setLoaded(true);
      })
      .catch((err) => setMessage({ kind: "err", text: errText(err) }))
      .finally(() => setProvidersLoaded(true));

    // Version is furniture: the page still works when /api/health is down.
    api
      .health()
      .then((h) => setVersion(h.version))
      .catch(() => undefined);
  }, []);

  function presetOf(id: string): ProviderInfo | undefined {
    return providers.find((p) => p.id === id);
  }

  const currentPreset = presetOf(provider);

  /** Everything the PUT endpoint accepts, built from the current form. */
  const payload = useMemo<SettingsInput>(
    () => ({
      provider,
      base_url: baseUrl.trim(),
      model: model.trim(),
      user_name: userName.trim(),
      analysis_template: analysisTemplate,
      llm_fallback: llmFallback,
      vocab_ai_sense: vocabAiSense,
      vocab_learner_definitions: vocabLearner,
      vocab_exam_ai_grading: vocabExamAi,
      custom_dictionary_enabled: customDictionary,
      show_builtin_library: showBuiltin,
      ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
    }),
    [
      provider,
      baseUrl,
      model,
      userName,
      analysisTemplate,
      llmFallback,
      vocabAiSense,
      vocabLearner,
      vocabExamAi,
      customDictionary,
      showBuiltin,
      apiKey,
    ],
  );

  /** Persist the newest form snapshot, coalescing edits made while saving. */
  const persist = useCallback(async (next: SettingsInput) => {
    pendingRef.current = next;
    if (savingRef.current) return;
    savingRef.current = true;

    try {
      while (pendingRef.current) {
        const current: SettingsInput = pendingRef.current;
        const fingerprint = JSON.stringify(current);
        if (fingerprint === lastSavedRef.current) break;

        setSaveState("saving");
        const saved = await api.saveSettings(current);
        lastSavedRef.current = fingerprint;
        setStored(saved);
        setMessage(null);

        if (current.api_key) {
          // Clearing the password field is not a new edit to persist.
          const cleared: SettingsInput = { ...current, api_key: undefined };
          pendingRef.current = cleared;
          lastSavedRef.current = JSON.stringify(cleared);
          setApiKey("");
        }

        setSaveState("saved");
        if (JSON.stringify(pendingRef.current) === lastSavedRef.current) break;
      }
    } catch (err) {
      setSaveState("error");
      setMessage({ kind: "err", text: errText(err) });
    } finally {
      savingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const fingerprint = JSON.stringify(payload);

    // First render after hydration: record the baseline, never save it.
    if (lastSavedRef.current === null) {
      lastSavedRef.current = fingerprint;
      return;
    }
    if (fingerprint === lastSavedRef.current) return;

    setSaveState("dirty");
    const timer = window.setTimeout(() => {
      void persist(payload);
    }, AUTOSAVE_DELAY);
    return () => window.clearTimeout(timer);
  }, [loaded, payload, persist]);

  function onProviderChange(next: string) {
    const previousPreset = presetOf(provider);
    const nextPreset = presetOf(next);
    setProvider(next);
    // Re-point the base URL only when it was a previous preset's default (or blank),
    // so a manually edited custom URL survives a provider switch.
    if (!baseUrl || baseUrl === previousPreset?.base_url) {
      setBaseUrl(nextPreset?.base_url ?? "");
    }
    // Auto-routing gateways (OrcaRouter/OpenRouter/OpenPaths) set the model too.
    if (nextPreset?.default_model) setModel(nextPreset.default_model);
  }

  async function onTest() {
    setBusy("test");
    setMessage(null);
    setProbe(null);
    try {
      setProbe(
        await api.testSettings({
          provider,
          base_url: baseUrl.trim(),
          model: model.trim(),
          ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
        }),
      );
    } catch (err) {
      setProbe({ ok: false, detail: errText(err) });
    } finally {
      setBusy(null);
    }
  }

  async function onRemoveKey() {
    setBusy("remove");
    setMessage(null);
    try {
      const saved = await api.saveSettings({ clear_key: true });
      setStored(saved);
      setApiKey("");
      setMessage({ kind: "ok", text: t("API key removed.") });
    } catch (err) {
      setMessage({ kind: "err", text: errText(err) });
    } finally {
      setBusy(null);
    }
  }

  async function onResetData() {
    const reset = window.inteflow?.resetData;
    if (!reset) {
      setMessage({
        kind: "err",
        text: t("Reset is only available in the desktop app."),
      });
      return;
    }
    setMessage(null);
    setResetting(true);
    try {
      const result = await reset();
      if (result?.cancelled) {
        setMessage({ kind: "ok", text: t("Reset cancelled.") });
      }
    } catch (err) {
      setMessage({ kind: "err", text: errText(err) });
    } finally {
      setResetting(false);
    }
  }

  const desktop = typeof window !== "undefined" && Boolean(window.inteflow?.desktop);

  const saveLabel =
    saveState === "saving"
      ? t("Saving…")
      : saveState === "dirty"
        ? t("Unsaved changes…")
        : saveState === "error"
          ? t("Could not save — retrying on the next change.")
          : saveState === "saved"
            ? t("Saved")
            : t("Changes save automatically.");

  const input =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none";
  const label = "block text-sm font-medium text-slate-700 mb-1";

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10 sm:py-14">
      <header className="mb-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-slate-400">
          {t("Workspace")}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{t("Settings")}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {t(
            "Configure the LLM API used for on-demand explanations and import fallback. Everything is stored locally; the key never leaves this machine except to call the provider you name below.",
          )}
        </p>
        <p className="mt-2 text-xs font-medium text-slate-400">
          {t("Version {version}", { version: version || "…" })}
        </p>
      </header>

      {message && (
        <div
          className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
            message.kind === "ok"
              ? "border-green-300 bg-green-50 text-green-800"
              : "border-red-300 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mb-5">
        <ThemePicker />
      </div>

      <div className="mb-5">
        <LanguagePicker />
      </div>

      <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label className={label} htmlFor="user-name">
            {t("Your name")}
          </label>
          <input
            id="user-name"
            className={input}
            value={userName}
            placeholder={t("Printed on page 1 of every exported notebook")}
            onChange={(e) => setUserName(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">
            {t("Used as the cover-page name when you export an analysis notebook.")}
          </p>
        </div>

        <div>
          <label className={label} htmlFor="analysis-template">
            {t("Analysis template")}
          </label>
          <textarea
            id="analysis-template"
            className={input + " min-h-[10rem] resize-y font-mono text-[13px] leading-6"}
            value={analysisTemplate}
            placeholder={t(
              "**Why the correct answer works**\n\n**Why I picked mine**\n\n**Takeaway**\n",
            )}
            onChange={(e) => setAnalysisTemplate(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">
            {t(
              "Pre-filled into every empty analysis page (wrong answers, starred questions and the review workspace). Markdown is supported. An existing analysis is never overwritten, and the template itself is only saved once you start editing the page.",
            )}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <label className="flex items-start gap-3" htmlFor="show-builtin">
            <input
              id="show-builtin"
              type="checkbox"
              checked={showBuiltin}
              onChange={(e) => setShowBuiltin(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>
              <span className="block text-sm font-medium text-slate-800">
                {t("Show built-in library")}
              </span>
              <span className="mt-1 block text-xs leading-5 text-slate-600">
                {t(
                  "Show the bundled SAT sample bank in Library. It is off by default so a new install starts empty; turning it on lets you add sample units without importing a file.",
                )}
              </span>
            </span>
          </label>
        </div>

        <div>
          <label className={label} htmlFor="provider">
            {t("Provider")}
          </label>
          <select
            id="provider"
            className={input}
            value={provider}
            onChange={(e) => onProviderChange(e.target.value)}
          >
            {!providersLoaded && <option value={provider}>{t("Loading providers…")}</option>}
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {currentPreset && (
            <p className="mt-1 text-xs text-slate-500">
              {currentPreset.protocol === "anthropic"
                ? t(
                    "A provider is the service; this one speaks the Anthropic Messages protocol (x-api-key auth).",
                  )
                : t(
                    "A provider is the service; this one speaks the OpenAI-compatible protocol (chat/completions, Bearer auth).",
                  )}
            </p>
          )}
        </div>

        <div>
          <label className={label} htmlFor="base-url">
            {t("Base URL")}
          </label>
          <input
            id="base-url"
            className={input}
            value={baseUrl}
            placeholder={currentPreset?.base_url || "https://…/v1"}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
          {currentPreset?.note ? (
            <p className="mt-1 text-xs text-slate-500">{currentPreset.note}</p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              {t("OpenAI-compatible proxies work too — point this at any …/v1 endpoint.")}
            </p>
          )}
        </div>

        <div>
          <label className={label} htmlFor="api-key">
            {t("API Key")}
          </label>
          <div className="flex gap-2">
            <input
              id="api-key"
              type="password"
              autoComplete="off"
              className={input}
              value={apiKey}
              placeholder={
                stored?.api_key_set
                  ? t("Stored: {masked} — leave blank to keep", {
                      masked: stored.api_key_masked,
                    })
                  : "sk-…"
              }
              onChange={(e) => setApiKey(e.target.value)}
            />
            {stored?.api_key_set && (
              <button
                type="button"
                onClick={() => void onRemoveKey()}
                disabled={busy !== null}
                className="btn shrink-0 rounded-md border border-red-300 px-3 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {t("Remove")}
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {t("Saved keys are shown masked and are never sent back to the browser.")}
          </p>
        </div>

        <div>
          <label className={label} htmlFor="model">
            {t("Model")}
          </label>
          <input
            id="model"
            className={input}
            value={model}
            list="model-suggestions"
            placeholder={currentPreset?.default_model ?? "e.g. gpt-4o-mini"}
            onChange={(e) => setModel(e.target.value)}
          />
          <datalist id="model-suggestions">
            {currentPreset?.default_model && (
              <option value={currentPreset.default_model} />
            )}
          </datalist>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <label className="flex items-start gap-3" htmlFor="llm-fallback">
            <input
              id="llm-fallback"
              type="checkbox"
              checked={llmFallback}
              onChange={(e) => setLlmFallback(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>
              <span className="block text-sm font-medium text-slate-800">
                {t("AI recognition fallback")}
              </span>
              <span className="mt-1 block text-xs leading-5 text-slate-600">
                {t(
                  "When a PDF or DOCX cannot be parsed by the built-in layout rules, let the configured model label the questions instead. It only reads text that was already extracted, never rewrites it, and costs tokens — turn it off to keep imports fully offline. When the source prints no choices, the question is imported as a fill-in-the-blank instead.",
                )}
              </span>
            </span>
          </label>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-800">{t("Vocabulary")}</p>
          <div className="mt-3 space-y-3">
            <label className="flex items-start gap-3" htmlFor="vocab-ai-sense">
              <input
                id="vocab-ai-sense"
                type="checkbox"
                checked={vocabAiSense}
                onChange={(e) => setVocabAiSense(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">
                  {t("AI sense matching")}
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-600">
                  {t(
                    "When you drag a word into the Vocabulary pane, ask the configured model to choose the Merriam-Webster sense that fits the sentence. Turn this off to use the first sense every time with no token cost.",
                  )}
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3" htmlFor="vocab-learner">
              <input
                id="vocab-learner"
                type="checkbox"
                checked={vocabLearner}
                onChange={(e) => setVocabLearner(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">
                  {t("Definition for English Learners")}
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-600">
                  {t(
                    "When the local Merriam-Webster entry includes its Definition for English Learners section (usually harder words), use that simpler definition first. Entries without the section fall back to the ordinary definition. This is part of the same dictionary — no extra file and no tokens.",
                  )}
                </span>
              </span>
            </label>

            <div className="flex items-start gap-3">
              <input
                id="custom-dictionary"
                type="checkbox"
                aria-label={t("Use my dictionary first")}
                checked={customDictionary}
                onChange={(e) => setCustomDictionary(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="min-w-0 flex-1">
                <label
                  htmlFor="custom-dictionary"
                  className="block text-sm font-medium text-slate-800"
                >
                  {t("Use my dictionary first")}
                </label>
                <span className="mt-1 block text-xs leading-5 text-slate-600">
                  {t(
                    "Check your own words before Merriam-Webster. If a word is missing, lookup falls back to the local MW dictionary. Import CSV / TSV / JSON / TXT, or add words by hand.",
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setCustomOpen(true)}
                  className="mt-2 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                >
                  {t("Manage my dictionary")}
                </button>
              </span>
            </div>

            <label className="flex items-start gap-3" htmlFor="vocab-exam-ai">
              <input
                id="vocab-exam-ai"
                type="checkbox"
                checked={vocabExamAi}
                onChange={(e) => setVocabExamAi(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">
                  {t("AI grading for word tests")}
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-600">
                  {t(
                    "When you submit a word test, ask the configured model to grade both directions. It receives the word-list meaning and Merriam-Webster references and is instructed to be strict. Turn this off to grade locally with no token cost. A failed or missing model falls back to local grading automatically.",
                  )}
                </span>
              </span>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-xs text-slate-500" aria-live="polite" data-testid="settings-save-state">
            {saveLabel}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void onTest()}
            disabled={busy !== null}
          >
            {busy === "test" ? t("Testing…") : t("Test connection")}
          </Button>
        </div>

        {probe && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              probe.ok
                ? "border-green-300 bg-green-50 text-green-800"
                : "border-red-300 bg-red-50 text-red-800"
            }`}
          >
            {probe.ok ? "✓ " : "✗ "}
            {probe.detail}
          </div>
        )}
      </div>

      {desktop && (
        <section className="mt-5 rounded-xl border border-red-200 bg-white p-6 shadow-sm">
          <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-slate-400">
            {t("Desktop")}
          </p>
          <h2 className="mt-2 text-lg font-semibold">{t("Reset local data")}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {t(
              "Remove the local database, imported documents, analyses, vocabulary, exports and preferences, then restart InteFlow. Your own dictionary source files in the dictionary folder are kept. This cannot be undone.",
            )}
          </p>
          <button
            type="button"
            onClick={() => void onResetData()}
            disabled={resetting}
            className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            {resetting ? t("Resetting…") : t("Reset local data…")}
          </button>
        </section>
      )}

      {customOpen && (
        <CustomDictionaryManager onClose={() => setCustomOpen(false)} />
      )}
    </div>
  );
}