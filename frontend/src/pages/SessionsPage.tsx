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
    <div className="mx-auto w-full max-w-4xl px-6 py-10 sm:py-14">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-slate-400">
            {t("History")}
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
            {t("Sessions")}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {t("Every attempt you have submitted, newest first.")}
          </p>
        </div>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("Search exams…")}
          aria-label={t("Search sessions")}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none sm:w-64"
        />
      </header>

      {error && (
        <div role="alert" className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {sessions === null && !error && (
        <p className="mt-8 text-sm text-slate-500">{t("Loading sessions…")}</p>
      )}

      {sessions?.length === 0 && (
        <div className="mt-10 rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center">
          <p className="font-display text-2xl tracking-tight text-slate-700">
            {t("No sessions yet.")}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            {t("Finish an exam and it will show up here.")}
          </p>
          <Link to="/" className="mt-5 inline-block text-sm text-blue-700 underline">
            {t("Pick an exam")}
          </Link>
        </div>
      )}

      {sessions && sessions.length > 0 && visible.length === 0 && (
        <p className="mt-8 text-sm text-slate-500">
          {t("No sessions match “{query}”.", { query })}
        </p>
      )}

      {visible.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-200">
          {visible.map((session) => (
            <li
              key={session.session_id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4"
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
                <div className="text-sm font-semibold tabular-nums">
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
                className="rounded-md border border-slate-200 p-2 text-slate-400 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
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
