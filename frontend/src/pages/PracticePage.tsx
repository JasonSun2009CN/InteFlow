import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  api,
  ApiError,
  type QuizQuestion,
  type StartResponse,
  type TimerMode,
  type TimerPreference,
} from "../api/client";
import RichText from "../components/RichText";
import PassageText from "../components/PassageText";
import { sectionLabel } from "../lib/sections";
import { useI18n } from "../lib/i18n";

/** Last timer choice, remembered per paper and globally for docs without a record. */
const TIMER_STORAGE_KEY = "inteflow.practice.timer";

interface StoredTimer {
  mode: TimerMode;
  seconds: number | null;
}

function readStoredTimer(docId: number): StoredTimer | null {
  try {
    const raw =
      window.localStorage.getItem(`${TIMER_STORAGE_KEY}.${docId}`) ??
      window.localStorage.getItem(TIMER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredTimer>;
    if (parsed.mode !== "countup" && parsed.mode !== "countdown") return null;
    return {
      mode: parsed.mode,
      seconds:
        typeof parsed.seconds === "number" && parsed.seconds > 0
          ? parsed.seconds
          : null,
    };
  } catch {
    return null;
  }
}

function writeStoredTimer(docId: number, timer: StoredTimer): void {
  try {
    // Keep the last countdown length even when this attempt counts up, so a
    // later switch back to countdown starts from the familiar value.
    const previous = readStoredTimer(docId);
    const raw = JSON.stringify({
      mode: timer.mode,
      seconds: timer.seconds ?? previous?.seconds ?? null,
    } satisfies StoredTimer);
    window.localStorage.setItem(`${TIMER_STORAGE_KEY}.${docId}`, raw);
    window.localStorage.setItem(TIMER_STORAGE_KEY, raw);
  } catch {
    /* private mode / disabled storage: the backend still remembers the choice */
  }
}

const MAX_COUNTDOWN_MINUTES = 24 * 60;

function optionParts(option: string): { letter: string; text: string } {
  const m = /^([A-Z])[.)]\s*([\s\S]*)$/.exec(option.trim());
  return m ? { letter: m[1], text: m[2] } : { letter: "?", text: option };
}

/** The letters this question actually offers (AMC prints five, some six). */
function optionLetters(q: QuizQuestion): Set<string> {
  return new Set(q.options.map((opt) => optionParts(opt).letter));
}

