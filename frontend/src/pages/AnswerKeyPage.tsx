import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Plus, X } from "lucide-react";
import {
  api,
  ApiError,
  type DocumentSummary,
  type Question,
  type Subject,
} from "../api/client";
import { SubjectPicker } from "../components/SubjectControls";
import RichText from "../components/RichText";
import { useI18n } from "../lib/i18n";

/** Letters of a question's options, in order ("A", "B", …). Falls back to a
 *  standard four-letter grid if the options are not labelled. */
function optionLetters(q: Question): string[] {
  const seen: string[] = [];
  for (const opt of q.options) {
    const m = /^([A-Z])[.)]/.exec(opt.trim());
    if (m && !seen.includes(m[1])) seen.push(m[1]);
  }
  return seen.length ? seen.sort() : ["A", "B", "C", "D"];
}

/**
 * Accepts "1-A 2-C", "1. A", "12B" or a bare letter string "ACBDA".
 * Returns answers keyed by the question's displayed number. A trailing run of
 * letters is kept as a list so `multi` questions can be pasted as "3-AC".
 */
export function parseBulk(text: string): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  const numbered = [
    ...text.matchAll(/(\d{1,3})\s*[-.):]?\s*([A-Za-z](?:\s*[,&/]?\s*[A-Za-z])*)/g),
  ];
  if (numbered.length > 0) {
    for (const m of numbered) {
      const no = Number(m[1]);
      if (no >= 1 && no <= 200) {
        out[no] = [...new Set(m[2].replace(/[^A-Za-z]/g, "").toUpperCase().split(""))].sort();
      }
    }
    return out;
  }
  const letters = text.replace(/[^A-Za-z]/g, "").toUpperCase();
  for (let i = 0; i < letters.length; i++) out[i + 1] = [letters[i]];
  return out;
}

