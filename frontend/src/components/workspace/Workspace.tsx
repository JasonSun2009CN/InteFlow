import { useCallback, useEffect, useState, type DragEvent } from "react";
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
import AiTutorPane from "./AiTutorPane";
import AnalysisEditor from "./AnalysisEditor";
import ExportDrawer from "./ExportDrawer";
import NotebookPreview from "./NotebookPreview";
import QuestionNav, { type Filter } from "./QuestionNav";
import Splitter from "./Splitter";
import VocabularyPane, { WORD_MIME } from "./VocabularyPane";
import WorkspacePane, { toolLabel } from "./WorkspacePane";
import { MenuIcon } from "./icons";
import { useMediaQuery } from "./useMediaQuery";
import { useWorkspaceLayout, type WorkspaceTool } from "./usePersistentLayout";
import { sectionLabel } from "../../lib/sections";

const PANE_MIN = 22;
const PANE_MAX = 78;
const DEFAULT_SPLIT = 42;

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
 * Review workspace: a 2-of-4 split.
 *
 * Question, Analysis, AI Tutor and Vocabulary are peers. Each side can switch
 * to any of the other three; choosing the tool already shown on the opposite
 * side swaps the two panes. The default is Question | Analysis. The question
 * list stays a floating overlay, and exports live in the top bar so they never
 * compete with the reading surface.
 */
