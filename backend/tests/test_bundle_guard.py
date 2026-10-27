"""The packaged desktop bundle must never contain the copyrighted sample bank."""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / "desktop" / "verify_bundle.py"


@pytest.fixture(scope="module")
def guard():
    spec = importlib.util.spec_from_file_location("inteflow_verify_bundle", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_bundle_guard_flags_sample_bank(guard, tmp_path: Path) -> None:
    bank = tmp_path / "backend" / "_internal" / "app" / "builtin" / "sat2025-rw-b"
    bank.mkdir(parents=True)
    (bank / "manifest.json").write_text("{}", encoding="utf-8")
    found = guard.find_forbidden(tmp_path)
    assert any("builtin/sat2025-rw-b" in rel for rel in found)


def test_bundle_guard_allows_api_code(guard, tmp_path: Path) -> None:
    api = tmp_path / "backend" / "_internal" / "app" / "api"
    api.mkdir(parents=True)
    (api / "builtin.py").write_text("", encoding="utf-8")
    assert guard.find_forbidden(tmp_path) == []
