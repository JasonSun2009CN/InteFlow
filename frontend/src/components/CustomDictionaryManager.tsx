import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError, type CustomDictionaryEntry } from "../api/client";

function errText(err: unknown): string {
  return err instanceof ApiError ? err.message : String(err);
}

interface Props {
  onClose: () => void;
}

/** Add / import / delete entries in the user's own dictionary. */
export default function CustomDictionaryManager({ onClose }: Props) {
  const [entries, setEntries] = useState<CustomDictionaryEntry[] | null>(null);
  const [count, setCount] = useState(0);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ word: "", pos: "", definition: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (search: string) => {
    setEntries(null);
    setError(null);
    try {
      const data = await api.getCustomDictionary(search);
      setEntries(data.entries);
      setCount(data.count);
    } catch (err) {
      setError(errText(err));
    }
  }, []);

  useEffect(() => {
    void load("");
  }, [load]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function add(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const word = form.word.trim();
    const definition = form.definition.trim();
    if (!word || !definition) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.addCustomDictionaryEntry({
        word,
        definition,
        pos: form.pos.trim(),
      });
      setForm({ word: "", pos: "", definition: "" });
      setMessage(`Added “${word}”.`);
      await load(query);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(entry: CustomDictionaryEntry) {
    if (busy) return;
    if (!window.confirm(`Delete “${entry.word}” from your dictionary?`)) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.deleteCustomDictionaryEntry(entry.id);
      setMessage(`Deleted “${entry.word}”.`);
      await load(query);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file: File) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.importCustomDictionary(file);
      setMessage(
        `Imported ${result.added} new and ${result.updated} updated words` +
          (result.skipped ? `, skipped ${result.skipped}.` : "."),
      );
      await load(query);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-dictionary-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-xl border bg-white shadow-xl"
      >
        <header className="flex items-start gap-3 border-b px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2
              id="custom-dictionary-title"
              className="font-display text-xl tracking-tight text-slate-900"
            >
              My dictionary
            </h2>
            <p className="mt-0.5 text-xs leading-5 text-slate-500">
              {count.toLocaleString()} {count === 1 ? "word" : "words"}. Custom entries are
              checked before Merriam-Webster.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-2 py-1 text-xs font-medium hover:bg-slate-50"
          >
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="rounded-xl border bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.tsv,.tab,.txt,.json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void importFile(file);
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
              >
                Import file
              </button>
              <span className="text-[11px] text-slate-500">
                CSV / TSV / JSON / TXT · columns: <code>word, definition, pos</code>
              </span>
            </div>
          </div>

          <form onSubmit={(event) => void add(event)} className="mt-3 rounded-xl border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Add a word
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem]">
              <input
                value={form.word}
                onChange={(event) => setForm({ ...form, word: event.target.value })}
                placeholder="Word"
                aria-label="Custom dictionary word"
                className="min-w-0 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
              />
              <input
                value={form.pos}
                onChange={(event) => setForm({ ...form, pos: event.target.value })}
                placeholder="POS (optional)"
                aria-label="Custom dictionary part of speech"
                className="min-w-0 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
              />
            </div>
            <textarea
              value={form.definition}
              onChange={(event) => setForm({ ...form, definition: event.target.value })}
              placeholder="Definition / meaning"
              aria-label="Custom dictionary definition"
              rows={2}
              className="mt-2 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !form.word.trim() || !form.definition.trim()}
              className="mt-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
            >
              {busy ? "Saving…" : "Add word"}
            </button>
          </form>

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}
          {message && (
            <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              {message}
            </p>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void load(query);
            }}
            className="mt-4 flex gap-2"
          >
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter my dictionary…"
              aria-label="Filter my dictionary"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
            >
              Search
            </button>
          </form>

          {entries === null && !error && (
            <p className="mt-4 text-sm text-slate-500">Loading…</p>
          )}
          {entries?.length === 0 && (
            <p className="mt-4 rounded-lg border border-dashed px-4 py-8 text-center text-sm text-slate-500">
              No words yet. Import a file above, or add one word at a time.
            </p>
          )}
          {entries && entries.length > 0 && (
            <ul className="mt-3 divide-y divide-slate-100 rounded-xl border bg-white">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-start gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800">
                      {entry.word}
                      {entry.pos && (
                        <span className="ml-2 text-xs font-normal text-slate-400">
                          {entry.pos}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap text-xs leading-5 text-slate-600">
                      {entry.definition}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void remove(entry)}
                    disabled={busy}
                    aria-label={`Delete ${entry.word}`}
                    className="shrink-0 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-40"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
