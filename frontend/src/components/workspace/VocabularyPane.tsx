import { useEffect, useState, type DragEvent, type FormEvent } from "react";
import {
  api,
  ApiError,
  type ResultItem,
  type WordEntryResult,
  type WordGrid,
} from "../../api/client";
import VocabGrid from "./VocabGrid";

interface Props {
  docId: number;
  item: ResultItem | null;
}

export const WORD_MIME = "application/x-inteflow-word";

function errText(err: unknown): string {
  return err instanceof ApiError ? err.message : String(err);
}

function cleanWord(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'“”‘’.,;:!?()[\]{}<>]+|["'“”‘’.,;:!?()[\]{}<>]+$/g, "")
    .slice(0, 120);
}

/** The reviewed question as context for Merriam-Webster sense selection. */
function contextOf(item: ResultItem | null): string {
  if (!item) return "";
  return [item.material ?? "", item.stem, ...item.options]
    .filter((part) => part.trim())
    .join("\n")
    .slice(0, 2000);
}

/**
 * Vocabulary pane: the exam's word list beside the question, with drag-and-drop.
 *
 * A word dragged from the question or an option is dropped here; the backend
 * looks it up in the local Merriam-Webster index and (when enabled in Settings)
 * asks the LLM to pick the sense that fits the context. Otherwise the first
 * sense is used and a warning is shown — the drop never dead-ends.
 */
export default function VocabularyPane({ docId, item }: Props) {
  const [grid, setGrid] = useState<WordGrid | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [word, setWord] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
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
    return () => {
      cancelled = true;
    };
  }, [docId]);

  async function save(): Promise<boolean> {
    if (!grid || !dirty) return true;
    setBusy(true);
    setErr(null);
    try {
      const saved = await api.putWords(docId, grid);
      setGrid(saved);
      setDirty(false);
      setMsg("Saved ✓");
      return true;
    } catch (error) {
      setErr(errText(error));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function adopt(result: WordEntryResult) {
    setGrid(result.grid);
    setDirty(false);
    setMsg(
      result.definition
        ? `Added “${result.word}”${result.pos ? ` · ${result.pos}` : ""} — ${result.definition}`
        : `Added “${result.word}”. Add a meaning below or in the Vocabulary page.`,
    );
    setWarning(result.warning || null);
  }

  async function addManual(event: FormEvent) {
    event.preventDefault();
    const text = cleanWord(word);
    if (!text || busy || dropping) return;
    setMsg(null);
    setWarning(null);
    setErr(null);
    if (!(await save())) return;
    setDropping(true);
    try {
      adopt(await api.addWordEntry(docId, { word: text }));
      setWord("");
    } catch (error) {
      setErr(errText(error));
    } finally {
      setDropping(false);
    }
  }

  async function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDropActive(false);
    const text = cleanWord(
      event.dataTransfer.getData(WORD_MIME) || event.dataTransfer.getData("text/plain"),
    );
    if (!text) {
      setErr("Drag a word (select it in the question first).");
      return;
    }
    setMsg(null);
    setWarning(null);
    setErr(null);
    if (!(await save())) return;
    setDropping(true);
    try {
      adopt(
        await api.addWordFromSelection(docId, {
          text,
          context: contextOf(item),
          question_id: item?.question_id ?? null,
        }),
      );
    } catch (error) {
      setErr(errText(error));
    } finally {
      setDropping(false);
    }
  }

  async function exportXlsx() {
    if (!(await save())) return;
    const a = document.createElement("a");
    a.href = api.wordsExportUrl(docId);
    a.click();
  }

  const count = grid
    ? grid.rows.filter((row) => Object.values(row.cells).some((cell) => cell.trim())).length
    : 0;

  return (
    <section
      data-testid="vocabulary-pane"
      aria-label="Vocabulary pane"
      className={
        "relative flex h-full min-h-0 flex-col bg-white transition-shadow " +
        (dropActive ? "ring-2 ring-inset ring-blue-400" : "")
      }
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setDropActive(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDropActive(false);
        }
      }}
      onDrop={(event) => void handleDrop(event)}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-slate-50 px-3 py-1.5">
        <span className="text-xs text-slate-500">
          {count} {count === 1 ? "word" : "words"}
        </span>
        {dirty && !busy && <span className="text-xs text-amber-600">unsaved</span>}
        {busy && <span className="text-xs text-slate-400">Saving…</span>}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void save()}
            disabled={!dirty || busy}
            className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-white disabled:opacity-40"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => void exportXlsx()}
            className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-white"
          >
            Export .xlsx
          </button>
        </div>
      </div>

      <form onSubmit={(event) => void addManual(event)} className="flex shrink-0 gap-1.5 border-b px-3 py-1.5">
        <input
          value={word}
          onChange={(event) => setWord(event.target.value)}
          placeholder="Add a word manually…"
          aria-label="Add a word manually"
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!word.trim() || busy || dropping}
          className="rounded-md border bg-white px-2.5 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
        >
          Add
        </button>
      </form>

      <div className="min-h-0 flex-1 p-2.5">
        {loading ? (
          <p className="p-3 text-sm text-slate-400">Loading vocabulary…</p>
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
          <p className="p-3 text-sm text-red-600">{err ?? "Could not load vocabulary."}</p>
        )}
      </div>

      {(msg || warning || err) && (
        <div className="shrink-0 space-y-1 border-t px-3 py-2 text-xs">
          {msg && <p className="text-emerald-700">{msg}</p>}
          {warning && <p className="text-amber-700">{warning}</p>}
          {err && <p className="text-red-700">{err}</p>}
        </div>
      )}

      {dropActive && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-blue-50/80">
          <p className="rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-700 shadow-sm">
            Drop to add · Merriam-Webster sense for this sentence
          </p>
        </div>
      )}

      {dropping && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-white/80">
          <p className="rounded-lg border bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
            Looking up the word…
          </p>
        </div>
      )}
    </section>
  );
}
