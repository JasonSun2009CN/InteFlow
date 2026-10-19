"""Provider catalog: presets, legacy ids, and endpoint-URL joining rules."""

from __future__ import annotations

import pytest

from app.providers import (
    DEFAULT_PROVIDER,
    PROTOCOLS,
    PROVIDERS,
    endpoint_url,
    get_provider,
)

FIELDS = {"id", "name", "base_url", "protocol", "default_model", "note"}


def test_default_provider_is_orcarouter() -> None:
    assert DEFAULT_PROVIDER == "orcarouter"
    assert get_provider(DEFAULT_PROVIDER) is not None


def test_catalog_entries_are_well_formed() -> None:
    ids = [p["id"] for p in PROVIDERS]
    assert len(ids) == len(set(ids)), "duplicate provider ids"
    for p in PROVIDERS:
        assert set(p) == FIELDS, p["id"]
        assert p["protocol"] in PROTOCOLS, p["id"]
        assert p["name"], p["id"]
        # Only the catch-all "custom*" presets ship without a base URL.
        if not p["base_url"]:
            assert p["id"].startswith("custom"), p["id"]


def test_openai_presets_carry_their_version_path() -> None:
    # The transport appends /chat/completions, so OpenAI-style defaults keep /v1.
    for p in PROVIDERS:
        if p["protocol"] == "openai" and p["base_url"]:
            assert p["base_url"].rstrip("/").endswith("/v1"), p["id"]


def test_legacy_ids_still_resolve() -> None:
    legacy = get_provider("deepseek")
    assert legacy is not None
    assert legacy["id"] == "deepseek-openai"
    assert legacy["protocol"] == "openai"


@pytest.mark.parametrize(
    ("base", "protocol", "path", "expected"),
    [
        ("https://api.openai.com/v1", "openai", "/chat/completions",
         "https://api.openai.com/v1/chat/completions"),
        ("https://api.deepseek.com", "openai", "/chat/completions",
         "https://api.deepseek.com/chat/completions"),
        ("https://api.orcarouter.ai/v1/", "openai", "/chat/completions",
         "https://api.orcarouter.ai/v1/chat/completions"),
        ("https://api.anthropic.com", "anthropic", "/messages",
         "https://api.anthropic.com/v1/messages"),
        ("https://api.deepseek.com/anthropic", "anthropic", "/messages",
         "https://api.deepseek.com/anthropic/v1/messages"),
        ("https://api.deepseek.com/anthropic/v1", "anthropic", "/messages",
         "https://api.deepseek.com/anthropic/v1/messages"),
        ("https://gw.example.com/api/v2/", "anthropic", "/messages",
         "https://gw.example.com/api/v2/messages"),
        ("https://api.anthropic.com", "anthropic", "/models",
         "https://api.anthropic.com/v1/models"),
    ],
)
def test_endpoint_url(base: str, protocol: str, path: str, expected: str) -> None:
    assert endpoint_url(base, protocol, path) == expected
