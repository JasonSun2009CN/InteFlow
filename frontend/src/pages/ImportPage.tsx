import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  ApiError,
  type BuiltinBank,
  type DocumentSummary,
  type ImportJob,
  type Subject,
  type SubjectRef,
} from "../api/client";
import BuiltinBankCard from "../components/BuiltinBankCard";
import ImportPipeline from "../components/ImportPipeline";
import LibraryList from "../components/LibraryList";
import IfmdTemplate from "../components/IfmdTemplate";
import { SubjectFilterBar, SubjectManager } from "../components/SubjectControls";
import type { SubjectFilterValue } from "../lib/subjects";
import { useI18n } from "../lib/i18n";

function errText(err: unknown): string {
  return err instanceof ApiError ? err.message : String(err);
}

export default function ImportPage() {
  const { t } = useI18n();
  const [docs, setDocs] = useState<DocumentSummary[] | null>(null);
  const [banks, setBanks] = useState<BuiltinBank[] | null>(null);
  const [showBuiltin, setShowBuiltin] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectFilter, setSubjectFilter] = useState<SubjectFilterValue>("all");
  const [importSubjectId, setImportSubjectId] = useState<number | "">("");
  const [managerOpen, setManagerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [imported, setImported] = useState<DocumentSummary | null>(null);
  const [ocr, setOcr] = useState<string[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const [bankBusy, setBankBusy] = useState(false);
  const [bankMsg, setBankMsg] = useState<string | null>(null);
  const [bankErr, setBankErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bankFileRef = useRef<HTMLInputElement>(null);
  /** Set when the user cancels while the conversion is still running. */
  const cancelledRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      setDocs(await api.listDocuments());
    } catch (err) {
      setError(errText(err));
    }
  }, []);

  const refreshSubjects = useCallback(async () => {
    try {
      const next = await api.listSubjects();
      setSubjects(next);
      // If the active filter or import target was deleted, clear it.
      setSubjectFilter((current) =>
        typeof current === "number" && !next.some((item) => item.id === current)
          ? "all"
          : current,
      );
      setImportSubjectId((current) =>
        typeof current === "number" && !next.some((item) => item.id === current)
          ? ""
          : current,
      );
    } catch (err) {
      // grouping is optional: the library still works without it
      console.warn("subjects unavailable:", err);
    }
  }, []);

  const refreshBanks = useCallback(async () => {
    try {
      setBanks(await api.listBanks());
    } catch (err) {
      // the bank list is optional furniture — don't block the import page
      console.warn("builtin banks unavailable:", err);
    }
  }, []);

  async function importBank(file: File) {
    setBankBusy(true);
    setBankErr(null);
    setBankMsg(null);
    try {
      const res = await api.importBank(file);
      setBankMsg(
        t("Imported “{title}” · {units} units · {questions} questions.", {
          title: res.title,
          units: res.units,
          questions: res.questions,
        }),
      );
      await refreshAll();
    } catch (err) {
      setBankErr(errText(err));
    } finally {
      setBankBusy(false);
      if (bankFileRef.current) bankFileRef.current.value = "";
    }
  }

  /** After adding built-in modules: reload flags + the library in one pass. */
  const refreshAll = useCallback(async () => {
    await Promise.all([refresh(), refreshBanks()]);
  }, [refresh, refreshBanks]);

  useEffect(() => {
    void refresh();
    void refreshSubjects();
    // User-imported banks are always shown; the bundled sample bank is opt-in
    // (Settings → Show built-in library) and only exists in source checkouts.
    void refreshBanks();
    api
      .getSettings()
      .then((s) => setShowBuiltin(s.show_builtin_library))
      .catch((err) => console.warn("settings unavailable:", err));
    api
      .health()
      .then((h) => setOcr(h.ocr))
      .catch(() => setOcr(null)); // health is furniture; never block the page
  }, [refresh, refreshBanks, refreshSubjects]);

  async function startImport(file: File) {
    setBusy(true);
    setError(null);
    setJob(null);
    setImported(null);
    cancelledRef.current = false;
    const targetSubject = importSubjectId === "" ? null : importSubjectId;
    try {
      // POST /api/imports returns 202 immediately with status "converting";
      // the conversion runs in the background and we poll for per-page
      // progress until the job settles (review / failed / cancelled).
      let current = await api.createImport(file);
      setJob(current);
      let polls = 0;
      while (
        !cancelledRef.current &&
        (current.status === "converting" || current.status === "detecting")
      ) {
        if (++polls > 2000) {
          // 10 minutes — the job keeps running server-side; tell the user.
          throw new Error(t("Conversion is taking too long — reload the page to check its status."));
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
        current = await api.getImport(current.id);
        if (!cancelledRef.current) setJob(current);
      }
      if (cancelledRef.current) return;
      // Clean conversions skip the review screen (0 token, no ambiguity).
      if (current.status === "review" && !current.needs_review) {
        current = await api.commitImport(current.id);
      }
      setJob(current);
      if (current.status === "done" && current.document_id) {
        let importedDoc = await api.getDocument(current.document_id);
        if (targetSubject !== null) {
          importedDoc = await api.setDocumentSubject(current.document_id, targetSubject);
        }
        setImported(importedDoc);
        await Promise.all([refresh(), refreshSubjects()]);
      }
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void startImport(file);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void startImport(file);
  }

  async function onCommit() {
    if (!job) return;
    setBusy(true);
    try {
      const done = await api.commitImport(job.id);
      setJob(done);
      if (done.document_id) {
        let importedDoc = await api.getDocument(done.document_id);
        if (importSubjectId !== "") {
          importedDoc = await api.setDocumentSubject(
            done.document_id,
            importSubjectId,
          );
        }
        setImported(importedDoc);
        await Promise.all([refresh(), refreshSubjects()]);
      }
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function onCancelJob() {
    if (!job) return;
    cancelledRef.current = true;              // stop the progress poll first
    try {
      await api.cancelImport(job.id);
    } catch (err) {
      console.warn("cancel failed:", err);
    }
    setJob(null);
  }

  async function onAiFallback() {
    if (!job) return;
    setBusy(true);
    try {
      const updated = await api.aiFallbackImport(job.id);
      setJob(updated);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(doc: DocumentSummary) {
    if (
      !window.confirm(
        t("Delete “{title}” and all its questions, answers and analyses?", {
          title: doc.title,
        }),
      )
    )
      return;
    try {
      await api.deleteDocument(doc.id);
      if (imported?.id === doc.id) setImported(null);
      await Promise.all([refresh(), refreshSubjects()]);
    } catch (err) {
      setError(errText(err));
    }
  }

  function onSubjectChanged(docId: number, subject: SubjectRef | null) {
    setDocs((current) =>
      current?.map((doc) => (doc.id === docId ? { ...doc, subject } : doc)) ?? current,
    );
    setImported((current) =>
      current && current.id === docId ? { ...current, subject } : current,
    );
  }

  async function onSubjectsManaged() {
    await Promise.all([refresh(), refreshSubjects()]);
  }

  const allDocs = docs ?? [];
  const subjectCounts = new Map<number, number>();
  let uncategorized = 0;
  for (const doc of allDocs) {
    if (doc.subject) {
      subjectCounts.set(doc.subject.id, (subjectCounts.get(doc.subject.id) ?? 0) + 1);
    } else {
      uncategorized += 1;
    }
  }
  const filteredDocs = allDocs.filter((doc) => {
    if (subjectFilter === "all") return true;
    if (subjectFilter === "none") return doc.subject === null;
    return doc.subject?.id === subjectFilter;
  });
  const filters = subjects.map((subject) => ({
    ...subject,
    document_count: subjectCounts.get(subject.id) ?? 0,
  }));

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
      <header className="mb-8 max-w-3xl">
        <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-slate-400">
          {t("Question bank")}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{t("Library")}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {t(
            "Import a question bank (PDF, Word .docx, or .ifmd.md), fill in the answers, then practice in an exam-style UI.",
          )}
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-800">
          {error}
        </div>
      )}

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">{t("Import a document")}</h2>
        <p className="mt-1 text-sm text-slate-600">
          {t(
            "PDFs and Word .docx files are converted locally to InteFlow-MD — no tokens, no cloud. Questions must be numbered (1., 2., …) with two or more labelled options each.",
          )}
        </p>
        {ocr !== null &&
          (ocr.length > 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              {t("Scanned PDFs are read locally with OCR ({engines}).", {
                engines: ocr.join(", "),
              })}
            </p>
          ) : (
            <p className="mt-2 text-sm text-amber-700">
              {t(
                "Scanned (image-only) PDFs need OCR: install tesseract on any OS, or pyobjc-framework-Vision on macOS.",
              )}
            </p>
          ))}

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border bg-slate-50 px-3 py-2">
          <label className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-slate-600">
            <span>{t("Subject for this import")}</span>
            <select
              value={importSubjectId}
              onChange={(event) =>
                setImportSubjectId(
                  event.target.value === "" ? "" : Number(event.target.value),
                )
              }
              className="max-w-[16rem] rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
            >
              <option value="">{t("No subject")}</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setManagerOpen(true)}
            className="text-xs font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-900"
          >
            {t("Manage subjects")}
          </button>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={
            "mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors " +
            (dragging ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50")
          }
        >
          <p className="text-sm text-slate-600">
            {t("Drag a file here, or")}{" "}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="font-medium text-blue-700 underline hover:text-blue-800 disabled:opacity-50"
            >
              {t("choose a file")}
            </button>
            .
          </p>
          <p className="mt-1 text-xs text-slate-400">PDF · DOCX · .md · .markdown · .ifmd.md</p>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.md,.markdown"
            className="hidden"
            disabled={busy}
            onChange={onFile}
          />
          {busy && <p className="mt-3 text-sm text-slate-500">{t("Converting…")}</p>}
        </div>

        <IfmdTemplate />
      </section>

      {job && (
        <ImportPipeline
          job={job}
          busy={busy}
          onCommit={onCommit}
          onCancel={onCancelJob}
          onAiFallback={onAiFallback}
        />
      )}

      {imported && (
        <section className="mt-6 rounded-xl border border-emerald-300 bg-emerald-50 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-emerald-900">{imported.title}</h2>
              <p className="text-sm text-emerald-800">
                {t("{count} questions imported from {file} · answers: {status}", {
                  count: imported.question_count,
                  file: imported.source_filename,
                  status: t(imported.answers_status),
                })}
                {imported.needs_answers &&
                  t(" · {answered}/{total} filled", {
                    answered: imported.answered_count,
                    total: imported.question_count,
                  })}
              </p>
            </div>
            <div className="flex gap-2">
              {imported.needs_answers && (
                <Link
                  to={`/doc/${imported.id}/answers`}
                  className="rounded-lg bg-amber-500 px-4 py-2 font-medium text-white hover:bg-amber-600"
                >
                  {t("Enter answers")}
                </Link>
              )}
              <Link
                to={`/doc/${imported.id}/practice`}
                className="btn btn-primary rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
              >
                {t("Start practice")}
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="mt-6 rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{t("Question banks")}</h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">
              {t(
                "Import a bank ZIP: manifest.json + one folder per unit, or several .ifmd.md files. Imports stay local (0 tokens).",
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <input
              ref={bankFileRef}
              type="file"
              accept=".zip,application/zip"
              data-testid="bank-file"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importBank(file);
              }}
            />
            <button
              type="button"
              onClick={() => bankFileRef.current?.click()}
              disabled={bankBusy}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {bankBusy ? t("Importing…") : t("Import bank")}
            </button>
          </div>
        </div>
        {bankMsg && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {bankMsg}
          </p>
        )}
        {bankErr && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{bankErr}</p>
        )}
      </section>

      {banks
        ?.filter((bank) => bank.origin === "user" || showBuiltin)
        .map((bank) => (
          <BuiltinBankCard
            key={bank.id}
            bank={bank}
            onChanged={() => void refreshAll()}
          />
        ))}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">{t("Your exams")}</h2>

        {docs && docs.length > 0 && (
          <div className="mt-3">
            <SubjectFilterBar
              subjects={filters}
              value={subjectFilter}
              onChange={setSubjectFilter}
              total={allDocs.length}
              uncategorized={uncategorized}
              onManage={() => setManagerOpen(true)}
            />
          </div>
        )}

        {docs === null && <p className="mt-3 text-sm text-slate-500">{t("Loading…")}</p>}
        {docs?.length === 0 && (
          <p className="mt-3 text-sm text-slate-500">{t("Nothing imported yet.")}</p>
        )}
        {docs && docs.length > 0 && filteredDocs.length === 0 && (
          <p className="mt-3 rounded-lg border border-dashed px-4 py-8 text-center text-sm text-slate-500">
            {t("No exams in this subject yet.")}
          </p>
        )}
        <div className="mt-3">
          {filteredDocs.length > 0 && (
            <LibraryList
              docs={filteredDocs}
              subjects={subjects}
              importedId={imported?.id ?? null}
              onDelete={onDelete}
              onSubjectChanged={onSubjectChanged}
              onSubjectsChanged={() => void refreshSubjects()}
            />
          )}
        </div>
      </section>

      {managerOpen && (
        <SubjectManager
          subjects={subjects}
          onClose={() => setManagerOpen(false)}
          onChanged={onSubjectsManaged}
        />
      )}
    </div>
  );
}