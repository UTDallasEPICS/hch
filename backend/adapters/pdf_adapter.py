from __future__ import annotations

import re
import unicodedata
from pathlib import Path

import pdfplumber

from schema import BoundingBox, Confidence, ExtractionResult, ExtractedField, FieldType


LINE_MIN_WIDTH   = 30
LINE_MAX_HEIGHT  = 3
LABEL_TO_INPUT_GAP = 60
MIN_LABEL_CHARS  = 3
COL_BUCKET_SIZE  = 20
ROW_MERGE_GAP    = 4
NUMBERED_RE      = re.compile(r"^\d+[\.\)]\s*")

_TYPE_PATTERNS: list[tuple[re.Pattern[str], FieldType]] = [
    (re.compile(r"\b(date|dob|born|birthday|month|year)\b", re.I), FieldType.date),
    (re.compile(r"\b(age|number|amount|score|count|qty|#)\b",  re.I), FieldType.number),
    (re.compile(r"\b(check|tick|agree|confirm)\b",             re.I), FieldType.checkbox),
    (re.compile(r"\b(select|choose|option|pick)\b",            re.I), FieldType.dropdown),
]


def _infer_type(label: str) -> FieldType:
    for pattern, field_type in _TYPE_PATTERNS:
        if pattern.search(label):
            return field_type
    return FieldType.text


def _clean(text: str) -> str:
    text = "".join(
        ch for ch in text
        if unicodedata.category(ch) not in ("Cf", "Cc") or ch in (" ", "\t")
    )
    return text.strip()


def _is_label(text: str) -> bool:
    cleaned = _clean(text)
    if len(cleaned) < MIN_LABEL_CHARS:
        return False
    words = cleaned.split()
    if cleaned.endswith((":", "?", "_")):
        return True
    if NUMBERED_RE.match(cleaned):
        return True
    if len(words) <= 12:
        return True
    return False


def _h_lines(page) -> list[dict]:
    return [
        r for r in page.rects
        if (r["x1"] - r["x0"]) >= LINE_MIN_WIDTH
        and (r["y1"] - r["y0"]) <= LINE_MAX_HEIGHT
    ]


def _has_input_below(top: float, bottom: float, x0: float, x1: float,
                     lines: list[dict], page_height: float) -> bool:
    for ln in lines:
        if ln["top"] >= bottom and ln["top"] <= bottom + LABEL_TO_INPUT_GAP:
            if ln["x0"] <= x1 and ln["x1"] >= x0:
                return True
    return bottom + LABEL_TO_INPUT_GAP < page_height


def _cluster_words_into_rows(words: list[dict]) -> list[list[dict]]:
    if not words:
        return []
    rows: dict[float, list[dict]] = {}
    for w in words:
        key = round(w["top"] / ROW_MERGE_GAP) * ROW_MERGE_GAP
        rows.setdefault(key, []).append(w)
    return [sorted(cluster, key=lambda w: w["x0"]) for _, cluster in sorted(rows.items())]


def _pass1(page, page_num: int) -> list[ExtractedField]:
    lines = _h_lines(page)
    words = page.extract_words(extra_attrs=["fontname", "size"])
    if not words:
        return []

    fields: list[ExtractedField] = []
    for row in _cluster_words_into_rows(words):
        raw_text = " ".join(w["text"] for w in row)
        label = _clean(raw_text)
        if not _is_label(label):
            continue

        x0 = min(w["x0"]    for w in row)
        y0 = min(w["top"]    for w in row)
        x1 = max(w["x1"]    for w in row)
        y1 = max(w["bottom"] for w in row)

        has_input = _has_input_below(y0, y1, x0, x1, lines, page.height)
        fields.append(ExtractedField(
            label=label.rstrip(":?").strip(),
            type=_infer_type(label),
            bounding_box=BoundingBox(x0=x0, y0=y0, x1=x1, y1=y1, page=page_num),
            confidence=Confidence.high if has_input else Confidence.low,
            raw_metadata={"pass": 1, "page": page_num},
        ))
    return fields


def _bucket_x(x: float) -> int:
    return int(x // COL_BUCKET_SIZE)


def _pass2(page, page_num: int) -> list[ExtractedField]:
    words = page.extract_words(extra_attrs=["fontname", "size"])
    if not words:
        return []

    cols: dict[int, list[dict]] = {}
    for w in words:
        cols.setdefault(_bucket_x(w["x0"]), []).append(w)

    if not cols:
        return []

    sorted_buckets = sorted(cols.keys())
    half_width = page.width / 2
    label_words: list[dict] = []
    for bucket in sorted_buckets:
        ws = cols[bucket]
        if ws and ws[0]["x0"] > half_width:
            break
        label_words.extend(ws)

    if not label_words:
        return []

    rows = _cluster_words_into_rows(label_words)
    fields: list[ExtractedField] = []
    for row in rows:
        raw_text = " ".join(w["text"] for w in row)
        label = _clean(raw_text)
        if not _is_label(label):
            continue

        x0 = min(w["x0"]    for w in row)
        y0 = min(w["top"]    for w in row)
        x1 = max(w["x1"]    for w in row)
        y1 = max(w["bottom"] for w in row)

        fields.append(ExtractedField(
            label=label.rstrip(":?").strip(),
            type=_infer_type(label),
            bounding_box=BoundingBox(x0=x0, y0=y0, x1=x1, y1=y1, page=page_num),
            confidence=Confidence.low,
            raw_metadata={"pass": 2, "page": page_num},
        ))
    return fields


def _merge(pass1: list[ExtractedField],
           pass2: list[ExtractedField]) -> list[ExtractedField]:
    seen: set[str] = {f.label.lower() for f in pass1 if f.label}
    merged = list(pass1)
    for f in pass2:
        key = f.label.lower()
        if key and key not in seen:
            seen.add(key)
            merged.append(f)
    merged.sort(key=lambda f: (
        f.bounding_box.page if f.bounding_box else 0,
        f.bounding_box.y0   if f.bounding_box else 0,
    ))
    return merged


def extract(file_path: Path | str, source_name: str = "") -> ExtractionResult:
    file_path   = Path(file_path)
    source_name = source_name or file_path.name
    all_fields: list[ExtractedField] = []
    warnings:   list[str] = []

    with pdfplumber.open(file_path) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            words = page.extract_words()
            if not words:
                warnings.append(f"Page {page_num}: no extractable text — PDF may be scanned.")
                continue

            p1 = _pass1(page, page_num)
            p2 = _pass2(page, page_num)
            all_fields.extend(_merge(p1, p2))

    all_fields = [f for f in all_fields if f.label]

    if not all_fields:
        warnings.append(
            "No form fields detected. "
            "The PDF may be scanned (try OCR) or use a non-standard layout."
        )

    return ExtractionResult(
        source_type="pdf",
        source_name=source_name,
        fields=all_fields,
        warnings=warnings,
    )
