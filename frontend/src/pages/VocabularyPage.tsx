import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  api,
  ApiError,
  type DictionaryLookup,
  type DictionaryStatus,
  type VocabularyDocument,
  type VocabularyOverview,
  type WordGrid,
} from "../api/client";
import VocabGrid from "../components/workspace/VocabGrid";

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
  const [query, setQuery] = useState("");
  const filtered = documents.filter((doc) =>
    doc.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <aside className="flex max-h-[42dvh] min-h-0 w-full shrink-0 flex-col border-b border-slate-200 bg-white lg:max-h-none lg:w-80 lg:border-b-0 lg:border-r">
      <div className="shrink-0 border-b border-slate-200 px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          Reference
        </p>
        <h1 className="mt-1 font-display text-2xl tracking-tight text-slate-900">
          Vocabulary
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          {documents.length} {documents.length === 1 ? "exam" : "exams"} ·{" "}
          {documents.reduce((sum, doc) => sum + doc.word_count, 0)} words
        </p>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter exams…"
          aria-label="Filter exams"
          className="mt-3 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-sm text-slate-400">
            {documents.length === 0 ? "No exams yet." : "No exam matches that filter."}
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
                        : "No words yet — add from the workspace"}
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
      setMsg("Saved ✓");
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
      setMsg(result.created ? `Added “${result.word}”.` : `Updated “${result.word}”.`);
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

  async function addEntry(entryId: number) {
    resetMessages();
    if (!(await save())) return;
    setBusy(true);
    try {
      const result = await api.addWordFromEntry(docId, {
        entry_id: entryId,
        ...(lookup ? { source: lookup.source } : {}),
      });
      setGrid(result.grid);
      setDirty(false);
      setMsg(
        result.definition
          ? `Added “${result.word}”${result.pos ? ` · ${result.pos}` : ""} — ${result.definition}`
          : `Added “${result.word}”.`,
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
              {count} {count === 1 ? "word" : "words"}
              {dirty ? " · unsaved changes" : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={!dirty || busy}
              className="rounded-lg border bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100 disabled:opacity-40"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => void exportXlsx()}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Export .xlsx
            </button>
            <Link
              to={`/doc/${docId}/practice`}
              className="rounded-lg border bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
            >
              Practice
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
              aria-label="Add a word"
            >
              <input
                value={form.word}
                onChange={(event) => setForm({ ...form, word: event.target.value })}
                placeholder="Word"
                aria-label="Word"
                required
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
              />
              <input
                value={form.pos}
                onChange={(event) => setForm({ ...form, pos: event.target.value })}
                placeholder="POS (e.g. adj.)"
                aria-label="Part of speech"
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
              />
              <input
                value={form.meaning}
                onChange={(event) => setForm({ ...form, meaning: event.target.value })}
                placeholder="Meaning"
                aria-label="Meaning"
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
              />
              <input
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Notes (optional)"
                aria-label="Notes"
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!form.word.trim() || busy}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40 sm:col-span-2 xl:col-span-4"
              >
                Add word
              </button>
            </form>

            <div className="mt-4 h-[30rem] min-h-[20rem]">
              {loading ? (
                <p className="rounded-xl border bg-white p-6 text-sm text-slate-400">
                  Loading words…
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
                  {err ?? "Could not load this word list."}
                </p>
              )}
            </div>
          </div>

          <aside className="space-y-3">
            <form
              onSubmit={(event) => void runLookup(event)}
              className="rounded-xl border bg-white p-3"
              aria-label="Dictionary lookup"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Dictionary
              </p>
              <div className="mt-2 flex gap-1.5">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Look up a word…"
                  aria-label="Look up a word"
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!query.trim() || lookupBusy}
                  className="rounded-lg border bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
                >
                  {lookupBusy ? "…" : "Look up"}
                </button>
              </div>

              {status && !status.available && (
                <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs leading-5 text-amber-800">
                  Merriam-Webster is not installed. Put the Eudic <code>.eudb</code> file in
                  the <code>dictionary/</code> folder, then reload.
                </p>
              )}
              {status?.available && !status.indexed && (
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  The local index is built automatically on first lookup (about 10
                  seconds). Only English-English definitions are shown.
                </p>
              )}
              {status?.indexed && (
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {dictionaryTitle} · {status.entry_count.toLocaleString()} entries · local,
                  no tokens.
                </p>
              )}
              {status?.learner_enabled && !status.learner?.available && (
                <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs leading-5 text-amber-800">
                  Learner&apos;s definitions are on, but no learner&apos;s .eudb was found
                  in <code>dictionary/learners/</code>. Using the standard dictionary.
                </p>
              )}
              {status?.learner?.available && (
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {status.learner_enabled
                    ? "Learner's dictionary in use"
                    : "Learner's dictionary installed — turn it on in Settings"}
                  {status.learner.indexed
                    ? ` · ${status.learner.entry_count.toLocaleString()} entries.`
                    : " · its index builds on first lookup."}
                </p>
              )}
              {lookupErr && (
                <p className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700">
                  {lookupErr}
                </p>
              )}
              {lookup?.fallback && (
                <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                  {lookup.fallback}
                </p>
              )}

              {lookup && (
                <div className="mt-3 space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {lookup.source === "learner"
                      ? "Learner's definition"
                      : "Collegiate definition"}
                  </p>
                  {lookup.exact.length === 0 && (
                    <p className="text-xs text-slate-500">
                      No exact entry. Pick a suggestion below.
                    </p>
                  )}
                  {lookup.exact.map((entry) => (
                    <div key={entry.id} className="rounded-lg border bg-slate-50 p-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{entry.headword}</span>
                        <button
                          type="button"
                          onClick={() => void addEntry(entry.id)}
                          disabled={busy}
                          className="ml-auto rounded border bg-white px-2 py-0.5 text-xs font-medium hover:bg-slate-100 disabled:opacity-40"
                        >
                          Add
                        </button>
                      </div>
                      <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap text-xs leading-5 text-slate-600">
                        {entry.definition}
                      </p>
                    </div>
                  ))}
                  {lookup.matches.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Suggestions
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {lookup.matches.map((entry) => (
                          <button
                            key={entry.id}
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
              <p className="font-medium text-slate-700">How words get here</p>
              <p className="mt-1">
                Drag a word from a question or option onto the Vocabulary pane in the review
                workspace — the Merriam-Webster sense that fits the sentence is added. AI
                sense matching and learner&apos;s definitions can be toggled in Settings. You
                can also add words here or edit any cell above.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

export default function VocabularyPage() {
  const [overview, setOverview] = useState<VocabularyOverview | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
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
          {err ? `Could not load vocabulary: ${err}` : "Loading vocabulary…"}
        </div>
      ) : selected ? (
        <VocabularyDetail
          key={selected.document_id}
          doc={selected}
          onChanged={() => void refresh()}
        />
      ) : (
        <div className="grid min-h-0 flex-1 place-items-center p-8 text-center">
          <div>
            <p className="font-display text-2xl tracking-tight text-slate-700">
              No exams yet
            </p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
              Import an exam, then drag words from the review workspace into its vocabulary
              list. Every exam keeps its own list, and re-practising edits the same one.
            </p>
            <Link
              to="/library"
              className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Go to Library
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
