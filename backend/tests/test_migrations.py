"""DB migration: older databases gain the new columns/tables in place."""

from __future__ import annotations

import sqlite3

import pytest

from app.db import SCHEMA, _migrate


def test_migrate_widens_option_letter_check() -> None:
    """Legacy rows were capped at A–D; a fifth option (E) must be storable."""
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(
        """
        CREATE TABLE documents (id INTEGER PRIMARY KEY, title TEXT);
        CREATE TABLE questions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          ext_id TEXT NOT NULL,
          answer TEXT CHECK (answer IS NULL OR answer IN ('A','B','C','D')),
          order_idx INTEGER NOT NULL,
          UNIQUE (document_id, ext_id)
        );
        CREATE TABLE session_items (
          session_id INTEGER NOT NULL,
          question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
          chosen TEXT,
          PRIMARY KEY (session_id, question_id)
        );
        """
    )
    conn.execute("INSERT INTO documents (id, title) VALUES (1, 'legacy')")
    conn.execute(
        "INSERT INTO questions (document_id, ext_id, answer, order_idx)"
        " VALUES (1, 'Q001', 'D', 0)"
    )
    conn.execute("INSERT INTO session_items (session_id, question_id) VALUES (1, 1)")

    _migrate(conn)
    _migrate(conn)                                    # idempotent

    row = conn.execute("SELECT * FROM questions WHERE ext_id = 'Q001'").fetchone()
    assert row["answer"] == "D"                       # data preserved
    assert conn.execute("SELECT COUNT(*) FROM session_items").fetchone()[0] == 1

    conn.execute("UPDATE questions SET answer = 'E' WHERE ext_id = 'Q001'")
    assert conn.execute("SELECT answer FROM questions").fetchone()["answer"] == "E"

    with pytest.raises(sqlite3.IntegrityError):
        conn.execute("UPDATE questions SET answer = 'AB' WHERE ext_id = 'Q001'")
    conn.close()


def test_migrate_adds_missing_document_columns() -> None:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("CREATE TABLE documents (id INTEGER PRIMARY KEY, title TEXT)")
    conn.execute("INSERT INTO documents (id, title) VALUES (1, 'old row')")

    _migrate(conn)

    cols = {row["name"] for row in conn.execute("PRAGMA table_info(documents)")}
    assert {"builtin_key", "import_source", "used_ai", "report_json"} <= cols
    row = conn.execute("SELECT * FROM documents WHERE id = 1").fetchone()
    assert row["title"] == "old row"                 # data preserved
    assert row["used_ai"] == 0                        # default backfilled
    conn.close()


def test_migrate_adds_word_grid_v2_columns() -> None:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("CREATE TABLE documents (id INTEGER PRIMARY KEY, title TEXT)")
    conn.execute(
        "CREATE TABLE word_grids (document_id INTEGER PRIMARY KEY, headers TEXT, rows_json TEXT)"
    )
    conn.execute(
        "INSERT INTO word_grids (document_id, headers, rows_json) VALUES (1, '[\"Word\"]', '[]')"
    )

    _migrate(conn)

    cols = {row["name"] for row in conn.execute("PRAGMA table_info(word_grids)")}
    assert {"columns_json", "view_json", "version"} <= cols
    row = conn.execute("SELECT * FROM word_grids WHERE document_id = 1").fetchone()
    assert row["headers"] == '["Word"]'               # data preserved
    assert row["version"] == 1                        # legacy rows stay v1 until re-saved
    conn.close()


def test_migrate_renames_legacy_deepseek_provider() -> None:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    conn.execute("INSERT INTO settings (key, value) VALUES ('provider', 'deepseek')")
    conn.execute("INSERT INTO settings (key, value) VALUES ('model', 'deepseek-chat')")

    _migrate(conn)
    _migrate(conn)                                    # idempotent

    rows = {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM settings")}
    assert rows["provider"] == "deepseek-openai"
    assert rows["model"] == "deepseek-chat"           # other settings untouched
    conn.close()


def test_migrate_is_idempotent() -> None:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("CREATE TABLE documents (id INTEGER PRIMARY KEY, title TEXT)")
    _migrate(conn)
    _migrate(conn)
    assert True
    _migrate(conn)                                    # must not raise
    conn.close()


def test_schema_creates_import_jobs() -> None:
    conn = sqlite3.connect(":memory:")
    conn.executescript(SCHEMA)
    tables = {
        row[0]
        for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
    }
    assert "import_jobs" in tables
    cols = {row[1] for row in conn.execute("PRAGMA table_info(import_jobs)")}
    assert {"id", "status", "stage", "pages_json", "warnings_json", "document_id"} <= cols
    conn.close()