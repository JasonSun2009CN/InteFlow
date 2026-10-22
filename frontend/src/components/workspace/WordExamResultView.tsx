import { useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { WordExam, WordExamResult } from "../../api/client";
import {
  buildWordExamShare,
  makeWordExamShareId,
  splitWordExamQrPayloads,
} from "../../lib/wordExamQr";
import { useI18n } from "../../lib/i18n";

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

function methodLabel(
  method: WordExamResult["items"][number]["method"],
  t: (source: string, vars?: Record<string, string | number>) => string,
): string {
  if (method === "ai") return t("AI graded");
  if (method === "fallback") return t("local fallback");
  return t("local");
}

/** Result page: accuracy, per-word detail and the shareable QR payload. */
export default function WordExamResultView({ exam, result, onNewTest, onBack }: Props) {
  const { t } = useI18n();
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
              {t("Word test result")}
            </p>
            <h2 className="mt-1 truncate font-display text-2xl tracking-tight text-slate-900">
              {result.title || exam.title}
            </h2>
            <p className="text-xs text-slate-500">
              {t(MODE_LABEL[result.mode])} ·{" "}
              {t("{tested} of {eligible} eligible words", {
                tested: scope.tested,
                eligible: scope.eligible,
              })}
              {scope.skipped > 0
                ? t(" · {count} skipped (no meaning)", { count: scope.skipped })
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onNewTest}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              {t("New test")}
            </button>
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg border bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
            >
              {t("Back to word list")}
            </button>
          </div>
        </header>

        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-xl border bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t("Accuracy")}
            </p>
            <p className="mt-1 font-display text-4xl tracking-tight text-slate-900">
              {formatAccuracy(result.accuracy)}%
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {t("{correct} / {total} correct", {
                correct: result.correct,
                total: result.total,
              })}
            </p>
          </div>
          <div className="rounded-xl border bg-white p-4 text-xs leading-5 text-slate-600">
            <p className="font-semibold uppercase tracking-wide text-slate-400">
              {t("Scope")}
            </p>
            <p className="mt-1">
              {scope.all
                ? t("All {count} eligible words were tested.", {
                    count: scope.eligible,
                  })
                : t("{tested} of {eligible} eligible words were tested.", {
                    tested: scope.tested,
                    eligible: scope.eligible,
                  })}
            </p>
            <p className="mt-1">
              {t("List positions: {positions}", {
                positions: positionText || "—",
              })}
            </p>
            <p className="mt-2">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                {result.ai_grading ? t("AI graded") : t("Local grading")}
              </span>
            </p>
          </div>
        </div>

        {result.warning && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {result.warning}
          </p>
        )}

        <section
          className="mt-4 rounded-xl border bg-white p-4"
          aria-label={t("Result QR")}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800">{t("Result QR")}</h3>
            <span className="text-xs text-slate-400">
              {t("{count} codes", { count: codes.length })}
            </span>
            <button
              type="button"
              onClick={downloadJson}
              className="ml-auto rounded-lg border bg-white px-2.5 py-1 text-xs font-medium hover:bg-slate-100"
            >
              {t("Download .json")}
            </button>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {t(
              "Encodes the accuracy, the tested word range, and every word's correct answer and your answer. Large tests produce several codes — scan them in order; each starts with IFWT1|<id>|part/total|.",
            )}
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
                  title={t("Word exam result part {number}", {
                    number: index + 1,
                  })}
                />
                <figcaption className="text-[10px] text-slate-500">
                  {t("Part {part} of {total}", {
                    part: index + 1,
                    total: codes.length,
                  })}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="mt-4" aria-label={t("Answers")}>
          <h3 className="text-sm font-semibold text-slate-800">
            {t("Every word")}
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
                        {t("Prompt: {prompt}", { prompt: item.prompt })}
                      </p>
                    )}
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-lg bg-emerald-50/60 p-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                          {t("Correct answer")}
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap text-xs leading-5 text-slate-700">
                          {item.expected || "—"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          {t("Your answer")}
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap text-xs leading-5 text-slate-700">
                          {item.response || "—"}
                        </p>
                      </div>
                    </div>
                    {(item.reason || item.method === "ai" || item.method === "fallback") && (
                      <p className="mt-1 text-[11px] text-slate-400">
                        {methodLabel(item.method, t)}
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
                    {item.is_correct ? t("Correct") : t("Incorrect")}
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
