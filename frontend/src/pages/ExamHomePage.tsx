import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { api, ApiError, type DocumentSummary, type Subject } from "../api/client";
import { buttonClasses } from "../components/ui";
import { SubjectBadge, SubjectFilterBar } from "../components/SubjectControls";
import { useCountUp } from "../lib/useCountUp";
import { useI18n } from "../lib/i18n";
import type { SubjectFilterValue } from "../lib/subjects";

function errText(err: unknown): string {
  return err instanceof ApiError ? err.message : String(err);
}

/** Stats read as a two-digit ledger: 01, 02, … */
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** SQLite stores `datetime('now')` as "YYYY-MM-DD HH:MM:SS" in UTC. */
function formatAdded(value: string, locale: string): string | null {
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function Stat({
  label,
  value,
  format = (n) => String(n),
  tone = "ink",
}: {
  label: string;
  value: number | null;
  format?: (n: number) => string;
  tone?: "ink" | "accent";
}) {
  const shown = useCountUp(value);

  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd
        className={`mt-1 text-2xl leading-none font-semibold tabular-nums ${
          tone === "accent" ? "text-seal-600" : "text-slate-900"
        }`}
      >
        {shown === null ? "—" : format(shown)}
      </dd>
    </div>
  );
}

/**
 * Exams tab: pick an exam and start it — nothing else.
 *
 * Import / Library / Settings are management tools and live in the sidebar.
 * The layout is a single column: a quiet statement, then a list. No cards,
 * no dividers, no ornament.
 */
