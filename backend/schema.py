"""
Unified JSON schema for extracted form fields.

Every adapter (PDF, Word, Google Docs) must produce a list of
ExtractedField objects. The Normalizer validates and returns an
ExtractionResult.
"""

from __future__ import annotations

from enum import Enum
from typing import Any
from pydantic import BaseModel, Field
import uuid


class FieldType(str, Enum):
    text = "text"
    number = "number"
    date = "date"
    checkbox = "checkbox"
    dropdown = "dropdown"
    radio = "radio"


class Confidence(str, Enum):
    high = "high"
    low = "low"


class BoundingBox(BaseModel):
    """Pixel / point coordinates from a PDF page."""
    x0: float
    y0: float
    x1: float
    y1: float
    page: int = 1


class ExtractedField(BaseModel):
    field_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    label: str                          # The question / label text
    type: FieldType = FieldType.text    # Best-guess input type
    options: list[str] | None = None    # For checkbox / dropdown / radio only

    # Source location — mutually exclusive depending on adapter used
    bounding_box: BoundingBox | None = None   # PDF
    element_index: int | None = None          # Word / Google Docs paragraph index

    confidence: Confidence = Confidence.high  # "low" when no input area was found

    # Raw adapter-specific extras (stored as JSON, not shown to end user)
    raw_metadata: dict[str, Any] = Field(default_factory=dict)


class ExtractionResult(BaseModel):
    source_type: str          # "pdf" | "docx" | "gdoc"
    source_name: str          # original filename or doc title
    fields: list[ExtractedField]
    warnings: list[str] = Field(default_factory=list)
