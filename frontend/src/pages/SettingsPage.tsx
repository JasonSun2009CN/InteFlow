import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  BookMarked,
  Check,
  FileUp,
  Languages,
  Monitor,
  Palette,
  PenLine,
  ShieldCheck,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
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

const INPUT_CLASS =
  "w-full rounded-lg border border-paper-300 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm transition-colors placeholder:text-ink-300 hover:border-ink-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";

const HELP_CLASS = "mt-1.5 text-[11px] leading-5 text-ink-400";

/** One block of the page: icon + title, a short lede, then the card. */
function SettingsSection({
  id,
  icon: Icon,
  title,
  description,
  action,
  footer,
  cardClassName = "",
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  footer?: ReactNode;
  cardClassName?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28" aria-labelledby={`${id}-heading`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-paper-200 bg-white text-ink-500 shadow-sm">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2
            id={`${id}-heading`}
            className="font-display text-xl leading-none tracking-tight text-ink-900"
          >
            {title}
          </h2>
        </div>
        {action}
      </div>
      {description && (
        <p className="mt-2.5 max-w-2xl text-xs leading-5 text-ink-500">{description}</p>
      )}
      <div
        className={`mt-4 divide-y divide-paper-200 overflow-hidden rounded-xl border border-paper-200 bg-white shadow-sm ${cardClassName}`}
      >
        {children}
      </div>
      {footer && <div className="mt-3">{footer}</div>}
    </section>
  );
}