function clock(total: number): string {
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function errText(err: unknown): string {
  return err instanceof ApiError ? err.message : String(err);
}

export default function PracticePage() {
  const { id } = useParams();
  const docId = Number(id);
  const navigate = useNavigate();
  const { t } = useI18n();
  const [session, setSession] = useState<StartResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [entered, setEntered] = useState(false);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string[]>>({});
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const [seconds, setSeconds] = useState(0);
  const [timerMode, setTimerMode] = useState<TimerMode>("countup");
  const [countdownMin, setCountdownMin] = useState(30);
  const [countdownSec, setCountdownSec] = useState(0);
  const [timerPref, setTimerPref] = useState<TimerPreference | null>(null);
  const [timeUp, setTimeUp] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const answersRef = useRef<Record<number, string[]>>({});
  answersRef.current = answers;
  const submittingRef = useRef(false);
  const autoSubmittedRef = useRef(false);
  const enteredRef = useRef(false);
  const timerTouchedRef = useRef(false);

  // React 18 StrictMode double-invokes effects in dev (setup -> cleanup ->
  // setup). The backend session is a real side effect that cleanup cannot
  // undo, so start it only once per document. The response is accepted only
  // while the component is mounted (aliveRef) and no newer document is in
  // flight (startedFor ref) — a StrictMode synthetic cleanup must NOT cancel
  // the single in-flight request.
  const startedFor = useRef<number | null>(null);
  const aliveRef = useRef(true);
  /** The provisional session row; dropped on leave unless the attempt is submitted. */
  const sessionIdRef = useRef<number | null>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    aliveRef.current = true;
    setSession(null);
    setEntered(false);
    setIdx(0);
    setAnswers({});
    setMarked(new Set());
    setSeconds(0);
    setTimeUp(false);
    autoSubmittedRef.current = false;
    submittingRef.current = false;
    enteredRef.current = false;
    timerTouchedRef.current = false;
    setError(null);
    if (startedFor.current === docId) return undefined; // strict-mode re-run

    submittedRef.current = false;
    startedFor.current = docId;
    api
      .startSession(docId)
      .then((s) => {
        if (!aliveRef.current || startedFor.current !== docId) {
          // The screen went away before the session loaded — drop the row.
          void api.deleteSession(s.session_id).catch(() => {});
          return;
        }
        sessionIdRef.current = s.session_id;
        setSession(s);
      })
      .catch((err) => {
        if (aliveRef.current && startedFor.current === docId) setError(errText(err));
      });
    return () => {
      aliveRef.current = false;
      // Opening an exam must not leave an attempt behind: unless it was
      // submitted, the provisional session is discarded.
      const sid = sessionIdRef.current;
      sessionIdRef.current = null;
      if (sid !== null && !submittedRef.current) {
        void api.deleteSession(sid).catch(() => {});
      }
    };
  }, [docId]);

  // Load the paper's persisted stars so they survive reloads and unfinished tries.
  useEffect(() => {
    let cancelled = false;
    api
      .listStarredIds(docId)
      .then(({ question_ids }) => {
        if (!cancelled) setMarked(new Set(question_ids));
      })
      .catch(() => {
        /* starring is optional; practice still works */
      });
    return () => {
      cancelled = true;
    };
  }, [docId]);

  // Preselect the clock from this paper's last submitted attempt, then from
  // the last attempt anywhere. localStorage is the offline fallback.
  useEffect(() => {
    let cancelled = false;

    function apply(timer: StoredTimer) {
      if (timerTouchedRef.current) return;
      setTimerMode(timer.mode);
      if (timer.seconds && timer.seconds > 0) {
        const total = Math.min(
          Math.floor(timer.seconds),
          MAX_COUNTDOWN_MINUTES * 60,
        );
        setCountdownMin(Math.floor(total / 60));
        setCountdownSec(total % 60);
      }
    }

    api
      .getTimerPreference(docId)
      .then((preference) => {
        if (cancelled || enteredRef.current) return;
        setTimerPref(preference);
        const stored = readStoredTimer(docId);
        if (preference.source !== "none") {
          apply({
            mode: preference.mode,
            seconds: preference.seconds ?? stored?.seconds ?? null,
          });
        } else if (stored) {
          apply(stored);
        }
      })
      .catch(() => {
        if (cancelled || enteredRef.current) return;
        const stored = readStoredTimer(docId);
        if (stored) apply(stored);
      });

    return () => {
      cancelled = true;
    };
  }, [docId]);

  // leave fullscreen when the exam ends or the page unmounts
  useEffect(
    () => () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    },
    [],
  );

  useEffect(() => {
    if (!session || !entered) return;
    const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [session, entered]);

  const questions = session?.questions ?? [];
  const current: QuizQuestion | undefined = questions[idx];
  const answered = Object.keys(answers).length;
  const last = idx === questions.length - 1;
  const countdownTotal =
    timerMode === "countdown" ? countdownMin * 60 + countdownSec : null;

  /** Choice: single-select replaces, multi-select toggles. */
  function choose(q: QuizQuestion, letter: string) {
    setAnswers((prev) => {
      const existing = prev[q.id] ?? [];
      if (!q.multi) {
        // single-select: clicking the same letter again clears it
        return { ...prev, [q.id]: existing.includes(letter) ? [] : [letter] };
      }
      const next = existing.includes(letter)
        ? existing.filter((l) => l !== letter)
        : [...existing, letter].sort();
      return { ...prev, [q.id]: next };
    });
  }

  function setBlank(qid: number, value: string) {
    setAnswers((prev) => ({ ...prev, [qid]: value.trim() ? [value] : [] }));
  }

  async function toggleMark(qid: number) {
    const wasStarred = marked.has(qid);
    setMarked((prev) => {
      const next = new Set(prev);
      if (wasStarred) next.delete(qid);
      else next.add(qid);
      return next;
    });
    setError(null);
    try {
      if (wasStarred) await api.unstarQuestion(qid);
      else await api.starQuestion(qid);
    } catch (err) {
      // roll the star back if the local write failed
      setMarked((prev) => {
        const next = new Set(prev);
        if (wasStarred) next.add(qid);
        else next.delete(qid);
        return next;
      });
      setError(errText(err));
    }
  }

  async function doSubmit() {
    if (!session || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.submit(
        session.session_id,
        Object.fromEntries(
          Object.entries(answersRef.current).filter(([, v]) => v.length > 0),
        ),
      );
      submittedRef.current = true;
      setConfirming(false);
      if (res.graded > 0) {
        // the key exists — straight to the graded results
        navigate(`/session/${res.session_id}/result?t=${seconds}`);
      } else {
        // no key in the source: record the attempt, then fill the key in
        navigate(`/doc/${docId}/answers?session=${res.session_id}`);
      }
    } catch (err) {
      setError(errText(err));
      setConfirming(false);
      setSubmitting(false);
      submittingRef.current = false;
    }
  }

  // Countdown expiry: grade whatever is on the paper and leave the exam.
  useEffect(() => {
    if (!session || !entered || countdownTotal === null) return;
    if (seconds < countdownTotal || autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    setTimeUp(true);
    void doSubmit();
    // doSubmit reads the live answers ref, so it is safe to bind once per tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, session, entered, countdownTotal]);

  /** Leave mid-exam: the session is abandoned and never listed as an attempt. */
  function leaveExam() {
    setLeaving(false);
    navigate("/");
  }

  async function enter() {
    if (timerMode === "countdown" && (!countdownTotal || countdownTotal <= 0)) {
      return;
    }
    writeStoredTimer(docId, {
      mode: timerMode,
      seconds: timerMode === "countdown" ? countdownTotal : null,
    });
    enteredRef.current = true;
    if (session) {
      void api
        .setSessionTimer(
          session.session_id,
          timerMode,
          timerMode === "countdown" ? countdownTotal : null,
        )
        .catch(() => {
          /* the local clock still works if saving the preference fails */
        });
    }
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // fullscreen may be unavailable (embedded view) — start anyway
    }
    setEntered(true);
  }

  // exam-style shortcuts: the option letters select, arrows move.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!session || !entered || confirming || leaving) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const q = questions[idx];
      if (!q) return;
      const key = e.key.toUpperCase();
      if (q.kind !== "blank" && optionLetters(q).has(key)) {
        choose(q, key);
      } else if (e.key === "ArrowRight") {
        setIdx((i) => Math.min(i + 1, questions.length - 1));
      } else if (e.key === "ArrowLeft") {
        setIdx((i) => Math.max(i - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (error && !session) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-800">
          {error}
        </div>
        <Link to="/" className="mt-4 inline-block text-blue-700 underline">
          {t("Back to exams")}
        </Link>
      </div>
    );
  }

  if (!session) {
    return <div className="mx-auto max-w-3xl px-4 py-10 text-slate-500">{t("Loading…")}</div>;
  }

  if (!entered) {
    const countdownInvalid = timerMode === "countdown" && (!countdownTotal || countdownTotal <= 0);
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
          <div className="text-center">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("Ready to begin")}
            </div>
            <h1 className="mt-2 text-2xl font-bold">{session.document.title}</h1>
            <p className="mt-2 text-sm text-slate-600">
              {t("{count} questions · choose how the clock runs", {
                count: session.questions.length,
              })}
            </p>
          </div>

          <div className="mt-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("Timer")}
            </div>
            <div
              role="group"
              aria-label={t("Timer mode")}
              className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1"
            >
              <button
                type="button"
                aria-pressed={timerMode === "countup"}
                onClick={() => {
                  timerTouchedRef.current = true;
                  setTimerMode("countup");
                }}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                  timerMode === "countup"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t("Count up")}
              </button>
              <button
                type="button"
                aria-pressed={timerMode === "countdown"}
                onClick={() => {
                  timerTouchedRef.current = true;
                  setTimerMode("countdown");
                }}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                  timerMode === "countdown"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t("Count down")}
              </button>
            </div>

            {timerMode === "countdown" && (
              <div className="mt-3 flex items-end gap-3">
                <label className="flex-1 text-xs font-medium text-slate-600">
                  {t("Minutes")}
                  <input
                    type="number"
                    min={0}
                    max={MAX_COUNTDOWN_MINUTES}
                    value={countdownMin}
                    onChange={(event) =>
                      setCountdownMin(
                        Math.floor(
                          Math.max(
                            0,
                            Math.min(
                              MAX_COUNTDOWN_MINUTES,
                              Number(event.target.value) || 0,
                            ),
                          ),
                        ),
                      )
                    }
                    onFocus={() => {
                      timerTouchedRef.current = true;
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-center font-mono text-lg tabular-nums focus:border-blue-600 focus:outline-none"
                  />
                </label>
                <span className="pb-2 text-lg font-semibold text-slate-400">:</span>
                <label className="flex-1 text-xs font-medium text-slate-600">
                  {t("Seconds")}
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={countdownSec}
                    onChange={(event) =>
                      setCountdownSec(
                        Math.floor(
                          Math.max(0, Math.min(59, Number(event.target.value) || 0)),
                        ),
                      )
                    }
                    onFocus={() => {
                      timerTouchedRef.current = true;
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-center font-mono text-lg tabular-nums focus:border-blue-600 focus:outline-none"
                  />
                </label>
              </div>
            )}

            <p className="mt-2 text-xs text-slate-500">
              {timerMode === "countdown"
                ? t("When the clock reaches 00:00, your answers are submitted automatically.")
                : t("The clock counts up from zero; submit whenever you are ready.")}
            </p>
            {timerPref?.source === "document" && (
              <p className="mt-1 text-xs text-slate-500">
                {t("Default carried over from this paper's last attempt.")}
              </p>
            )}
            {timerPref?.source === "global" && (
              <p className="mt-1 text-xs text-slate-500">
                {t("No attempt on this paper yet — defaulted to your last timer.")}
              </p>
            )}
          </div>

          <button
            onClick={() => void enter()}
            disabled={countdownInvalid}
            className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {t("Begin — enter fullscreen")}
          </button>
          <Link
            to={`/doc/${docId}/answers`}
            className="mt-4 block text-center text-sm text-blue-700 underline"
          >
            {t("Enter answers first (optional)")}
          </Link>
          <Link
            to="/"
            className="mt-2 block text-center text-sm text-slate-500 underline"
          >
            {t("Back to exams")}
          </Link>
        </div>
      </div>
    );
  }

  if (!current) {
    return <div className="mx-auto max-w-3xl px-4 py-10 text-slate-500">{t("Loading…")}</div>;
  }

  const unanswered = questions.length - answered;
  const material = current.material;
  const material2 = current.material2;
  const clockValue =
    timerMode === "countdown" && countdownTotal !== null
      ? Math.max(0, countdownTotal - seconds)
      : seconds;

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="sticky top-0 z-20 border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate font-semibold">{session.document.title}</div>
            <div className="text-xs text-slate-500">
              {t(sectionLabel(current.sec))}
            </div>
          </div>
          <div className="text-sm text-slate-600">
            {t("Question {current} of {total}", {
              current: idx + 1,
              total: questions.length,
            })}
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-md px-2.5 py-1 font-mono text-sm tabular-nums ${
                timerMode === "countdown" && clockValue <= 60
                  ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                  : "bg-slate-100"
              }`}
              title={timerMode === "countdown" ? t("Time remaining") : t("Time elapsed")}
            >
              {clock(clockValue)}
            </span>
            <button
              onClick={() => setLeaving(true)}
              className="rounded-lg border px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              {t("Exit")}
            </button>
            <button
              onClick={() => setConfirming(true)}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              {t("Submit")}
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-auto mt-3 max-w-6xl rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {timeUp && (
        <div className="mx-auto mt-3 max-w-6xl rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {t("Time's up — submitting your answers…")}
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <div className={material || material2 ? "grid gap-4 lg:grid-cols-2" : "mx-auto max-w-3xl"}>
          {(material || material2) && (
            <aside
              className="max-h-[70vh] overflow-y-auto rounded-xl border bg-white p-5 [scrollbar-gutter:stable]"
              data-testid="practice-passage"
            >
              <PassageText material={material} material2={material2} docId={docId} />
            </aside>
          )}

          <section className={`rounded-xl border bg-white p-5 ${material || material2 ? "" : "p-6"}`}>
            <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>
                {t("Question {number}", { number: current.no ?? idx + 1 })}
                {current.source ? ` · ${current.source}` : ""}
              </span>
              <button
                onClick={() => toggleMark(current.id)}
                className={`rounded px-2 py-1 normal-case tracking-normal ${
                  marked.has(current.id)
                    ? "bg-amber-100 text-amber-800"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {marked.has(current.id) ? `★ ${t("Starred")}` : `☆ ${t("Star for review")}`}
              </button>
            </div>

            <div className="text-[15px]">
              <RichText text={current.stem} docId={docId} />
            </div>

            <div className="mt-5 space-y-2.5">
              {current.kind === "blank" ? (
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t("Your answer")}
                  </span>
                  <input
                    type="text"
                    autoComplete="off"
                    value={answers[current.id]?.[0] ?? ""}
                    onChange={(event) => setBlank(current.id, event.target.value)}
                    aria-label={t("Your answer")}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-3 text-[15px] focus:border-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  />
                </label>
              ) : (
                current.options.map((option) => {
                  const { letter, text } = optionParts(option);
                  const selected = (answers[current.id] ?? []).includes(letter);
                  return (
                    <button
                      key={letter}
                      onClick={() => choose(current, letter)}
                      aria-pressed={selected}
                      className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
                        selected
                          ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600"
                          : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center text-sm font-semibold ${
                          current.multi ? "rounded-md border" : "rounded-full border"
                        } ${
                          selected
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-slate-400 text-slate-700"
                        }`}
                      >
                        {letter}
                      </span>
                      <span className="min-w-0 flex-1 pt-0.5 text-[15px]">
                        <RichText text={text} docId={docId} />
                      </span>
                    </button>
                  );
                })
              )}
              {current.multi && (
                <p className="text-xs text-slate-500">{t("Select every correct answer.")}</p>
              )}
            </div>
          </section>
        </div>
      </main>

      <footer className="sticky bottom-0 z-20 border-t bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <button
            onClick={() => setIdx((i) => Math.max(i - 1, 0))}
            disabled={idx === 0}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
          >
            {t("Previous")}
          </button>

          <nav className="flex flex-1 flex-wrap justify-center gap-1.5" aria-label={t("Question palette")}>
            {questions.map((q, i) => {
              const isAnswered = (answers[q.id] ?? []).length > 0;
              const isMarked = marked.has(q.id);
              const isCurrent = i === idx;
              const tone = isMarked
                ? "border-amber-500 bg-amber-400 text-slate-900"
                : isAnswered
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-300 bg-white text-slate-700";
              return (
                <button
                  key={q.id}
                  onClick={() => setIdx(i)}
                  title={
                    isMarked
                      ? t("Question {number} (starred)", { number: q.no ?? i + 1 })
                      : t("Question {number}", { number: q.no ?? i + 1 })
                  }
                  className={`grid h-8 w-8 place-items-center rounded-md border text-xs font-semibold transition ${tone} ${
                    isCurrent ? "ring-2 ring-slate-900 ring-offset-1" : ""
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </nav>

          <button
            onClick={() => setIdx((i) => Math.min(i + 1, questions.length - 1))}
            disabled={last}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
          >
            {t("Next")}
          </button>
        </div>
      </footer>

      {confirming && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">{t("Submit your answers?")}</h2>
            <p className="mt-2 text-sm text-slate-600">
              {t("{answered} of {total} answered", {
                answered,
                total: questions.length,
              })}
              {unanswered > 0 &&
                t(", {count} still blank", { count: unanswered })}
              {t(". You can review every question afterwards.")}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                {t("Keep working")}
              </button>
              <button
                onClick={() => void doSubmit()}
                disabled={submitting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? t("Grading…") : t("Submit")}
              </button>
            </div>
          </div>
        </div>
      )}
      {leaving && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">{t("Leave the exam?")}</h2>
            <p className="mt-2 text-sm text-slate-600">
              {t(
                "This attempt will be left unfinished — your answers so far are not submitted and will not be graded. You can start a new attempt any time.",
              )}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setLeaving(false)}
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                {t("Keep working")}
              </button>
              <button
                onClick={leaveExam}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                {t("Leave exam")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
