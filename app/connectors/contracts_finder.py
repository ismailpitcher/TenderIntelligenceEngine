from __future__ import annotations

from datetime import datetime, timedelta, timezone

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


class ContractsFinderConnector(BaseConnector):
    source_name = "contracts_finder"
    base_url = "https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search"

    def fetch(self, *, days_back: int, limit: int) -> list[NormalizedTender]:
        start = (datetime.now(timezone.utc) - timedelta(days=days_back)).replace(microsecond=0).isoformat()
        end = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        response = self.client.get(
            self.base_url,
            params={
                "publishedFrom": start,
                "publishedTo": end,
                "limit": limit,
            },
        )
        response.raise_for_status()
        payload = response.json()

        tenders: list[NormalizedTender] = []
        for release in payload.get("releases", []):
            tender = release.get("tender") or {}
            buyer = release.get("buyer") or {}
            tender_id = release.get("id") or release.get("ocid")
            if not tender_id:
                continue
            title = tender.get("title") or "Untitled Contracts Finder notice"
            description = normalize_space(tender.get("description") or "")
            source_url = (
                tender.get("documents", [{}])[0].get("url")
                if tender.get("documents")
                else f"https://www.contractsfinder.service.gov.uk/Notice/{tender_id}"
            )
            deadline = ((tender.get("tenderPeriod") or {}).get("endDate"))
            raw_text = normalize_space(" ".join(filter(None, [title, description, buyer.get("name", "")])))

            tenders.append(
                NormalizedTender(
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
            )
        return tenders

