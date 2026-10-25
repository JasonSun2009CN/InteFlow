import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  api,
  ApiError,
  type AppSettings,
  type DictionaryEntry,
  type DictionaryLookup,
  type DictionaryStatus,
} from "../../api/client";
import { useI18n } from "../../lib/i18n";

function errText(err: unknown): string {
  return err instanceof ApiError ? err.message : String(err);
}

/**
 * Dictionary pane: the bundled Merriam-Webster index as a peer review tool.
 *
 * Fully local (no tokens). Settings decides whether a lookup runs while typing
 * or only on Enter; either way the pane can save the student's own definition
 * into My dictionary, which the lookup consults first when enabled.
 */
export default function DictionaryPane() {
  const { t, locale } = useI18n();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [status, setStatus] = useState<DictionaryStatus | null>(null);
  const [query, setQuery] = useState("");
  const [lookup, setLookup] = useState<DictionaryLookup | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addWord, setAddWord] = useState("");
  const [addPos, setAddPos] = useState("");
  const [addDefinition, setAddDefinition] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addMsg, setAddMsg] = useState<string | null>(null);
  const [addErr, setAddErr] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    Promise.all([api.getSettings(), api.dictionaryStatus()])
      .then(([s, d]) => {
        setSettings(s);
        setStatus(d);
      })
      .catch((error) => setErr(errText(error)));
  }, []);

  const runLookup = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const id = ++requestId.current;
    setBusy(true);
    setErr(null);
    try {
      const result = await api.dictionaryLookup(trimmed);
      if (id === requestId.current) setLookup(result);
    } catch (error) {
      if (id === requestId.current) {
        setLookup(null);
        setErr(errText(error));
      }
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }, []);

  // Auto lookup while typing, unless the user turned it off in Settings.
  useEffect(() => {
    if (settings?.dictionary_auto_lookup === false) return;
    const trimmed = query.trim();
    if (!trimmed) return;
    const timer = window.setTimeout(() => void runLookup(trimmed), 350);
    return () => window.clearTimeout(timer);
  }, [query, settings, runLookup]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void runLookup(query);
  }

  function openAdd(entry?: DictionaryEntry | string) {
    setAddOpen(true);
    setAddMsg(null);
    setAddErr(null);
    if (typeof entry === "string") {
      setAddWord(entry);
    } else if (entry) {
      setAddWord(entry.headword);
      setAddPos(entry.pos ?? "");
    } else if (!addWord) {
      setAddWord(lookup?.query ?? query);
    }
  }

  async function saveDefinition(event: FormEvent) {
    event.preventDefault();
    const word = addWord.trim();
    const definition = addDefinition.trim();
    if (!word || !definition) return;
    setAddBusy(true);
    setAddErr(null);
    setAddMsg(null);
    try {
      const saved = await api.addCustomDictionaryEntry({
        word,
        definition,
        pos: addPos.trim(),
      });
      setAddMsg(
        t("Saved “{word}” to My dictionary ({count} words).", {
          word: saved.word,
          count: saved.count.toLocaleString(locale),
        }),
      );
      setAddDefinition("");
      setAddPos("");
      setStatus((current) =>
        current
          ? {
              ...current,
              custom_dictionary: { ...current.custom_dictionary, count: saved.count },
            }
          : current,
      );
      void runLookup(word);
    } catch (error) {
      setAddErr(errText(error));
    } finally {
      setAddBusy(false);
    }
  }

  const dictionaryTitle = status?.title || status?.source_name || "Merriam-Webster";
  const autoLookup = settings?.dictionary_auto_lookup !== false;

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{t("Dictionary")}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {status?.indexed
                ? t("{title} · {count} entries · local, no tokens.", {
                    title: dictionaryTitle,
                    count: status.entry_count.toLocaleString(locale),
                  })
                : t("Merriam-Webster · local, no tokens.")}
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            {t("0 tokens")}
          </span>
        </div>

        <form onSubmit={onSubmit} className="mt-2 flex gap-1.5">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Look up a word…")}
            aria-label={t("Look up a word")}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!query.trim() || busy}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {busy ? "…" : t("Look up")}
          </button>
        </form>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 [scrollbar-gutter:stable]">
        {status && !status.available && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            {t("Merriam-Webster is not installed. Put the Eudic .eudb file in the")}{" "}
            <code>dictionary/</code> {t("folder, then reload.")}
          </p>
        )}
        {status?.available && !status.indexed && (
          <p className="text-xs leading-5 text-slate-500">
            {t(
              "The local index is built automatically on first lookup (about 10 seconds). Only English-English definitions are shown.",
            )}
          </p>
        )}
        {err && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>
        )}
        {lookup?.warning && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {lookup.warning}
          </p>
        )}

        {!query.trim() && !lookup && (
          <div className="mt-6 rounded-xl border border-dashed bg-white px-4 py-6 text-center">
            <p className="text-sm font-medium text-slate-700">
              {t("Look up any word from the question.")}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {t(
                "Definitions come from the bundled Merriam-Webster index. Your own definitions are checked first.",
              )}
            </p>
            <button
              type="button"
              onClick={() => openAdd()}
              className="mt-3 text-xs font-medium text-blue-700 underline underline-offset-4"
            >
              {t("Add my own definition")}
            </button>
          </div>
        )}

        {lookup && (
          <div className="space-y-3">
            {lookup.exact.length === 0 && (
              <p className="text-xs text-slate-500">
                {t("No exact entry. Pick a suggestion below.")}
              </p>
            )}
            {lookup.exact.map((entry) => {
              const learner =
                status?.learner_enabled && entry.learner_definition
                  ? entry.learner_definition
                  : null;
              const definition = learner ?? entry.definition;
              const label =
                entry.source === "custom"
                  ? t("My dictionary")
                  : learner
                    ? t("Definition for English Learners")
                    : t("Collegiate definition");
              return (
                <article
                  key={`${entry.source}-${entry.id}`}
                  className="rounded-xl border border-slate-200 bg-white p-3"
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h3 className="font-display text-lg font-semibold text-slate-900">
                      {entry.headword}
                    </h3>
                    {entry.pos && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] italic text-slate-600">
                        {entry.pos}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => openAdd(entry)}
                      className="ml-auto rounded border bg-white px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      {t("Add my own definition")}
                    </button>
                  </div>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {label}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {definition}
                  </p>
                </article>
              );
            })}

            {lookup.matches.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {t("Suggestions")}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {lookup.matches.map((entry) => (
                    <button
                      key={`${entry.source}-${entry.id}`}
                      type="button"
                      onClick={() => setQuery(entry.headword)}
                      title={entry.snippet}
                      className="rounded-full border bg-white px-2.5 py-0.5 text-xs text-slate-600 hover:bg-slate-100"
                    >
                      {entry.headword}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => openAdd()}
              className="text-xs font-medium text-blue-700 underline underline-offset-4"
            >
              {t("Can't find it? Add my own definition")}
            </button>
          </div>
        )}

        {addOpen && (
          <form
            onSubmit={(event) => void saveDefinition(event)}
            className="mt-4 rounded-xl border border-blue-200 bg-blue-50/60 p-3"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">
              {t("Add my own definition")}
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-slate-600">
                {t("Word")}
                <input
                  value={addWord}
                  onChange={(event) => setAddWord(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </label>
              <label className="text-xs text-slate-600">
                {t("Part of speech (optional)")}
                <input
                  value={addPos}
                  onChange={(event) => setAddPos(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </label>
            </div>
            <label className="mt-2 block text-xs text-slate-600">
              {t("Definition")}
              <textarea
                value={addDefinition}
                onChange={(event) => setAddDefinition(event.target.value)}
                rows={3}
                className="mt-1 w-full resize-y rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="submit"
                disabled={addBusy || !addWord.trim() || !addDefinition.trim()}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
              >
                {addBusy ? t("Saving…") : t("Save definition")}
              </button>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="rounded-lg border bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                {t("Cancel")}
              </button>
              {addMsg && <span className="text-xs text-emerald-700">{addMsg}</span>}
              {addErr && <span className="text-xs text-red-700">{addErr}</span>}
            </div>
            {!autoLookup && (
              <p className="mt-2 text-[11px] leading-5 text-slate-500">
                {t("Auto lookup is off — press Enter in the search box to look a word up.")}
              </p>
            )}
          </form>
        )}

        <div className="mt-6 border-t border-slate-200 pt-3 text-[11px] leading-5 text-slate-500">
          {status && status.custom_dictionary.count > 0 ? (
            <p>
              {t("My dictionary: {count} words", {
                count: status.custom_dictionary.count.toLocaleString(locale),
              })}
              {status.custom_dictionary.enabled
                ? t(" · checked first")
                : t(" · off in Settings")}
              .
            </p>
          ) : (
            <p>{t("Your own definitions are saved locally and checked first.")}</p>
          )}
          <p className="mt-1">
            {autoLookup
              ? t("Auto lookup is on. Change it in Settings → Look up dictionary words while typing.")
              : t("Auto lookup is off. Change it in Settings → Look up dictionary words while typing.")}
          </p>
        </div>
      </div>
    </div>
  );
}
