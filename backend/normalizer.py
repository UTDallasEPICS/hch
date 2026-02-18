from __future__ import annotations

from pathlib import Path

from schema import ExtractionResult
from adapters import pdf_adapter, word_adapter, gdocs_adapter


MIME_PDF  = "application/pdf"
MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
MIME_GDOC = "application/vnd.google-apps.document"


def route(
    *,
    mime_type: str,
    file_path: Path | str | None = None,
    source_name: str = "",
    gdoc_id: str | None = None,
) -> ExtractionResult:
    if mime_type == MIME_PDF:
        if file_path is None:
            raise ValueError("file_path required for PDF extraction")
        return pdf_adapter.extract(file_path, source_name)

    elif mime_type == MIME_DOCX:
        if file_path is None:
            raise ValueError("file_path required for DOCX extraction")
        return word_adapter.extract(file_path, source_name)

    elif mime_type == MIME_GDOC:
        if gdoc_id is None:
            raise ValueError("gdoc_id required for Google Docs extraction")
        return gdocs_adapter.extract(gdoc_id)

    else:
        raise ValueError(
            f"Unsupported MIME type: {mime_type!r}. "
            f"Expected one of: {MIME_PDF!r}, {MIME_DOCX!r}, {MIME_GDOC!r}"
        )
