from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class NormalizedTender:
    source: str
    source_notice_id: str
    title: str
    buyer_name: str
    country: str
    publication_date: str | None
    deadline_date: str | None
    source_url: str
    document_url: str | None
    description: str
    raw_text: str
    cpv_codes: list[str] = field(default_factory=list)
    notice_type: str | None = None
    value_amount: float | None = None
    value_currency: str | None = None
    raw_payload: dict[str, Any] = field(default_factory=dict)

    @property
    def external_id(self) -> str:
        return f"{self.source}:{self.source_notice_id}"


@dataclass
class ConnectorResult:
    source: str
    notices: list[NormalizedTender]


@dataclass
class ScoreResult:
    fit_score: float
    score_label: str
    positive_reasons: list[str]
    negative_reasons: list[str]
    matched_terms: dict[str, list[str]]
    breakdown: dict[str, float]
    excluded: bool

