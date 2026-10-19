/**
 * Section label helpers.
 *
 * `sec` is a free-form token on the backend (InteFlow is not SAT-only). A few
 * well-known tokens get a friendly display name; anything else renders as-is.
 * Keep in sync with `backend/app/sections.py`.
 */
const KNOWN_LABELS: Record<string, string> = {
  rw: "Reading & Writing",
  math: "Math",
  general: "General",
};

export function sectionLabel(sec: string | null | undefined): string {
  if (!sec) return "";
  return KNOWN_LABELS[sec] ?? sec;
}
