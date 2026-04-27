from __future__ import annotations

from datetime import datetime, timedelta, timezone

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


class FindTenderConnector(BaseConnector):
    source_name = "find_tender"
    base_url = "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages"

    def fetch(self, *, days_back: int, limit: int) -> list[NormalizedTender]:
        start = (datetime.now(timezone.utc) - timedelta(days=days_back)).replace(microsecond=0).isoformat()
        end = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        response = self.client.get(
            self.base_url,
            params={
                "updatedFrom": start,
                "updatedTo": end,
                "limit": limit,
            },
        )
        response.raise_for_status()
        payload = response.json()

        tenders: list[NormalizedTender] = []
        for release in payload.get("releases", []):
            tender = release.get("tender") or {}
            notice_id = release.get("id") or release.get("ocid")
            if not notice_id:
                continue
            title = tender.get("title") or "Untitled Find a Tender notice"
            description = normalize_space(tender.get("description") or "")
            buyer_name = normalize_space(_extract_buyer_name(release))
            deadline = ((tender.get("tenderPeriod") or {}).get("endDate"))
            source_url = f"https://www.find-tender.service.gov.uk/Notice/{notice_id}"
            raw_text = normalize_space(" ".join(filter(None, [title, description, buyer_name])))

            tenders.append(
                NormalizedTender(
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
            )
        return tenders

