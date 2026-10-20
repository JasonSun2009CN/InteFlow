import type { ReactNode } from "react";
import type { WorkspaceTool } from "./usePersistentLayout";

export const TOOLS: { id: WorkspaceTool; label: string }[] = [
  { id: "question", label: "Question" },
  { id: "analysis", label: "Analysis" },
  { id: "ai", label: "AI Tutor" },
  { id: "vocabulary", label: "Vocabulary" },
];

export function toolLabel(tool: WorkspaceTool): string {
  return TOOLS.find((entry) => entry.id === tool)?.label ?? tool;
}

interface Props {
  side: "left" | "right";
  tool: WorkspaceTool;
  onChoose: (tool: WorkspaceTool) => void;
  children: ReactNode;
}

/**
 * One half of the workspace split. The header switcher only offers the other
 * three tools; selecting the tool that is currently in the opposite pane is
 * handled by the parent, which swaps the two sides.
 */
export default function WorkspacePane({ side, tool, onChoose, children }: Props) {
  const others = TOOLS.filter((entry) => entry.id !== tool);
  return (
    <section
      data-testid={`${side}-pane`}
      data-tool={tool}
      aria-label={`${toolLabel(tool)} pane`}
      className="flex h-full min-h-0 min-w-0 flex-col bg-white"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-slate-50 px-2.5 py-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {toolLabel(tool)}
        </span>
        <label className="ml-auto flex items-center gap-1 text-[11px] text-slate-400">
          <span className="sr-only">Switch {side} pane</span>
          <select
            aria-label={`Switch ${side} pane`}
            value=""
            onChange={(event) => {
              const next = event.target.value as WorkspaceTool;
              if (next) onChoose(next);
              event.target.value = "";
            }}
            className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] text-slate-600 focus:border-blue-400 focus:outline-none"
          >
            <option value="">Switch…</option>
            {others.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
