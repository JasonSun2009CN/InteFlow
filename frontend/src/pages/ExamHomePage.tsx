import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { api, ApiError, type DocumentSummary, type Subject } from "../api/client";
import { buttonClasses } from "../components/ui";
import { SubjectBadge, SubjectFilterBar } from "../components/SubjectControls";
import { useCountUp } from "../lib/useCountUp";
import type { SubjectFilterValue } from "../lib/subjects";

function errText(err: unknown): string {
  return err instanceof ApiError ? err.message : String(err);
}

/** Stats read as a two-digit ledger: 01, 02, … */
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** SQLite stores `datetime('now')` as "YYYY-MM-DD HH:MM:SS" in UTC. */
function formatAdded(value: string): string | null {
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
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
  tone?: "ink" | "seal";
}) {
  const shown = useCountUp(value);

  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-[0.2em] text-ink-400">
        {label}
      </dt>
      <dd
        className={`mt-1 font-display text-3xl leading-none tabular-nums ${
          tone === "seal" ? "text-seal-600" : "text-ink-900"
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
 * The visual language is paper-and-ink: serif display type, hairline rules and
 * numbered rows instead of cards.
 */
export default function ExamHomePage() {
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
    <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
      <section className="pb-10 sm:pb-14">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-ink-400">
              Local practice workspace
            </p>
            <h1 className="mt-3 font-display text-4xl leading-[1.05] tracking-tight text-ink-900 sm:text-5xl lg:text-6xl">
              Select an exam
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-ink-500">
              Answers are graded when you submit. The timer starts when you begin
              — and everything stays on this machine.
            </p>
          </div>

          <dl className="flex gap-8 border-t border-paper-200 pt-6 md:border-t-0 md:pt-0 md:text-right">
            <Stat
              label="Exams"
              value={docs ? examCount : null}
              format={pad}
            />
            <Stat
              label="Questions"
              value={docs ? questionCount : null}
              format={(n) => n.toLocaleString("en-US")}
            />
            <Stat
              label="Needs keys"
              value={docs ? needsKeys : null}
              format={pad}
              tone={needsKeys > 0 ? "seal" : "ink"}
            />
          </dl>
        </div>
      </section>

      {docs && docs.length > 0 && subjects.list.length > 0 && (
        <div className="mb-6">
          <SubjectFilterBar
            subjects={subjects.list}
            value={effectiveFilter}
            onChange={setSubjectFilter}
            total={docs.length}
            uncategorized={subjects.uncategorized}
          />
        </div>
      )}

      <section aria-labelledby="exam-list-heading" aria-busy={docs === null}>
        <div className="flex items-baseline justify-between gap-4 border-b border-ink-900/80 pb-2">
          <h2
            id="exam-list-heading"
            className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-500"
          >
            Exams
          </h2>
          <p className="text-[11px] text-ink-400">Answers are graded when you submit</p>
        </div>

        {error && (
          <div role="alert" className="my-8 border-l-2 border-seal-500 bg-seal-50 px-5 py-4">
            <p className="font-medium text-seal-700">Couldn&apos;t load your exams.</p>
            <p className="mt-1 text-sm leading-6 text-ink-500">{error}</p>
            <button
              type="button"
              onClick={load}
              className="mt-3 border-b border-ink-300 pb-0.5 text-xs font-medium text-ink-700 transition-colors hover:border-ink-900 hover:text-ink-900"
            >
              Try again
            </button>
          </div>
        )}

        {docs === null && !error && (
          <>
            <ul className="divide-y divide-paper-200" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <li
                  key={i}
                  className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-4 gap-y-3 py-6 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-x-6"
                >
                  <span className="mt-1 h-3 w-5 animate-pulse rounded-sm bg-paper-300/70" />
                  <div className="min-w-0">
                    <div className="h-5 w-2/3 animate-pulse rounded-sm bg-paper-300/70" />
                    <div className="mt-2 h-3 w-1/3 animate-pulse rounded-sm bg-paper-200" />
                  </div>
                  <div className="col-span-2 h-8 w-24 animate-pulse rounded-sm bg-paper-200 sm:col-span-1" />
                </li>
              ))}
            </ul>
            <p role="status" className="sr-only">
              Loading exams…
            </p>
          </>
        )}

        {docs?.length === 0 && (
          <div className="border-b border-paper-200 py-14 text-center">
            <p className="font-display text-3xl tracking-tight text-ink-900">No exams yet.</p>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink-500">
              Import a PDF, DOCX or InteFlow-MD file, or add a ready-made set from the
              built-in library.
            </p>
            <Link
              to="/library"
              className={buttonClasses({ className: "mt-6 whitespace-nowrap" })}
            >
              Open library
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        )}

        {docs && docs.length > 0 && visibleDocs.length === 0 && (
          <div className="border-b border-paper-200 py-12 text-center">
            <p className="font-display text-2xl tracking-tight text-ink-900">
              No exams in this subject.
            </p>
            <button
              type="button"
              onClick={() => setSubjectFilter("all")}
              className="mt-3 text-xs text-ink-500 underline decoration-paper-300 underline-offset-4 hover:text-ink-900"
            >
              Show all exams
            </button>
          </div>
        )}

        {visibleDocs.length > 0 && (
          <ol className="divide-y divide-paper-200">
            {visibleDocs.map((doc, index) => {
              const needsKey =
                doc.needs_answers && doc.answered_count < doc.question_count;
              const added = formatAdded(doc.created_at);

              return (
                <li
                  key={doc.id}
                  className="group grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-4 gap-y-3 py-6 transition-colors hover:bg-paper-100/60 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-x-6"
                >
                  <span className="pt-1 font-mono text-[11px] tabular-nums text-ink-300 sm:pt-0">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <div className="min-w-0">
                    <h3 className="truncate">
                      <Link
                        to={`/doc/${doc.id}/practice`}
                        className="font-display text-xl leading-snug tracking-tight text-ink-900 decoration-paper-300 underline-offset-4 hover:underline sm:text-2xl"
                      >
                        {doc.title}
                      </Link>
                    </h3>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-400">
                      {doc.subject && (
                        <>
                          <SubjectBadge subject={doc.subject} />
                          <span aria-hidden="true">·</span>
                        </>
                      )}
                      <span className="tabular-nums">
                        {doc.question_count.toLocaleString("en-US")} questions
                      </span>
                      {added && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Added {added}</span>
                        </>
                      )}
                      {needsKey && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-medium tabular-nums text-seal-600">
                            Answer key {doc.answered_count}/{doc.question_count}
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="col-span-2 flex items-center justify-between gap-4 sm:col-span-1 sm:justify-end">
                    {needsKey ? (
                      <Link
                        to={`/doc/${doc.id}/answers`}
                        className="text-xs text-ink-500 underline decoration-paper-300 underline-offset-4 transition-colors hover:text-ink-900"
                      >
                        Enter answers
                      </Link>
                    ) : (
                      <span />
                    )}
                    <Link
                      to={`/doc/${doc.id}/practice`}
                      className={buttonClasses({ className: "whitespace-nowrap" })}
                    >
                      Start
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
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
