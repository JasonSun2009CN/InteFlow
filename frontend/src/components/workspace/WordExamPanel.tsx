import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  api,
  ApiError,
  type AppSettings,
  type VocabularyDocument,
  type WordExam,
  type WordExamMode,
  type WordExamResult,
} from "../../api/client";
import WordExamResultView from "./WordExamResultView";
import { useI18n } from "../../lib/i18n";

interface Props {
  doc: VocabularyDocument;
  onBack: () => void;
}

type Stage = "setup" | "exam" | "result";

const MODES: { mode: WordExamMode; label: string; hint: string }[] = [
  {
    mode: "en-zh",
    label: "English → Chinese",
    hint: "See the word, write its meaning.",
  },
  {
    mode: "zh-en",
    label: "Chinese → English (spelling)",
    hint: "See the meaning, spell the word.",
  },
];

function errText(err: unknown): string {
  return err instanceof ApiError ? err.message : String(err);
}

function initialCount(wordCount: number): number {
  return Math.max(1, Math.min(10, wordCount || 1));
}

/** Word-test tab: pick a mode + size, answer, then grade and share. */
export default function WordExamPanel({ doc, onBack }: Props) {
  const { t } = useI18n();
  const [stage, setStage] = useState<Stage>("setup");
  const [mode, setMode] = useState<WordExamMode>("en-zh");
  const [count, setCount] = useState(() => initialCount(doc.word_count));
  const [all, setAll] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [exam, setExam] = useState<WordExam | null>(null);
  const [result, setResult] = useState<WordExamResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getSettings()
      .then((next) => !cancelled && setSettings(next))
      .catch(() => !cancelled && setSettings(null));
    return () => {
      cancelled = true;
    };
  }, []);

  const hasWords = doc.word_count > 0;

  async function start() {
    if (busy || !hasWords) return;
    setErr(null);
    setBusy(true);
    try {
      const requested = all
        ? null
        : Math.max(1, Math.min(count, doc.word_count || count));
      const next = await api.startWordExam(doc.document_id, {
        mode,
        count: requested,
      });
      setExam(next);
      setAnswers({});
      setIndex(0);
      setResult(null);
      setStage("exam");
    } catch (error) {
      setErr(errText(error));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (busy || !exam) return;
    setErr(null);
    setBusy(true);
    try {
      const items = exam.questions.map((question) => ({
        row_id: question.row_id,
        response: (answers[question.row_id] ?? "").trim(),
      }));
      const graded = await api.gradeWordExam(doc.document_id, {
        mode: exam.mode,
        items,
      });
      setResult(graded);
      setStage("result");
    } catch (error) {
      setErr(errText(error));
    } finally {
      setBusy(false);
    }
  }

  function onAnswerSubmit(event: FormEvent) {
    event.preventDefault();
    if (!exam) return;
    if (index < exam.questions.length - 1) {
      setIndex((current) => current + 1);
    } else {
      void submit();
    }
  }

  function newTest() {
    setExam(null);
    setResult(null);
    setAnswers({});
    setIndex(0);
    setErr(null);
    setStage("setup");
    setCount(initialCount(doc.word_count));
  }

  const answered = useMemo(
    () =>
      Object.values(answers).filter((value) => value.trim() !== "").length,
    [answers],
  );

  if (stage === "result" && exam && result) {
    return (
      <WordExamResultView
        exam={exam}
        result={result}
        onNewTest={newTest}
        onBack={onBack}
      />
    );
  }

  if (stage === "exam" && exam) {
    const question = exam.questions[index];
    return (
      <section className="min-h-0 w-full flex-1 overflow-y-auto bg-slate-50">
        <div className="mx-auto w-full max-w-2xl px-4 py-5 sm:px-6">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t("Question {current} of {total}", {
                current: index + 1,
                total: exam.questions.length,
              })}
            </p>
            <p className="ml-auto text-xs text-slate-500">
              {t("{count} answered", { count: answered })}
            </p>
          </div>
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={exam.questions.length}
            aria-valuenow={index + 1}
          >
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{
                width: `${((index + 1) / exam.questions.length) * 100}%`,
              }}
            />
          </div>

          <form
            onSubmit={onAnswerSubmit}
            className="mt-4 rounded-xl border bg-white p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {exam.mode === "en-zh"
                ? t("Write its meaning")
                : t("Spell the English word")}
            </p>
            <p className="mt-2 whitespace-pre-wrap font-display text-xl leading-8 text-slate-900">
              {question.prompt}
            </p>
            {question.pos && (
              <span className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                {question.pos}
              </span>
            )}

            <label className="mt-4 block">
              <span className="sr-only">{t("Your answer")}</span>
              <input
                autoFocus
                value={answers[question.row_id] ?? ""}
                onChange={(event) =>
                  setAnswers((current) => ({
                    ...current,
                    [question.row_id]: event.target.value,
                  }))
                }
                placeholder={
                  exam.mode === "en-zh" ? t("Type the meaning…") : t("Type the word…")
                }
                aria-label={t("Your answer")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
              />
            </label>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIndex((current) => Math.max(0, current - 1))}
                disabled={index === 0}
                className="rounded-lg border bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100 disabled:opacity-40"
              >
                {t("Previous")}
              </button>
              {index < exam.questions.length - 1 ? (
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  {t("Next")}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
                >
                  {busy ? t("Grading…") : t("Submit test")}
                </button>
              )}
              <button
                type="button"
                onClick={() => void submit()}
                disabled={busy}
                className="ml-auto rounded-lg border bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100 disabled:opacity-40"
              >
                {busy ? t("Grading…") : t("Submit now")}
              </button>
            </div>
          </form>

          {err && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {err}
            </p>
          )}

          <div
            className="mt-4 flex flex-wrap gap-1.5"
            aria-label={t("Question navigation")}
          >
            {exam.questions.map((item, itemIndex) => {
              const isAnswered = (answers[item.row_id] ?? "").trim() !== "";
              return (
                <button
                  key={item.row_id}
                  type="button"
                  onClick={() => setIndex(itemIndex)}
                  aria-label={t("Question {number}", { number: itemIndex + 1 })}
                  aria-current={itemIndex === index ? "true" : undefined}
                  className={`h-7 min-w-7 rounded-md px-1.5 text-xs font-medium transition-colors ${
                    itemIndex === index
                      ? "bg-slate-900 text-white"
                      : isAnswered
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-white text-slate-500 ring-1 ring-inset ring-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {itemIndex + 1}
                </button>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-0 w-full flex-1 overflow-y-auto bg-slate-50">
      <div className="mx-auto w-full max-w-2xl px-4 py-5 sm:px-6">
        <header>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            {t("Vocabulary")}
          </p>
          <h2 className="mt-1 font-display text-2xl tracking-tight text-slate-900">
            {t("Word test")}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {t("Test how well “{title}” stuck — {count} words in this list.", {
              title: doc.title,
              count: doc.word_count,
            })}
          </p>
        </header>

        {!hasWords ? (
          <div className="mt-5 rounded-xl border bg-white p-6 text-center">
            <p className="font-display text-lg tracking-tight text-slate-700">
              {t("This list is empty")}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
              {t(
                "Drag words into the Vocabulary pane while reviewing, or add them in the word list, then come back to take a test.",
              )}
            </p>
            <button
              type="button"
              onClick={onBack}
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              {t("Back to word list")}
            </button>
          </div>
        ) : (
          <>
            <fieldset className="mt-5">
              <legend className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t("Mode")}
              </legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {MODES.map((option) => {
                  const active = option.mode === mode;
                  return (
                    <button
                      key={option.mode}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setMode(option.mode)}
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        active
                          ? "border-blue-400 bg-blue-50 ring-1 ring-inset ring-blue-300"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <span className="block text-sm font-medium text-slate-800">
                        {t(option.label)}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {t(option.hint)}
                      </span>
                    </button>
                  );
                })}
              </div>
              {mode === "en-zh" &&
                settings !== null &&
                !settings.vocab_exam_ai_grading && (
                  <p className="mt-2 text-[11px] leading-5 text-slate-400">
                    {t(
                      "Local grading compares text, so an English definition from the list works best. Enable AI grading in Settings to accept a Chinese paraphrase.",
                    )}
                  </p>
                )}
            </fieldset>

            <fieldset className="mt-4">
              <legend className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t("How many words")}
              </legend>
              <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl border bg-white p-3">
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, doc.word_count)}
                  value={all ? doc.word_count : count}
                  disabled={all}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (Number.isFinite(next)) setCount(Math.max(1, Math.round(next)));
                  }}
                  aria-label={t("Number of words")}
                  className="w-24 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                />
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={all}
                    onChange={(event) => setAll(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  {t("All {count} words", { count: doc.word_count })}
                </label>
                <span className="text-xs text-slate-400">
                  {t("Random selection from the list.")}
                </span>
              </div>
            </fieldset>

            <p className="mt-4 rounded-lg bg-white px-3 py-2 text-xs leading-5 text-slate-500 ring-1 ring-inset ring-slate-200">
              {settings === null
                ? t("Checking how this test will be graded…")
                : settings.vocab_exam_ai_grading
                  ? settings.api_key_set
                    ? t(
                        "AI grading is on — your model checks both directions against the word list and Merriam-Webster.",
                      )
                    : t(
                        "AI grading is on, but no model is configured yet, so grading stays local.",
                      )
                  : t("AI grading is off — grading is local and free.")}{" "}
              <Link to="/settings" className="font-medium text-blue-600 hover:underline">
                {t("Settings")}
              </Link>
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void start()}
                disabled={busy}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
              >
                {busy ? t("Building test…") : t("Start test")}
              </button>
              <button
                type="button"
                onClick={onBack}
                className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100"
              >
                {t("Back to word list")}
              </button>
            </div>
          </>
        )}

        {err && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {err}
          </p>
        )}
      </div>
    </section>
  );
}
