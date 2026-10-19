import { useEffect, useState } from "react";
import { api, ApiError, type ResultItem } from "../../api/client";
import VocabularySheet from "./VocabularySheet";
import { CloseIcon } from "./icons";

export type DrawerTab = "ai" | "vocabulary" | "export";

interface Props {
  docId: number;
  item: ResultItem | null;
  sessionId?: number;
  tab: DrawerTab;
  onTab: (tab: DrawerTab) => void;
  onClose: () => void;
}

const TABS: { key: DrawerTab; label: string }[] = [
  { key: "ai", label: "AI Tutor" },
  { key: "vocabulary", label: "Vocabulary" },
  { key: "export", label: "Export" },
];

function errText(err: unknown): string {
  return err instanceof ApiError ? err.message : String(err);
}

/**
 * Study tools drawer: the AI tutor, the vocabulary grid and the notebook
 * exports. Kept out of the reading surface on purpose — the two-pane review
 * stays focused on the question and its analysis page.
 */
export default function StudyDrawer({ docId, item, sessionId, tab, onTab, onClose }: Props) {
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [exportErr, setExportErr] = useState<string | null>(null);

  useEffect(() => {
    setAiText(null);
    setAiErr(null);
  }, [item?.question_id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function askAI() {
    if (!item) return;
    setAiBusy(true);
    setAiErr(null);
    setAiText(null);
    try {
      const res = await api.askAI(docId, item.question_id, sessionId);
      setAiText(res.text);
    } catch (err) {
      setAiErr(errText(err));
    } finally {
      setAiBusy(false);
    }
  }

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
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Study tools">
      <button aria-label="Close study tools" onClick={onClose} className="scrim absolute inset-0" />
      <div className="relative z-10 ml-auto flex h-full w-[min(26rem,92vw)] flex-col bg-white shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Study tools
            </div>
            <div className="truncate text-sm font-semibold">
              {item ? `Question ${item.no}` : "Select a question"}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close study tools"
            className="rounded-md border p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <CloseIcon size={16} />
          </button>
        </header>

        <div className="flex shrink-0 border-b" role="tablist" aria-label="Study tools sections">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => onTab(t.key)}
              className={`flex-1 border-b-2 px-2 py-2 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "ai" && (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {!item ? (
              <p className="text-sm text-slate-500">Select a question first.</p>
            ) : item.answers.length === 0 ? (
              <p className="rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                No answer key for this question — enter the answers first.
              </p>
            ) : (
              <>
                <p className="mb-2 text-xs text-slate-500">
                  Context: this question and its correct answer only. Uses your configured
                  model — this may consume tokens.
                </p>
                <button
                  onClick={() => void askAI()}
                  disabled={aiBusy}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {aiBusy ? "Thinking…" : aiText ? "Regenerate" : "Explain with AI"}
                </button>
                {aiErr && (
                  <p className="mt-2 rounded bg-red-50 px-2 py-1.5 text-xs text-red-700">{aiErr}</p>
                )}
                {aiText && (
                  <div className="mt-2 whitespace-pre-wrap rounded-lg border bg-white p-3 text-sm">
                    {aiText}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === "vocabulary" && (
          <div className="min-h-0 flex-1">
            <VocabularySheet docId={docId} open onToggle={() => {}} />
          </div>
        )}

        {tab === "export" && (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <p className="text-xs text-slate-500">
              The analysis notebook: the exam title, then every question that has an
              analysis — stem, figures and your notes. No tokens. Use Notebook in the
              top bar to preview it first.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(["pdf", "docx", "md"] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => void exportNotebook(fmt)}
                  disabled={exporting !== null}
                  className="rounded-lg border bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100 disabled:opacity-50"
                >
                  {exporting === fmt ? "Exporting…" : `Export .${fmt}`}
                </button>
              ))}
            </div>
            {exportMsg && (
              <p className="mt-3 break-words rounded bg-emerald-50 px-2 py-1.5 text-xs text-emerald-800">
                {exportMsg}
              </p>
            )}
            {exportErr && (
              <p className="mt-3 rounded bg-red-50 px-2 py-1.5 text-xs text-red-700">{exportErr}</p>
            )}

            <div className="mt-5 border-t pt-3">
              <p className="text-xs text-slate-500">Vocabulary sheet</p>
              <a
                href={api.wordsExportUrl(docId)}
                className="mt-2 inline-block rounded-lg border bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
              >
                Export vocabulary .xlsx
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
