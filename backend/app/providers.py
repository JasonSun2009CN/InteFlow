"""Model-service-provider catalog.

A *provider* is the service that hosts models and exposes them at a base
URL (Groq, DeepSeek, OrcaRouter, …). A *protocol* is the wire format the
service speaks — OpenAI's ``chat/completions`` (Bearer auth) or Anthropic's
``messages`` (``x-api-key`` auth). "OpenAI" and "Anthropic" are therefore
protocols, not providers, and one protocol-compatible provider generally
works with any service that exposes it.

Base URLs are listed exactly as each vendor documents them, which means the
two families differ: OpenAI-style bases carry the version path already
(``https://api.openai.com/v1``) while Anthropic-style bases do not, because
the Anthropic SDK adds ``/v1`` itself. :func:`endpoint_url` inserts the
version only when it is missing, so either shape works.

Base URLs below were verified against each provider's official docs
(2026-10-06; xAI / DeepSeek-Anthropic / custom-Anthropic re-checked 2026-10-19):

- OrcaRouter     https://api.orcarouter.ai/v1        (orcarouter.ai)
- OpenAI         https://api.openai.com/v1           (standard)
- Groq           https://api.groq.com/openai/v1      (GroqDocs)
- xAI (Grok)     https://api.x.ai/v1                 (xAI docs; flagship grok-4.7)
- Mistral AI     https://api.mistral.ai/v1           (standard)
- DeepSeek (OpenAI)     https://api.deepseek.com/v1       (api-docs.deepseek.com)
- DeepSeek (Anthropic)  https://api.deepseek.com/anthropic   (Anthropic-compatible; app adds /v1/messages)
- Together AI    https://api.together.xyz/v1        (standard)
- Fireworks AI   https://api.fireworks.ai/inference/v1  (official)
- NVIDIA NIM     https://integrate.api.nvidia.com/v1    (docs.api.nvidia.com)
- Ollama local   http://127.0.0.1:11434/v1          (standard)
- Moonshot (Kimi) https://api.moonshot.cn/v1         (platform.moonshot.cn)
- MiniMax        https://api.minimaxi.com/v1         (CN; api.minimax.io/v1 is the intl endpoint)
- DashScope intl https://dashscope-us.aliyuncs.com/compatible-mode/v1 (Aliyun docs)
- OpenRouter     https://openrouter.ai/api/v1        (standard; auto: openrouter/auto)
- OpenPaths      https://openpaths.io/v1             (openpaths.io; auto: openpaths/auto)
- Anthropic      https://api.anthropic.com           (Messages protocol; app adds /v1/messages)
- Custom         no default URL (user-provided, OpenAI-compatible)
- Custom (Anthropic)  no default URL (user-provided, Anthropic-compatible; app adds /v1/messages)
"""

from __future__ import annotations

import re

PROTOCOL_OPENAI = "openai"
PROTOCOL_ANTHROPIC = "anthropic"
PROTOCOLS = (PROTOCOL_OPENAI, PROTOCOL_ANTHROPIC)

# The service a fresh install talks to until Settings says otherwise.
DEFAULT_PROVIDER = "orcarouter"

# Provider ids that were renamed; kept resolving so old saved settings still work.
# `db._migrate` rewrites the stored value on the next startup.
LEGACY_PROVIDER_IDS = {"deepseek": "deepseek-openai"}

