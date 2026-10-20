import { useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import { CloseIcon } from "./icons";

interface Props {
  docId: number;
  sessionId?: number;
  onClose: () => void;
}

function errText(err: unknown): string {
  return err instanceof ApiError ? err.message : String(err);
}

/**
 * Export drawer, kept in the top bar rather than the four-tool split: exports
 * are a one-off action, not a reading surface. Both the analysis notebook and
 * the vocabulary sheet are exported locally (0 token).
 */
export default function ExportDrawer({ docId, sessionId, onClose }: Props) {
  const [exporting, setExporting] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function exportNotebook(fmt: "md" | "docx" | "pdf") {
    setExporting(fmt);
    setMsg(null);
    setErr(null);
    try {
      const { path } = await api.exportAnalysis(docId, fmt, sessionId, true);
      setMsg(path ? `Downloaded — a copy was saved to ${path}` : "Downloaded.");
    } catch (error) {
      setErr(errText(error));
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Export">
      <button aria-label="Close export" onClick={onClose} className="scrim absolute inset-0" />
      <div className="relative z-10 ml-auto flex h-full w-[min(26rem,92vw)] flex-col bg-white shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Export
            </div>
            <div className="text-sm font-semibold">Local files, no tokens</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close export"
            className="rounded-md border p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <CloseIcon size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <p className="text-xs leading-5 text-slate-500">
            The analysis notebook: the exam title, then every question with an analysis —
            stem, figures and your notes. Use Notebook in the top bar to preview it first.
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
          {msg && (
            <p className="mt-3 break-words rounded bg-emerald-50 px-2 py-1.5 text-xs text-emerald-800">
              {msg}
            </p>
          )}
          {err && (
            <p className="mt-3 rounded bg-red-50 px-2 py-1.5 text-xs text-red-700">{err}</p>
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
      </div>
    </div>
  );
}
