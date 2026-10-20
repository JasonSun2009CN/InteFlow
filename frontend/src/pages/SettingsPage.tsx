import { useEffect, useState } from "react";
import {
  api,
  ApiError,
  type AppSettings,
  type ProbeResult,
  type ProviderInfo,
} from "../api/client";
import { Button, ThemePicker } from "../components/ui";
import CustomDictionaryManager from "../components/CustomDictionaryManager";

function errText(err: unknown): string {
  return err instanceof ApiError ? err.message : String(err);
}

export default function SettingsPage() {
  const [provider, setProvider] = useState("orcarouter");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [userName, setUserName] = useState("");
  const [llmFallback, setLlmFallback] = useState(true);
  const [vocabAiSense, setVocabAiSense] = useState(true);
  const [vocabLearner, setVocabLearner] = useState(false);
  const [vocabExamAi, setVocabExamAi] = useState(false);
  const [customDictionary, setCustomDictionary] = useState(true);
  const [customOpen, setCustomOpen] = useState(false);
  const [stored, setStored] = useState<AppSettings | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [providersLoaded, setProvidersLoaded] = useState(false);
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [probe, setProbe] = useState<ProbeResult | null>(null);

  useEffect(() => {
    Promise.all([api.getSettings(), api.listProviders()])
      .then(([s, list]) => {
        setStored(s);
        setProvider(s.provider);
        setBaseUrl(s.base_url);
        setModel(s.model);
        setUserName(s.user_name);
        setLlmFallback(s.llm_fallback);
        setVocabAiSense(s.vocab_ai_sense);
        setVocabLearner(s.vocab_learner_definitions);
        setVocabExamAi(s.vocab_exam_ai_grading);
        setCustomDictionary(s.custom_dictionary_enabled);
        setProviders(list);
      })
      .catch((err) => setMessage({ kind: "err", text: errText(err) }))
      .finally(() => setProvidersLoaded(true));
  }, []);

  function presetOf(id: string): ProviderInfo | undefined {
    return providers.find((p) => p.id === id);
  }

  const currentPreset = presetOf(provider);

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

  async function onSave() {
    setBusy("save");
    setMessage(null);
    setProbe(null);
    try {
      const saved = await api.saveSettings({
        provider,
        base_url: baseUrl.trim(),
        model: model.trim(),
        user_name: userName.trim(),
        llm_fallback: llmFallback,
        vocab_ai_sense: vocabAiSense,
        vocab_learner_definitions: vocabLearner,
        vocab_exam_ai_grading: vocabExamAi,
        custom_dictionary_enabled: customDictionary,
        ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
      });
      setStored(saved);
      setApiKey("");
      setMessage({ kind: "ok", text: "Settings saved." });
    } catch (err) {
      setMessage({ kind: "err", text: errText(err) });
    } finally {
      setBusy(null);
    }
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
    setBusy("save");
    setMessage(null);
    try {
      const saved = await api.saveSettings({ clear_key: true });
      setStored(saved);
      setApiKey("");
      setMessage({ kind: "ok", text: "API key removed." });
    } catch (err) {
      setMessage({ kind: "err", text: errText(err) });
    } finally {
      setBusy(null);
    }
  }

  const input =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none";
  const label = "block text-sm font-medium text-slate-700 mb-1";

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10 sm:py-14">
      <header className="mb-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-slate-400">
          Workspace
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Settings</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Configure the LLM API used for on-demand explanations and import fallback.
          Everything is stored locally; the key never leaves this machine except to call
          the provider you name below.
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

      <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label className={label} htmlFor="user-name">
            Your name
          </label>
          <input
            id="user-name"
            className={input}
            value={userName}
            placeholder="Printed on page 1 of every exported notebook"
            onChange={(e) => setUserName(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">
            Used as the cover-page name when you export an analysis notebook.
          </p>
        </div>

        <div>
          <label className={label} htmlFor="provider">
            Provider
          </label>
          <select
            id="provider"
            className={input}
            value={provider}
            onChange={(e) => onProviderChange(e.target.value)}
          >
            {!providersLoaded && <option value={provider}>Loading providers…</option>}
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {currentPreset && (
            <p className="mt-1 text-xs text-slate-500">
              {currentPreset.protocol === "anthropic"
                ? "A provider is the service; this one speaks the Anthropic Messages protocol (x-api-key auth)."
                : "A provider is the service; this one speaks the OpenAI-compatible protocol (chat/completions, Bearer auth)."}
            </p>
          )}
        </div>

        <div>
          <label className={label} htmlFor="base-url">
            Base URL
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
              OpenAI-compatible proxies work too — point this at any{" "}
              <code className="rounded bg-slate-100 px-1">…/v1</code> endpoint.
            </p>
          )}
        </div>

        <div>
          <label className={label} htmlFor="api-key">
            API Key
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
                  ? `Stored: ${stored.api_key_masked} — leave blank to keep`
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
                Remove
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Saved keys are shown masked and are never sent back to the browser.
          </p>
        </div>

        <div>
          <label className={label} htmlFor="model">
            Model
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
                AI recognition fallback
              </span>
              <span className="mt-1 block text-xs leading-5 text-slate-600">
                When a PDF or DOCX cannot be parsed by the built-in layout rules, let the
                configured model label the questions instead. It only reads text that was
                already extracted, never rewrites it, and costs tokens — turn it off to keep
                imports fully offline. When the source prints no choices, the question is
                imported as a fill-in-the-blank instead.
              </span>
            </span>
          </label>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-800">Vocabulary</p>
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
                  AI sense matching
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-600">
                  When you drag a word into the Vocabulary pane, ask the configured model
                  to choose the Merriam-Webster sense that fits the sentence. Turn this
                  off to use the first sense every time with no token cost.
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
                  Definition for English Learners
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-600">
                  When the local Merriam-Webster entry includes its{" "}
                  <em>Definition for English Learners</em> section (usually harder
                  words), use that simpler definition first. Entries without the section
                  fall back to the ordinary definition. This is part of the same
                  dictionary — no extra file and no tokens.
                </span>
              </span>
            </label>

            <div className="flex items-start gap-3">
              <input
                id="custom-dictionary"
                type="checkbox"
                aria-label="Use my dictionary first"
                checked={customDictionary}
                onChange={(e) => setCustomDictionary(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="min-w-0 flex-1">
                <label
                  htmlFor="custom-dictionary"
                  className="block text-sm font-medium text-slate-800"
                >
                  Use my dictionary first
                </label>
                <span className="mt-1 block text-xs leading-5 text-slate-600">
                  Check your own words before Merriam-Webster. If a word is missing,
                  lookup falls back to the local MW dictionary. Import CSV / TSV / JSON /
                  TXT, or add words by hand.
                </span>
                <button
                  type="button"
                  onClick={() => setCustomOpen(true)}
                  className="mt-2 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                >
                  Manage my dictionary
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
                  AI grading for word tests
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-600">
                  When you submit a word test, ask the configured model to grade both
                  directions. It receives the word-list meaning and Merriam-Webster
                  references and is instructed to be strict. Turn this off to grade
                  locally with no token cost. A failed or missing model falls back to
                  local grading automatically.
                </span>
              </span>
            </label>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <Button type="button" onClick={() => void onSave()} disabled={busy !== null}>
            {busy === "save" ? "Saving…" : "Save settings"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void onTest()}
            disabled={busy !== null}
          >
            {busy === "test" ? "Testing…" : "Test connection"}
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

      {customOpen && (
        <CustomDictionaryManager onClose={() => setCustomOpen(false)} />
      )}
    </div>
  );
}