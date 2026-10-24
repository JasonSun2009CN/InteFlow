"""LLM provider settings: read/write config, provider catalog and probe.

The API key is write-only: GET returns a masked form, never the raw value.
The stored config is read server-side when the LLM layer runs (Phase 2/4).

Distinction the app now enforces:
- provider   = the service hosting models (OrcaRouter, Groq, DeepSeek, …),
               each with an officially documented default base URL;
- protocol   = the wire format that service speaks (openai | anthropic),
               implied by the chosen provider but storable explicitly.
"""

from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.providers import (
    DEFAULT_PROVIDER,
    PROVIDERS,
    PROTOCOLS,
    default_base_url,
    default_protocol,
    endpoint_url,
    get_provider,
)
from app.repos import settings as settings_repo

router = APIRouter(prefix="/api/settings", tags=["settings"])

PROBE_TIMEOUT = 10.0


class SettingsPayload(BaseModel):
    provider: str | None = None
    protocol: str | None = None       # explicit override; otherwise implied by provider
    base_url: str | None = None
    api_key: str | None = None       # write-only; blank means "keep stored key"
    model: str | None = None
    clear_key: bool = False          # explicit wipe; blank alone keeps the key
    user_name: str | None = None     # printed on page 1 of every analysis notebook
    analysis_template: str | None = None  # pre-filled into empty analysis pages
    llm_fallback: bool | None = None  # allow AI question recognition when parsing fails
    vocab_ai_sense: bool | None = None  # AI picks the MW sense on drag-to-vocabulary
    vocab_learner_definitions: bool | None = None  # prefer the in-entry learner section
    vocab_exam_ai_grading: bool | None = None  # AI may grade word-test answers
    custom_dictionary_enabled: bool | None = None  # consult the user dictionary first
    show_builtin_library: bool | None = None  # show the bundled sample bank in Library


def _mask(key: str) -> str:
    if len(key) <= 8:
        return "•" * len(key)
    return f"{key[:4]}…{key[-4:]}"


def _load() -> dict[str, str]:
    stored = settings_repo.get_all()
    provider = stored.get("provider") or DEFAULT_PROVIDER
    return {
        "provider": provider,
        "protocol": stored.get("protocol") or default_protocol(provider),
        "base_url": stored.get("base_url", ""),
        "api_key": stored.get("api_key", ""),
        "model": stored.get("model", ""),
        "user_name": stored.get("user_name", ""),
        "analysis_template": stored.get("analysis_template", ""),
        "llm_fallback": stored.get("llm_fallback", "1"),
        "vocab_ai_sense": stored.get("vocab_ai_sense", "1"),
        "vocab_learner_definitions": stored.get("vocab_learner_definitions", "0"),
        "vocab_exam_ai_grading": stored.get("vocab_exam_ai_grading", "0"),
        "custom_dictionary_enabled": stored.get("custom_dictionary_enabled", "1"),
        "show_builtin_library": stored.get("show_builtin_library", "0"),
    }


def _view(s: dict[str, str]) -> dict:
    return {
        "provider": s["provider"],
        "protocol": s["protocol"],
        "base_url": s["base_url"],
        "model": s["model"],
        "api_key_masked": _mask(s["api_key"]) if s["api_key"] else "",
        "api_key_set": bool(s["api_key"]),
        "user_name": s["user_name"],
        "analysis_template": s["analysis_template"],
        "llm_fallback": s["llm_fallback"] != "0",
        "vocab_ai_sense": s["vocab_ai_sense"] != "0",
        "vocab_learner_definitions": s["vocab_learner_definitions"] == "1",
        "vocab_exam_ai_grading": s["vocab_exam_ai_grading"] == "1",
        "custom_dictionary_enabled": s["custom_dictionary_enabled"] != "0",
        "show_builtin_library": s["show_builtin_library"] == "1",
    }


@router.get("")
def get_settings() -> dict:
    return _view(_load())


