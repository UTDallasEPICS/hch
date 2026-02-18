from __future__ import annotations

import re
from pathlib import Path

import docx
from docx.document import Document
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph

from schema import Confidence, ExtractionResult, ExtractedField, FieldType


_TYPE_PATTERNS: list[tuple[re.Pattern[str], FieldType]] = [
    (re.compile(r"\b(date|dob|born|birthday|month|year)\b", re.I), FieldType.date),
    (re.compile(r"\b(age|number|amount|score|count|qty|#)\b", re.I), FieldType.number),
    (re.compile(r"\b(check|tick|agree|confirm)\b", re.I), FieldType.checkbox),
    (re.compile(r"\b(select|choose|option|pick)\b", re.I), FieldType.dropdown),
]

_BULLET_STYLES = {"List Bullet", "List Number", "List Paragraph"}


def _infer_type(label: str, style_name: str = "") -> FieldType:
    if style_name in _BULLET_STYLES:
        return FieldType.radio
    for pattern, field_type in _TYPE_PATTERNS:
        if pattern.search(label):
            return field_type
    return FieldType.text


def _text(para: Paragraph) -> str:
    return para.text.strip()


def _is_label(text: str) -> bool:
    if not text:
        return False
    return text.endswith((":", "?")) or (3 <= len(text.split()) <= 10)


def _iter_block_items(document: Document):
    parent = document.element.body
    for child in parent.iterchildren():
        tag = child.tag.split("}")[-1]
        if tag == "p":
            yield Paragraph(child, document)
        elif tag == "tbl":
            yield Table(child, document)


def _process_table(table: Table, element_index: int) -> list[ExtractedField]:
    fields: list[ExtractedField] = []
    for row_idx, row in enumerate(table.rows):
        cells = row.cells
        if len(cells) < 2:
            continue
        label_text = cells[0].text.strip().rstrip(":").strip()
        if not label_text:
            continue
        answer_text = cells[1].text.strip()
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
                raw_metadata={"source": "table", "row": row_idx, "table_index": element_index},
            )
        )
    return fields


def extract(file_path: Path | str, source_name: str = "") -> ExtractionResult:
    file_path = Path(file_path)
    source_name = source_name or file_path.name
    fields: list[ExtractedField] = []
    warnings: list[str] = []

    doc = docx.Document(str(file_path))
    blocks = list(_iter_block_items(doc))
    total = len(blocks)

    idx = 0
    radio_group: list[str] = []
    radio_label: str | None = None
    radio_start_idx: int | None = None

    def _flush_radio():
        nonlocal radio_group, radio_label, radio_start_idx
        if radio_label and len(radio_group) >= 2:
            fields.append(
                ExtractedField(
                    label=radio_label,
                    type=FieldType.radio,
                    options=radio_group[:],
                    element_index=radio_start_idx,
                    confidence=Confidence.high,
                    raw_metadata={"source": "bullet_group"},
                )
            )
        radio_group = []
        radio_label = None
        radio_start_idx = None

    while idx < total:
        block = blocks[idx]

        if isinstance(block, Table):
            _flush_radio()
            fields.extend(_process_table(block, idx))
            idx += 1
            continue

        text = _text(block)
        style = block.style.name if block.style else ""

        if style in _BULLET_STYLES:
            if text:
                if radio_start_idx is None:
                    radio_start_idx = idx
                radio_group.append(text)
            idx += 1
            continue
        else:
            _flush_radio()

        if not text:
            idx += 1
            continue

        if _is_label(text):
            next_text = _text(blocks[idx + 1]) if idx + 1 < total else "x"
            is_followed_by_blank = (next_text == "")
            ends_with_marker = text.endswith((":", "?"))
            confidence = Confidence.high if (is_followed_by_blank or ends_with_marker) else Confidence.low

            fields.append(
                ExtractedField(
                    label=text.rstrip(":?").strip(),
                    type=_infer_type(text, style),
                    element_index=idx,
                    confidence=confidence,
                    raw_metadata={"source": "paragraph", "style": style},
                )
            )

        idx += 1

    _flush_radio()

    if not fields:
        warnings.append("No form fields detected. Check that labels end with ':' or '?'.")

    return ExtractionResult(
        source_type="docx",
        source_name=source_name,
        fields=fields,
        warnings=warnings,
    )
