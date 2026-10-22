"""PyInstaller entry point for the bundled InteFlow backend.

Run by the Electron main process with:
    INTEFLOW_PORT, INTEFLOW_DATA, INTEFLOW_STATIC_DIR, ...
"""

from __future__ import annotations

import os

import uvicorn

from app.main import app


def main() -> None:
    port = int(os.environ.get("INTEFLOW_PORT", "8000"))
    log_level = os.environ.get("INTEFLOW_LOG_LEVEL", "info")
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=port,
        log_level=log_level,
        access_log=False,
        loop="asyncio",
        http="h11",
        ws="none",
        lifespan="on",
    )


if __name__ == "__main__":
    main()
