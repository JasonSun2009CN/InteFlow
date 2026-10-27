"""Question-bank ZIP import: manifest or loose .ifmd.md files (0 token)."""

from __future__ import annotations

import io
import json
import zipfile
from pathlib import Path

import pytest

from tests.conftest import MINI_IFMD
from tests.test_builtin import _make_bank

PNG = b"\x89PNG\r\n\x1a\n fake"


def _zip(entries: dict[str, str | bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name, content in entries.items():
            zf.writestr(name, content)
    return buf.getvalue()


@pytest.fixture()
def user_banks(tmp_path: Path, monkeypatch) -> Path:
    from app.api import builtin as builtin_api

    root = tmp_path / "user-banks"
    monkeypatch.setattr(builtin_api, "USER_BANKS_DIR", root)
    monkeypatch.setattr(builtin_api, "BANKS_DIR", tmp_path / "shipped-banks")
    return root


def _import(client, data: bytes, name: str = "bank.zip"):
    return client.post(
        "/api/builtin/import",
        files={"file": (name, data, "application/zip")},
    )


def _manifest(units: list[dict], **extra) -> str:
    return json.dumps(
        {"id": "my-bank", "title": "My Bank", "source": "mine.zip", "units": units, **extra},
        ensure_ascii=False,
    )


def test_import_bank_with_manifest_and_add_unit(client, user_banks: Path) -> None:
    data = _zip(
        {
            "manifest.json": _manifest([{"id": "u1", "title": "Unit One", "module": 1}]),
            "u1/doc.ifmd.md": MINI_IFMD.replace('title: "Mini Bank"', 'title: "Unit One"'),
            "u1/assets/pic.png": PNG,
        }
    )
    res = _import(client, data)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["bank_id"] == "my-bank"
    assert body["units"] == 1 and body["questions"] == 2

    banks = client.get("/api/builtin").json()
    assert len(banks) == 1
    bank = banks[0]
    assert bank["origin"] == "user" and bank["removable"] is True
    assert bank["units"][0]["assets"] == 1

    added = client.post("/api/builtin/my-bank/units/u1").json()
    assert added["added"] is True
    doc = client.get(f"/api/documents/{added['document_id']}").json()
    assert doc["title"] == "Unit One" and doc["question_count"] == 2


def test_import_bank_without_manifest_autogenerates_units(client, user_banks: Path) -> None:
    data = _zip(
        {
            "alpha.ifmd.md": MINI_IFMD,
            "beta.ifmd.md": MINI_IFMD.replace('title: "Mini Bank"', 'title: "Beta"'),
            "assets/pic.png": PNG,
        }
    )
    res = _import(client, data)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["units"] == 2 and body["questions"] == 4

    bank = client.get("/api/builtin").json()[0]
    assert {u["id"] for u in bank["units"]} == {"alpha", "beta"}
    assert all(u["assets"] == 1 for u in bank["units"])


def test_import_bank_strips_a_wrapper_folder(client, user_banks: Path) -> None:
    data = _zip(
        {
            "MyBank/manifest.json": _manifest([{"id": "u1", "title": "Unit One"}]),
            "MyBank/u1/doc.ifmd.md": MINI_IFMD,
        }
    )
    assert _import(client, data).status_code == 200
    assert client.get("/api/builtin").json()[0]["id"] == "my-bank"


def test_import_bank_rejects_zip_slip(client, user_banks: Path) -> None:
    data = _zip({"../evil.ifmd.md": MINI_IFMD})
    res = _import(client, data)
    assert res.status_code == 400
    assert not (user_banks.parent / "evil.ifmd.md").exists()


def test_import_bank_rejects_duplicate_and_bad_units(client, user_banks: Path) -> None:
    good = _zip(
        {
            "manifest.json": _manifest([{"id": "u1", "title": "Unit One"}]),
            "u1/doc.ifmd.md": MINI_IFMD,
        }
    )
    assert _import(client, good).status_code == 200
    assert _import(client, good).status_code == 409

    missing = _zip(
        {
            "manifest.json": _manifest([{"id": "u1", "title": "Unit One"}]),
            "other/doc.ifmd.md": MINI_IFMD,
        }
    )
    assert _import(client, missing).status_code == 400


def test_import_bank_rejects_broken_ifmd(client, user_banks: Path) -> None:
    data = _zip(
        {
            "manifest.json": _manifest([{"id": "u1", "title": "Unit One"}]),
            "u1/doc.ifmd.md": "not an ifmd document",
        }
    )
    res = _import(client, data)
    assert res.status_code == 400
    assert not (user_banks / "my-bank").exists()


def test_remove_user_bank_but_not_shipped(client, user_banks: Path) -> None:
    data = _zip(
        {
            "manifest.json": _manifest([{"id": "u1", "title": "Unit One"}]),
            "u1/doc.ifmd.md": MINI_IFMD,
        }
    )
    assert _import(client, data).status_code == 200
    assert client.delete("/api/builtin/my-bank").json()["deleted"] == 1
    assert client.get("/api/builtin").json() == []

    from app.api import builtin as builtin_api

    shipped = _make_bank(builtin_api.BANKS_DIR, {"u1": "Unit One"})
    res = client.delete(f"/api/builtin/{shipped}")
    assert res.status_code == 403
