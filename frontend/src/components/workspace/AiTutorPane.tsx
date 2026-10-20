import { useEffect, useState } from "react";
import { api, ApiError, type ResultItem } from "../../api/client";

interface Props {
  docId: number;
  item: ResultItem | null;
  sessionId?: number;
}

function errText(err: unknown): string {
  return err instanceof ApiError ? err.message : String(err);
}

/**
 * AI tutor pane. The call is explicit (a button), so it is the only workspace
 * tool that may spend tokens. Context is the reviewed question, its correct
 * answer and the student's choice — never the hand-written analysis.
 */
export default function AiTutorPane({ docId, item, sessionId }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setText(null);
    setErr(null);
  }, [item?.question_id]);

  async function ask() {
    if (!item) return;
    setBusy(true);
    setErr(null);
    setText(null);
    try {
      const res = await api.askAI(docId, item.question_id, sessionId);
      setText(res.text);
    } catch (error) {
      setErr(errText(error));
    } finally {
      setBusy(false);
    }
  }

  if (!item) {
    return (
      <p className="grid h-full place-items-center p-6 text-center text-sm text-slate-500">
        Pick a question to ask the AI tutor.
      </p>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <p className="text-sm font-medium text-slate-800">Question {item.no}</p>
        <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-500">{item.stem}</p>
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
          The tutor sees this question, its correct answer and your choice — not your
          analysis notes. Explicit call: this may use tokens from your configured model.
        </p>

        {item.answers.length === 0 ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            No answer key for this question — fill it in on the answer page first.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => void ask()}
            disabled={busy}
            className="mt-3 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? "Thinking…" : text ? "Regenerate" : "Explain with AI"}
          </button>
        )}

        {err && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>
        )}
        {text && (
          <div className="mt-3 whitespace-pre-wrap rounded-lg border bg-white p-3 text-sm leading-6">
            {text}
          </div>
        )}
      </div>
    </div>
  );
}
