import { useEffect, useId, useRef, useState } from "react";
import type { HighlightColor, QuestionHighlight } from "../api/client";
import RichText from "./RichText";
import { useI18n } from "../lib/i18n";
import {
  HIGHLIGHT_COLORS,
  quoteRange,
  registerHighlights,
  clearHighlights,
  selectionInfo,
  type SelectionInfo,
} from "../lib/highlightRanges";

export interface HighlightInput {
  question_id: number;
  field: string;
  quote: string;
  occurrence: number;
  color: HighlightColor;
  note: string;
  start: number;
  end: number;
}

interface Props {
  text: string;
  docId?: number;
  /** material | material2 | stem | option:A */
  field: string;
  questionId?: number | null;
  highlights?: QuestionHighlight[];
  onCreate?: (input: HighlightInput) => Promise<void> | void;
  onError?: (message: string) => void;
  breaks?: boolean;
}

const SWATCH: Record<HighlightColor, string> = {
  yellow: "bg-amber-300",
  green: "bg-emerald-300",
  blue: "bg-sky-300",
  pink: "bg-pink-300",
};

/** A Markdown text block that supports selecting text to add a highlight. */
export default function AnnotatableText({
  text,
  docId,
  field,
  questionId,
  highlights = [],
  onCreate,
  onError,
  breaks = false,
}: Props) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const key = useId();
  const [menu, setMenu] = useState<SelectionInfo | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const container = ref.current;
    if (!container || !questionId) {
      clearHighlights(key);
      return undefined;
    }
    const items = highlights
      .filter((item) => item.question_id === questionId && item.field === field)
      .map((item) => {
        const range = quoteRange(container, item.quote, item.occurrence);
        return range ? { color: item.color, range } : null;
      })
      .filter((item): item is { color: HighlightColor; range: Range } => item !== null);
    registerHighlights(key, items);
    return () => clearHighlights(key);
  }, [highlights, questionId, field, text, key]);

  useEffect(() => {
    if (!menu) return undefined;
    const close = () => {
      setMenu(null);
      setNoteOpen(false);
      setNote("");
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [menu]);

  function openMenu(): void {
    if (!onCreate || !questionId) return;
    const container = ref.current;
    const selection = window.getSelection();
    if (!container || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (range.collapsed) {
      setMenu(null);
      return;
    }
    const info = selectionInfo(container, range);
    if (!info) return;
    setNoteOpen(false);
    setNote("");
    setMenu(info);
  }

  async function add(color: HighlightColor): Promise<void> {
    if (!menu || !onCreate || !questionId || saving) return;
    setSaving(true);
    try {
      await onCreate({
        question_id: questionId,
        field,
        quote: menu.quote,
        occurrence: menu.occurrence,
        color,
        note: note.trim(),
        start: menu.start,
        end: menu.end,
      });
      setMenu(null);
      setNote("");
      setNoteOpen(false);
      window.getSelection()?.removeAllRanges();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={ref} className="relative" onMouseUp={openMenu}>
      <RichText text={text} docId={docId} breaks={breaks} />
      {menu && (
        <div
          role="toolbar"
          aria-label={t("Highlight selection")}
          onMouseDown={(event) => event.stopPropagation()}
          onMouseUp={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          className="fixed z-40 w-60 border border-slate-300 bg-white p-2 shadow-lg"
          style={{
            left: Math.min(
              Math.max(8, menu.rect.left),
              Math.max(8, window.innerWidth - 248),
            ),
            top: Math.min(menu.rect.bottom + 6, window.innerHeight - 132),
          }}
        >
          <div className="flex items-center gap-2">
            <span className="mr-1 text-[11px] font-medium text-slate-500">
              {t("Highlight")}
            </span>
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                disabled={saving}
                onClick={() => void add(color)}
                aria-label={t("Highlight in {color}", { color: t(color) })}
                title={t(color)}
                className={`h-5 w-5 rounded-full border border-slate-300 ${SWATCH[color]} transition hover:scale-110 disabled:opacity-40`}
              />
            ))}
            <button
              type="button"
              onClick={() => setNoteOpen((open) => !open)}
              aria-expanded={noteOpen}
              className="ml-auto px-1 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              {t("Note")}
            </button>
            <button
              type="button"
              onClick={() => setMenu(null)}
              aria-label={t("Cancel")}
              className="px-1 text-slate-400 hover:text-slate-900"
            >
              ×
            </button>
          </div>
          {noteOpen && (
            <textarea
              autoFocus
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("Optional note for this highlight")}
              rows={2}
              className="mt-2 w-full resize-none border border-slate-300 px-2 py-1 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
            />
          )}
        </div>
      )}
    </div>
  );
}
