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

_ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _detect_mime(upload: UploadFile) -> str:
    ct = (upload.content_type or "").lower()
    if "pdf" in ct:
        return MIME_PDF
    if "wordprocessingml" in ct or "docx" in ct or upload.filename.endswith(".docx"):
        return MIME_DOCX
    if upload.filename.endswith(".pdf"):
        return MIME_PDF
    return ct


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/extract/file", response_model=ExtractionResult)
async def extract_file(file: UploadFile = File(...)) -> ExtractionResult:
    mime = _detect_mime(file)
    if mime not in (MIME_PDF, MIME_DOCX):
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {file.content_type}. Upload a PDF or DOCX.",
        )

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


@app.post("/extract/gdoc", response_model=ExtractionResult)
async def extract_gdoc(body: GDocRequest) -> ExtractionResult:
    try:
        result = route(mime_type=MIME_GDOC, gdoc_id=body.doc_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return result


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
