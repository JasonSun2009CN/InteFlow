import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  ApiError,
  type ResultItem,
  type ReviewAnalysis,
  type ReviewItem,
} from "../api/client";
import AnalysisEditor from "../components/workspace/AnalysisEditor";
import RichText from "../components/RichText";
import { SubjectBadge } from "../components/SubjectControls";
import { SlidingTabs } from "../components/ui";
import { sectionLabel } from "../lib/sections";
import { useI18n } from "../lib/i18n";

type Collection = "mistakes" | "starred";
type SortOrder = "newest" | "oldest";

const EMPTY_ITEMS: ReviewItem[] = [];

function errText(err: unknown): string {
  return err instanceof ApiError ? err.message : String(err);
}

/** SQLite stores `datetime('now')` as "YYYY-MM-DD HH:MM:SS" in UTC. */
function formatWhen(value: string | null, locale: string): string {
  if (!value) return "";
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function itemDate(item: ReviewItem): string {
  return item.answered_at ?? item.finished_at ?? item.starred_at ?? "";
}

function answerText(item: ReviewItem, values: string[]): string {
  if (values.length === 0) return "—";
  return item.kind === "blank" ? values.join(" | ") : values.join(", ");
}

function matches(item: ReviewItem, needle: string): boolean {
  if (!needle) return true;
  const haystack = [
    item.document_title,
    item.stem,
    ...item.options,
    ...item.answers,
    ...item.chosen_answers,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

function mergeSavedAnalysis(item: ReviewItem, content: string): ReviewItem {
  const analyses: ReviewAnalysis[] = item.analyses.map((entry) =>
    entry.source === "page" ? { ...entry, content } : entry,
  );
  if (!analyses.some((entry) => entry.source === "page")) {
    analyses.unshift({
      source: "page",
      content,
      updated_at: new Date().toISOString(),
    });
  }
  return { ...item, analysis: content, analyses };
}

/** A row in either collection; star toggling never opens the row. */
function ReviewRow({
  item,
  selected,
  onSelect,
  onToggleStar,
}: {
  item: ReviewItem;
  selected: boolean;
  onSelect: () => void;
  onToggleStar: () => void;
}) {
  const { t, locale } = useI18n();
  const date = formatWhen(itemDate(item), locale);
  const status =
    item.is_correct === false
      ? "bg-red-500"
      : item.is_correct === true
        ? "bg-emerald-500"
        : "bg-slate-300";

  return (
    <li
      className={`flex items-stretch gap-2 px-3 py-3 transition-colors ${
        selected ? "bg-slate-100" : "hover:bg-slate-50"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className="flex min-w-0 flex-1 items-start gap-3 text-left"
      >
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${status}`} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-slate-800">
              {t("Question {number}", { number: item.no })}
            </span>
            <span className="text-[11px] text-slate-400">
              {t(sectionLabel(item.sec))}
              {item.source ? ` · ${item.source}` : ""}
            </span>
            {item.subject && <SubjectBadge subject={item.subject} />}
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            {item.document_title}
            {date ? ` · ${date}` : ""}
          </span>
          <span className="mt-1 line-clamp-2 block text-sm leading-5 text-slate-700">
            {item.stem}
          </span>
          <span className="mt-1 block text-[11px] text-slate-400">
            {t("Correct: {answer}", { answer: answerText(item, item.answers) })}
            {item.chosen_answers.length > 0 && (
              <> · {t("Yours: {answer}", { answer: answerText(item, item.chosen_answers) })}</>
            )}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onToggleStar}
        aria-label={
          item.starred
            ? t("Unstar question {number}", { number: item.no })
            : t("Star question {number}", { number: item.no })
        }
        aria-pressed={item.starred}
        title={item.starred ? t("Remove from Starred") : t("Add to Starred")}
        className={`h-8 shrink-0 self-start rounded-md border px-2 text-sm ${
          item.starred
            ? "border-amber-300 bg-amber-100 text-amber-800"
            : "border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-amber-700"
        }`}
      >
        {item.starred ? "★" : "☆"}
      </button>
    </li>
  );
}

/** Mistakes + starred questions, with the shared analysis editor on the right. */
export default function MistakesPage() {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<Collection>("mistakes");
  const [data, setData] = useState<Record<Collection, ReviewItem[] | null>>({
    mistakes: null,
    starred: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [exam, setExam] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (data[tab] !== null) return undefined;
    setLoading(true);
    setError(null);
    const load = tab === "mistakes" ? api.listMistakes() : api.listStarredQuestions();
    load
      .then((items) => {
        if (!cancelled) setData((current) => ({ ...current, [tab]: items }));
      })
      .catch((err) => {
        if (!cancelled) setError(errText(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, reloadKey]);

  const items = data[tab] ?? EMPTY_ITEMS;

  const exams = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of items) map.set(item.document_id, item.document_title);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = items.filter(
      (item) =>
        (exam === "all" || String(item.document_id) === exam) &&
        matches(item, needle),
    );
    rows.sort((a, b) => {
      const byDate = itemDate(a).localeCompare(itemDate(b));
      const order = (sort === "newest" ? -byDate : byDate) || a.no - b.no;
      return order;
    });
    return rows;
  }, [items, query, exam, sort]);

  useEffect(() => {
    setSelectedId((current) =>
      filtered.some((item) => item.question_id === current)
        ? current
        : (filtered[0]?.question_id ?? null),
    );
  }, [filtered]);

  const selected =
    filtered.find((item) => item.question_id === selectedId) ?? null;

  const onSaved = useCallback((questionId: number, content: string) => {
    setData((current) => ({
      mistakes:
        current.mistakes?.map((item) =>
          item.question_id === questionId ? mergeSavedAnalysis(item, content) : item,
        ) ?? null,
      starred:
        current.starred?.map((item) =>
          item.question_id === questionId ? mergeSavedAnalysis(item, content) : item,
        ) ?? null,
    }));
  }, []);

  async function toggleStar(item: ReviewItem) {
    const next = !item.starred;
    setError(null);
    setData((current) => {
      const update = (list: ReviewItem[] | null) =>
        list?.map((row) =>
          row.question_id === item.question_id
            ? {
                ...row,
                starred: next,
                starred_at: next ? new Date().toISOString() : null,
              }
            : row,
        ) ?? null;

      let starred = update(current.starred);
      if (!next && starred) {
        starred = starred.filter((row) => row.question_id !== item.question_id);
      } else if (next && starred && !starred.some((row) => row.question_id === item.question_id)) {
        starred = [
          { ...item, starred: true, starred_at: new Date().toISOString() },
          ...starred,
        ];
      }
      return { mistakes: update(current.mistakes), starred };
    });

    try {
      if (next) await api.starQuestion(item.question_id);
      else await api.unstarQuestion(item.question_id);
    } catch (err) {
      setError(errText(err));
      // Re-read both collections so the failed toggle cannot leave a stale row.
      setData({ mistakes: null, starred: null });
      setReloadKey((key) => key + 1);
    }
  }

  const others = selected
    ? selected.analyses.filter(
        (entry) => entry.content.trim() && entry.content !== selected.analysis,
      )
    : [];

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-slate-400">
            {t("Review")}
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
            {t("Review sets")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {t(
              "Your latest wrong answers and the questions you starred, across every attempt. Read or write the analysis here — it is the same notebook as the review workspace.",
            )}
          </p>
        </div>
        <Link to="/" className="text-sm text-blue-700 underline underline-offset-4">
          {t("Pick an exam")}
        </Link>
      </header>

      <div className="mt-4">
        <SlidingTabs
          ariaLabel={t("Review sets")}
          tabs={[
            {
              key: "mistakes",
              label: `${t("Mistakes")}${
                data.mistakes ? ` (${data.mistakes.length})` : ""
              }`,
            },
            {
              key: "starred",
              label: `${t("Starred")}${data.starred ? ` (${data.starred.length})` : ""}`,
            },
          ]}
          activeKey={tab}
          onChange={(key) => setTab(key === "starred" ? "starred" : "mistakes")}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("Search papers, stems and options…")}
          aria-label={t("Search review sets")}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none sm:max-w-sm"
        />
        <select
          value={exam}
          onChange={(event) => setExam(event.target.value)}
          aria-label={t("Filter by exam")}
          className="max-w-[16rem] rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm focus:border-blue-400 focus:outline-none"
        >
          <option value="all">{t("All exams")}</option>
          {exams.map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setSort((current) => (current === "newest" ? "oldest" : "newest"))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          {sort === "newest" ? t("Newest first") : t("Oldest first")}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <span className="min-w-0 flex-1">{error}</span>
          <button
            type="button"
            onClick={() => {
              setData((current) => ({ ...current, [tab]: null }));
              setReloadKey((key) => key + 1);
            }}
            className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium hover:bg-red-100"
          >
            {t("Try again")}
          </button>
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section
          aria-label={
            tab === "mistakes" ? t("Mistakes") : t("Starred questions")
          }
        >
          {loading && data[tab] === null && !error && (
            <p className="rounded-xl border bg-white px-4 py-8 text-center text-sm text-slate-500">
              {tab === "mistakes"
                ? t("Loading mistakes…")
                : t("Loading starred questions…")}
            </p>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-5 py-12 text-center">
              <p className="font-display text-2xl tracking-tight text-slate-700">
                {items.length === 0
                  ? tab === "mistakes"
                    ? t("No mistakes yet.")
                    : t("No starred questions yet.")
                  : t("No questions match.")}
              </p>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                {items.length === 0
                  ? tab === "mistakes"
                    ? t(
                        "Submit an attempt and every wrong answer will collect here.",
                      )
                    : t(
                        "Tap ☆ Star while practising or reviewing to build this set.",
                      )
                  : t("Try a different search or exam filter.")}
              </p>
            </div>
          )}

          {filtered.length > 0 && (
            <ul className="max-h-[70dvh] divide-y divide-slate-100 overflow-y-auto rounded-xl border bg-white shadow-sm">
              {filtered.map((item) => (
                <ReviewRow
                  key={item.question_id}
                  item={item}
                  selected={item.question_id === selectedId}
                  onSelect={() => setSelectedId(item.question_id)}
                  onToggleStar={() => void toggleStar(item)}
                />
              ))}
            </ul>
          )}
        </section>

        <aside className="min-w-0">
          {selected ? (
            <div className="overflow-hidden rounded-xl border bg-white shadow-sm lg:sticky lg:top-4">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-slate-200 px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                  {selected.document_title}
                </span>
                {selected.subject && <SubjectBadge subject={selected.subject} />}
                {selected.session_id !== null && (
                  <Link
                    to={`/session/${selected.session_id}/result`}
                    className="text-xs text-blue-700 underline underline-offset-4"
                  >
                    {t("Open attempt")}
                  </Link>
                )}
                <Link
                  to={`/doc/${selected.document_id}/practice`}
                  className="text-xs text-slate-500 underline underline-offset-4"
                >
                  {t("Practice")}
                </Link>
              </div>

              {selected.material && (
                <div className="max-h-44 overflow-y-auto border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <RichText text={selected.material} docId={selected.document_id} />
                </div>
              )}

              <div className="h-[34rem] min-h-0">
                <AnalysisEditor
                  docId={selected.document_id}
                  item={selected as ResultItem}
                  content={selected.analysis}
                  onSaved={onSaved}
                />
              </div>

              {others.length > 0 && (
                <div className="max-h-52 overflow-y-auto border-t border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {t("Earlier analyses")}
                  </p>
                  <div className="mt-2 space-y-2">
                    {others.map((entry, index) => (
                      <article
                        key={`${entry.source}-${index}`}
                        className="rounded-lg border bg-white px-3 py-2 text-sm"
                      >
                        <p className="text-[10px] uppercase tracking-wide text-slate-400">
                          {entry.source === "legacy"
                            ? t("Legacy analysis")
                            : t("Saved analysis")}
                          {entry.updated_at
                            ? ` · ${formatWhen(entry.updated_at, locale)}`
                            : ""}
                        </p>
                        <div className="mt-1">
                          <RichText text={entry.content} docId={selected.document_id} breaks />
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid min-h-[24rem] place-items-center rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 text-center">
              <div>
                <p className="font-display text-xl tracking-tight text-slate-600">
                  {t("Pick a question")}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {t("Its question, answers and analysis will open here.")}
                </p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