PROVIDERS: list[dict] = [
    {
        "id": "orcarouter",
        "name": "OrcaRouter",
        "base_url": "https://api.orcarouter.ai/v1",
        "protocol": PROTOCOL_OPENAI,
        "default_model": "orcarouter/auto",
        "note": "Routes every request to the cheapest live model — use model orcarouter/auto.",
    },
    {
        "id": "openai",
        "name": "OpenAI",
        "base_url": "https://api.openai.com/v1",
        "protocol": PROTOCOL_OPENAI,
        "default_model": None,
        "note": "",
    },
    {
        "id": "groq",
        "name": "Groq",
        "base_url": "https://api.groq.com/openai/v1",
        "protocol": PROTOCOL_OPENAI,
        "default_model": None,
        "note": "",
    },
    {
        "id": "xai",
        "name": "xAI (Grok)",
        "base_url": "https://api.x.ai/v1",
        "protocol": PROTOCOL_OPENAI,
        "default_model": "grok-4.7",
        "note": "xAI's Grok models — not to be confused with Groq (the LPU inference service).",
    },
    {
        "id": "mistral",
        "name": "Mistral AI",
        "base_url": "https://api.mistral.ai/v1",
        "protocol": PROTOCOL_OPENAI,
        "default_model": None,
        "note": "",
    },
    {
        "id": "deepseek-openai",
        "name": "DeepSeek (OpenAI-compatible)",
        "base_url": "https://api.deepseek.com/v1",
        "protocol": PROTOCOL_OPENAI,
        "default_model": None,
        "note": "OpenAI chat/completions endpoint. Official base is api.deepseek.com; /v1 is the OpenAI-SDK-compatible form.",
    },
    {
        "id": "deepseek-anthropic",
        "name": "DeepSeek (Anthropic-compatible)",
        "base_url": "https://api.deepseek.com/anthropic",
        "protocol": PROTOCOL_ANTHROPIC,
        "default_model": "deepseek-flash",
        "note": "Anthropic Messages endpoint, exactly as DeepSeek documents it — /v1/messages is added for you.",
    },
    {
        "id": "together",
        "name": "Together AI",
        "base_url": "https://api.together.xyz/v1",
        "protocol": PROTOCOL_OPENAI,
        "default_model": None,
        "note": "",
    },
    {
        "id": "fireworks",
        "name": "Fireworks AI",
        "base_url": "https://api.fireworks.ai/inference/v1",
        "protocol": PROTOCOL_OPENAI,
        "default_model": None,
        "note": "",
    },
    {
        "id": "nvidia",
        "name": "NVIDIA NIM",
        "base_url": "https://integrate.api.nvidia.com/v1",
        "protocol": PROTOCOL_OPENAI,
        "default_model": None,
        "note": "",
    },
    {
        "id": "ollama",
        "name": "Ollama (local)",
        "base_url": "http://127.0.0.1:11434/v1",
        "protocol": PROTOCOL_OPENAI,
        "default_model": None,
        "note": "Runs fully offline on this machine — no API key needed.",
    },
    {
        "id": "moonshot",
        "name": "Moonshot (Kimi)",
        "base_url": "https://api.moonshot.cn/v1",
        "protocol": PROTOCOL_OPENAI,
        "default_model": None,
        "note": "",
    },
    {
        "id": "minimax",
        "name": "MiniMax",
        "base_url": "https://api.minimaxi.com/v1",
        "protocol": PROTOCOL_OPENAI,
        "default_model": None,
        "note": "China endpoint — international accounts use api.minimax.io/v1.",
    },
    {
        "id": "dashscope",
        "name": "DashScope (international)",
        "base_url": "https://dashscope-us.aliyuncs.com/compatible-mode/v1",
        "protocol": PROTOCOL_OPENAI,
        "default_model": None,
        "note": "Aliyun Model Studio US region, OpenAI-compatible mode.",
    },
    {
        "id": "openrouter",
        "name": "OpenRouter",
        "base_url": "https://openrouter.ai/api/v1",
        "protocol": PROTOCOL_OPENAI,
        "default_model": "openrouter/auto",
        "note": "Gateway with auto-routing — use model openrouter/auto.",
    },
    {
        "id": "openpaths",
        "name": "OpenPaths",
        "base_url": "https://openpaths.io/v1",
        "protocol": PROTOCOL_OPENAI,
        "default_model": "openpaths/auto",
        "note": "Open-source model router — use model openpaths/auto.",
    },
    {
        "id": "anthropic",
        "name": "Anthropic",
        "base_url": "https://api.anthropic.com",
        "protocol": PROTOCOL_ANTHROPIC,
        "default_model": None,
        "note": "Speaks the Anthropic Messages protocol (x-api-key auth).",
    },
    {
        "id": "custom",
        "name": "Custom (OpenAI-compatible)",
        "base_url": "",
        "protocol": PROTOCOL_OPENAI,
        "default_model": None,
        "note": "Enter any OpenAI-compatible base URL.",
    },
    {
        "id": "custom-anthropic",
        "name": "Custom (Anthropic-compatible)",
        "base_url": "",
        "protocol": PROTOCOL_ANTHROPIC,
        "default_model": None,
        "note": "Enter any Anthropic-compatible base URL — with or without the /v1 version path.",
    },
]


def get_provider(provider_id: str) -> dict | None:
    """Look up a provider preset by id, or None when unknown.

    Legacy ids that were renamed still resolve (:data:`LEGACY_PROVIDER_IDS`).
    """
    provider_id = LEGACY_PROVIDER_IDS.get(provider_id, provider_id)
    return next((p for p in PROVIDERS if p["id"] == provider_id), None)


def provider_ids() -> tuple[str, ...]:
    return tuple(p["id"] for p in PROVIDERS)


def default_base_url(provider_id: str) -> str:
    """The official base URL for a provider preset ('' for unknown/custom)."""
    p = get_provider(provider_id)
    return p["base_url"] if p else ""


def default_protocol(provider_id: str) -> str:
    """The wire protocol a provider preset speaks (OpenAI by default)."""
    p = get_provider(provider_id)
    return p["protocol"] if p else PROTOCOL_OPENAI


_VERSION_SEGMENT = re.compile(r"^v\d")


def endpoint_url(base_url: str, protocol: str, path: str) -> str:
    """Join a base URL with an API path (``/chat/completions``, ``/messages``…).

    The transport appends the path to whatever the user stored, so a base URL
    must not lose its version segment — but vendors disagree on who owns it.
    OpenAI-style bases already include it (``https://api.openai.com/v1``);
    Anthropic-style ones do not, because the Anthropic SDK adds ``/v1`` itself
    (``https://api.deepseek.com/anthropic`` → ``/anthropic/v1/messages``).
    Insert ``/v1`` for Anthropic only when the base does not already end with
    a version segment, so both documented shapes work as-is.
    """
    base = base_url.strip().rstrip("/")
    if protocol == PROTOCOL_ANTHROPIC and base:
        if not _VERSION_SEGMENT.match(base.rsplit("/", 1)[-1]):
            base += "/v1"
    return base + path