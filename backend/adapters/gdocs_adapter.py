from __future__ import annotations

import os
import re
from typing import Any

from googleapiclient.discovery import build
from google.oauth2 import service_account
from google.auth import default as google_auth_default

from schema import Confidence, ExtractionResult, ExtractedField, FieldType


SCOPES = ["https://www.googleapis.com/auth/documents.readonly"]

_TYPE_PATTERNS: list[tuple[re.Pattern[str], FieldType]] = [
    (re.compile(r"\b(date|dob|born|birthday|month|year)\b", re.I), FieldType.date),
    (re.compile(r"\b(age|number|amount|score|count|qty|#)\b", re.I), FieldType.number),
    (re.compile(r"\b(check|tick|agree|confirm)\b", re.I), FieldType.checkbox),
    (re.compile(r"\b(select|choose|option|pick)\b", re.I), FieldType.dropdown),
]


def _infer_type(label: str) -> FieldType:
    for pattern, field_type in _TYPE_PATTERNS:
        if pattern.search(label):
            return field_type
    return FieldType.text


def _build_service():
    creds_path = os.getenv("GOOGLE_CREDS_PATH")
    if creds_path:
        creds = service_account.Credentials.from_service_account_file(
            creds_path, scopes=SCOPES
        )
    else:
        creds, _ = google_auth_default(scopes=SCOPES)
    return build("docs", "v1", credentials=creds)


def _paragraph_text(paragraph: dict[str, Any]) -> str:
    parts = []
    for elem in paragraph.get("elements", []):
        tr = elem.get("textRun", {})
        parts.append(tr.get("content", ""))
    return "".join(parts).strip()


def _is_label(text: str) -> bool:
    if not text:
        return False
    return text.endswith((":", "?")) or (3 <= len(text.split()) <= 10)


def _process_table_element(
    table: dict[str, Any], element_index: int
) -> list[ExtractedField]:
    fields: list[ExtractedField] = []
    for row_idx, row in enumerate(table.get("tableRows", [])):
        cells = row.get("tableCells", [])
        if len(cells) < 2:
            continue
        label_parts: list[str] = []
        for content in cells[0].get("content", []):
            para = content.get("paragraph")
            if para:
                label_parts.append(_paragraph_text(para))
        label_text = " ".join(label_parts).strip().rstrip(":").strip()
        if not label_text:
            continue

        answer_parts: list[str] = []
        for content in cells[1].get("content", []):
            para = content.get("paragraph")
            if para:
                answer_parts.append(_paragraph_text(para))
        answer_text = " ".join(answer_parts).strip()

        options = None
        field_type = _infer_type(label_text)
        if "/" in answer_text:
            options = [o.strip() for o in answer_text.split("/")]
            field_type = FieldType.radio

        fields.append(
            ExtractedField(
                label=label_text,
                type=field_type,
                options=options,
                element_index=element_index + row_idx,
                confidence=Confidence.high,
                raw_metadata={"source": "table", "row": row_idx},
            )
        )
    return fields


def extract(doc_id: str) -> ExtractionResult:
    service = _build_service()
    doc = service.documents().get(documentId=doc_id).execute()
    source_name = doc.get("title", doc_id)
    content = doc.get("body", {}).get("content", [])

    fields: list[ExtractedField] = []
    warnings: list[str] = []

    for elem_idx, element in enumerate(content):
        if "paragraph" in element:
            para = element["paragraph"]
            text = _paragraph_text(para)

            has_rule = any(
                "horizontalRule" in pe
                for pe in para.get("elements", [])
            )

            if not _is_label(text) or not text:
                continue

            next_elem = content[elem_idx + 1] if elem_idx + 1 < len(content) else {}
            next_text = ""
            if "paragraph" in next_elem:
                next_text = _paragraph_text(next_elem["paragraph"])
            has_blank_below = next_text == ""

            confidence = (
                Confidence.high if (has_rule or has_blank_below or text.endswith((":", "?")))
                else Confidence.low
            )

            style = para.get("paragraphStyle", {}).get("namedStyleType", "")
            field_type = _infer_type(text)
            if "LIST" in style.upper():
                field_type = FieldType.radio

            fields.append(
                ExtractedField(
                    label=text.rstrip(":?").strip(),
                    type=field_type,
                    element_index=elem_idx,
                    confidence=confidence,
                    raw_metadata={"source": "paragraph", "namedStyleType": style},
                )
            )

        elif "table" in element:
            fields.extend(_process_table_element(element["table"], elem_idx))

    if not fields:
        warnings.append("No form fields detected in this Google Doc.")

    return ExtractionResult(
        source_type="gdoc",
        source_name=source_name,
        fields=fields,
        warnings=warnings,
    )
