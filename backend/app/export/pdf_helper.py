"""HTML -> PDF for the exporters.

The web/CLI build uses WeasyPrint. The desktop build does not ship WeasyPrint
(it needs GTK/Pango system libraries on Windows and macOS), so it renders the
same HTML in Chromium:

    INTEFLOW_PDF_BRIDGE   local HTTP endpoint exposed by the Electron main
                          process (preferred)
    INTEFLOW_PDF_HELPER   optional Electron binary for manual/CLI rendering
    INTEFLOW_PDF_HELPER_SCRIPT   path to desktop/print-pdf.cjs

Both exporters share this module so the desktop and web builds keep exactly
the same export features.
"""

from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path

TIMEOUT = 180  # seconds; large notebooks can take a while to lay out


def bridge_url() -> str | None:
    return os.environ.get("INTEFLOW_PDF_BRIDGE") or None


def _via_bridge(html_text: str, url: str) -> bytes:
    import httpx

    try:
        response = httpx.post(
            url,
            content=html_text.encode("utf-8"),
            headers={"Content-Type": "text/html; charset=utf-8"},
            timeout=TIMEOUT,
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise RuntimeError(f"PDF rendering failed: {exc}") from exc

    if not response.content.startswith(b"%PDF"):
        detail = response.text[:300] if response.text else "empty response"
        raise RuntimeError(f"PDF rendering failed: {detail}")
    return response.content


def electron_helper() -> tuple[str, str] | None:
    helper = os.environ.get("INTEFLOW_PDF_HELPER")
    script = os.environ.get("INTEFLOW_PDF_HELPER_SCRIPT")
    if not helper or not script:
        return None
    if not Path(helper).is_file() or not Path(script).is_file():
        return None
    return helper, script


def _via_electron(html_text: str, helper: str, script: str) -> bytes:
    with tempfile.TemporaryDirectory(prefix="inteflow-pdf-") as tmp:
        src = Path(tmp) / "export.html"
        dst = Path(tmp) / "export.pdf"
        src.write_text(html_text, encoding="utf-8")

        env = {k: v for k, v in os.environ.items() if k != "ELECTRON_RUN_AS_NODE"}
        env["ELECTRON_DISABLE_SECURITY_WARNINGS"] = "1"

        try:
            proc = subprocess.run(
                [helper, script, str(src), str(dst)],
                env=env,
                capture_output=True,
                text=True,
                timeout=TIMEOUT,
            )
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError("PDF rendering timed out") from exc

        if proc.returncode != 0 or not dst.is_file():
            detail = (proc.stderr or proc.stdout or "").strip()
            raise RuntimeError(f"PDF rendering failed: {detail[:400]}")
        return dst.read_bytes()


def html_to_pdf(html_text: str) -> bytes:
    """Render a self-contained HTML document to PDF bytes."""
    bridge = bridge_url()
    if bridge:
        return _via_bridge(html_text, bridge)

    helper = electron_helper()
    if helper:
        return _via_electron(html_text, *helper)

    from weasyprint import HTML

    return HTML(string=html_text).write_pdf()
