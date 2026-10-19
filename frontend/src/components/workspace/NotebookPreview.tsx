import { useEffect, useState } from "react";
import { api, ApiError, type ResultItem } from "../../api/client";
import RichText from "../RichText";
import { sectionLabel } from "../../lib/sections";
import { CloseIcon } from "./icons";

interface Props {
  docId: number;
  title: string;
  items: ResultItem[];
  /** Saved analysis text per question id. */
  pages: Record<number, string>;
  sessionId?: number;
  onClose: () => void;
}

function optionLetter(option: string): string {
  return /^([A-Z])[.)]/.exec(option.trim())?.[1] ?? "?";
}

function errText(err: unknown): string {
  return err instanceof ApiError ? err.message : String(err);
}

/**
 * Full-exam notebook preview: the exam title, then every question that has an
 * analysis page (stem, figures and the handwritten analysis). Exporting from
 * here writes the same selection — questions without analysis are skipped.
 */
export default function NotebookPreview({ docId, title, items, pages, sessionId, onClose }: Props) {
  const [exporting, setExporting] = useState<"md" | "docx" | "pdf" | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [exportErr, setExportErr] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const analysed = items.filter((item) => (pages[item.question_id] ?? "").trim().length > 0);

  async function exportNotebook(fmt: "md" | "docx" | "pdf") {
    setExporting(fmt);
    setExportMsg(null);
    setExportErr(null);
    try {
      const { path } = await api.exportAnalysis(docId, fmt, sessionId, true);
      setExportMsg(path ? `Downloaded — a copy was saved to ${path}` : "Downloaded.");
    } catch (err) {
      setExportErr(errText(err));
    } finally {
      setExporting(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-label="Analysis notebook"
    >
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Analysis notebook
          </p>
          <h2 className="truncate font-display text-lg tracking-tight text-slate-900">{title}</h2>
        </div>

        <span className="hidden text-xs text-slate-500 sm:block">
          {analysed.length} {analysed.length === 1 ? "question" : "questions"} analysed
        </span>

        <div className="flex items-center gap-1.5">
          <span className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 sm:block">
            Export
          </span>
          {(["pdf", "docx", "md"] as const).map((fmt) => (
            <button
              key={fmt}
              type="button"
              onClick={() => void exportNotebook(fmt)}
              disabled={exporting !== null || analysed.length === 0}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              {exporting === fmt ? "Exporting…" : `.${fmt}`}
            </button>
          ))}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notebook"
            className="ml-1 rounded-md border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <CloseIcon size={16} />
          </button>
        </div>
      </header>

      {(exportMsg || exportErr) && (
        <p
          className={
            "shrink-0 break-words px-4 py-1.5 text-xs " +
            (exportErr ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800")
          }
        >
          {exportErr ?? exportMsg}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <article className="mx-auto w-full max-w-3xl px-6 py-12 sm:px-8">
          <header className="border-b border-slate-200 pb-10 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              Analysis notebook
            </p>
            <h1 className="mt-3 font-display text-3xl tracking-tight text-slate-900 sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 text-sm text-slate-500">
              {analysed.length} {analysed.length === 1 ? "question" : "questions"} with analysis
            </p>
          </header>

          {analysed.length === 0 && (
            <p className="py-16 text-center text-sm italic text-slate-400">
              No analysis yet — write an analysis page and it will appear here.
            </p>
          )}

          {analysed.map((item) => (
            <section key={item.question_id} className="border-b border-slate-200 py-10 last:border-b-0">
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
                <h2 className="font-display text-xl tracking-tight text-slate-900">
                  Question {item.no}
                </h2>
                <span className="text-xs text-slate-500">
                  {sectionLabel(item.sec)}
                  {item.source ? ` · ${item.source}` : ""}
                </span>
              </div>

              {item.material && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <RichText text={item.material} docId={docId} breaks />
                </div>
              )}

              <div className="mt-4 text-[15px]">
                <RichText text={item.stem} docId={docId} breaks />
              </div>

              {item.kind === "choice" && item.options.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {item.options.map((option) => {
                    const letter = optionLetter(option);
                    return (
                      <li key={letter} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="font-semibold">{letter}</span>
                        <span className="min-w-0 flex-1">
                          <RichText
                            text={option.replace(/^[A-Z][.)]\s*/, "")}
                            docId={docId}
                            breaks
                          />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="mt-6 border-t border-slate-200 pt-4">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Analysis
                </h3>
                <div className="mt-2 text-[15px]">
                  <RichText text={pages[item.question_id] ?? ""} docId={docId} breaks />
                </div>
              </div>
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
