from __future__ import annotations

from datetime import datetime, timedelta, timezone

from .base import BaseConnector, flatten_i18n, normalize_date_string, normalize_space, xml_to_text
from ..config import settings
from ..types import NormalizedTender


TED_COUNTRY_MAP = {
    "AUT": "Austria",
    "BEL": "Belgium",
    "CHE": "Switzerland",
    "CZE": "Czech Republic",
    "DEU": "Germany",
    "DNK": "Denmark",
    "ESP": "Spain",
    "FIN": "Finland",
    "FRA": "France",
    "GBR": "United Kingdom",
    "GRC": "Greece",
    "HUN": "Hungary",
    "IRL": "Ireland",
    "ISL": "Iceland",
    "ITA": "Italy",
    "NLD": "Netherlands",
    "NOR": "Norway",
    "POL": "Poland",
    "PRT": "Portugal",
    "SWE": "Sweden",
}


class TEDConnector(BaseConnector):
    source_name = "ted"
    search_url = "https://api.ted.europa.eu/v3/notices/search"

    def _fetch_notice_text(self, xml_url: str | None) -> str:
        if not xml_url:
            return ""
        response = self.client.get(xml_url)
        response.raise_for_status()
        return xml_to_text(response.text)[: settings.max_raw_text_length]

    def fetch(self, *, days_back: int, limit: int) -> list[NormalizedTender]:
        start_date = (datetime.now(timezone.utc) - timedelta(days=days_back)).strftime("%Y%m%d")
        end_date = datetime.now(timezone.utc).strftime("%Y%m%d")
        payload = {
            "query": f"PD>={start_date} AND PD<={end_date}",
            "fields": [
                "publication-number",
                "publication-date",
                "notice-title",
                "buyer-name",
                "deadline-receipt-tender-date-lot",
                "organisation-country-buyer",
            ],
            "limit": limit,
            "page": 1,
            "scope": "ACTIVE",
            "onlyLatestVersions": True,
        }
        response = self.client.post(self.search_url, json=payload)
        response.raise_for_status()
        data = response.json()

        tenders: list[NormalizedTender] = []
        for notice in data.get("notices", []):
            publication_number = notice.get("publication-number")
            if not publication_number:
                continue
            country_codes = notice.get("organisation-country-buyer") or []
            country = TED_COUNTRY_MAP.get(country_codes[0], country_codes[0] if country_codes else "Europe")
            links = notice.get("links", {})
            xml_url = (links.get("xml") or {}).get("MUL")
            source_url = f"https://ted.europa.eu/en/notice/{publication_number}/html"
            deadline_values = notice.get("deadline-receipt-tender-date-lot") or []
            raw_text = self._fetch_notice_text(xml_url)
            title = flatten_i18n(notice.get("notice-title"))
            buyer_name = flatten_i18n(notice.get("buyer-name"))
            description = normalize_space(f"{title} {buyer_name}")

            tenders.append(
                NormalizedTender(
                    source=self.source_name,
                    source_notice_id=publication_number,
                    title=title or publication_number,
                    buyer_name=buyer_name,
                    country=country,
                    publication_date=normalize_date_string(notice.get("publication-date")),
                    deadline_date=normalize_date_string(deadline_values[0] if deadline_values else None),
                    source_url=source_url,
                    document_url=xml_url,
                    description=description,
                    raw_text=raw_text,
                    cpv_codes=[],
                    notice_type=None,
                    raw_payload=notice,
                )
            )
        return tenders

