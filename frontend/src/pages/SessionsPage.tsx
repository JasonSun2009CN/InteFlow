import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { api, ApiError, type SessionSummary } from "../api/client";
import { useI18n } from "../lib/i18n";

function errText(err: unknown): string {
  return err instanceof ApiError ? err.message : String(err);
}

/** SQLite stores `datetime('now')` as "YYYY-MM-DD HH:MM:SS" in UTC. */
function formatWhen(value: string | null, locale: string, unfinished: string): string {
  if (!value) return unfinished;
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function score(session: SessionSummary, notGraded: string): string {
  if (!session.graded) return notGraded;
  const pct = Math.round((session.correct / session.graded) * 100);
  return `${session.correct}/${session.graded} · ${pct}%`;
}

/**
 * Sessions: every attempt ever submitted, newest first.
 *
 * One row per attempt (an "object" the user can delete); the search box
 * filters by exam title. Opening a row goes straight back into the review
 * workspace for that attempt.
 */
export default function SessionsPage() {
  const { t, locale } = useI18n();
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = useCallback(() => {
    setSessions(null);
    setError(null);
    api
      .listSessions()
      .then(setSessions)
      .catch((err) => setError(errText(err)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = sessions ?? [];
    if (!needle) return rows;
    return rows.filter(
      (s) =>
        s.document_title.toLowerCase().includes(needle) ||
        String(s.session_id).includes(needle),
    );
  }, [sessions, query]);

  async function remove(session: SessionSummary) {
    if (
      !window.confirm(
        t("Delete this attempt of “{title}”?", { title: session.document_title }),
      )
    )
      return;
    setDeleting(session.session_id);
    setError(null);
    try {
      await api.deleteSession(session.session_id);
      setSessions((prev) => (prev ?? []).filter((s) => s.session_id !== session.session_id));
    } catch (err) {
      setError(errText(err));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12 sm:py-16">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-sm text-slate-500">{t("History")}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            {t("Sessions")}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {t("Every attempt you have submitted, newest first.")}
          </p>
        </div>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("Search exams…")}
          aria-label={t("Search sessions")}
          className="w-full rounded-sm border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none sm:w-64"
        />
      </header>

      {error && (
        <div role="alert" className="mt-8 bg-red-50 px-5 py-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {sessions === null && !error && (
        <p className="mt-12 text-sm text-slate-500">{t("Loading sessions…")}</p>
      )}

      {sessions?.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-2xl font-semibold tracking-tight text-slate-900">
            {t("No sessions yet.")}
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">
            {t("Finish an exam and it will show up here.")}
          </p>
          <Link
            to="/"
            className="mt-6 inline-block border-b border-slate-400 pb-0.5 text-sm text-slate-700 hover:border-slate-900 hover:text-slate-900"
          >
            {t("Pick an exam")}
          </Link>
        </div>
      )}

      {sessions && sessions.length > 0 && visible.length === 0 && (
        <p className="mt-12 text-sm text-slate-500">
          {t("No sessions match “{query}”.", { query })}
        </p>
      )}

      {visible.length > 0 && (
        <ul className="mt-10">
          {visible.map((session) => (
            <li
              key={session.session_id}
              className="flex flex-wrap items-center gap-x-6 gap-y-2 px-1 py-5 transition-colors hover:bg-slate-50"
            >
              <div className="min-w-0 flex-1">
                <Link
                  to={`/session/${session.session_id}/result`}
                  className="font-medium text-slate-900 decoration-slate-300 underline-offset-4 hover:underline"
                >
                  {session.document_title}
                </Link>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                  <span>{t("Attempt #{id}", { id: session.session_id })}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatWhen(session.started_at, locale, t("unfinished"))}</span>
                  {!session.finished_at && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-amber-700">{t("unfinished")}</span>
                    </>
                  )}
                </p>
              </div>

              <div className="text-right">
                <div className="text-sm font-semibold tabular-nums text-slate-900">
                  {score(session, t("not graded"))}
                </div>
                <div className="text-xs text-slate-500">
                  {t("{count} answered", { count: session.answered })}
                </div>
              </div>

              <button
                type="button"
                onClick={() => void remove(session)}
                disabled={deleting === session.session_id}
                aria-label={t("Delete attempt {id}", { id: session.session_id })}
                title={t("Delete this attempt")}
                className="cursor-pointer rounded-sm p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