/** A label on the left, its control on the right — the page's form rhythm. */
function FieldRow({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2 px-5 py-4 sm:grid-cols-[10.5rem_minmax(0,1fr)] sm:gap-6">
      <div className="sm:pt-1.5">
        <label htmlFor={id} className="text-sm font-medium text-ink-900">
          {label}
        </label>
        {hint && <p className="mt-0.5 text-[11px] leading-4 text-ink-400">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * A checkbox that reads as a switch. The input keeps `role=checkbox` and its
 * label association, so keyboard and screen-reader behaviour is unchanged.
 */
function Switch({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="relative mt-0.5 inline-flex shrink-0 cursor-pointer">
      <input
        id={id}
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        aria-hidden="true"
        className="h-6 w-11 rounded-full bg-paper-300 transition-colors duration-200 peer-checked:bg-primary-600 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-white"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-5"
      />
    </label>
  );
}

/** Title + explanation on the left, switch on the right. */
function ToggleRow({
  id,
  title,
  description,
  checked,
  onChange,
  footer,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  footer?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-5 px-5 py-4 transition-colors hover:bg-paper-50/70">
      <div className="min-w-0 flex-1">
        <label
          htmlFor={id}
          className="cursor-pointer text-sm font-medium text-ink-900"
        >
          {title}
        </label>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-ink-500">{description}</p>
        {footer}
      </div>
      <Switch id={id} checked={checked} onChange={onChange} />
    </div>
  );
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
  const [vocabAutoDefinition, setVocabAutoDefinition] = useState(true);
  const [vocabLearner, setVocabLearner] = useState(false);
  const [vocabExamAi, setVocabExamAi] = useState(false);
  const [customDictionary, setCustomDictionary] = useState(true);
  const [showBuiltin, setShowBuiltin] = useState(false);
  const [dictionaryAuto, setDictionaryAuto] = useState(true);
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
  const [activeSection, setActiveSection] = useState("profile");

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
        setVocabAutoDefinition(s.vocab_auto_definition);
        setVocabLearner(s.vocab_learner_definitions);
        setVocabExamAi(s.vocab_exam_ai_grading);
        setCustomDictionary(s.custom_dictionary_enabled);
        setShowBuiltin(s.show_builtin_library);
        setDictionaryAuto(s.dictionary_auto_lookup);
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

  const desktop = typeof window !== "undefined" && Boolean(window.inteflow?.desktop);

  const sections = useMemo(() => {
    const list: { id: string; label: string; icon: LucideIcon }[] = [
      { id: "profile", label: t("Profile"), icon: UserRound },
      { id: "appearance", label: t("Appearance"), icon: Palette },
      { id: "model", label: t("AI model"), icon: Sparkles },
      { id: "imports", label: t("Importing"), icon: FileUp },
      { id: "vocabulary", label: t("Vocabulary"), icon: Languages },
      { id: "writing", label: t("Writing"), icon: PenLine },
    ];
    if (desktop) list.push({ id: "desktop", label: t("Desktop"), icon: Monitor });
    return list;
  }, [desktop, t]);

  // Scroll-spy for the rail. Browsers without IntersectionObserver (and jsdom)
  // simply keep the first entry marked.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const elements = sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => element !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveSection(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -65% 0px", threshold: 0 },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [sections]);

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
      vocab_auto_definition: vocabAutoDefinition,
      vocab_learner_definitions: vocabLearner,
      vocab_exam_ai_grading: vocabExamAi,
      custom_dictionary_enabled: customDictionary,
      show_builtin_library: showBuiltin,
      dictionary_auto_lookup: dictionaryAuto,
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
      vocabAutoDefinition,
      vocabLearner,
      vocabExamAi,
      customDictionary,
      showBuiltin,
      dictionaryAuto,
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
        setProbe(null);                 // a probe result belongs to the old config
        const saved = await api.saveSettings(current);
        lastSavedRef.current = fingerprint;
        setStored(saved);
        setMessage(null);

        if (current.api_key) {
          // The server now has this key. Only drop it from the queue when no
          // newer key was typed meanwhile, and keep any edits queued while the
          // request was in flight — they still need their own save.
          const queued: SettingsInput = pendingRef.current ?? current;
          if (queued.api_key === current.api_key) {
            pendingRef.current = { ...queued, api_key: undefined };
            setApiKey("");
          }
          lastSavedRef.current = JSON.stringify({ ...current, api_key: undefined });
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
    // Drop the queued autosave (it may still carry a just-typed key) and let an
    // in-flight PUT finish before clearing the key. Otherwise a racing save
    // could write the key back after the clear. The 5 s cap keeps the button
    // from ever hanging on a stalled request.
    pendingRef.current = null;
    setApiKey("");
    const deadline = Date.now() + 5000;
    while (savingRef.current && Date.now() < deadline) {
      await new Promise((resolve) => window.setTimeout(resolve, 25));
    }
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

  const statusTone =
    saveState === "error"
      ? "border-danger-200 bg-danger-50 text-danger-700"
      : "border-paper-200 bg-white text-ink-500";

  const statusDot =
    saveState === "saving"
      ? "bg-primary-500 animate-pulse"
      : saveState === "dirty"
        ? "bg-amber-500"
        : saveState === "saved"
          ? "bg-emerald-500"
          : saveState === "error"
            ? "bg-danger-500"
            : "bg-ink-300";

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <header className="border-b border-paper-200 pb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-ink-400">
          {t("Workspace")}
        </p>
        <h1 className="mt-2 font-display text-3xl leading-none tracking-tight text-ink-900 sm:text-4xl">
          {t("Settings")}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-ink-500">
          {t(
            "Everything on this page is stored on this machine. Changes are saved as you type.",
          )}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px]">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium ${statusTone}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} aria-hidden="true" />
            <span data-testid="settings-save-state" aria-live="polite">
              {saveLabel}
            </span>
          </span>
          <span className="text-ink-300" aria-hidden="true">
            ·
          </span>
          <span className="font-medium tabular-nums text-ink-400">
            {t("Version {version}", { version: version || "…" })}
          </span>
        </div>
      </header>

      {message && (
        <div
          role={message.kind === "err" ? "alert" : "status"}
          className={`mt-5 flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm ${
            message.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-danger-200 bg-danger-50 text-danger-800"
          }`}
        >
          {message.kind === "ok" ? (
            <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span className="min-w-0 break-words">{message.text}</span>
        </div>
      )}

      {/* Narrow screens get the same index as a horizontal strip. */}
      <nav
        aria-label={t("Settings sections")}
        className="sticky top-14 z-20 -mx-5 mt-4 border-b border-paper-200 bg-paper-50/95 px-5 py-2 backdrop-blur sm:-mx-8 sm:px-8 lg:hidden"
      >
        <ul className="flex gap-1.5 overflow-x-auto pb-0.5">
          {sections.map(({ id, label, icon: Icon }) => (
            <li key={id} className="shrink-0">
              <a
                href={`#${id}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-paper-200 bg-white px-3 py-1.5 text-[11px] font-medium text-ink-500 transition-colors hover:border-paper-300 hover:text-ink-900"
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-6 lg:mt-8 lg:grid lg:grid-cols-[12.5rem_minmax(0,1fr)] lg:gap-10">
        <nav aria-label={t("Settings sections")} className="hidden lg:block">
          <div className="sticky top-8">
            <p className="px-2.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-400">
              {t("On this page")}
            </p>
            <ul className="mt-2 space-y-0.5">
              {sections.map(({ id, label, icon: Icon }) => {
                const active = id === activeSection;
                return (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      aria-current={active ? "true" : undefined}
                      className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors ${
                        active
                          ? "bg-white font-medium text-ink-900 shadow-sm ring-1 ring-paper-200"
                          : "text-ink-500 hover:bg-white/60 hover:text-ink-900"
                      }`}
                    >
                      <Icon
                        className={`h-3.5 w-3.5 shrink-0 ${
                          active ? "text-primary-600" : "text-ink-400"
                        }`}
                        aria-hidden="true"
                      />
                      <span className="truncate">{label}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 flex items-start gap-2 rounded-lg border border-paper-200 bg-white/60 px-3 py-2.5 text-[11px] leading-5 text-ink-400">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <p>
                {t(
                  "Local only. Nothing leaves this machine unless you click Test connection or ask for an explanation.",
                )}
              </p>
            </div>
          </div>
        </nav>

        <div className="min-w-0 space-y-9">
          <SettingsSection
            id="profile"
            icon={UserRound}
            title={t("Profile")}
            description={t("The name printed on the cover of every exported notebook.")}
          >
            <FieldRow id="user-name" label={t("Your name")} hint={t("Cover page")}>
              <input
                id="user-name"
                className={INPUT_CLASS}
                value={userName}
                placeholder={t("Printed on page 1 of every exported notebook")}
                onChange={(e) => setUserName(e.target.value)}
              />
              <p className={HELP_CLASS}>
                {t("Used as the cover-page name when you export an analysis notebook.")}
              </p>
            </FieldRow>
          </SettingsSection>

          <SettingsSection
            id="appearance"
            icon={Palette}
            title={t("Appearance")}
            description={t("Make the workspace feel like yours. Saved locally on this machine.")}
          >
            <div className="px-5 py-5">
              <ThemePicker />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-900">{t("Interface language")}</p>
                <p className="mt-1 max-w-md text-xs leading-5 text-ink-500">
                  {t(
                    "Choose the language used by the workspace. Exam content and your own notes are never translated.",
                  )}
                </p>
              </div>
              <LanguagePicker />
            </div>
          </SettingsSection>

          <SettingsSection
            id="model"
            icon={Sparkles}
            title={t("AI model")}
            description={t(
              "Used only when you ask: explanations, AI sense matching, word-test grading and the optional import fallback. The key is stored locally.",
            )}
            action={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void onTest()}
                disabled={busy !== null}
              >
                {busy === "test" ? t("Testing…") : t("Test connection")}
              </Button>
            }
            footer={
              probe && (
                <div
                  role="status"
                  className={`flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-xs leading-5 ${
                    probe.ok
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-danger-200 bg-danger-50 text-danger-800"
                  }`}
                >
                  {probe.ok ? (
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span className="min-w-0 break-words">{probe.detail}</span>
                </div>
              )
            }
          >
            <FieldRow id="provider" label={t("Provider")} hint={t("Where the model runs")}>
              <select
                id="provider"
                className={INPUT_CLASS}
                value={provider}
                onChange={(e) => onProviderChange(e.target.value)}
              >
                {!providersLoaded && (
                  <option value={provider}>{t("Loading providers…")}</option>
                )}
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {currentPreset && (
                <p className={HELP_CLASS}>
                  {currentPreset.protocol === "anthropic"
                    ? t(
                        "A provider is the service; this one speaks the Anthropic Messages protocol (x-api-key auth).",
                      )
                    : t(
                        "A provider is the service; this one speaks the OpenAI-compatible protocol (chat/completions, Bearer auth).",
                      )}
                </p>
              )}
            </FieldRow>

            <FieldRow id="base-url" label={t("Base URL")} hint={t("Endpoint")}>
              <input
                id="base-url"
                className={INPUT_CLASS}
                value={baseUrl}
                placeholder={currentPreset?.base_url || "https://…/v1"}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
              {currentPreset?.note ? (
                <p className={HELP_CLASS}>{currentPreset.note}</p>
              ) : (
                <p className={HELP_CLASS}>
                  {t("OpenAI-compatible proxies work too — point this at any …/v1 endpoint.")}
                </p>
              )}
            </FieldRow>

            <FieldRow id="api-key" label={t("API Key")} hint={t("Stored locally")}>
              <div className="flex gap-2">
                <input
                  id="api-key"
                  type="password"
                  autoComplete="off"
                  className={INPUT_CLASS}
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
                    className="shrink-0 rounded-lg border border-danger-300 px-3 text-sm font-medium text-danger-700 transition-colors hover:bg-danger-50 disabled:opacity-50"
                  >
                    {t("Remove")}
                  </button>
                )}
              </div>
              <p className={HELP_CLASS}>
                {t("Saved keys are shown masked and are never sent back to the browser.")}
              </p>
            </FieldRow>

            <FieldRow id="model" label={t("Model")} hint={t("Used on demand")}>
              <input
                id="model"
                className={INPUT_CLASS}
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
            </FieldRow>
          </SettingsSection>

          <SettingsSection
            id="imports"
            icon={FileUp}
            title={t("Importing")}
            description={t(
              "PDF, DOCX and InteFlow-MD conversion runs offline. The fallback below is the one exception.",
            )}
          >
            <ToggleRow
              id="llm-fallback"
              title={t("AI recognition fallback")}
              description={t(
                "When a PDF or DOCX cannot be parsed by the built-in layout rules, let the configured model label the questions instead. It only reads text that was already extracted, never rewrites it, and costs tokens — turn it off to keep imports fully offline. When the source prints no choices, the question is imported as a fill-in-the-blank instead.",
              )}
              checked={llmFallback}
              onChange={setLlmFallback}
            />
            <ToggleRow
              id="show-builtin"
              title={t("Show built-in library")}
              description={t(
                "Show the bundled SAT sample bank in Library. It is off by default so a new install starts empty; turning it on lets you add sample units without importing a file.",
              )}
              checked={showBuiltin}
              onChange={setShowBuiltin}
            />
          </SettingsSection>

          <SettingsSection
            id="vocabulary"
            icon={Languages}
            title={t("Vocabulary")}
            description={t(
              "Word lists, the built-in Merriam-Webster dictionary and word tests.",
            )}
          >
            <ToggleRow
              id="dictionary-auto"
              title={t("Look up dictionary words while typing")}
              description={t(
                "The Dictionary tool queries the built-in Merriam-Webster index as you type. Turn it off to look up only when you press Enter, or to add your own definition instead.",
              )}
              checked={dictionaryAuto}
              onChange={setDictionaryAuto}
            />
            <ToggleRow
              id="vocab-auto-definition"
              title={t("Auto-fill definitions in the word list")}
              description={t(
                "When you drag a word into the Vocabulary pane, fill its Meaning with the Merriam-Webster definition automatically. Turn this off to add the word with an empty Meaning and write your own definition.",
              )}
              checked={vocabAutoDefinition}
              onChange={setVocabAutoDefinition}
            />
            <ToggleRow
              id="vocab-ai-sense"
              title={t("AI sense matching")}
              description={t(
                "When you drag a word into the Vocabulary pane, ask the configured model to choose the Merriam-Webster sense that fits the sentence. Turn this off to use the first sense every time with no token cost.",
              )}
              checked={vocabAiSense}
              onChange={setVocabAiSense}
            />
            <ToggleRow
              id="vocab-learner"
              title={t("Definition for English Learners")}
              description={t(
                "When the local Merriam-Webster entry includes its Definition for English Learners section (usually harder words), use that simpler definition first. Entries without the section fall back to the ordinary definition. This is part of the same dictionary — no extra file and no tokens.",
              )}
              checked={vocabLearner}
              onChange={setVocabLearner}
            />
            <ToggleRow
              id="custom-dictionary"
              title={t("Use my dictionary first")}
              description={t(
                "Check your own words before Merriam-Webster. If a word is missing, lookup falls back to the local MW dictionary. Import CSV / TSV / JSON / TXT, or add words by hand.",
              )}
              checked={customDictionary}
              onChange={setCustomDictionary}
              footer={
                <button
                  type="button"
                  onClick={() => setCustomOpen(true)}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-paper-200 bg-white px-2.5 py-1 text-[11px] font-medium text-ink-600 transition-colors hover:border-paper-300 hover:bg-paper-50 hover:text-ink-900"
                >
                  <BookMarked className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("Manage my dictionary")}
                </button>
              }
            />
            <ToggleRow
              id="vocab-exam-ai"
              title={t("AI grading for word tests")}
              description={t(
                "When you submit a word test, ask the configured model to grade both directions. It receives the word-list meaning and Merriam-Webster references and is instructed to be strict. Turn this off to grade locally with no token cost. A failed or missing model falls back to local grading automatically.",
              )}
              checked={vocabExamAi}
              onChange={setVocabExamAi}
            />
          </SettingsSection>

          <SettingsSection
            id="writing"
            icon={PenLine}
            title={t("Writing")}
            description={t("What a fresh analysis page starts with.")}
          >
            <div className="px-5 py-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <label
                  htmlFor="analysis-template"
                  className="text-sm font-medium text-ink-900"
                >
                  {t("Analysis template")}
                </label>
                <span className="rounded border border-paper-200 bg-paper-50 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-400">
                  Markdown
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-ink-500">
                {t(
                  "Pre-filled into every empty analysis page (wrong answers, starred questions and the review workspace). Markdown is supported. An existing analysis is never overwritten, and the template itself is only saved once you start editing the page.",
                )}
              </p>
              <textarea
                id="analysis-template"
                className={`${INPUT_CLASS} mt-3 min-h-[11rem] resize-y font-mono text-[13px] leading-6`}
                value={analysisTemplate}
                placeholder={t(
                  "**Why the correct answer works**\n\n**Why I picked mine**\n\n**Takeaway**\n",
                )}
                onChange={(e) => setAnalysisTemplate(e.target.value)}
              />
            </div>
          </SettingsSection>

          {desktop && (
            <SettingsSection
              id="desktop"
              icon={Monitor}
              title={t("Desktop")}
              description={t("Housekeeping for the installed app.")}
            >
              <div className="flex flex-wrap items-start justify-between gap-4 bg-danger-50/50 px-5 py-4">
                <div className="min-w-0 max-w-xl">
                  <p className="text-sm font-medium text-danger-700">
                    {t("Reset local data")}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-ink-500">
                    {t(
                      "Remove the local database, imported documents, analyses, vocabulary, exports and preferences, then restart InteFlow. Your own dictionary source files in the dictionary folder are kept. This cannot be undone.",
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void onResetData()}
                  disabled={resetting}
                  className="shrink-0 rounded-lg border border-danger-300 bg-white px-3.5 py-2 text-sm font-medium text-danger-700 transition-colors hover:bg-danger-50 disabled:opacity-50"
                >
                  {resetting ? t("Resetting…") : t("Reset local data…")}
                </button>
              </div>
            </SettingsSection>
          )}
        </div>
      </div>

      {customOpen && <CustomDictionaryManager onClose={() => setCustomOpen(false)} />}
    </div>
  );
}
