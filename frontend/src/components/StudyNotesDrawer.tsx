import { useEffect, useMemo, useRef, useState } from "react";
import type { HighlightColor, QuestionHighlight } from "../api/client";
import { useI18n } from "../lib/i18n";

const DOT: Record<HighlightColor, string> = {
  yellow: "bg-amber-300",
  green: "bg-emerald-300",
  blue: "bg-sky-300",
  pink: "bg-pink-300",
};

interface Props {
  open: boolean;
  onClose: () => void;
  questionNo: number | null | undefined;
  highlights: QuestionHighlight[];
  note: string;
  onSaveNote: (content: string) => Promise<void>;
  onUpdateHighlight: (id: number, patch: { note?: string }) => Promise<void>;
  onDeleteHighlight: (id: number) => Promise<void>;
}

/** Right-hand drawer: this question's highlights and its free-form note. */
export default function StudyNotesDrawer({
  open,
  onClose,
  questionNo,
  highlights,
  note,
  onSaveNote,
  onUpdateHighlight,
  onDeleteHighlight,
}: Props) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(note);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const noteRef = useRef(note);
  const questionRef = useRef(questionNo);
  noteRef.current = note;

  useEffect(() => {
    if (questionRef.current !== questionNo) {
      questionRef.current = questionNo;
      setDraft(note);
      setSavedAt(null);
      return;
    }
    // The server value arrives asynchronously: adopt it only while the user
    // has not started typing over the previous draft.
    setDraft((current) => (current === "" || current === note ? note : current));
  }, [note, questionNo]);

  // Debounced note autosave, mirroring the analysis editor.
  useEffect(() => {
    if (!open) return undefined;
    if (draft === noteRef.current) return undefined;
    const timer = window.setTimeout(() => {
      void onSaveNote(draft)
        .then(() => setSavedAt(draft))
        .catch(() => setSavedAt(null));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [draft, open, onSaveNote]);

  const ordered = useMemo(
    () => [...highlights].sort((a, b) => a.start - b.start),
    [highlights],
  );

  function close() {
    if (draft !== noteRef.current) {
      void onSaveNote(draft).catch(() => undefined);
    }
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <button
        aria-label={t("Close")}
        onClick={close}
        className="absolute inset-0 scrim"
      />
      <aside className="relative z-10 ml-auto flex h-full w-[min(24rem,92vw)] flex-col border-l border-slate-300 bg-white">
        <header className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-slate-900">{t("Notes")}</h2>
            <p className="text-xs text-slate-500">
              {questionNo != null
                ? t("Question {number}", { number: questionNo })
                : t("This paper")}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="px-2 py-1 text-slate-500 hover:text-slate-900"
          >
            {t("Close")}
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <section>
            <h3 className="text-xs font-medium text-slate-500">
              {t("Highlights")}
            </h3>
            {ordered.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                {t("Select text in the passage or question, then pick a colour.")}
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {ordered.map((item) => (
                  <li
                    key={item.id}
                    className="border-l-2 border-slate-300 bg-slate-50 px-2.5 py-2"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        aria-hidden="true"
                        className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[item.color]}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-5 text-slate-800">
                          “{item.quote}”
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {item.field.startsWith("option:")
                            ? t("Option {letter}", {
                                letter: item.field.slice("option:".length),
                              })
                            : item.field === "stem"
                              ? t("Question")
                              : t("Passage")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void onDeleteHighlight(item.id).catch(() => undefined)
                        }
                        aria-label={t("Delete highlight")}
                        className="shrink-0 px-1 text-slate-400 hover:text-red-600"
                      >
                        ×
                      </button>
                    </div>
                    {editing === item.id ? (
                      <div className="mt-2">
                        <textarea
                          value={editText}
                          onChange={(event) => setEditText(event.target.value)}
                          rows={2}
                          className="w-full resize-none border border-slate-300 px-2 py-1 text-xs focus:border-slate-900 focus:outline-none"
                        />
                        <div className="mt-1 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditing(null)}
                            className="text-xs text-slate-500 hover:text-slate-900"
                          >
                            {t("Cancel")}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void onUpdateHighlight(item.id, {
                                note: editText,
                              })
                                .then(() => setEditing(null))
                                .catch(() => undefined);
                            }}
                            className="text-xs font-medium text-slate-900"
                          >
                            {t("Save")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(item.id);
                          setEditText(item.note);
                        }}
                        className="mt-1 block w-full text-left text-xs text-slate-600 hover:text-slate-900"
                      >
                        {item.note || t("Add a note…")}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-6 border-t border-slate-200 pt-4">
            <h3 className="text-xs font-medium text-slate-500">
              {t("Question note")}
            </h3>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={10}
              placeholder={t("Write anything that helps with this question…")}
              className="mt-2 w-full resize-y border border-slate-300 px-3 py-2 text-sm leading-6 text-slate-900 focus:border-slate-900 focus:outline-none"
            />
            <p className="mt-1 h-4 text-[11px] text-slate-400">
              {draft !== note
                ? t("Saving…")
                : savedAt
                  ? t("Saved")
                  : t("Saved automatically")}
            </p>
          </section>
        </div>
      </aside>
    </div>
  );
}
