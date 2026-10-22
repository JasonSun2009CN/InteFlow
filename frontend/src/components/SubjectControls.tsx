import { useEffect, useState, type FormEvent } from "react";
import {
  api,
  ApiError,
  type Subject,
  type SubjectColor,
  type SubjectRef,
} from "../api/client";
import {
  SUBJECT_COLORS,
  subjectTone,
  type SubjectFilterValue,
} from "../lib/subjects";
import { useT } from "../lib/i18n";

function errText(err: unknown): string {
  return err instanceof ApiError ? err.message : String(err);
}

function nextColor(subjects: Subject[]): SubjectColor {
  return SUBJECT_COLORS[subjects.length % SUBJECT_COLORS.length].id;
}

/** Small colored dot used by badges and pickers. */
export function SubjectDot({
  color,
  className = "",
}: {
  color: SubjectColor | string | null | undefined;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${subjectTone(color).dot} ${className}`}
    />
  );
}

export function SubjectBadge({
  subject,
  showEmpty = false,
  className = "",
}: {
  subject: SubjectRef | null;
  showEmpty?: boolean;
  className?: string;
}) {
  const t = useT();
  if (!subject) {
    return showEmpty ? (
      <span className={`text-[11px] text-slate-400 ${className}`}>{t("No subject")}</span>
    ) : null;
  }
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${subjectTone(subject.color).chip} ${className}`}
    >
      <SubjectDot color={subject.color} />
      <span className="truncate">{subject.name}</span>
    </span>
  );
}

function ColorSwatches({
  value,
  onChange,
  disabled = false,
}: {
  value: SubjectColor;
  onChange: (color: SubjectColor) => void;
  disabled?: boolean;
}) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("Subject color")}>
      {SUBJECT_COLORS.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            aria-label={t("Color {name}", { name: option.label })}
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(option.id)}
            className={`h-5 w-5 rounded-full ring-offset-2 transition ${option.dot} ${
              active ? `ring-2 ${option.ring}` : "hover:scale-110"
            } disabled:opacity-40`}
          />
        );
      })}
    </div>
  );
}

interface SubjectPickerProps {
  docId: number;
  /** Used in the accessible label, e.g. "Subject for October Review". */
  title?: string;
  subjects: Subject[];
  value: SubjectRef | null;
  onChange: (subject: SubjectRef | null) => void;
  onSubjectsChanged: () => void;
  className?: string;
}

/**
 * Inline subject assignment for one paper. Creating a subject from the picker
 * also assigns it to the current paper, so categorizing never needs a detour.
 */
export function SubjectPicker({
  docId,
  title,
  subjects,
  value,
  onChange,
  onSubjectsChanged,
  className = "",
}: SubjectPickerProps) {
  const t = useT();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<SubjectColor>(() => nextColor(subjects));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function assign(subjectId: number | null) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.setDocumentSubject(docId, subjectId);
      onChange(updated.subject);
      onSubjectsChanged();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  function onSelect(raw: string) {
    setError(null);
    if (raw === "__new__") {
      setColor(nextColor(subjects));
      setName("");
      setCreating(true);
      return;
    }
    setCreating(false);
    if (raw === "") {
      void assign(null);
      return;
    }
    void assign(Number(raw));
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    const cleaned = name.trim();
    if (!cleaned || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.createSubject(cleaned, color);
      const updated = await api.setDocumentSubject(docId, created.id);
      onChange(updated.subject);
      onSubjectsChanged();
      setCreating(false);
      setName("");
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`min-w-0 ${className}`}>
      <div className="flex min-w-0 items-center gap-1.5">
        <SubjectDot color={value?.color} />
        <select
          value={value?.id ?? ""}
          onChange={(event) => onSelect(event.target.value)}
          disabled={busy}
          aria-label={
            title ? t("Subject for {title}", { title }) : t("Subject")
          }
          className="min-w-0 max-w-[15rem] truncate rounded-md border border-transparent bg-transparent py-0.5 pl-0.5 pr-1 text-xs text-slate-600 hover:border-slate-300 focus:border-blue-400 focus:outline-none disabled:opacity-50"
        >
          <option value="">{t("No subject")}</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
          <option value="__new__">{t("+ New subject…")}</option>
        </select>
      </div>

      {creating && (
        <form
          onSubmit={(event) => void create(event)}
          className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border bg-slate-50 p-2"
        >
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("e.g. SAT Math")}
            aria-label={t("New subject name")}
            maxLength={40}
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none"
          />
          <ColorSwatches value={color} onChange={setColor} disabled={busy} />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {busy ? t("Adding…") : t("Add")}
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setError(null);
            }}
            className="rounded-md border bg-white px-2 py-1 text-[11px] font-medium hover:bg-slate-100"
          >
            {t("Cancel")}
          </button>
        </form>
      )}

      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}

