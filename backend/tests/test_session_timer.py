"""Timing method persistence: per-paper default, global fallback, validation."""

from __future__ import annotations

from tests.conftest import MINI_IFMD, upload


def _import_mini(client, name: str = "mini.ifmd.md") -> int:
    resp = upload(client, name, MINI_IFMD)
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def _start(client, doc_id: int) -> int:
    resp = client.post("/api/sessions", json={"document_id": doc_id})
    assert resp.status_code == 200, resp.text
    return resp.json()["session_id"]


def test_timer_choice_becomes_this_papers_default(client) -> None:
    doc_id = _import_mini(client, "timer-doc-a.ifmd.md")
    other_id = _import_mini(client, "timer-doc-b.ifmd.md")
    session_id = _start(client, doc_id)

    saved = client.patch(
        f"/api/sessions/{session_id}/timer",
        json={"mode": "countdown", "seconds": 1800},
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["timer_mode"] == "countdown"
    assert saved.json()["timer_seconds"] == 1800

    # An unfinished attempt is not an exam record yet.
    before = client.get(
        "/api/sessions/timer-preference", params={"document_id": doc_id}
    ).json()
    assert before["source"] != "document"

    client.post(f"/api/sessions/{session_id}/submit", json={"answers": {}})

    own = client.get(
        "/api/sessions/timer-preference", params={"document_id": doc_id}
    ).json()
    assert own == {"mode": "countdown", "seconds": 1800, "source": "document"}

    # Another paper without attempts inherits the most recent record.
    other = client.get(
        "/api/sessions/timer-preference", params={"document_id": other_id}
    ).json()
    assert other["source"] == "global"
    assert other["mode"] == "countdown"
    assert other["seconds"] == 1800

    # The stored attempt exposes the same choice.
    detail = client.get(f"/api/sessions/{session_id}").json()
    assert detail["timer_mode"] == "countdown"
    assert detail["timer_seconds"] == 1800


def test_countup_clears_the_countdown_length(client) -> None:
    doc_id = _import_mini(client, "timer-doc-c.ifmd.md")
    session_id = _start(client, doc_id)

    client.patch(
        f"/api/sessions/{session_id}/timer",
        json={"mode": "countdown", "seconds": 60},
    )
    saved = client.patch(
        f"/api/sessions/{session_id}/timer", json={"mode": "countup"}
    ).json()
    assert saved["timer_mode"] == "countup"
    assert saved["timer_seconds"] is None


def test_timer_validation(client) -> None:
    doc_id = _import_mini(client, "timer-doc-d.ifmd.md")
    session_id = _start(client, doc_id)

    missing = client.patch(
        f"/api/sessions/{session_id}/timer", json={"mode": "countdown"}
    )
    assert missing.status_code == 400

    zero = client.patch(
        f"/api/sessions/{session_id}/timer",
        json={"mode": "countdown", "seconds": 0},
    )
    assert zero.status_code == 400

    too_long = client.patch(
        f"/api/sessions/{session_id}/timer",
        json={"mode": "countdown", "seconds": 24 * 60 * 60 + 1},
    )
    assert too_long.status_code == 400

    unknown = client.patch(
        f"/api/sessions/{session_id}/timer", json={"mode": "stopwatch"}
    )
    assert unknown.status_code == 422

    missing_session = client.patch(
        "/api/sessions/999999/timer", json={"mode": "countup"}
    )
    assert missing_session.status_code == 404

    unknown_doc = client.get(
        "/api/sessions/timer-preference", params={"document_id": 999999}
    )
    assert unknown_doc.status_code == 404
