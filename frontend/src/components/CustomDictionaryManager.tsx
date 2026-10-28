import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError, type CustomDictionaryEntry } from "../api/client";
import { useI18n } from "../lib/i18n";

function errText(err: unknown): string {
  return err instanceof ApiError ? err.message : String(err);
}

interface Props {
  onClose: () => void;
}

/** Add / import / delete entries in the user's own dictionary. */
export default function CustomDictionaryManager({ onClose }: Props) {
  const { t } = useI18n();
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
    if (
      !window.confirm(t("Delete “{word}” from your dictionary?", { word: entry.word }))
    )
      return;
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
        result.skipped
          ? t(
              "Imported {added} new, updated {updated}, skipped {skipped}.",
              {
                added: result.added,
                updated: result.updated,
                skipped: result.skipped,
              },
            )
          : t("Imported {added} new, updated {updated}.", {
              added: result.added,
              updated: result.updated,
            }),
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
        className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden border border-slate-300 bg-white"
      >
        <header className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2
              id="custom-dictionary-title"
              className="text-xl tracking-tight text-slate-900"
            >
              {t("My dictionary")}
            </h2>
            <p className="mt-0.5 text-xs leading-5 text-slate-500">
              {t("{count} words. Custom entries are checked before Merriam-Webster.", {
                count: count.toLocaleString(),
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-slate-300 px-2 py-1 text-xs font-medium hover:border-slate-900"
          >
            {t("Close")}
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="border-l-2 border-slate-200 pl-3">
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
                className="bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
              >
                {t("Import file")}
              </button>
              <span className="text-xs text-slate-500">
                {t("CSV / TSV / JSON / TXT · columns: word, definition, pos")}
              </span>
            </div>
          </div>

          <form onSubmit={(event) => void add(event)} className="mt-4 border-t border-slate-200 pt-4">
            <p className="text-xs font-medium text-slate-500">
              {t("Add a word")}
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem]">
              <input
                value={form.word}
                onChange={(event) => setForm({ ...form, word: event.target.value })}
                placeholder={t("Word")}
                aria-label={t("Custom dictionary word")}
                className="min-w-0 border-b border-slate-300 bg-transparent px-0 py-1.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              />
              <input
                value={form.pos}
                onChange={(event) => setForm({ ...form, pos: event.target.value })}
                placeholder={t("POS (optional)")}
                aria-label={t("Custom dictionary part of speech")}
                className="min-w-0 border-b border-slate-300 bg-transparent px-0 py-1.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>
            <textarea
              value={form.definition}
              onChange={(event) => setForm({ ...form, definition: event.target.value })}
              placeholder={t("Definition / meaning")}
              aria-label={t("Custom dictionary definition")}
              rows={2}
              className="mt-2 w-full border border-slate-300 bg-transparent px-2.5 py-1.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !form.word.trim() || !form.definition.trim()}
              className="mt-2 bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
            >
              {busy ? t("Saving…") : t("Add word")}
            </button>
          </form>

          {error && (
            <p className="mt-3 border-l-2 border-red-500 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}
          {message && (
            <p className="mt-3 border-l-2 border-emerald-500 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
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
              placeholder={t("Filter my dictionary…")}
              aria-label={t("Filter my dictionary")}
              className="min-w-0 flex-1 border-b border-slate-300 bg-transparent px-0 py-1.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
            />
            <button
              type="submit"
              className="border border-slate-300 px-3 py-1.5 text-sm font-medium hover:border-slate-900"
            >
              {t("Search")}
            </button>
          </form>

          {entries === null && !error && (
            <p className="mt-4 text-sm text-slate-500">{t("Loading…")}</p>
          )}
          {entries?.length === 0 && (
            <p className="mt-4 border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
              {t("No words yet. Import a file above, or add one word at a time.")}
            </p>
          )}
          {entries && entries.length > 0 && (
            <ul className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
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
                    aria-label={t("Delete {word}", { word: entry.word })}
                    className="shrink-0 border-b border-transparent px-1 py-1 text-xs font-medium text-red-700 hover:border-red-400 disabled:opacity-40"
                  >
                    {t("Delete")}
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
