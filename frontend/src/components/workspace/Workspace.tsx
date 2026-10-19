import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  ApiError,
  type AnalysisPage,
  type ResultItem,
  type SessionDetail,
  type SubmitResult,
} from "../../api/client";
import RichText from "../RichText";
import { buttonClasses } from "../ui";
import AnalysisEditor from "./AnalysisEditor";
import NotebookPreview from "./NotebookPreview";
import QuestionNav, { type Filter } from "./QuestionNav";
import Splitter from "./Splitter";
import StudyDrawer from "./StudyDrawer";
import { MenuIcon } from "./icons";
import { useMediaQuery } from "./useMediaQuery";
import { useWorkspaceLayout } from "./usePersistentLayout";
import { sectionLabel } from "../../lib/sections";

const QUESTION_MIN = 24;
const QUESTION_MAX = 68;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function optionLetter(option: string): string {
  const m = /^([A-Z])[.)]/.exec(option.trim());
  return m ? m[1] : "?";
}

function clock(total: number): string {
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function elapsed(detail: SessionDetail, t: number): number | null {
  if (t > 0) return t;
  if (!detail.started_at || !detail.finished_at) return null;
  const start = Date.parse(detail.started_at.replace(" ", "T") + "Z");
  const end = Date.parse(detail.finished_at.replace(" ", "T") + "Z");
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.max(0, Math.round((end - start) / 1000));
}

function answerText(item: ResultItem, values: string[]): string {
  if (values.length === 0) return "—";
  return item.kind === "blank" ? values.join(" | ") : values.join(", ");
}

interface Props {
  detail: SessionDetail;
  result: SubmitResult;
  t: number;
  sessionId: number;
}

/**
 * Review workspace: the question on the left, a Pages-style analysis notebook
 * on the right.
 *
 * Every question owns exactly one analysis page, so selecting a question swaps
 * both panes together. The question list is a floating overlay in the top-left
 * corner (collapsed by default) and never squeezes the reading area; the AI
 * tutor, vocabulary grid and exports live in the study drawer.
 */
export default function Workspace({ detail, result, t, sessionId }: Props) {
  const docId = detail.document_id;
  const [layout, setLayout] = useWorkspaceLayout(docId);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<"question" | "analysis">("question");
  const [pages, setPages] = useState<Record<number, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const matchesFilter = (i: ResultItem) =>
    filter === "all" ? true : filter === "correct" ? i.is_correct === true : i.is_correct === false;

  // Load the notebook once per exam; it is the source of truth for page text.
  useEffect(() => {
    let cancelled = false;
    api
      .getAnalysis(docId)
      .then((notebook) => {
        if (cancelled) return;
        const loaded = Object.fromEntries(
          notebook.pages.map((page: AnalysisPage) => [page.question_id, page.content]),
        );
        // Pages saved while the notebook was still loading win over the snapshot.
        setPages((prev) => ({ ...loaded, ...prev }));
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof ApiError ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [docId]);

  useEffect(() => {
    const ids = result.items.filter(matchesFilter).map((i) => i.question_id);
    setSelectedId((prev) => (prev !== null && ids.includes(prev) ? prev : (ids[0] ?? null)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, filter]);

  // keyboard ← / → navigation (ignored while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      const ids = result.items.filter(matchesFilter).map((i) => i.question_id);
      const idx = selectedId === null ? -1 : ids.indexOf(selectedId);
      const target = e.key === "ArrowLeft" ? idx - 1 : idx + 1;
      if (target >= 0 && target < ids.length) {
        e.preventDefault();
        setSelectedId(ids[target]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // re-register each render so the closure sees fresh filter/selection

  const visibleItems = result.items.filter(matchesFilter);
  const selected = result.items.find((i) => i.question_id === selectedId) ?? null;
  const vIdx = visibleItems.findIndex((i) => i.question_id === selectedId);
  const prevQ = vIdx > 0 ? visibleItems[vIdx - 1] : null;
  const nextQ = vIdx >= 0 && vIdx < visibleItems.length - 1 ? visibleItems[vIdx + 1] : null;

  const wrong = result.items.filter((i) => i.is_correct === false).length;
  const correct = result.items.filter((i) => i.is_correct === true).length;
  const pct = result.graded ? Math.round((correct / result.graded) * 100) : 0;
  const secs = elapsed(detail, t);

  const counts: Record<Filter, number> = { all: result.items.length, correct, wrong };

  const onSaved = useCallback((questionId: number, content: string) => {
    setPages((prev) => ({ ...prev, [questionId]: content }));
  }, []);

  const questionPane = selected ? (
    <article className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={
            "grid h-6 w-6 place-items-center rounded-full text-xs font-semibold text-white " +
            (selected.is_correct === true
              ? "bg-emerald-600"
              : selected.is_correct === false
                ? "bg-red-500"
                : "bg-slate-400")
          }
        >
          {selected.is_correct === true ? "✓" : selected.is_correct === false ? "✗" : "–"}
        </span>
        <span className="font-semibold">Question {selected.no}</span>
        <span className="text-sm text-slate-500">
          {sectionLabel(selected.sec)}
          {selected.source ? ` · ${selected.source}` : ""}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => prevQ && setSelectedId(prevQ.question_id)}
            disabled={!prevQ}
            aria-label="Previous question"
            className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-40"
          >
            ←
          </button>
          <span className="text-xs text-slate-400">
            {vIdx >= 0 ? vIdx + 1 : 0} / {visibleItems.length}
          </span>
          <button
            onClick={() => nextQ && setSelectedId(nextQ.question_id)}
            disabled={!nextQ}
            aria-label="Next question"
            className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-40"
          >
            →
          </button>
        </div>
      </div>

      {selected.material && (
        <div className="mt-3 rounded-lg border bg-slate-50 p-3 text-sm">
          <RichText text={selected.material} docId={docId} />
        </div>
      )}
      <div className="mt-3 text-[15px]">
        <RichText text={selected.stem} docId={docId} />
      </div>

      {selected.kind === "blank" ? (
        <dl className="mt-4 space-y-1.5 rounded-lg border border-slate-200 p-3 text-sm">
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-slate-500">Correct</dt>
            <dd className="font-medium text-emerald-700">
              {answerText(selected, selected.answers)}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-slate-500">Your answer</dt>
            <dd
              className={
                "font-medium " +
                (selected.is_correct === false ? "text-red-600" : "text-slate-800")
              }
            >
              {answerText(selected, selected.chosen_answers)}
            </dd>
          </div>
        </dl>
      ) : (
        <ul className="mt-3 space-y-2">
          {selected.options.map((option) => {
            const letter = optionLetter(option);
            const isAnswer = selected.answers.includes(letter);
            const isChosen = selected.chosen_answers.includes(letter);
            const tone = isAnswer
              ? "border-emerald-500 bg-emerald-50"
              : isChosen
                ? "border-red-400 bg-red-50"
                : "border-slate-200";
            return (
              <li
                key={letter}
                className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-sm ${tone}`}
              >
                <span className="font-semibold">{letter}</span>
                <span className="flex-1">
                  <RichText text={option.replace(/^[A-Z][.)]\s*/, "")} docId={docId} />
                </span>
                {isChosen && (
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
                      isAnswer ? "bg-emerald-600 text-white" : "bg-red-500 text-white"
                    }`}
                  >
                    your answer
                  </span>
                )}
                {isAnswer && !isChosen && (
                  <span className="shrink-0 rounded bg-emerald-600 px-1.5 py-0.5 text-xs font-medium text-white">
                    correct
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {selected.answers.length === 0 && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No answer key for this question — fill it in on the{" "}
          <Link to={`/doc/${docId}/answers`} className="underline">
            answer page
          </Link>
          .
        </p>
      )}
    </article>
  ) : (
    <p className="rounded-xl border bg-white p-6 text-center text-sm text-slate-500">
      {filter === "wrong" ? "Nothing wrong here — nice work." : "No questions to show."}
    </p>
  );

  const analysisPane = (
    <AnalysisEditor
      docId={docId}
      item={selected}
      content={selected ? (pages[selected.question_id] ?? "") : ""}
      onSaved={onSaved}
    />
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-100">
      {/* ---- top bar -------------------------------------------------------- */}
      <header className="flex shrink-0 items-center gap-3 border-b bg-white px-3 py-2">
        {isDesktop ? (
          <QuestionNav
            items={result.items}
            visible={visibleItems}
            filter={filter}
            counts={counts}
            selectedId={selectedId}
            open={navOpen}
            onOpenChange={setNavOpen}
            onFilter={setFilter}
            onSelect={setSelectedId}
          />
        ) : (
          <button
            onClick={() => setNavOpen(true)}
            aria-label="Open question list"
            className="rounded-lg border p-1.5 text-slate-600 hover:bg-slate-100"
          >
            <MenuIcon />
          </button>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold">{detail.document.title}</h1>
          <p className="truncate text-xs text-slate-500">
            {secs !== null && `${clock(secs)} · `}
            {result.total} questions · {result.graded} graded
          </p>
        </div>

        <div className="hidden text-right sm:block">
          <div className="text-lg font-bold tracking-tight">
            {correct} <span className="text-slate-400">/ {result.graded}</span>
          </div>
          <div className="text-xs text-slate-500">
            {result.graded ? `${pct}%` : "not graded"} · {wrong} wrong
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setNotebookOpen(true)}
            className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
          >
            Notebook
          </button>
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
          >
            Study tools
          </button>
          <Link
            to={`/doc/${docId}/practice`}
            className={buttonClasses({
              size: "sm",
              className: "hidden sm:inline-flex",
            })}
          >
            Practice again
          </Link>
          <Link
            to="/sessions"
            className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
          >
            Back
          </Link>
        </div>
      </header>

      {loadError && (
        <p className="shrink-0 border-b border-amber-300 bg-amber-50 px-4 py-1.5 text-xs text-amber-900">
          Could not load the analysis notebook: {loadError}
        </p>
      )}

      {/* ---- split: question | analysis page -------------------------------- */}
      {isDesktop ? (
        <div className="flex min-h-0 flex-1">
          <div
            data-testid="question-pane"
            className="min-h-0 min-w-0 overflow-y-auto p-4"
            style={{ width: `${layout.questionWidth}%` }}
          >
            {questionPane}
          </div>
          <Splitter
            orientation="vertical"
            label="Resize question and analysis panes"
            onResize={(delta) =>
              setLayout((l) => ({
                ...l,
                questionWidth: clamp(
                  l.questionWidth + (delta / Math.max(window.innerWidth, 1)) * 100,
                  QUESTION_MIN,
                  QUESTION_MAX,
                ),
              }))
            }
            onReset={() => setLayout((l) => ({ ...l, questionWidth: 42 }))}
          />
          <div data-testid="analysis-pane" className="min-h-0 min-w-0 flex-1 border-l bg-white">
            {analysisPane}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 gap-1 border-b bg-white px-2 py-1.5">
            {(["question", "analysis"] as const).map((pane) => (
              <button
                key={pane}
                onClick={() => setMobilePane(pane)}
                aria-pressed={mobilePane === pane}
                className={`flex-1 rounded-md px-2 py-1 text-xs font-medium capitalize ${
                  mobilePane === pane
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {pane}
              </button>
            ))}
          </div>
          {mobilePane === "question" ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-3">{questionPane}</div>
          ) : (
            <div className="min-h-0 flex-1">{analysisPane}</div>
          )}
        </div>
      )}

      {!isDesktop && navOpen && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          <button
            aria-label="Close"
            onClick={() => setNavOpen(false)}
            className="absolute inset-0 scrim"
          />
          <div className="relative z-10 mr-auto flex h-full w-[min(20rem,85vw)] flex-col bg-white p-3 shadow-xl">
            <QuestionNav
              items={result.items}
              visible={visibleItems}
              filter={filter}
              counts={counts}
              selectedId={selectedId}
              open
              onOpenChange={(open) => !open && setNavOpen(false)}
              onFilter={setFilter}
              onSelect={(qid) => {
                setSelectedId(qid);
                setNavOpen(false);
                setMobilePane("question");
              }}
            />
          </div>
        </div>
      )}

      {drawerOpen && (
        <StudyDrawer
          docId={docId}
          item={selected}
          sessionId={sessionId}
          tab={layout.drawerTab}
          onTab={(tab) => setLayout((l) => ({ ...l, drawerTab: tab }))}
          onClose={() => setDrawerOpen(false)}
        />
      )}

      {notebookOpen && (
        <NotebookPreview
          docId={docId}
          title={detail.document.title}
          items={result.items}
          pages={pages}
          sessionId={sessionId}
          onClose={() => setNotebookOpen(false)}
        />
      )}
    </div>
  );
}
