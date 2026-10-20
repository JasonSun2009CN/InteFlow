import { Link } from "react-router-dom";
import type { DocumentSummary, Subject, SubjectRef } from "../api/client";
import { SubjectPicker } from "./SubjectControls";

interface Props {
  docs: DocumentSummary[];
  subjects: Subject[];
  importedId?: number | null;
  onDelete: (doc: DocumentSummary) => void;
  onSubjectChanged: (docId: number, subject: SubjectRef | null) => void;
  onSubjectsChanged: () => void;
}

function answerProgress(doc: DocumentSummary): string {
  if (doc.question_count === 0) return "no questions";
  return `${doc.answered_count}/${doc.question_count} answers`;
}

export default function LibraryList({
  docs,
  subjects,
  importedId,
  onDelete,
  onSubjectChanged,
  onSubjectsChanged,
}: Props) {
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border bg-white shadow-sm">
      {docs.map((doc) => (
        <li
          key={doc.id}
          className={
            "flex flex-wrap items-center justify-between gap-3 px-4 py-3 " +
            (doc.id === importedId ? "bg-emerald-50" : "hover:bg-slate-50")
          }
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-medium text-slate-800">{doc.title}</span>
              {doc.id === importedId && (
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">
                  just imported
                </span>
              )}
              {doc.needs_answers && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                  needs answers
                </span>
              )}
            </div>
            <p className="truncate text-sm text-slate-500">
              {doc.source_filename} · {doc.question_count} questions · {answerProgress(doc)}
            </p>
            <SubjectPicker
              docId={doc.id}
              title={doc.title}
              subjects={subjects}
              value={doc.subject}
              onChange={(subject) => onSubjectChanged(doc.id, subject)}
              onSubjectsChanged={onSubjectsChanged}
              className="mt-1.5"
            />
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 text-sm">
            <Link
              to={`/doc/${doc.id}/practice`}
              className="btn btn-primary rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
            >
              Practice
            </Link>
            <Link
              to={`/doc/${doc.id}/answers`}
              className="rounded-lg border px-3 py-1.5 font-medium hover:bg-slate-50"
            >
              Answers
            </Link>
            <button
              onClick={() => onDelete(doc)}
              className="rounded-lg border border-red-200 px-3 py-1.5 font-medium text-red-700 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}