"""InteFlow API server — FastAPI entry point (PLAN.md §4)."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api import (
    ai,
    analysis,
    builtin,
    custom_dictionary,
    dictionary,
    documents,
    imports,
    review,
    sessions,
    settings,
    subjects,
    vocabulary,
    word_exam,
)
from app.convert import ocr
from app.db import init_db

VERSION = "0.1.0"


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="InteFlow", version=VERSION, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # local-only app; the Vite dev server proxies /api anyway
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(documents.router)
app.include_router(imports.router)
app.include_router(builtin.router)
app.include_router(sessions.router)
app.include_router(settings.router)
app.include_router(ai.router)
app.include_router(analysis.router)
app.include_router(dictionary.router)
app.include_router(vocabulary.router)
app.include_router(word_exam.router)
app.include_router(subjects.router)
app.include_router(review.router)
app.include_router(custom_dictionary.router)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "version": VERSION, "ocr": ocr.available_engines()}


def _mount_frontend(application: FastAPI) -> None:
    """Serve the built React app from FastAPI in the desktop build.

    Set ``INTEFLOW_STATIC_DIR`` to ``frontend/dist`` (the Electron app points it
    at its bundled copy). API routes are registered before the catch-all, so
    they always win; unknown ``/api/*`` paths stay 404 instead of returning
    ``index.html``.
    """
    configured = os.environ.get("INTEFLOW_STATIC_DIR")
    if not configured:
        return
    root = Path(configured).expanduser().resolve()
    index = root / "index.html"
    if not index.is_file():
        return

    assets = root / "assets"
    if assets.is_dir():
        application.mount("/assets", StaticFiles(directory=assets), name="assets")

    @application.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        if path == "api" or path.startswith("api/"):
            raise HTTPException(status_code=404)
        candidate = (root / path).resolve()
        if path and (candidate == root or root in candidate.parents) and candidate.is_file():
            return FileResponse(candidate)
        # BrowserRouter routes such as /doc/12/practice need the SPA shell.
        return FileResponse(index)


_mount_frontend(app)
