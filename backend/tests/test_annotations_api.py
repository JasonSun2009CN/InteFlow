"""Highlights and per-question notes API (local, 0 token)."""

from __future__ import annotations

from tests.conftest import MINI_IFMD, upload


def _doc(client) -> tuple[int, list[dict]]:
    resp = upload(client, "annotations.ifmd.md", MINI_IFMD)
    assert resp.status_code == 200, resp.text
    doc_id = resp.json()["id"]
    return doc_id, client.get(f"/api/documents/{doc_id}/questions").json()


def test_highlight_crud_and_notes(client) -> None:
    doc_id, questions = _doc(client)
    question_id = questions[0]["id"]

    created = client.post(
        f"/api/documents/{doc_id}/annotations",
        json={
            "question_id": question_id,
            "field": "stem",
            "quote": "best completes",
            "occurrence": 0,
            "color": "green",
            "note": "watch the tense",
            "start": 10,
            "end": 23,
        },
    )
    assert created.status_code == 200, created.text
    highlight = created.json()
    assert highlight["quote"] == "best completes"
    assert highlight["color"] == "green"

    listed = client.get(f"/api/documents/{doc_id}/annotations")
    assert listed.status_code == 200
    assert len(listed.json()["highlights"]) == 1
    assert listed.json()["highlights"][0]["note"] == "watch the tense"

    patched = client.patch(
        f"/api/documents/{doc_id}/annotations/{highlight['id']}",
        json={"color": "pink", "note": "updated"},
    )
    assert patched.status_code == 200
    assert patched.json()["color"] == "pink"
    assert patched.json()["note"] == "updated"

    saved = client.put(
        f"/api/documents/{doc_id}/questions/{question_id}/note",
        json={"content": "Read the scope word first."},
    )
    assert saved.status_code == 200
    assert saved.json()["content"] == "Read the scope word first."
    assert (
        client.get(f"/api/documents/{doc_id}/annotations").json()["notes"][
            str(question_id)
        ]
        == "Read the scope word first."
    )

    removed = client.delete(
        f"/api/documents/{doc_id}/annotations/{highlight['id']}"
    )
    assert removed.status_code == 200
    assert client.get(f"/api/documents/{doc_id}/annotations").json()["highlights"] == []


def test_highlight_validation(client) -> None:
    doc_id, questions = _doc(client)
    question_id = questions[0]["id"]

    bad_color = client.post(
        f"/api/documents/{doc_id}/annotations",
        json={
            "question_id": question_id,
            "field": "stem",
            "quote": "x",
            "color": "orange",
        },
    )
    assert bad_color.status_code == 422

    bad_field = client.post(
        f"/api/documents/{doc_id}/annotations",
        json={
            "question_id": question_id,
            "field": "page",
            "quote": "x",
        },
    )
    assert bad_field.status_code == 422

    empty = client.post(
        f"/api/documents/{doc_id}/annotations",
        json={"question_id": question_id, "field": "stem", "quote": "   "},
    )
    assert empty.status_code == 422

    other = client.post(
        f"/api/documents/{doc_id}/annotations",
        json={"question_id": 999999, "field": "stem", "quote": "x"},
    )
    assert other.status_code == 404
