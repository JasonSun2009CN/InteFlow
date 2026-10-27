"""SQLite access layer: single-file DB under ./data (see PLAN.md §5)."""

from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.environ.get("INTEFLOW_DATA", REPO_ROOT / "data"))
DB_PATH = DATA_DIR / "app.db"
DOCS_DIR = DATA_DIR / "docs"          # docs/<doc_id>/doc.ifmd.md + assets/
UPLOAD_TMP = DATA_DIR / "tmp"         # transient upload staging
JOBS_DIR = DATA_DIR / "jobs"          # import_jobs/<job_id>/ (staged conversion result)
EXPORTS_DIR = DATA_DIR / "exports"
BANKS_DIR = DATA_DIR / "banks"       # user-imported question banks


def doc_dir(doc_id: int) -> Path:
    return DOCS_DIR / str(doc_id)


def jobs_dir(job_id: str) -> Path:
    return JOBS_DIR / job_id


def ifmd_path(doc_id: int) -> Path:
    return doc_dir(doc_id) / "doc.ifmd.md"


def assets_dir(doc_id: int) -> Path:
    return doc_dir(doc_id) / "assets"

SCHEMA = """
CREATE TABLE IF NOT EXISTS subjects (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL COLLATE NOCASE UNIQUE,  -- user-defined subject label
  color      TEXT NOT NULL DEFAULT 'blue',         -- palette id (blue|emerald|...)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS documents (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT NOT NULL,
  source_filename TEXT NOT NULL,
  ifmd_path      TEXT NOT NULL,
  answers_status  TEXT NOT NULL DEFAULT 'none',  -- inline|external|none|pending
  question_count  INTEGER NOT NULL DEFAULT 0,
  builtin_key     TEXT,                          -- "bank_id/unit_id" for built-in banks
  import_source   TEXT,                          -- pdf|docx|ifmd.md|builtin
  used_ai         INTEGER NOT NULL DEFAULT 0,    -- 1 if any AI was used to import
  report_json     TEXT,                          -- per-page conversion report (JSON)
  subject_id      INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS import_jobs (
  id              TEXT PRIMARY KEY,              -- "j_<hex>"
  filename        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'detecting',  -- detecting|converting|review|done|failed|cancelled
  stage           TEXT NOT NULL DEFAULT 'detect',     -- detect|convert|validate|commit
  kind            TEXT,                          -- pdf|docx|ifmd
  import_source   TEXT,
  pages_total     INTEGER NOT NULL DEFAULT 0,
  pages_done      INTEGER NOT NULL DEFAULT 0,
  question_count  INTEGER NOT NULL DEFAULT 0,
  used_ai         INTEGER NOT NULL DEFAULT 0,
  pages_json      TEXT NOT NULL DEFAULT '[]',
  warnings_json   TEXT NOT NULL DEFAULT '[]',
  document_id     INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  error           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS questions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id  INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  ext_id       TEXT NOT NULL,
  no           INTEGER,
  sec          TEXT NOT NULL DEFAULT 'general',  -- free-form section label (rw|math|physics|...)
  type         TEXT,
  difficulty   TEXT,
  material     TEXT,
  material2    TEXT,                              -- second text of a paired-passage item
  stem         TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '[]',  -- ["A. ...", ...] one per option, or [] for a blank
  kind         TEXT NOT NULL DEFAULT 'choice',  -- choice|blank
  multi        INTEGER NOT NULL DEFAULT 0,      -- 1 = several correct letters
  answers_json TEXT NOT NULL DEFAULT '[]',      -- ["B"] / ["A","C"] / ["2","two"]
  answer       TEXT CHECK (answer IS NULL OR answer GLOB '[A-Z]'),
  explain      TEXT,
  source_ref   TEXT,
  images_json  TEXT NOT NULL DEFAULT '[]',
  order_idx    INTEGER NOT NULL,
  UNIQUE (document_id, ext_id)
);

CREATE TABLE IF NOT EXISTS question_stars (
  question_id  INTEGER PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  document_id  INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_question_stars_document ON question_stars(document_id);

CREATE TABLE IF NOT EXISTS sessions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id   INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  started_at    TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at   TEXT,
  mode          TEXT NOT NULL DEFAULT 'all',        -- all|range
  timer_mode    TEXT NOT NULL DEFAULT 'countup',   -- countup|countdown
  timer_seconds INTEGER                            -- countdown length, null for countup
);

CREATE TABLE IF NOT EXISTS session_items (
  session_id   INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question_id  INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  no           INTEGER NOT NULL,
  chosen       TEXT,
  chosen_json  TEXT NOT NULL DEFAULT '[]',
  is_correct   INTEGER,
  answered_at  TEXT,
  PRIMARY KEY (session_id, question_id)
);

CREATE TABLE IF NOT EXISTS analysis_pages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id  INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  question_id  INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL DEFAULT 0,
  content      TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (document_id, question_id, position)
);

CREATE TABLE IF NOT EXISTS analyses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  session_id  INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vocab (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  word         TEXT NOT NULL,
  context      TEXT,
  document_id  INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  question_id  INTEGER REFERENCES questions(id) ON DELETE SET NULL,
  meaning      TEXT,
  ease         REAL NOT NULL DEFAULT 2.5,
  interval     INTEGER NOT NULL DEFAULT 0,
  due_at       TEXT NOT NULL DEFAULT (datetime('now')),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS word_grids (
  document_id  INTEGER PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  headers      TEXT NOT NULL DEFAULT '["Word","Meaning","Notes"]',
  rows_json    TEXT NOT NULL DEFAULT '[]',
  columns_json TEXT,
  view_json    TEXT,
  version      INTEGER NOT NULL DEFAULT 1,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS custom_dictionary_entries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  word       TEXT NOT NULL,
  word_key   TEXT NOT NULL UNIQUE,
  pos        TEXT NOT NULL DEFAULT '',
  definition TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_custom_dictionary_key
  ON custom_dictionary_entries(word_key);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS llm_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  purpose     TEXT NOT NULL,
  provider    TEXT NOT NULL,
  model       TEXT NOT NULL,
  tokens_in   INTEGER,
  tokens_out  INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


def ensure_dirs() -> None:
    for d in (DATA_DIR, DOCS_DIR, UPLOAD_TMP, JOBS_DIR, EXPORTS_DIR, BANKS_DIR):
        d.mkdir(parents=True, exist_ok=True)


@contextmanager
def db() -> Iterator[sqlite3.Connection]:
    """One connection per unit of work; commits on success, rolls back on error."""
    ensure_dirs()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _migrate(conn: sqlite3.Connection) -> None:
    """Idempotent in-place upgrades for pre-existing databases.

    ``SCHEMA`` already contains the current shape for fresh databases; this
    adds anything missing on older ones. Called by :func:`init_db` and safe to
    run repeatedly. Kept as a standalone function so it can be unit-tested
    against an in-memory connection.
    """
    # questions (2026-10-19): option letters are no longer capped at A–D (AMC
    # prints five), so the legacy CHECK must widen to any single A–Z. SQLite
    # cannot drop a CHECK, so rebuild the table via the documented copy/rename.
    # Run first, before any DML opens a transaction, so the FK toggle applies.
    q_row = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'questions'"
    ).fetchone()
    if q_row and "answer IN ('A','B','C','D')" in (q_row["sql"] or ""):
        new_sql = (q_row["sql"] or "").replace(
            "CHECK (answer IS NULL OR answer IN ('A','B','C','D'))",
            "CHECK (answer IS NULL OR answer GLOB '[A-Z]')",
        )
        new_sql = new_sql.replace(
            "CREATE TABLE IF NOT EXISTS questions", "CREATE TABLE questions_new", 1
        )
        if "questions_new" not in new_sql:
            new_sql = new_sql.replace("CREATE TABLE questions", "CREATE TABLE questions_new", 1)
        # A transaction must not be open when the FK toggle is set, or it is a
        # no-op and DROP TABLE cascades away the child rows.
        conn.commit()
        conn.execute("PRAGMA foreign_keys = OFF")
        conn.execute("PRAGMA legacy_alter_table = ON")
        conn.execute("DROP TABLE IF EXISTS questions_new")
        conn.execute(new_sql)
        names = ", ".join(r["name"] for r in conn.execute("PRAGMA table_info(questions)"))
        conn.execute(f"INSERT INTO questions_new ({names}) SELECT {names} FROM questions")
        conn.execute("DROP TABLE questions")
        conn.execute("ALTER TABLE questions_new RENAME TO questions")
        conn.commit()                       # end the txn so the PRAGMAs below apply
        conn.execute("PRAGMA legacy_alter_table = OFF")
        conn.execute("PRAGMA foreign_keys = ON")

    # user-defined subjects (2026-10-20): a paper belongs to at most one.
    # Create the lookup table first so an old documents table can reference it.
    conn.execute(
        "CREATE TABLE IF NOT EXISTS subjects ("
        " id INTEGER PRIMARY KEY AUTOINCREMENT,"
        " name TEXT NOT NULL COLLATE NOCASE UNIQUE,"
        " color TEXT NOT NULL DEFAULT 'blue',"
        " created_at TEXT NOT NULL DEFAULT (datetime('now'))"
        ")"
    )
    # starred / selected questions (2026-10-20): one row per question, global.
    conn.execute(
        "CREATE TABLE IF NOT EXISTS question_stars ("
        " question_id INTEGER PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,"
        " document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,"
        " created_at TEXT NOT NULL DEFAULT (datetime('now'))"
        ")"
    )
    if conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'questions'"
    ).fetchone():
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_question_stars_document"
            " ON question_stars(document_id)"
        )
        # paired passages (2026-10-25): SAT dual-text items keep a second
        # material column next to the existing one.
        qcols = {row["name"] for row in conn.execute("PRAGMA table_info(questions)")}
        if "material2" not in qcols:
            conn.execute("ALTER TABLE questions ADD COLUMN material2 TEXT")

    # user-managed dictionary (2026-10-20): plain word/pos/definition rows.
    conn.execute(
        "CREATE TABLE IF NOT EXISTS custom_dictionary_entries ("
        " id INTEGER PRIMARY KEY AUTOINCREMENT,"
        " word TEXT NOT NULL,"
        " word_key TEXT NOT NULL UNIQUE,"
        " pos TEXT NOT NULL DEFAULT '',"
        " definition TEXT NOT NULL,"
        " created_at TEXT NOT NULL DEFAULT (datetime('now')),"
        " updated_at TEXT NOT NULL DEFAULT (datetime('now'))"
        ")"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_custom_dictionary_key"
        " ON custom_dictionary_entries(word_key)"
    )

    cols = {row["name"] for row in conn.execute("PRAGMA table_info(documents)")}
    additions = (
        ("builtin_key", "TEXT"),
        ("import_source", "TEXT"),
        ("used_ai", "INTEGER NOT NULL DEFAULT 0"),
        ("report_json", "TEXT"),
        ("subject_id", "INTEGER REFERENCES subjects(id) ON DELETE SET NULL"),
    )
    if cols:
        for name, ddl in additions:
            if name not in cols:
                conn.execute(f"ALTER TABLE documents ADD COLUMN {name} {ddl}")
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_documents_subject"
            " ON documents(subject_id)"
        )
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_documents_builtin_key"
            " ON documents(builtin_key) WHERE builtin_key IS NOT NULL"
        )

    # word_grids v2 (batch 10): stable column/row ids, widths, saved view.
    if conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'word_grids'"
    ).fetchone():
        grid_cols = {row["name"] for row in conn.execute("PRAGMA table_info(word_grids)")}
        for name, ddl in (
            ("columns_json", "TEXT"),
            ("view_json", "TEXT"),
            ("version", "INTEGER NOT NULL DEFAULT 1"),
            ("updated_at", "TEXT"),
        ):
            if name not in grid_cols:
                conn.execute(f"ALTER TABLE word_grids ADD COLUMN {name} {ddl}")
        conn.execute(
            "UPDATE word_grids SET updated_at = COALESCE(updated_at, datetime('now'))"
        )

    # questions / session_items (2026-10-19): blank questions + multiple answers.
    # `answer` stays the single-letter column (old data + export paths), the new
    # `answers_json` is the source of truth for grading.
    if conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'questions'"
    ).fetchone():
        q_cols = {row["name"] for row in conn.execute("PRAGMA table_info(questions)")}
        for name, ddl in (
            ("kind", "TEXT NOT NULL DEFAULT 'choice'"),
            ("multi", "INTEGER NOT NULL DEFAULT 0"),
            ("answers_json", "TEXT NOT NULL DEFAULT '[]'"),
        ):
            if name not in q_cols:
                conn.execute(f"ALTER TABLE questions ADD COLUMN {name} {ddl}")
        # backfill: legacy rows had exactly four options and one letter answer
        conn.execute(
            "UPDATE questions SET answers_json = json_array(answer)"
            " WHERE (answers_json IS NULL OR answers_json = '[]') AND answer IS NOT NULL"
        )
    if conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'session_items'"
    ).fetchone():
        si_cols = {row["name"] for row in conn.execute("PRAGMA table_info(session_items)")}
        if "chosen_json" not in si_cols:
            conn.execute(
                "ALTER TABLE session_items ADD COLUMN chosen_json TEXT NOT NULL DEFAULT '[]'"
            )
        conn.execute(
            "UPDATE session_items SET chosen_json = json_array(chosen)"
            " WHERE (chosen_json IS NULL OR chosen_json = '[]') AND chosen IS NOT NULL"
        )

    # sessions (2026-10-22): remember which timing method an attempt used so the
    # next start screen can default to it (per paper, falling back to the last
    # attempt across all papers).
    if conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'sessions'"
    ).fetchone():
        session_cols = {row["name"] for row in conn.execute("PRAGMA table_info(sessions)")}
        for name, ddl in (
            ("timer_mode", "TEXT NOT NULL DEFAULT 'countup'"),
            ("timer_seconds", "INTEGER"),
        ):
            if name not in session_cols:
                conn.execute(f"ALTER TABLE sessions ADD COLUMN {name} {ddl}")

    # settings (2026-10-19): DeepSeek became two protocol presets, so the old
    # `deepseek` provider id is rewritten to `deepseek-openai`
    # (see providers.LEGACY_PROVIDER_IDS for the in-memory fallback).
    if conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'settings'"
    ).fetchone():
        conn.execute(
            "UPDATE settings SET value = 'deepseek-openai'"
            " WHERE key = 'provider' AND value = 'deepseek'"
        )


def init_db() -> None:
    with db() as conn:
        conn.executescript(SCHEMA)
        _migrate(conn)


def query(sql: str, params: tuple = ()) -> list[sqlite3.Row]:
    with db() as conn:
        return conn.execute(sql, params).fetchall()


def one(sql: str, params: tuple = ()) -> sqlite3.Row | None:
    with db() as conn:
        return conn.execute(sql, params).fetchone()


def execute(sql: str, params: tuple = ()) -> int:
    """Run a write; returns lastrowid."""
    with db() as conn:
        cur = conn.execute(sql, params)
        return cur.lastrowid or 0
