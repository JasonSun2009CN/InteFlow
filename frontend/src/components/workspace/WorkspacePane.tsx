import type { ReactNode } from "react";
import { BookOpen, FileQuestion, NotebookPen, Sparkles, type LucideIcon } from "lucide-react";
import type { WorkspaceTool } from "./usePersistentLayout";
import { useT } from "../../lib/i18n";

export const TOOLS: { id: WorkspaceTool; label: string; Icon: LucideIcon }[] = [
  { id: "question", label: "Question", Icon: FileQuestion },
  { id: "analysis", label: "Analysis", Icon: NotebookPen },
  { id: "ai", label: "AI Tutor", Icon: Sparkles },
  { id: "vocabulary", label: "Vocabulary", Icon: BookOpen },
];

export function toolLabel(
  tool: WorkspaceTool,
  t: (source: string, vars?: Record<string, string | number>) => string = (source) =>
    source,
): string {
  return t(TOOLS.find((entry) => entry.id === tool)?.label ?? tool);
}

interface Props {
  side: "left" | "right";
  tool: WorkspaceTool;
  /** The tool currently occupying the opposite pane; choosing it swaps sides. */
  otherTool?: WorkspaceTool;
  onChoose: (tool: WorkspaceTool) => void;
  children: ReactNode;
}

/**
 * One half of the workspace split. The header switcher shows all four peer
 * tools as icon buttons in a row; the active one is highlighted. Selecting the
 * tool that is currently in the opposite pane is handled by the parent, which
 * swaps the two sides.
 */
export default function WorkspacePane({ side, tool, otherTool, onChoose, children }: Props) {
  const t = useT();
  return (
    <section
      data-testid={`${side}-pane`}
      data-tool={tool}
      aria-label={t("{tool} pane", { tool: toolLabel(tool, t) })}
      className="flex h-full min-h-0 min-w-0 flex-col bg-white"
    >
      <div
        role="group"
        aria-label={t("Switch {side} pane", {
          side: side === "left" ? t("left") : t("right"),
        })}
        className="flex shrink-0 items-center gap-1 border-b border-slate-200 bg-slate-50 px-1.5 py-1"
      >
        {TOOLS.map(({ id, label, Icon }) => {
          const active = id === tool;
          const elsewhere = id === otherTool;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChoose(id)}
              aria-pressed={active}
              title={
                elsewhere
                  ? t("{tool} is on the other side — click to swap panes", {
                      tool: t(label),
                    })
                  : t(label)
              }
              className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors ${
                active
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                  : elsewhere
                    ? "text-slate-500 hover:bg-white hover:text-slate-800"
                    : "text-slate-400 hover:bg-white hover:text-slate-700"
              }`}
            >
              <Icon size={14} aria-hidden="true" focusable="false" className="shrink-0" />
              <span className="truncate">{t(label)}</span>
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