export default function AnswerKeyPage() {
  const { t } = useI18n();
  const { id } = useParams();
  const docId = Number(id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  /** Set when the user just submitted an attempt that needs grading. */
  const pendingSession = searchParams.get("session");
  const [doc, setDoc] = useState<DocumentSummary | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [bulk, setBulk] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function refreshSubjects() {
    api
      .listSubjects()
      .then(setSubjects)
      .catch(() => {
        /* grouping is optional */
      });
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getDocument(docId),
      api.getQuestions(docId),
      api.listSubjects().catch(() => [] as Subject[]),
    ])
      .then(([d, qs, ss]) => {
        if (cancelled) return;
        setDoc(d);
        setQuestions(qs);
        setSubjects(ss);
        setAnswers(
          Object.fromEntries(
            qs.filter((q) => q.answers.length > 0).map((q) => [q.ext_id, q.answers]),
          ),
        );
      })
      .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, [docId]);

  const filled = Object.values(answers).filter((values) =>
    values.some((value) => value.trim()),
  ).length;
  const total = questions?.length ?? 0;

  function toggleLetter(extId: string, letter: string, multi: boolean) {
    setAnswers((prev) => {
      const existing = prev[extId] ?? [];
      const next = multi
        ? existing.includes(letter)
          ? existing.filter((l) => l !== letter)
          : [...existing, letter].sort()
        : existing.includes(letter)
          ? []
          : [letter];
      const copy = { ...prev };
      if (next.length === 0) delete copy[extId];
      else copy[extId] = next;
      return copy;
    });
    setMessage(null);
  }

  /** Blank questions accept several alternative spellings, one per row. */
  function setBlankValue(extId: string, index: number, value: string) {
    setAnswers((prev) => {
      const existing = [...(prev[extId] ?? [""])];
      existing[index] = value;
      const cleaned = existing.map((v) => v.trim());
      const copy = { ...prev };
      const kept = cleaned.filter(Boolean);
      if (kept.length === 0) delete copy[extId];
      else copy[extId] = cleaned;
      return copy;
    });
    setMessage(null);
  }

  function addBlankValue(extId: string) {
    // The first input is shown by default, so seed it before appending.
    setAnswers((prev) => ({ ...prev, [extId]: [...(prev[extId] ?? [""]), ""] }));
  }

  function removeBlankValue(extId: string, index: number) {
    setAnswers((prev) => {
      const existing = [...(prev[extId] ?? [])];
      existing.splice(index, 1);
      const copy = { ...prev };
      const kept = existing.filter((v) => v.trim());
      if (kept.length === 0) delete copy[extId];
      else copy[extId] = existing;
      return copy;
    });
  }

  function applyBulk() {
    if (!questions) return;
    const parsed = parseBulk(bulk);
    const next: Record<string, string[]> = { ...answers };
    let applied = 0;
    questions.forEach((q, index) => {
      if (q.kind === "blank") return;
      const no = q.no ?? index + 1;
      const letters = parsed[no];
      if (letters && letters.length > 0) {
        next[q.ext_id] = q.multi ? letters : letters.slice(0, 1);
        applied += 1;
      }
    });
    if (applied === 0) {
      setError(t("Nothing recognized — expected something like 1-A 2-C 3-D, or ACBD…"));
      return;
    }
    setError(null);
    setAnswers(next);
    setMessage(t("Parsed {count} answer(s) from the pasted text.", { count: applied }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, string[]> = {};
      for (const [extId, values] of Object.entries(answers)) {
        const cleaned = values.map((v) => v.trim()).filter(Boolean);
        if (cleaned.length > 0) payload[extId] = cleaned;
      }
      const updated = await api.putAnswers(docId, payload);
      setDoc(updated);
      if (pendingSession && Object.keys(payload).length > 0) {
        // the stored attempt waits for this key — grade it and show results
        navigate(`/session/${pendingSession}/result`);
        return;
      }
      setMessage(
        t("Saved {answered}/{total} answers.", {
          answered: updated.answered_count,
          total: updated.question_count,
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (error && !questions) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-800">
          {error}
        </div>
      </div>
    );
  }

  if (!doc || !questions) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-10 text-slate-500">{t("Loading…")}</div>
    );
  }

  const choiceQuestions = questions.filter((q) => q.kind !== "blank");
  const blankQuestions = questions.filter((q) => q.kind === "blank");

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-slate-400">
            {t("Answer key")}
          </p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{doc.title}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {t("{count} questions · {filled}/{total} filled", {
              count: total,
              filled,
              total,
            })}
            {doc.answers_status !== "none" &&
              t(" · source had: {status} answers", { status: t(doc.answers_status) })}
          </p>
          <SubjectPicker
            docId={doc.id}
            title={doc.title}
            subjects={subjects}
            value={doc.subject}
            onChange={(subject) => setDoc((current) => (current ? { ...current, subject } : current))}
            onSubjectsChanged={refreshSubjects}
            className="mt-1.5"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving || filled === 0}
            className="btn btn-primary rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving
              ? t("Saving…")
              : pendingSession
                ? t("Save & view results")
                : t("Save answers")}
          </button>
          <Link
            to={`/doc/${doc.id}/practice`}
            className="rounded-lg border px-4 py-2 font-medium hover:bg-slate-50"
          >
            {t("Practice")}
          </Link>
        </div>
      </div>

      {pendingSession && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t(
            "You just submitted an attempt — enter the answer key to grade it, then you'll see the results.",
          )}
        </div>
      )}
      {message && (
        <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900">
          {message}
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-800">
          {error}
        </div>
      )}

      {choiceQuestions.length > 0 && (
        <section className="mt-6 rounded-xl border bg-white p-4">
          <h2 className="font-semibold">{t("Bulk entry")}</h2>
          <p className="text-sm text-slate-600">
            {t(
              "Paste 1-A 2-C 3-D, 1. A, ACBDA, or 3-AC for multiple answers.",
            )}
          </p>
          <textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            rows={3}
            placeholder="1-A 2-C 3-D 4-A 5-B"
            className="mt-2 w-full rounded-lg border px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={applyBulk}
            className="mt-2 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
          >
            {t("Apply to grid")}
          </button>
        </section>
      )}

      {choiceQuestions.length > 0 && (
        <section className="mt-6 grid gap-2 sm:grid-cols-2">
          {choiceQuestions.map((q) => {
            const no = q.no ?? questions.indexOf(q) + 1;
            const chosen = answers[q.ext_id] ?? [];
            return (
              <div
                key={q.ext_id}
                className="flex items-center gap-3 rounded-lg border bg-white px-3 py-2"
              >
                <span
                  className={`w-10 shrink-0 text-sm font-semibold ${chosen.length ? "text-slate-800" : "text-slate-400"}`}
                >
                  {no}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-500" title={q.stem}>
                  {q.stem}
                </span>
                {q.multi && (
                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    {t("multi")}
                  </span>
                )}
                <div className="flex shrink-0 gap-1">
                  {optionLetters(q).map((letter) => (
                    <button
                      key={letter}
                      onClick={() => toggleLetter(q.ext_id, letter, q.multi)}
                      aria-pressed={chosen.includes(letter)}
                      className={`h-8 w-8 rounded-md border text-sm font-semibold transition ${
                        chosen.includes(letter)
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-300 hover:border-slate-400"
                      }`}
                    >
                      {letter}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {blankQuestions.length > 0 && (
        <section className="mt-6 space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("Fill in the blank · list every acceptable answer")}
          </h2>
          {blankQuestions.map((q) => {
            const no = q.no ?? questions.indexOf(q) + 1;
            const values = answers[q.ext_id] ?? [""];
            return (
              <div key={q.ext_id} className="rounded-lg border bg-white p-3">
                <div className="flex items-start gap-3">
                  <span className="w-10 shrink-0 text-sm font-semibold text-slate-800">{no}</span>
                  <span className="min-w-0 flex-1 text-xs text-slate-600">{q.stem}</span>
                </div>
                <div className="mt-2 space-y-1.5 pl-13">
                  {values.map((value, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={value}
                        onChange={(event) => setBlankValue(q.ext_id, index, event.target.value)}
                        placeholder={
                          index === 0
                            ? t("Correct answer")
                            : t("Another acceptable answer")
                        }
                        aria-label={t("Accepted answer {number} for question {question}", {
                          number: index + 1,
                          question: no,
                        })}
                        className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                      />
                      {values.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeBlankValue(q.ext_id, index)}
                          aria-label={t("Remove answer {number} for question {question}", {
                            number: index + 1,
                            question: no,
                          })}
                          className="rounded-md border border-slate-200 p-1.5 text-slate-400 hover:border-red-300 hover:text-red-600"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addBlankValue(q.ext_id)}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("Add acceptable answer")}
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="mt-6 rounded-xl border bg-white p-4">
        <h2 className="font-semibold">{t("Preview")}</h2>
        <p className="text-sm text-slate-600">
          {t("First question as the practice UI will render it.")}
        </p>
        <div className="mt-2 rounded-lg border bg-slate-50 p-3 text-sm">
          <RichText text={questions[0]?.stem ?? ""} docId={docId} />
        </div>
      </section>

      <div className="mt-6 flex gap-3">
        <button
          onClick={save}
          disabled={saving || filled === 0}
          className="btn btn-primary rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving
            ? t("Saving…")
            : pendingSession
              ? t("Save & view results")
              : t("Save answers")}
        </button>
        {filled === total && total > 0 && (
          <Link
            to={`/doc/${doc.id}/practice`}
            className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700"
          >
            {t("All set — start practice")}
          </Link>
        )}
      </div>
    </div>
  );
}
