import { useEffect, useRef } from "react";
import type { ResultItem } from "../../api/client";
import { ChevronDownIcon, CloseIcon } from "./icons";

export type Filter = "all" | "correct" | "wrong";

function statusOf(item: ResultItem): "correct" | "wrong" | "ungraded" {
  return item.is_correct === true ? "correct" : item.is_correct === false ? "wrong" : "ungraded";
}

interface Props {
  items: ResultItem[];
  visible: ResultItem[];
  filter: Filter;
  counts: Record<Filter, number>;
  selectedId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFilter: (filter: Filter) => void;
  onSelect: (questionId: number) => void;
}

const TABS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "wrong", label: "Wrong" },
  { key: "correct", label: "Correct" },
];

/**
 * Floating question navigator.
 *
 * Collapsed it is a small pill in the top-left corner; clicking it rotates the
 * chevron and unfolds the whole question list as an overlay, so the question
 * pane underneath never gets squeezed. The overlay closes on Escape, on a
 * click outside, or as soon as a question is picked.
 */
export default function QuestionNav({
  items,
  visible,
  filter,
  counts,
  selectedId,
  open,
  onOpenChange,
  onFilter,
  onSelect,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const current = items.find((i) => i.question_id === selectedId) ?? null;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <div className="relative z-40" data-testid="question-nav">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-controls="question-nav-panel"
        title={open ? "Hide question list" : "Show question list"}
        className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white/95 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:bg-white"
      >
        <ChevronDownIcon
          size={16}
          className={`transition-transform duration-200 ${open ? "rotate-180" : "-rotate-90"}`}
        />
        <span>Questions</span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium tabular-nums text-slate-500">
          {current ? `${current.no}/${items.length}` : items.length}
        </span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close question list"
            tabIndex={-1}
            onClick={() => onOpenChange(false)}
            className="scrim fixed inset-0 z-30 cursor-default opacity-60"
          />
          <div
            id="question-nav-panel"
            ref={panelRef}
            data-testid="question-nav-panel"
            className="absolute left-0 top-full z-40 mt-2 w-[min(20rem,80vw)] rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Jump to question
              </span>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close question list"
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <CloseIcon size={14} />
              </button>
            </div>

            <div className="flex gap-0.5 rounded-lg bg-slate-100 p-0.5" role="tablist">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={filter === tab.key}
                  onClick={() => onFilter(tab.key)}
                  title={`${tab.label} (${counts[tab.key]})`}
                  className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition ${
                    filter === tab.key
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab.label}
                  <span className="ml-1 tabular-nums text-slate-400">{counts[tab.key]}</span>
                </button>
              ))}
            </div>

            <div className="mt-3 max-h-[55vh] overflow-y-auto">
              {visible.length === 0 ? (
                <p className="px-1 py-3 text-xs text-slate-400">
                  {filter === "wrong" ? "Nothing wrong here — nice work." : "Nothing to show."}
                </p>
              ) : (
                <div className="grid grid-cols-6 gap-1.5">
                  {visible.map((item) => {
                    const status = statusOf(item);
                    return (
                      <button
                        key={item.question_id}
                        data-no={item.no}
                        data-status={status}
                        aria-label={`Question ${item.no} — ${
                          status === "ungraded" ? "no answer key" : status
                        }`}
                        aria-current={selectedId === item.question_id ? "true" : undefined}
                        title={`Question ${item.no}`}
                        onClick={() => {
                          onSelect(item.question_id);
                          onOpenChange(false);
                        }}
                        className={
                          "aspect-square rounded-md border text-sm font-medium transition-colors " +
                          (status === "correct"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                            : status === "wrong"
                              ? "border-red-300 bg-red-50 text-red-800 hover:bg-red-100"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100") +
                          (selectedId === item.question_id ? " ring-2 ring-blue-500" : "")
                        }
                      >
                        {item.no}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
