import { useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { WordExam, WordExamResult } from "../../api/client";
import {
  buildWordExamShare,
  makeWordExamShareId,
  splitWordExamQrPayloads,
} from "../../lib/wordExamQr";

interface Props {
  exam: WordExam;
  result: WordExamResult;
  onNewTest: () => void;
  onBack: () => void;
}

const MODE_LABEL: Record<WordExam["mode"], string> = {
  "en-zh": "English → Chinese",
  "zh-en": "Chinese → English (spelling)",
};

function formatAccuracy(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function methodLabel(method: WordExamResult["items"][number]["method"]): string {
  if (method === "ai") return "AI graded";
  if (method === "fallback") return "local fallback";
  return "local";
}

/** Result page: accuracy, per-word detail and the shareable QR payload. */
export default function WordExamResultView({ exam, result, onNewTest, onBack }: Props) {
  const share = useMemo(
    () => buildWordExamShare(exam, result, makeWordExamShareId()),
    [exam, result],
  );
  const codes = useMemo(
    () => splitWordExamQrPayloads(JSON.stringify(share), share.id),
    [share],
  );

  function downloadJson() {
    const blob = new Blob([JSON.stringify(share, null, 2)], {
      type: "application/json",
    });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `word-exam-${share.id}.json`;
    link.click();
    URL.revokeObjectURL(href);
  }

  const scope = exam.scope;
  const positionText =
    scope.positions.length <= 12
      ? scope.positions.join(", ")
      : `${scope.positions.slice(0, 12).join(", ")} …`;

  return (
    <section className="min-h-0 w-full flex-1 overflow-y-auto bg-slate-50">
      <div className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6">
        <header className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Word test result
            </p>
            <h2 className="mt-1 truncate font-display text-2xl tracking-tight text-slate-900">
              {result.title || exam.title}
            </h2>
            <p className="text-xs text-slate-500">
              {MODE_LABEL[result.mode]} · {scope.tested} of {scope.eligible} eligible words
              {scope.skipped > 0 ? ` · ${scope.skipped} skipped (no meaning)` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onNewTest}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              New test
            </button>
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg border bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
            >
              Back to word list
            </button>
          </div>
        </header>

        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-xl border bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Accuracy
            </p>
            <p className="mt-1 font-display text-4xl tracking-tight text-slate-900">
              {formatAccuracy(result.accuracy)}%
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {result.correct} / {result.total} correct
            </p>
          </div>
          <div className="rounded-xl border bg-white p-4 text-xs leading-5 text-slate-600">
            <p className="font-semibold uppercase tracking-wide text-slate-400">
              Scope
            </p>
            <p className="mt-1">
              {scope.all
                ? `All ${scope.eligible} eligible words were tested.`
                : `${scope.tested} of ${scope.eligible} eligible words were tested.`}
            </p>
            <p className="mt-1">List positions: {positionText || "—"}</p>
            <p className="mt-2">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                {result.ai_grading ? "AI graded" : "Local grading"}
              </span>
            </p>
          </div>
        </div>

        {result.warning && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {result.warning}
          </p>
        )}

        <section className="mt-4 rounded-xl border bg-white p-4" aria-label="Result QR">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800">Result QR</h3>
            <span className="text-xs text-slate-400">
              {codes.length} {codes.length === 1 ? "code" : "codes"}
            </span>
            <button
              type="button"
              onClick={downloadJson}
              className="ml-auto rounded-lg border bg-white px-2.5 py-1 text-xs font-medium hover:bg-slate-100"
            >
              Download .json
            </button>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Encodes the accuracy, the tested word range, and every word&apos;s correct
            answer and your answer. Large tests produce several codes — scan them in
            order; each starts with <code>IFWT1|&lt;id&gt;|part/total|</code>.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {codes.map((value, index) => (
              <figure
                key={`${share.id}-${index}`}
                data-testid="word-exam-qr"
                className="flex flex-col items-center gap-1 rounded-lg border border-slate-200 bg-white p-2"
              >
                <QRCodeSVG
                  value={value}
                  size={160}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#0f172a"
                  title={`Word exam result part ${index + 1}`}
                />
                <figcaption className="text-[10px] text-slate-500">
                  Part {index + 1} of {codes.length}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="mt-4" aria-label="Answers">
          <h3 className="text-sm font-semibold text-slate-800">
            Every word
          </h3>
          <ul className="mt-2 space-y-2">
            {result.items.map((item) => (
              <li
                key={item.row_id}
                data-testid="word-exam-item"
                className={`rounded-xl border bg-white p-3 ${
                  item.is_correct ? "border-emerald-200" : "border-red-200"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                    {item.position}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{item.word}</p>
                    {result.mode === "zh-en" && (
                      <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-500">
                        Prompt: {item.prompt}
                      </p>
                    )}
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-lg bg-emerald-50/60 p-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                          Correct answer
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap text-xs leading-5 text-slate-700">
                          {item.expected || "—"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          Your answer
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap text-xs leading-5 text-slate-700">
                          {item.response || "—"}
                        </p>
                      </div>
                    </div>
                    {(item.reason || item.method === "ai" || item.method === "fallback") && (
                      <p className="mt-1 text-[11px] text-slate-400">
                        {methodLabel(item.method)}
                        {item.reason ? `: ${item.reason}` : ""}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      item.is_correct
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {item.is_correct ? "Correct" : "Incorrect"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