export default function Workspace({ detail, result, t, sessionId }: Props) {
  const docId = detail.document_id;
  const [layout, setLayout] = useWorkspaceLayout(docId);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [mobileSide, setMobileSide] = useState<0 | 1>(0);
  const [pages, setPages] = useState<Record<number, string>>({});
  const [notebookLoaded, setNotebookLoaded] = useState(false);
  const [starred, setStarred] = useState<Set<number>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [starError, setStarError] = useState<string | null>(null);

  const isDesktop = useMediaQuery("(min-width: 1024px)");

  // Stored layouts can be stale (older release / hand-edited localStorage):
  // fall back to the default pair instead of rendering an invalid tool.
  const validTool = (tool: WorkspaceTool) =>
    tool === "question" || tool === "analysis" || tool === "ai" || tool === "vocabulary";
  const leftTool: WorkspaceTool = validTool(layout.leftTool) ? layout.leftTool : "question";
  const rightTool: WorkspaceTool =
    validTool(layout.rightTool) && layout.rightTool !== leftTool
      ? layout.rightTool
      : leftTool === "analysis"
        ? "question"
        : "analysis";
  const split = clamp(layout.split, PANE_MIN, PANE_MAX);

  function chooseTool(side: "left" | "right", tool: WorkspaceTool) {
    if (side === "left") {
      setLayout((current) =>
        rightTool === tool
          ? { ...current, leftTool: tool, rightTool: current.leftTool }
          : { ...current, leftTool: tool },
      );
    } else {
      setLayout((current) =>
        leftTool === tool
          ? { ...current, leftTool: current.rightTool, rightTool: tool }
          : { ...current, rightTool: tool },
      );
    }
  }

  /** Native text selection → custom drag payload for the vocabulary pane. */
  function startWordDrag(event: DragEvent<HTMLDivElement>) {
    const selection = window.getSelection()?.toString().trim();
    if (!selection) return;
    event.dataTransfer.setData(WORD_MIME, selection);
    event.dataTransfer.setData("text/plain", selection);
    event.dataTransfer.effectAllowed = "copy";
  }

  const matchesFilter = (i: ResultItem) =>
    filter === "all" ? true : filter === "correct" ? i.is_correct === true : i.is_correct === false;

  // Load the notebook once per exam; it is the source of truth for page text.
  useEffect(() => {
    let cancelled = false;
    setNotebookLoaded(false);
    api
      .getAnalysis(docId)
      .then((notebook) => {
        if (cancelled) return;
        const loaded = Object.fromEntries(
          notebook.pages.map((page: AnalysisPage) => [page.question_id, page.content]),
        );
        // Pages saved while the notebook was still loading win over the snapshot.
        setPages((prev) => ({ ...loaded, ...prev }));
        setNotebookLoaded(true);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof ApiError ? err.message : String(err));
          setNotebookLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [docId]);

  useEffect(() => {
    let cancelled = false;
    api
      .listStarredIds(docId)
      .then(({ question_ids }) => {
        if (!cancelled) setStarred(new Set(question_ids));
      })
      .catch(() => {
        /* stars are optional furniture in the workspace */
      });
    return () => {
      cancelled = true;
    };
  }, [docId]);

  async function toggleStar(questionId: number) {
    const wasStarred = starred.has(questionId);
    setStarError(null);
    setStarred((current) => {
      const next = new Set(current);
      if (wasStarred) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
    try {
      if (wasStarred) await api.unstarQuestion(questionId);
      else await api.starQuestion(questionId);
    } catch (err) {
      setStarred((current) => {
        const next = new Set(current);
        if (wasStarred) next.add(questionId);
        else next.delete(questionId);
        return next;
      });
      setStarError(err instanceof ApiError ? err.message : String(err));
    }
  }

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
            type="button"
            onClick={() => void toggleStar(selected.question_id)}
            aria-pressed={starred.has(selected.question_id)}
            className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
              starred.has(selected.question_id)
                ? "border-amber-300 bg-amber-100 text-amber-800"
                : "border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {starred.has(selected.question_id) ? "★ Starred" : "☆ Star"}
          </button>
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
      loaded={notebookLoaded}
    />
  );

  function renderTool(tool: WorkspaceTool) {
    switch (tool) {
      case "question":
        return (
          <div
            className="h-full min-h-0 overflow-y-auto p-4"
            onDragStart={startWordDrag}
            title="Select a word, then drag it onto the Vocabulary pane"
          >
            {(leftTool === "vocabulary" || rightTool === "vocabulary") && (
              <p className="mb-3 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-3 py-1.5 text-xs text-blue-700">
                Select a word here, then drag it onto the Vocabulary pane — the
                Merriam-Webster sense that fits the sentence is added.
              </p>
            )}
            {questionPane}
          </div>
        );
      case "analysis":
        return <div className="h-full min-h-0">{analysisPane}</div>;
      case "ai":
        return <AiTutorPane docId={docId} item={selected} sessionId={sessionId} />;
      case "vocabulary":
        return <VocabularyPane docId={docId} item={selected} />;
    }
  }

  const mobileTools: WorkspaceTool[] = [leftTool, rightTool];

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
            onClick={() => setExportOpen(true)}
            className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
          >
            Export
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
      {starError && (
        <p className="shrink-0 border-b border-amber-300 bg-amber-50 px-4 py-1.5 text-xs text-amber-900">
          Could not update the star: {starError}
        </p>
      )}

      {/* ---- 2-of-4 split: any two of question / analysis / AI / vocabulary -- */}
      {isDesktop ? (
        <div className="flex min-h-0 flex-1">
          <div className="min-h-0 min-w-0" style={{ width: `${split}%` }}>
            <WorkspacePane
              side="left"
              tool={leftTool}
              onChoose={(tool) => chooseTool("left", tool)}
            >
              {renderTool(leftTool)}
            </WorkspacePane>
          </div>
          <Splitter
            orientation="vertical"
            label="Resize workspace panes"
            onResize={(delta) =>
              setLayout((l) => ({
                ...l,
                split: clamp(
                  l.split + (delta / Math.max(window.innerWidth, 1)) * 100,
                  PANE_MIN,
                  PANE_MAX,
                ),
              }))
            }
            onReset={() => setLayout((l) => ({ ...l, split: DEFAULT_SPLIT }))}
          />
          <div className="min-h-0 min-w-0 flex-1">
            <WorkspacePane
              side="right"
              tool={rightTool}
              onChoose={(tool) => chooseTool("right", tool)}
            >
              {renderTool(rightTool)}
            </WorkspacePane>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 gap-1 border-b bg-white px-2 py-1.5">
            {mobileTools.map((tool, index) => (
              <button
                key={`${index}-${tool}`}
                onClick={() => setMobileSide(index as 0 | 1)}
                aria-pressed={mobileSide === index}
                className={`flex-1 rounded-md px-2 py-1 text-xs font-medium ${
                  mobileSide === index
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {toolLabel(tool)}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            <WorkspacePane
              side={mobileSide === 0 ? "left" : "right"}
              tool={mobileTools[mobileSide]}
              onChoose={(tool) => chooseTool(mobileSide === 0 ? "left" : "right", tool)}
            >
              {renderTool(mobileTools[mobileSide])}
            </WorkspacePane>
          </div>
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
                setMobileSide(0);
              }}
            />
          </div>
        </div>
      )}

      {exportOpen && (
        <ExportDrawer
          docId={docId}
          sessionId={sessionId}
          onClose={() => setExportOpen(false)}
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
