from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date, datetime
from typing import Any
from xml.etree import ElementTree

import httpx

from ..config import settings
from ..types import NormalizedTender


def normalize_date_string(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(cleaned).date().isoformat()
    except ValueError:
        return cleaned[:10]


def parse_any_date(value: str | None) -> date | None:
    normalized = normalize_date_string(value)
    if not normalized:
        return None
    try:
        return date.fromisoformat(normalized)
    except ValueError:
        return None


def normalize_space(text: str) -> str:
    return " ".join((text or "").split())


def flatten_i18n(value: Any) -> str:
    if isinstance(value, str):
        return normalize_space(value)
    if isinstance(value, list):
        return normalize_space(" ".join(str(item) for item in value))
    if isinstance(value, dict):
        pieces: list[str] = []
        for nested in value.values():
            if isinstance(nested, list):
                pieces.extend(str(item) for item in nested)
            elif isinstance(nested, str):
                pieces.append(nested)
        return normalize_space(" ".join(pieces))
    return ""


def xml_to_text(xml_text: str) -> str:
    try:
        root = ElementTree.fromstring(xml_text)
        return normalize_space(" ".join(text for text in root.itertext()))
    except ElementTree.ParseError:
        return normalize_space(xml_text)


class BaseConnector(ABC):
    source_name: str

    def __init__(self) -> None:
        self.client = httpx.Client(
            timeout=settings.request_timeout,
            headers={"User-Agent": settings.user_agent},
            follow_redirects=True,
        )

    @abstractmethod
    def fetch(self, *, days_back: int, limit: int) -> list[NormalizedTender]:
        raise NotImplementedError