@router.put("")
def put_settings(payload: SettingsPayload) -> dict:
    updates: dict[str, str] = {}
    if payload.provider is not None:
        provider = payload.provider.strip()
        if get_provider(provider) is None:
            raise HTTPException(
                status_code=400,
                detail=f"unknown provider {provider!r} — pick one from /api/settings/providers",
            )
        updates["provider"] = provider
        # The provider implies a protocol by default, but an explicit
        # protocol (second block below) always wins when both are sent.
        updates["protocol"] = default_protocol(provider)
    if payload.protocol is not None:
        protocol = payload.protocol.strip()
        if protocol not in PROTOCOLS:
            raise HTTPException(
                status_code=400,
                detail=f"protocol must be one of {', '.join(PROTOCOLS)}",
            )
        updates["protocol"] = protocol
    for field in ("base_url", "model"):
        value = getattr(payload, field)
        if value is not None:
            updates[field] = value.strip()
    if payload.clear_key:
        updates["api_key"] = ""
    elif payload.api_key and payload.api_key.strip():
        updates["api_key"] = payload.api_key.strip()
    if payload.user_name is not None:
        updates["user_name"] = payload.user_name.strip()
    if payload.analysis_template is not None:
        # Markdown: keep the author's line breaks and spacing exactly as typed.
        updates["analysis_template"] = payload.analysis_template
    if payload.llm_fallback is not None:
        updates["llm_fallback"] = "1" if payload.llm_fallback else "0"
    if payload.vocab_ai_sense is not None:
        updates["vocab_ai_sense"] = "1" if payload.vocab_ai_sense else "0"
    if payload.vocab_learner_definitions is not None:
        updates["vocab_learner_definitions"] = (
            "1" if payload.vocab_learner_definitions else "0"
        )
    if payload.vocab_exam_ai_grading is not None:
        updates["vocab_exam_ai_grading"] = (
            "1" if payload.vocab_exam_ai_grading else "0"
        )
    if payload.custom_dictionary_enabled is not None:
        updates["custom_dictionary_enabled"] = (
            "1" if payload.custom_dictionary_enabled else "0"
        )
    if payload.show_builtin_library is not None:
        updates["show_builtin_library"] = "1" if payload.show_builtin_library else "0"
    settings_repo.set_values(updates)
    return _view(_load())


class TestPayload(SettingsPayload):
    """Probe with unsaved form values; falls back to the stored config."""


@router.post("/test")
def test_connection(payload: TestPayload) -> dict:
    s = _load()
    provider = (payload.provider or s["provider"]).strip()
    if get_provider(provider) is None:
        raise HTTPException(
            status_code=400,
            detail=f"unknown provider {provider!r} — pick one from /api/settings/providers",
        )
    explicit_provider = payload.provider is not None and bool(payload.provider.strip())
    if explicit_provider:
        # WYSIWYG: an explicitly named provider implies its own protocol,
        # never a stale protocol left behind by a different provider.
        protocol = payload.protocol or default_protocol(provider)
    else:
        protocol = payload.protocol or s["protocol"] or default_protocol(provider)
    if payload.base_url is not None and payload.base_url.strip():
        base_url = payload.base_url.strip()
    else:
        # Blank form value → the provider's official default; only for
        # providers without one (custom) fall back to a stored base URL.
        base_url = default_base_url(provider) or s["base_url"]
    if not base_url:
        return {"ok": False, "detail": "this provider needs a base URL — enter it in Settings"}
    api_key = payload.api_key.strip() if payload.api_key else s["api_key"]
    if not api_key:
        return {"ok": False, "detail": "no API key yet — paste a key first"}

    base = base_url.rstrip("/")
    # A pasted full endpoint is left alone; otherwise build base + /models with
    # the same version-segment rule the LLM transport uses.
    url = base if base.endswith("/models") else endpoint_url(base, protocol, "/models")
    if protocol == "anthropic":
        headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01"}
    else:
        headers = {"Authorization": f"Bearer {api_key}"}

    try:
        response = httpx.get(url, headers=headers, timeout=PROBE_TIMEOUT)
    except httpx.HTTPError as exc:
        return {"ok": False, "detail": f"could not reach {url}: {type(exc).__name__}"}

    if response.status_code in (401, 403):
        return {"ok": False, "detail": "authentication failed — check the API key"}
    if response.status_code == 404:
        return {"ok": False, "detail": f"404 at {url} — check the base URL"}
    if response.status_code != 200:
        return {"ok": False, "detail": f"HTTP {response.status_code} from {url}"}

    model_ids: list[str] = []
    try:
        model_ids = [m.get("id", "") for m in response.json().get("data", [])]
    except Exception:  # noqa: BLE001 - a non-JSON body still means we connected
        pass
    detail = f"connected — {len(model_ids)} models available" if model_ids else "connected"
    if payload.model and model_ids and payload.model not in model_ids:
        return {"ok": True, "detail": f"{detail}, but model '{payload.model}' is not listed"}
    return {"ok": True, "detail": detail}


@router.get("/providers")
def list_providers() -> list[dict]:
    """The curated provider catalog (providers are services, not protocols).

    OrcaRouter is first by design; every entry carries its official base
    URL, implied protocol and optional auto-routing default model.
    """
    return list(PROVIDERS)