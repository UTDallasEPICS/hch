"""
FastAPI entry point for the PDF/Word/Google-Docs extraction service.

Endpoints
---------
POST /extract/file
    Accepts a multipart upload (PDF or DOCX).
    Returns ExtractionResult JSON.

POST /extract/gdoc
    Accepts a JSON body { "doc_id": "<google-doc-id>" }.
    Returns ExtractionResult JSON.

GET  /health
    Liveness probe.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from normalizer import MIME_DOCX, MIME_GDOC, MIME_PDF, route
from schema import ExtractionResult


app = FastAPI(
    title="Form Extraction Service",
    description="Deterministic extraction of form fields from PDF, DOCX, and Google Docs.",
    version="1.0.0",
)

# Allow the Nuxt dev server (port 3000) and any configured origin to call this API
_ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── MIME detection helpers ───────────────────────────────────────────────────

def _detect_mime(upload: UploadFile) -> str:
    """
    Prefer the browser-supplied content_type; fall back to file-extension
    mapping so Windows/Mac discrepancies don't break routing.
    """
    ct = (upload.content_type or "").lower()
    if "pdf" in ct:
        return MIME_PDF
    if "wordprocessingml" in ct or "docx" in ct or upload.filename.endswith(".docx"):
        return MIME_DOCX
    if upload.filename.endswith(".pdf"):
        return MIME_PDF
    return ct


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/extract/file", response_model=ExtractionResult)
async def extract_file(file: UploadFile = File(...)) -> ExtractionResult:
    """
    Upload a PDF or DOCX file.  The service extracts potential form fields and
    returns them in the unified JSON schema.
    """
    mime = _detect_mime(file)
    if mime not in (MIME_PDF, MIME_DOCX):
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {file.content_type}. Upload a PDF or DOCX.",
        )

    # Stream upload to a temporary file so adapters can use file-system APIs
    suffix = ".pdf" if mime == MIME_PDF else ".docx"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = Path(tmp.name)

    try:
        result = route(
            mime_type=mime,
            file_path=tmp_path,
            source_name=file.filename or tmp_path.name,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        tmp_path.unlink(missing_ok=True)

    return result


class GDocRequest(BaseModel):
    doc_id: str
    """The document ID from the Google Docs URL."""


@app.post("/extract/gdoc", response_model=ExtractionResult)
async def extract_gdoc(body: GDocRequest) -> ExtractionResult:
    """
    Provide a Google Docs document ID. The service fetches it via the
    Docs API and extracts form fields.
    """
    try:
        result = route(mime_type=MIME_GDOC, gdoc_id=body.doc_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return result


# ── Dev entry point ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