export function SubjectFilterBar({
  subjects,
  value,
  onChange,
  total,
  uncategorized,
  onManage,
}: {
  subjects: Subject[];
  value: SubjectFilterValue;
  onChange: (value: SubjectFilterValue) => void;
  total: number;
  uncategorized: number;
  onManage?: () => void;
}) {
  const t = useT();
  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors";

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("Filter by subject")}>
      <button
        type="button"
        aria-pressed={value === "all"}
        onClick={() => onChange("all")}
        className={`${base} ${
          value === "all"
            ? "border-slate-900 bg-slate-900 text-white"
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        {t("All")}
        <span className="tabular-nums opacity-70">{total}</span>
      </button>

      {subjects.map((subject) => {
        const active = value === subject.id;
        const tone = subjectTone(subject.color);
        return (
          <button
            key={subject.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(subject.id)}
            className={`${base} ${
              active
                ? `${tone.chip} ring-1 ring-inset ${tone.ring}`
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <SubjectDot color={subject.color} />
            <span className="max-w-[10rem] truncate">{subject.name}</span>
            <span className="tabular-nums opacity-70">{subject.document_count}</span>
          </button>
        );
      })}

      {uncategorized > 0 && (
        <button
          type="button"
          aria-pressed={value === "none"}
          onClick={() => onChange("none")}
          className={`${base} ${
            value === "none"
              ? "border-slate-500 bg-slate-100 text-slate-700"
              : "border-dashed border-slate-300 bg-white text-slate-500 hover:bg-slate-50"
          }`}
        >
          {t("Uncategorized")}
          <span className="tabular-nums opacity-70">{uncategorized}</span>
        </button>
      )}

      {onManage && (
        <button
          type="button"
          onClick={onManage}
          className="ml-auto text-xs font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-900"
        >
          {t("Manage subjects")}
        </button>
      )}
    </div>
  );
}

interface SubjectManagerProps {
  subjects: Subject[];
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}

/** Create / rename / recolor / delete subject groups. */
export function SubjectManager({ subjects, onClose, onChanged }: SubjectManagerProps) {
  const t = useT();
  const [drafts, setDrafts] = useState<
    Record<number, { name: string; color: SubjectColor }>
  >({});
  const [addName, setAddName] = useState("");
  const [addColor, setAddColor] = useState<SubjectColor>(() => nextColor(subjects));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(
      Object.fromEntries(
        subjects.map((subject) => [
          subject.id,
          { name: subject.name, color: subject.color },
        ]),
      ),
    );
  }, [subjects]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function add(event: FormEvent) {
    event.preventDefault();
    const cleaned = addName.trim();
    if (!cleaned || busy) return;
    setBusy("add");
    setError(null);
    try {
      await api.createSubject(cleaned, addColor);
      setAddName("");
      setAddColor(nextColor(subjects));
      await onChanged();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(null);
    }
  }

  async function save(subject: Subject) {
    const draft = drafts[subject.id];
    if (!draft || busy) return;
    const patch: { name?: string; color?: SubjectColor } = {};
    if (draft.name.trim() !== subject.name) patch.name = draft.name.trim();
    if (draft.color !== subject.color) patch.color = draft.color;
    if (Object.keys(patch).length === 0) return;
    if (!draft.name.trim()) {
      setError(t("Subject name must not be empty."));
      return;
    }
    setBusy(`save-${subject.id}`);
    setError(null);
    try {
      await api.updateSubject(subject.id, patch);
      await onChanged();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(null);
    }
  }

  async function remove(subject: Subject) {
    if (busy) return;
    const extra =
      subject.document_count > 0
        ? t(" Its {count} papers will become uncategorized.", {
            count: subject.document_count,
          })
        : "";
    if (!window.confirm(t("Delete “{name}”?{extra}", { name: subject.name, extra })))
      return;
    setBusy(`delete-${subject.id}`);
    setError(null);
    try {
      await api.deleteSubject(subject.id);
      await onChanged();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="subject-manager-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-xl border bg-white shadow-xl"
      >
        <header className="flex items-start gap-3 border-b px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2
              id="subject-manager-title"
              className="font-display text-xl tracking-tight text-slate-900"
            >
              {t("Subjects")}
            </h2>
            <p className="mt-0.5 text-xs leading-5 text-slate-500">
              {t(
                "Group papers by subject. Renaming updates every paper; deleting moves its papers to Uncategorized.",
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Close subjects")}
            className="rounded-md border px-2 py-1 text-xs font-medium hover:bg-slate-50"
          >
            {t("Close")}
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <form onSubmit={(event) => void add(event)} className="rounded-xl border bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t("Add subject")}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                value={addName}
                onChange={(event) => setAddName(event.target.value)}
                placeholder={t("e.g. SAT Math")}
                aria-label={t("New subject name")}
                maxLength={40}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
              />
              <ColorSwatches value={addColor} onChange={setAddColor} disabled={busy !== null} />
              <button
                type="submit"
                disabled={busy !== null || !addName.trim()}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
              >
                {busy === "add" ? t("Adding…") : t("Add subject")}
              </button>
            </div>
          </form>

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <ul className="mt-3 space-y-2">
            {subjects.length === 0 && (
              <li className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-slate-400">
                {t("No subjects yet. Add your first one above.")}
              </li>
            )}
            {subjects.map((subject) => {
              const draft = drafts[subject.id] ?? {
                name: subject.name,
                color: subject.color,
              };
              const dirty =
                draft.name.trim() !== subject.name || draft.color !== subject.color;
              return (
                <li key={subject.id} className="rounded-xl border bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={draft.name}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [subject.id]: { ...draft, name: event.target.value },
                        }))
                      }
                      aria-label={t("Name for {name}", { name: subject.name })}
                      maxLength={40}
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void save(subject)}
                      disabled={!dirty || busy !== null}
                      className="rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
                    >
                      {busy === `save-${subject.id}` ? t("Saving…") : t("Save")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(subject)}
                      disabled={busy !== null}
                      className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-40"
                    >
                      {busy === `delete-${subject.id}` ? t("Deleting…") : t("Delete")}
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <ColorSwatches
                      value={draft.color}
                      onChange={(next) =>
                        setDrafts((current) => ({
                          ...current,
                          [subject.id]: { ...draft, color: next },
                        }))
                      }
                      disabled={busy !== null}
                    />
                    <span className="text-[11px] text-slate-400">
                      {t("{count} papers", { count: subject.document_count })}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
