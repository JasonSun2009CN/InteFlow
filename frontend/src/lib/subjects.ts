import type { SubjectColor } from "../api/client";

/** Palette shared with the backend (`repos/subjects.py`). Keep class strings
 * literal so Tailwind can see them. */
export const SUBJECT_COLORS: {
  id: SubjectColor;
  label: string;
  dot: string;
  chip: string;
  ring: string;
}[] = [
  {
    id: "blue",
    label: "Blue",
    dot: "bg-blue-500",
    chip: "border-blue-200 bg-blue-50 text-blue-700",
    ring: "ring-blue-400",
  },
  {
    id: "emerald",
    label: "Green",
    dot: "bg-emerald-500",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-700",
    ring: "ring-emerald-400",
  },
  {
    id: "amber",
    label: "Amber",
    dot: "bg-amber-500",
    chip: "border-amber-200 bg-amber-50 text-amber-800",
    ring: "ring-amber-400",
  },
  {
    id: "rose",
    label: "Rose",
    dot: "bg-rose-500",
    chip: "border-rose-200 bg-rose-50 text-rose-700",
    ring: "ring-rose-400",
  },
  {
    id: "violet",
    label: "Violet",
    dot: "bg-violet-500",
    chip: "border-violet-200 bg-violet-50 text-violet-700",
    ring: "ring-violet-400",
  },
  {
    id: "cyan",
    label: "Cyan",
    dot: "bg-cyan-500",
    chip: "border-cyan-200 bg-cyan-50 text-cyan-700",
    ring: "ring-cyan-400",
  },
  {
    id: "lime",
    label: "Lime",
    dot: "bg-lime-500",
    chip: "border-lime-200 bg-lime-50 text-lime-700",
    ring: "ring-lime-400",
  },
  {
    id: "slate",
    label: "Slate",
    dot: "bg-slate-500",
    chip: "border-slate-200 bg-slate-50 text-slate-600",
    ring: "ring-slate-400",
  },
];

export function subjectTone(color: SubjectColor | string | null | undefined) {
  return SUBJECT_COLORS.find((item) => item.id === color) ?? SUBJECT_COLORS[0];
}

/** Filter state shared by Library and Exams: all / one subject / no subject. */
export type SubjectFilterValue = "all" | "none" | number;
