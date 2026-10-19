import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, type ResultItem } from "../../api/client";
import RichText from "../RichText";
import { sectionLabel } from "../../lib/sections";

interface Props {
  docId: number;
  item: ResultItem | null;
  /** Saved content for this question, from the notebook payload. */
  content: string;
  /** Called after a successful save so the parent can keep its copy in sync. */
  onSaved: (questionId: number, content: string) => void;
}

type Mode = "write" | "preview";

const AUTOSAVE_MS = 900;

function errText(err: unknown): string {
  return err instanceof ApiError ? err.message : String(err);
}

function answerText(item: ResultItem, values: string[]): string {
  if (values.length === 0) return "—";
  return item.kind === "blank" ? values.join(" | ") : values.join(", ");
}

/**
 * The right-hand "Pages" pane: one page per question.
 *
 * The page header repeats the question, the correct answer and what the user
 * picked (so the analysis is written with the mistake in view); the body is a
 * Markdown analysis page that autosaves to the local database.
 */
export default function AnalysisEditor({ docId, item, content, onSaved }: Props) {
  const [draft, setDraft] = useState(content);
  const [saved, setSaved] = useState(content);
  const [mode, setMode] = useState<Mode>("write");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const questionId = item?.question_id ?? null;
  const dirty = draft !== saved;
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // Switching pages swaps the draft; the previous page was already autosaved.
  useEffect(() => {
    setDraft(content);
    setSaved(content);
    setError(null);
    setFlash(null);
  }, [questionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // The notebook arrives asynchronously, after the editor has already mounted
  // with an empty body. Adopt the loaded page once it lands — but never clobber
  // a draft the user has already started typing.
  useEffect(() => {
    if (draft !== savedRef.current) return;
    if (content === savedRef.current) return;
    setDraft(content);
    setSaved(content);
  }, [content, draft]);

  // Do not lose the last <900ms of typing when switching pages or leaving.
  useEffect(() => {
    return () => {
      if (questionId === null || draftRef.current === savedRef.current) return;
      const text = draftRef.current;
      void api
        .saveAnalysisPage(docId, questionId, text)
        .then(() => onSaved(questionId, text))
        .catch(() => {
          /* the next visit still has the server copy; a toast would be noise here */
        });
    };
  }, [docId, questionId, onSaved]);

  const persist = useCallback(
    async (text: string) => {
      if (questionId === null) return;
      setSaving(true);
      setError(null);
      try {
        await api.saveAnalysisPage(docId, questionId, text);
        setSaved(text);
        onSaved(questionId, text);
        setFlash("Saved");
        window.setTimeout(() => setFlash(null), 1500);
      } catch (err) {
        setError(errText(err));
      } finally {
        setSaving(false);
      }
    },
    [docId, questionId, onSaved],
  );

  // Autosave: debounce after the last keystroke.
  useEffect(() => {
    if (questionId === null || draft === savedRef.current) return;
    const timer = window.setTimeout(() => void persist(draft), AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [draft, questionId, persist]);

  // ⌘/Ctrl+S saves immediately (browsers otherwise offer "save page").
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      if (questionId !== null && draft !== savedRef.current) void persist(draft);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draft, questionId, persist]);

  if (!item) {
    return (
      <div className="grid h-full place-items-center p-8 text-center text-sm text-slate-500">
        Pick a question to open its analysis page.
      </div>
    );
  }

  const chosen = answerText(item, item.chosen_answers);
  const correct = answerText(item, item.answers);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* page header: the question, the key and the mistake in view */}
      <header className="shrink-0 border-b border-slate-200 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              "grid h-6 w-6 place-items-center rounded-full text-xs font-semibold text-white " +
              (item.is_correct === true
                ? "bg-emerald-600"
                : item.is_correct === false
                  ? "bg-red-500"
                  : "bg-slate-400")
            }
          >
            {item.is_correct === true ? "✓" : item.is_correct === false ? "✗" : "–"}
          </span>
          <h2 className="font-display text-lg tracking-tight text-slate-900">
            Question {item.no}
          </h2>
          <span className="text-xs text-slate-500">
            {sectionLabel(item.sec)}
            {item.source ? ` · ${item.source}` : ""}
          </span>
          <span className="ml-auto text-xs text-slate-400">
            {saving ? "Saving…" : flash ? `${flash} ✓` : dirty ? "unsaved changes" : ""}
          </span>
        </div>

        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="whitespace-pre-wrap font-medium text-slate-800">{item.stem}</p>
          {item.kind === "blank" ? (
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs">
              <span>
                <span className="text-slate-500">Correct: </span>
                <span className="font-semibold text-emerald-700">{correct}</span>
              </span>
              <span>
                <span className="text-slate-500">Yours: </span>
                <span
                  className={
                    "font-semibold " +
                    (item.is_correct === false ? "text-red-600" : "text-slate-700")
                  }
                >
                  {chosen}
                </span>
              </span>
            </div>
          ) : (
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {item.options.map((option) => {
                const letter = /^([A-Z])[.)]/.exec(option.trim())?.[1] ?? "?";
                const isCorrect = item.answers.includes(letter);
                const isChosen = item.chosen_answers.includes(letter);
                return (
                  <li
                    key={letter}
                    className={
                      "flex items-start gap-2 rounded px-2 py-1 text-xs " +
                      (isCorrect
                        ? "bg-emerald-50 text-emerald-900"
                        : isChosen
                          ? "bg-red-50 text-red-900"
                          : "text-slate-600")
                    }
                  >
                    <span className="font-semibold">{letter}</span>
                    <span className="min-w-0 flex-1">
                      {option.replace(/^[A-Z][.)]\s*/, "")}
                    </span>
                    {isCorrect && <span className="shrink-0 font-medium">correct</span>}
                    {isChosen && !isCorrect && <span className="shrink-0 font-medium">yours</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </header>

      {/* body: Markdown write / preview */}
      <div className="flex shrink-0 items-center gap-1 border-b border-slate-200 px-3 py-1.5">
        <span className="mr-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          Analysis
        </span>
        {(["write", "preview"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${
              mode === m ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {m}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void persist(draft)}
          disabled={!dirty || saving}
          className="ml-auto rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {mode === "write" ? (
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={
              "Why is the correct answer right — and why did you pick yours?\n\n" +
              "Markdown works here: **bold**, lists, $x^2$ formulas, ![figure](assets/name.png)."
            }
            aria-label="Analysis"
            className="h-full min-h-[18rem] w-full resize-none border-0 px-5 py-4 font-mono text-[13px] leading-6 text-slate-800 focus:outline-none"
          />
        ) : (
          <div className="px-5 py-4 text-[15px]">
            {draft.trim() ? (
              <RichText text={draft} docId={docId} breaks />
            ) : (
              <p className="text-sm italic text-slate-400">No analysis yet.</p>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="shrink-0 border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
