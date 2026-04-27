from __future__ import annotations

from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

from ..config import settings
from ..scoring import score_notice
from .base import BaseConnector, normalize_date_string, normalize_space
from ..types import NormalizedTender


def _extract_buyer_name(release: dict) -> str:
    buyer = release.get("buyer") or {}
    if buyer.get("name"):
        return str(buyer["name"])
    for party in release.get("parties", []):
        roles = party.get("roles") or []
        if "buyer" in roles and party.get("name"):
            return str(party["name"])
    return "Unknown buyer"


def _extract_cpv_codes(release: dict) -> list[str]:
    tender = release.get("tender") or {}
    codes = []
    if tender.get("classification", {}).get("id"):
        codes.append(str(tender["classification"]["id"]))
    for item in tender.get("items", []):
        code = (item.get("classification") or {}).get("id")
        if code:
            codes.append(str(code))
    return sorted(set(codes))


def _extract_classification_descriptions(release: dict) -> list[str]:
    descriptions: list[str] = []
    tender = release.get("tender") or {}
    classification = tender.get("classification") or {}
    if classification.get("description"):
        descriptions.append(str(classification["description"]))
    for item in tender.get("items", []):
        description = (item.get("classification") or {}).get("description")
        if description:
            descriptions.append(str(description))
    for lot in tender.get("lots", []):
        description = lot.get("description")
        if description:
            descriptions.append(str(description))
    main_procurement_category = tender.get("mainProcurementCategory")
    if main_procurement_category:
        descriptions.append(str(main_procurement_category))
    return sorted(set(descriptions))


class FindTenderConnector(BaseConnector):
    source_name = "find_tender"
    base_url = "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages"

    def _build_notice(self, release: dict) -> NormalizedTender | None:
        tender = release.get("tender") or {}
        notice_id = release.get("id") or release.get("ocid")
        if not notice_id:
            return None
        title = tender.get("title") or "Untitled Find a Tender notice"
        description_parts = [
            tender.get("description") or "",
            " ".join(_extract_classification_descriptions(release)),
            release.get("description") or "",
        ]
        description = normalize_space(" ".join(part for part in description_parts if part))
        buyer_name = normalize_space(_extract_buyer_name(release))
        deadline = ((tender.get("tenderPeriod") or {}).get("endDate"))
        source_url = f"https://www.find-tender.service.gov.uk/Notice/{notice_id}"
        raw_text = normalize_space(" ".join(filter(None, [title, description, buyer_name])))

        return NormalizedTender(
            source=self.source_name,
            source_notice_id=str(notice_id),
            title=normalize_space(title),
            buyer_name=buyer_name,
            country="United Kingdom",
            publication_date=normalize_date_string(release.get("date") or release.get("datePublished")),
            deadline_date=normalize_date_string(deadline),
            source_url=source_url,
            document_url=source_url,
            description=description,
            raw_text=raw_text,
            cpv_codes=_extract_cpv_codes(release),
            notice_type=((tender.get("procurementMethodDetails") or "")[:120] or None),
            raw_payload=release,
        )

    def fetch(self, *, days_back: int, limit: int) -> list[NormalizedTender]:
        start = (datetime.now(timezone.utc) - timedelta(days=days_back)).replace(microsecond=0).isoformat()
        end = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        tenders: list[NormalizedTender] = []
        scanned = 0
        max_scanned = max(settings.max_source_scan, limit * 6)
        next_url: str | None = self.base_url
        params: dict[str, str | int] | None = {
            "updatedFrom": start,
            "updatedTo": end,
            "limit": min(max(limit * 4, 50), 100),
            "stages": "tender",
        }

        while next_url and len(tenders) < limit and scanned < max_scanned:
            response = self.client.get(next_url, params=params)
            response.raise_for_status()
            payload = response.json()
            releases = payload.get("releases", [])
            if not releases:
                break
            scanned += len(releases)
            for release in releases:
                notice = self._build_notice(release)
                if not notice:
                    continue
                preview = score_notice(notice)
                if preview.excluded or preview.fit_score < settings.candidate_fit_min:
                    continue
                tenders.append(notice)
                if len(tenders) >= limit:
                    break
            next_link = ((payload.get("links") or {}).get("next")) or None
            if not next_link:
                break
            query = parse_qs(urlparse(next_link).query)
            cursor_values = query.get("cursor") or []
            if not cursor_values:
                break
            next_url = self.base_url
            params = {
                "updatedFrom": start,
                "updatedTo": end,
                "limit": min(max(limit * 4, 50), 100),
                "stages": "tender",
                "cursor": cursor_values[0],
            }
        return tenders
