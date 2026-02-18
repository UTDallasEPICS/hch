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
    x0: float
    y0: float
    x1: float
    y1: float
    page: int = 1


class ExtractedField(BaseModel):
    field_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    label: str
    type: FieldType = FieldType.text
    options: list[str] | None = None
    bounding_box: BoundingBox | None = None
    element_index: int | None = None
    confidence: Confidence = Confidence.high
    raw_metadata: dict[str, Any] = Field(default_factory=dict)


class ExtractionResult(BaseModel):
    source_type: str
    source_name: str
    fields: list[ExtractedField]
    warnings: list[str] = Field(default_factory=list)
