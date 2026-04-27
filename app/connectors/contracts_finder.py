from __future__ import annotations

from datetime import datetime, timedelta, timezone

from ..config import settings
from ..scoring import score_notice
from .base import BaseConnector, normalize_date_string, normalize_space
from ..types import NormalizedTender


def _extract_cpv_codes(release: dict) -> list[str]:
    codes: list[str] = []
    tender = release.get("tender") or {}
    items = tender.get("items") or []
    for item in items:
        classification = item.get("classification") or {}
        code = classification.get("id")
        if code:
            codes.append(str(code))
    main_classification = (tender.get("classification") or {}).get("id")
    if main_classification:
        codes.append(str(main_classification))
    return sorted(set(codes))


def _extract_classification_descriptions(release: dict) -> list[str]:
    descriptions: list[str] = []
    tender = release.get("tender") or {}
    items = tender.get("items") or []
    for item in items:
        description = (item.get("classification") or {}).get("description")
        if description:
            descriptions.append(str(description))
    main_description = (tender.get("classification") or {}).get("description")
    if main_description:
        descriptions.append(str(main_description))
    main_procurement_category = tender.get("mainProcurementCategory")
    if main_procurement_category:
        descriptions.append(str(main_procurement_category))
    return sorted(set(descriptions))


class ContractsFinderConnector(BaseConnector):
    source_name = "contracts_finder"
    base_url = "https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search"

    def _build_notice(self, release: dict) -> NormalizedTender | None:
        tender = release.get("tender") or {}
        buyer = release.get("buyer") or {}
        tender_id = release.get("id") or release.get("ocid")
        if not tender_id:
            return None
        title = tender.get("title") or "Untitled Contracts Finder notice"
        description_parts = [
            tender.get("description") or "",
            " ".join(_extract_classification_descriptions(release)),
            tender.get("procurementMethodDetails") or "",
        ]
        description = normalize_space(" ".join(part for part in description_parts if part))
        source_url = (
            tender.get("documents", [{}])[0].get("url")
            if tender.get("documents")
            else f"https://www.contractsfinder.service.gov.uk/Notice/{tender_id}"
        )
        deadline = ((tender.get("tenderPeriod") or {}).get("endDate"))
        raw_text = normalize_space(" ".join(filter(None, [title, description, buyer.get("name", "")])))

        return NormalizedTender(
            source=self.source_name,
            source_notice_id=str(tender_id),
            title=normalize_space(title),
            buyer_name=normalize_space(buyer.get("name") or "Unknown buyer"),
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
        params = {
            "publishedFrom": start,
            "publishedTo": end,
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
            next_url = ((payload.get("links") or {}).get("next")) or None
            params = None
        return tenders
