from __future__ import annotations

from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from .base import BaseConnector, normalize_date_string, normalize_space
from ..types import NormalizedTender


class BOAMPConnector(BaseConnector):
    source_name = "boamp"
    base_url = "https://boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp/records"

    def fetch(self, *, days_back: int, limit: int) -> list[NormalizedTender]:
        start_date = (datetime.now(timezone.utc) - timedelta(days=days_back)).date().isoformat()
        end_date = datetime.now(timezone.utc).date().isoformat()
        params = {
            "limit": limit,
            "where": f"dateparution >= date'{start_date}' AND dateparution <= date'{end_date}'",
            "order_by": "dateparution desc",
        }
        response = self.client.get(self.base_url, params=params)
        response.raise_for_status()
        data = response.json()

        tenders: list[NormalizedTender] = []
        for record in data.get("results", []):
            source_notice_id = record.get("idweb") or record.get("id")
            if not source_notice_id:
                continue

            title = record.get("objet") or record.get("objetcomplet") or record.get("titre") or "Untitled BOAMP notice"
            buyer_name = record.get("nomacheteur") or record.get("acheteur") or record.get("nom_acheteur") or "Unknown buyer"
            description_parts = [
                title,
                record.get("descriptif"),
                record.get("resume"),
                record.get("nature"),
                record.get("famille_libelle"),
            ]
            description = normalize_space(" ".join(part for part in description_parts if part))
            raw_text = normalize_space(
                " ".join(
                    str(value)
                    for key, value in record.items()
                    if key
                    not in {
                        "id",
                        "filename",
                    }
                )
            )
            detail_url = f"https://www.boamp.fr/avis/detail/{source_notice_id}"
            cpv_codes = []
            for key in ("codecpv", "code_cpv", "cpv", "codes_cpv"):
                value = record.get(key)
                if not value:
                    continue
                if isinstance(value, list):
                    cpv_codes.extend(str(item) for item in value)
                else:
                    cpv_codes.append(str(value))

            tenders.append(
                NormalizedTender(
                    source=self.source_name,
                    source_notice_id=str(source_notice_id),
                    title=normalize_space(title),
                    buyer_name=normalize_space(buyer_name),
                    country="France",
                    publication_date=normalize_date_string(record.get("dateparution")),
                    deadline_date=normalize_date_string(record.get("datelimitereponse")),
                    source_url=detail_url,
                    document_url=detail_url,
                    description=description,
                    raw_text=raw_text,
                    cpv_codes=cpv_codes,
                    notice_type=record.get("famille_libelle"),
                    raw_payload=record,
                )
            )
        return tenders