export default function ExamHomePage() {
  const { t, locale } = useI18n();
  const [docs, setDocs] = useState<DocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<SubjectFilterValue>("all");

  const load = useCallback(() => {
    setDocs(null);
    setError(null);
    api
      .listDocuments()
      .then(setDocs)
      .catch((err) => setError(errText(err)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const examCount = docs?.length ?? 0;
  const questionCount = docs?.reduce((sum, doc) => sum + doc.question_count, 0) ?? 0;
  const needsKeys =
    docs?.filter((doc) => doc.needs_answers && doc.answered_count < doc.question_count)
      .length ?? 0;

  const subjects = useMemo(() => {
    const counts = new Map<number, { subject: NonNullable<DocumentSummary["subject"]>; n: number }>();
    let uncategorized = 0;
    for (const doc of docs ?? []) {
      if (doc.subject) {
        const current = counts.get(doc.subject.id);
        if (current) current.n += 1;
        else counts.set(doc.subject.id, { subject: doc.subject, n: 1 });
      } else {
        uncategorized += 1;
      }
    }
    const list: Subject[] = [...counts.values()]
      .map(({ subject, n }) => ({
        ...subject,
        document_count: n,
        created_at: "",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { list, uncategorized };
  }, [docs]);

  const effectiveFilter: SubjectFilterValue =
    typeof subjectFilter === "number" &&
    !subjects.list.some((subject) => subject.id === subjectFilter)
      ? "all"
      : subjectFilter;

  const visibleDocs =
    docs?.filter((doc) => {
      if (effectiveFilter === "all") return true;
      if (effectiveFilter === "none") return doc.subject === null;
      return doc.subject?.id === effectiveFilter;
    }) ?? [];

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12 sm:py-16">
      <header>
        <p className="text-sm text-slate-500">{t("Local practice workspace")}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          {t("Select an exam")}
        </h1>
        <p className="mt-4 max-w-lg text-base leading-7 text-slate-600">
          {t(
            "Answers are graded when you submit. The timer starts when you begin — and everything stays on this machine.",
          )}
        </p>

        <dl className="mt-10 flex gap-12">
          <Stat label={t("Exams")} value={docs ? examCount : null} format={pad} />
          <Stat
            label={t("Questions")}
            value={docs ? questionCount : null}
            format={(n) => n.toLocaleString(locale)}
          />
          <Stat
            label={t("Needs keys")}
            value={docs ? needsKeys : null}
            format={pad}
            tone={needsKeys > 0 ? "accent" : "ink"}
          />
        </dl>
      </header>

      {docs && docs.length > 0 && subjects.list.length > 0 && (
        <div className="mt-12">
          <SubjectFilterBar
            subjects={subjects.list}
            value={effectiveFilter}
            onChange={setSubjectFilter}
            total={docs.length}
            uncategorized={subjects.uncategorized}
          />
        </div>
      )}

      <section aria-labelledby="exam-list-heading" aria-busy={docs === null} className="mt-12">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="exam-list-heading" className="text-base font-semibold text-slate-900">
            {t("Exams")}
          </h2>
          <p className="text-xs text-slate-500">{t("Answers are graded when you submit")}</p>
        </div>

        {error && (
          <div role="alert" className="mt-6 bg-seal-50 px-5 py-4">
            <p className="font-medium text-seal-700">{t("Couldn't load your exams.")}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{error}</p>
            <button
              type="button"
              onClick={load}
              className="mt-3 cursor-pointer border-b border-slate-400 pb-0.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-900 hover:text-slate-900"
            >
              {t("Try again")}
            </button>
          </div>
        )}

        {docs === null && !error && (
          <>
            <ul className="mt-2" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <li
                  key={i}
                  className="grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-4 gap-y-3 py-7 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-x-6"
                >
                  <span className="mt-1 h-3 w-5 animate-pulse rounded-sm bg-slate-200" />
                  <div className="min-w-0">
                    <div className="h-5 w-2/3 animate-pulse rounded-sm bg-slate-200" />
                    <div className="mt-2 h-3 w-1/3 animate-pulse rounded-sm bg-slate-100" />
                  </div>
                  <div className="col-span-2 h-8 w-24 animate-pulse rounded-sm bg-slate-100 sm:col-span-1" />
                </li>
              ))}
            </ul>
            <p role="status" className="sr-only">
              {t("Loading exams…")}
            </p>
          </>
        )}

        {docs?.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-2xl font-semibold tracking-tight text-slate-900">
              {t("No exams yet.")}
            </p>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">
              {t(
                "Import a PDF, DOCX or InteFlow-MD file, or add a ready-made set from the built-in library.",
              )}
            </p>
            <Link
              to="/library"
              className={buttonClasses({ className: "mt-7 whitespace-nowrap" })}
            >
              {t("Open library")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        )}

        {docs && docs.length > 0 && visibleDocs.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-xl font-semibold tracking-tight text-slate-900">
              {t("No exams in this subject.")}
            </p>
            <button
              type="button"
              onClick={() => setSubjectFilter("all")}
              className="mt-4 cursor-pointer text-sm text-slate-600 underline decoration-slate-300 underline-offset-4 hover:text-slate-900"
            >
              {t("Show all exams")}
            </button>
          </div>
        )}

        {visibleDocs.length > 0 && (
          <ol className="mt-2">
            {visibleDocs.map((doc, index) => {
              const needsKey =
                doc.needs_answers && doc.answered_count < doc.question_count;
              const added = formatAdded(doc.created_at, locale);

              return (
                <li
                  key={doc.id}
                  className="group grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-4 gap-y-3 py-7 transition-colors hover:bg-slate-50 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-x-6"
                >
                  <span className="pt-1 font-mono text-xs tabular-nums text-slate-400 sm:pt-0">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <div className="min-w-0">
                    <h3 className="truncate">
                      <Link
                        to={`/doc/${doc.id}/practice`}
                        className="text-xl font-medium leading-snug tracking-tight text-slate-900 underline-offset-4 hover:underline sm:text-2xl"
                      >
                        {doc.title}
                      </Link>
                    </h3>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      {doc.subject && (
                        <>
                          <SubjectBadge subject={doc.subject} />
                          <span aria-hidden="true">·</span>
                        </>
                      )}
                      <span className="tabular-nums">
                        {t("{count} questions", {
                          count: doc.question_count.toLocaleString(locale),
                        })}
                      </span>
                      {added && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{t("Added {date}", { date: added })}</span>
                        </>
                      )}
                      {needsKey && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-medium tabular-nums text-seal-600">
                            {t("Answer key {answered}/{total}", {
                              answered: doc.answered_count,
                              total: doc.question_count,
                            })}
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="col-span-2 flex items-center justify-between gap-6 sm:col-span-1 sm:justify-end">
                    {needsKey ? (
                      <Link
                        to={`/doc/${doc.id}/answers`}
                        className="text-xs text-slate-600 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-slate-900"
                      >
                        {t("Enter answers")}
                      </Link>
                    ) : (
                      <span />
                    )}
                    <Link
                      to={`/doc/${doc.id}/practice`}
                      className={buttonClasses({ size: "sm", className: "whitespace-nowrap" })}
                    >
                      {t("Start")}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
