"""User-defined subject labels: CRUD + assigning papers."""

from __future__ import annotations

from tests.conftest import MINI_IFMD, upload


def _doc(client) -> dict:
    resp = upload(client, "mini.ifmd.md", MINI_IFMD)
    assert resp.status_code == 200, resp.text
    return resp.json()


def _subject(client, name: str, color: str | None = None) -> dict:
    payload = {"name": name}
    if color is not None:
        payload["color"] = color
    resp = client.post("/api/subjects", json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_create_and_list_subjects(client) -> None:
    subject = _subject(client, "Subject List Test", "emerald")
    assert subject["name"] == "Subject List Test"
    assert subject["color"] == "emerald"
    assert subject["document_count"] == 0

    listed = client.get("/api/subjects").json()
    assert any(item["id"] == subject["id"] for item in listed)


def test_auto_assigns_a_palette_color(client) -> None:
    subject = _subject(client, "Auto Color Test")
    assert subject["color"] in {
        "blue",
        "emerald",
        "amber",
        "rose",
        "violet",
        "cyan",
        "lime",
        "slate",
    }


def test_rename_and_recolor(client) -> None:
    subject = _subject(client, "Rename Test", "blue")
    resp = client.patch(
        f"/api/subjects/{subject['id']}",
        json={"name": "Renamed Subject", "color": "violet"},
    )
    assert resp.status_code == 200, resp.text
    updated = resp.json()
    assert updated["name"] == "Renamed Subject"
    assert updated["color"] == "violet"


def test_duplicate_names_are_case_insensitive(client) -> None:
    _subject(client, "Duplicate Subject")
    resp = client.post("/api/subjects", json={"name": "  duplicate subject  "})
    assert resp.status_code == 409


def test_validates_name_and_color(client) -> None:
    assert client.post("/api/subjects", json={"name": "   "}).status_code == 400
    assert (
        client.post("/api/subjects", json={"name": "Bad Color", "color": "rainbow"}).status_code
        == 400
    )
    assert (
        client.post("/api/subjects", json={"name": "x" * 41}).status_code == 400
    )
    subject = _subject(client, "Patch Validation")
    assert client.patch(f"/api/subjects/{subject['id']}", json={}).status_code == 400


def test_assign_subject_to_document_and_unassign(client) -> None:
    doc = _doc(client)
    assert doc["subject"] is None
    subject = _subject(client, "Assign Test", "amber")

    resp = client.patch(
        f"/api/documents/{doc['id']}", json={"subject_id": subject["id"]}
    )
    assert resp.status_code == 200, resp.text
    assigned = resp.json()
    assert assigned["subject"] == {
        "id": subject["id"],
        "name": "Assign Test",
        "color": "amber",
    }

    # both the detail and list endpoints carry the label
    detail = client.get(f"/api/documents/{doc['id']}").json()
    assert detail["subject"]["name"] == "Assign Test"
    listed = client.get("/api/documents").json()
    mine = next(item for item in listed if item["id"] == doc["id"])
    assert mine["subject"]["id"] == subject["id"]

    subjects = client.get("/api/subjects").json()
    mine = next(item for item in subjects if item["id"] == subject["id"])
    assert mine["document_count"] == 1

    cleared = client.patch(f"/api/documents/{doc['id']}", json={"subject_id": None})
    assert cleared.status_code == 200
    assert cleared.json()["subject"] is None


def test_deleting_a_subject_uncategorizes_its_papers(client) -> None:
    doc = _doc(client)
    subject = _subject(client, "Delete Test")
    client.patch(f"/api/documents/{doc['id']}", json={"subject_id": subject["id"]})

    assert client.delete(f"/api/subjects/{subject['id']}").status_code == 200

    detail = client.get(f"/api/documents/{doc['id']}").json()
    assert detail["subject"] is None
    assert client.delete(f"/api/subjects/{subject['id']}").status_code == 404


def test_unknown_ids_are_rejected(client) -> None:
    doc = _doc(client)
    assert (
        client.patch("/api/documents/999999", json={"subject_id": None}).status_code
        == 404
    )
    assert (
        client.patch(f"/api/documents/{doc['id']}", json={"subject_id": 999999}).status_code
        == 404
    )
    assert client.patch("/api/subjects/999999", json={"name": "Nope"}).status_code == 404


def test_document_patch_requires_a_field(client) -> None:
    doc = _doc(client)
    assert client.patch(f"/api/documents/{doc['id']}", json={}).status_code == 400
