import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  api,
  ApiError,
  type DictionaryEntry,
  type DictionaryLookup,
  type DictionaryStatus,
  type VocabularyDocument,
  type VocabularyOverview,
  type WordGrid,
} from "../api/client";
import VocabGrid from "../components/workspace/VocabGrid";
import WordExamPanel from "../components/workspace/WordExamPanel";
import { Tabs } from "../components/ui";
import { useI18n } from "../lib/i18n";

function errText(err: unknown): string {
  return err instanceof ApiError ? err.message : String(err);
}

function wordCount(grid: WordGrid): number {
  return grid.rows.filter((row) =>
    Object.values(row.cells).some((cell) => cell.trim() !== ""),
  ).length;
}

/** Left index: every exam, its word count and a preview. */
function ExamIndex({
  documents,
  selectedId,
  onSelect,
}: {
  documents: VocabularyDocument[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const filtered = documents.filter((doc) =>
    doc.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <aside className="flex max-h-[42dvh] min-h-0 w-full shrink-0 flex-col border-b border-slate-200 bg-white lg:max-h-none lg:w-80 lg:border-b-0 lg:border-r">
      <div className="shrink-0 border-b border-slate-200 px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          {t("Reference")}
        </p>
        <h1 className="mt-1 font-display text-2xl tracking-tight text-slate-900">
          {t("Vocabulary")}
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          {t("{exams} exams · {words} words", {
            exams: documents.length,
            words: documents
              .reduce((sum, doc) => sum + doc.word_count, 0)
              .toLocaleString(locale),
          })}
        </p>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("Filter exams…")}
          aria-label={t("Filter exams")}
          className="mt-3 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-sm text-slate-400">
            {documents.length === 0 ? t("No exams yet.") : t("No exam matches that filter.")}
          </p>
        ) : (
          <ul className="space-y-1">
            {filtered.map((doc) => {
              const active = doc.document_id === selectedId;
              return (
                <li key={doc.document_id}>
                  <button
                    type="button"
                    onClick={() => onSelect(doc.document_id)}
                    aria-pressed={active}
                    className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                      active
                        ? "bg-slate-100 ring-1 ring-inset ring-slate-300"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                        {doc.title}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                          doc.word_count > 0
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {doc.word_count}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-400">
                      {doc.preview.length > 0
                        ? doc.preview.join(" · ")
                        : t("No words yet — add from the workspace")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

/** Right editor: one exam's word list, manual add, dictionary lookup, export. */
function VocabularyDetail({
  doc,
  onChanged,
}: {
  doc: VocabularyDocument;
  onChanged: () => void;
}) {
  const { t, locale } = useI18n();
  const docId = doc.document_id;
  const [grid, setGrid] = useState<WordGrid | null>(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState({ word: "", pos: "", meaning: "", notes: "" });

  const [status, setStatus] = useState<DictionaryStatus | null>(null);
  const [query, setQuery] = useState("");
  const [lookup, setLookup] = useState<DictionaryLookup | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupErr, setLookupErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setGrid(null);
    setDirty(false);
    api
      .getWords(docId)
      .then((loaded) => {
        if (!cancelled) setGrid(loaded);
      })
      .catch((error) => {
        if (!cancelled) setErr(errText(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    api
      .dictionaryStatus()
      .then((next) => !cancelled && setStatus(next))
      .catch(() => !cancelled && setStatus(null));

    return () => {
      cancelled = true;
    };
  }, [docId]);

  function resetMessages() {
    setMsg(null);
    setWarning(null);
    setErr(null);
  }

  async function save(): Promise<boolean> {
    if (!grid || !dirty) return true;
    setBusy(true);
    setErr(null);
    try {
      const saved = await api.putWords(docId, grid);
      setGrid(saved);
      setDirty(false);
      setMsg(t("Saved ✓"));
      onChanged();
      return true;
    } catch (error) {
      setErr(errText(error));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addManual(event: FormEvent) {
    event.preventDefault();
    const word = form.word.trim();
    if (!word || busy) return;
    resetMessages();
    if (!(await save())) return;
    setBusy(true);
    try {
      const result = await api.addWordEntry(docId, {
        word,
        pos: form.pos.trim(),
        meaning: form.meaning.trim(),
        notes: form.notes.trim(),
      });
      setGrid(result.grid);
      setDirty(false);
      setMsg(
        result.created
          ? t("Added “{word}”.", { word: result.word })
          : t("Updated “{word}”.", { word: result.word }),
      );
      setForm({ word: "", pos: "", meaning: "", notes: "" });
      onChanged();
    } catch (error) {
      setErr(errText(error));
    } finally {
      setBusy(false);
    }
  }

  async function runLookup(event?: FormEvent) {
    event?.preventDefault();
    const text = query.trim();
    if (!text || lookupBusy) return;
    resetMessages();
    setLookupErr(null);
    setLookupBusy(true);
    try {
      setLookup(await api.dictionaryLookup(text));
    } catch (error) {
      setLookup(null);
      setLookupErr(errText(error));
    } finally {
      setLookupBusy(false);
    }
  }

  async function addEntry(entry: DictionaryEntry) {
    resetMessages();
    if (!(await save())) return;
    setBusy(true);
    try {
      const result = await api.addWordFromEntry(docId, {
        entry_id: entry.id,
        source: entry.source,
      });
      setGrid(result.grid);
      setDirty(false);
      setMsg(
        result.definition
          ? t("Added “{word}”{pos} — {definition}", {
              word: result.word,
              pos: result.pos ? ` · ${result.pos}` : "",
              definition: result.definition,
            })
          : t("Added “{word}”.", { word: result.word }),
      );
      onChanged();
    } catch (error) {
      setErr(errText(error));
    } finally {
      setBusy(false);
    }
  }

  async function exportXlsx() {
    if (!(await save())) return;
    const a = document.createElement("a");
    a.href = api.wordsExportUrl(docId);
    a.click();
  }

  const count = grid ? wordCount(grid) : doc.word_count;
  const dictionaryTitle = status?.title || status?.source_name || "Merriam-Webster";

  return (
    <section className="min-h-0 w-full flex-1 overflow-y-auto bg-slate-50">
      <div className="w-full px-4 py-4 sm:px-6">
        <header className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-xl tracking-tight text-slate-900">
              {doc.title}
            </h2>
            <p className="text-xs text-slate-500">
              {t("{count} words", { count })}
              {dirty ? ` · ${t("unsaved changes")}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={!dirty || busy}
              className="rounded-lg border bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100 disabled:opacity-40"
            >
              {busy ? t("Saving…") : t("Save")}
            </button>
            <button
              type="button"
              onClick={() => void exportXlsx()}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
            >
              {t("Export .xlsx")}
            </button>
            <Link
              to={`/doc/${docId}/practice`}
              className="rounded-lg border bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
            >
              {t("Practice")}
            </Link>
          </div>
        </header>

        {(msg || warning || err) && (
          <div className="mt-3 space-y-1">
            {msg && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{msg}</p>
            )}
            {warning && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{warning}</p>
            )}
            {err && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>
            )}
          </div>
        )}

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0">
            <form
              onSubmit={(event) => void addManual(event)}
              className="grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-2 xl:grid-cols-4"
              aria-label={t("Add a word")}
            >
              <input
                value={form.word}
                onChange={(event) => setForm({ ...form, word: event.target.value })}
                placeholder={t("Word")}
                aria-label={t("Word")}
                required
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
              />
              <input
                value={form.pos}
                onChange={(event) => setForm({ ...form, pos: event.target.value })}
                placeholder={t("POS (e.g. adj.)")}
                aria-label={t("Part of speech")}
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
              />
              <input
                value={form.meaning}
                onChange={(event) => setForm({ ...form, meaning: event.target.value })}
                placeholder={t("Meaning")}
                aria-label={t("Meaning")}
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
              />
              <input
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder={t("Notes (optional)")}
                aria-label={t("Notes")}
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!form.word.trim() || busy}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40 sm:col-span-2 xl:col-span-4"
              >
                {t("Add word")}
              </button>
            </form>

            <div className="mt-4 h-[30rem] min-h-[20rem]">
              {loading ? (
                <p className="rounded-xl border bg-white p-6 text-sm text-slate-400">
                  {t("Loading words…")}
                </p>
              ) : grid ? (
                <VocabGrid
                  grid={grid}
                  onChange={(next) => {
                    setGrid(next);
                    setDirty(true);
                    setMsg(null);
                    setWarning(null);
                    setErr(null);
                  }}
                />
              ) : (
                <p className="rounded-xl border bg-white p-6 text-sm text-red-600">
                  {err ?? t("Could not load this word list.")}
                </p>
              )}
            </div>
          </div>

          <aside className="space-y-3">
            <form
              onSubmit={(event) => void runLookup(event)}
              className="rounded-xl border bg-white p-3"
              aria-label={t("Dictionary lookup")}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t("Dictionary")}
              </p>
              <div className="mt-2 flex gap-1.5">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("Look up a word…")}
                  aria-label={t("Look up a word")}
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!query.trim() || lookupBusy}
                  className="rounded-lg border bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
                >
                  {lookupBusy ? "…" : t("Look up")}
                </button>
              </div>

              {status && !status.available && (
                <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs leading-5 text-amber-800">
                  {t(
                    "Merriam-Webster is not installed. Put the Eudic .eudb file in the",
                  )}{" "}
                  <code>dictionary/</code> {t("folder, then reload.")}
                </p>
              )}
              {status?.available && !status.indexed && (
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {t(
                    "The local index is built automatically on first lookup (about 10 seconds). Only English-English definitions are shown.",
                  )}
                </p>
              )}
              {status?.indexed && (
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {t("{title} · {count} entries", {
                    title: dictionaryTitle,
                    count: status.entry_count.toLocaleString(locale),
                  })}
                  {status.learner_enabled && status.learner_count > 0
                    ? t(" · {count} with English-learner definitions", {
                        count: status.learner_count.toLocaleString(locale),
                      })
                    : ""}{" "}
                  · {t("local, no tokens.")}
                </p>
              )}
              {status && status.custom_dictionary.count > 0 && (
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {t("My dictionary: {count} words", {
                    count: status.custom_dictionary.count.toLocaleString(locale),
                  })}
                  {status.custom_dictionary.enabled
                    ? t(" · checked first")
                    : t(" · off in Settings")}
                  .
                </p>
              )}
              {lookupErr && (
                <p className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700">
                  {lookupErr}
                </p>
              )}
              {lookup?.warning && (
                <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                  {lookup.warning}
                </p>
              )}

              {lookup && (
                <div className="mt-3 space-y-2">
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
                      <div key={`${entry.source}-${entry.id}`} className="rounded-lg border bg-slate-50 p-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">{entry.headword}</span>
                          <button
                            type="button"
                            onClick={() => void addEntry(entry)}
                            disabled={busy}
                            className="ml-auto rounded border bg-white px-2 py-0.5 text-xs font-medium hover:bg-slate-100 disabled:opacity-40"
                          >
                            {t("Add")}
                          </button>
                        </div>
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          {label}
                        </p>
                        <p className="mt-0.5 max-h-40 overflow-y-auto whitespace-pre-wrap text-xs leading-5 text-slate-600">
                          {definition}
                        </p>
                      </div>
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
                            className="rounded-full border bg-white px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100"
                          >
                            {entry.headword}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </form>

            <div className="rounded-xl border bg-white p-3 text-xs leading-5 text-slate-500">
              <p className="font-medium text-slate-700">{t("How words get here")}</p>
              <p className="mt-1">
                {t(
                  "Drag a word from a question or option onto the Vocabulary pane in the review workspace — the dictionary sense that fits the sentence is added. AI sense matching, English-learner definitions, and My dictionary can be toggled in Settings. You can also add words here or edit any cell above.",
                )}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

export default function VocabularyPage() {
  const { t } = useI18n();
  const [overview, setOverview] = useState<VocabularyOverview | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [view, setView] = useState<"list" | "test">("list");
  const [testMounted, setTestMounted] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    try {
      const next = await api.getVocabulary();
      setOverview(next);
      setErr(null);
    } catch (error) {
      setErr(errText(error));
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const documents = useMemo(() => overview?.documents ?? [], [overview]);

  useEffect(() => {
    if (documents.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => {
      if (prev !== null && documents.some((doc) => doc.document_id === prev)) return prev;
      return (
        documents.find((doc) => doc.word_count > 0)?.document_id ??
        documents[0].document_id
      );
    });
  }, [documents]);

  const selected = documents.find((doc) => doc.document_id === selectedId) ?? null;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] w-full flex-col overflow-hidden lg:h-[100dvh] lg:flex-row">
      <ExamIndex
        documents={documents}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      {overview === null ? (
        <div className="grid min-h-0 flex-1 place-items-center p-8 text-sm text-slate-500">
          {err
            ? t("Could not load vocabulary: {error}", { error: err })
            : t("Loading vocabulary…")}
        </div>
      ) : selected ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-slate-200 bg-white px-3 pt-1">
            <Tabs
              ariaLabel={t("Vocabulary views")}
              tabs={[
                { key: "list", label: t("Word list") },
                { key: "test", label: t("Word test") },
              ]}
              activeKey={view}
              onChange={(key) => {
                if (key === "test") setTestMounted(true);
                setView(key === "test" ? "test" : "list");
              }}
            />
          </div>

          <div
            id="list-panel"
            role="tabpanel"
            aria-labelledby="list-tab"
            className={view === "list" ? "flex min-h-0 flex-1 flex-col" : "hidden"}
          >
            <VocabularyDetail
              key={selected.document_id}
              doc={selected}
              onChanged={() => void refresh()}
            />
          </div>

          {testMounted && (
            <div
              id="test-panel"
              role="tabpanel"
              aria-labelledby="test-tab"
              className={view === "test" ? "flex min-h-0 flex-1 flex-col" : "hidden"}
            >
              <WordExamPanel
                key={`test-${selected.document_id}`}
                doc={selected}
                onBack={() => setView("list")}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 place-items-center p-8 text-center">
          <div>
            <p className="font-display text-2xl tracking-tight text-slate-700">
              {t("No exams yet")}
            </p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
              {t(
                "Import an exam, then drag words from the review workspace into its vocabulary list. Every exam keeps its own list, and re-practising edits the same one.",
              )}
            </p>
            <Link
              to="/library"
              className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              {t("Go to Library")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
