from __future__ import annotations

from datetime import datetime, timedelta, timezone

from ..config import settings
from ..scoring import score_notice
from .base import BaseConnector, normalize_date_string, normalize_space
from ..types import NormalizedTender


def _stringify(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        return " ".join(_stringify(item) for item in value if item is not None)
    return str(value)


class BOAMPConnector(BaseConnector):
    source_name = "boamp"
    base_url = "https://boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp/records"

    def _build_notice(self, record: dict) -> NormalizedTender | None:
        source_notice_id = record.get("idweb") or record.get("id")
        if not source_notice_id:
            return None

        title = record.get("objet") or record.get("objetcomplet") or record.get("titre") or "Untitled BOAMP notice"
        buyer_name = record.get("nomacheteur") or record.get("acheteur") or record.get("nom_acheteur") or "Unknown buyer"
        description_parts = [
            title,
            record.get("descriptif"),
            record.get("resume"),
            record.get("nature"),
            record.get("famille_libelle"),
            record.get("type_marche"),
        ]
        description = normalize_space(" ".join(_stringify(part) for part in description_parts if part))
        raw_text = normalize_space(
            " ".join(
                str(value)
                for key, value in record.items()
                if key not in {"id", "filename"}
            )
        )
        detail_url = f"https://www.boamp.fr/avis/detail/{source_notice_id}"
        cpv_codes: list[str] = []
        for key in ("codecpv", "code_cpv", "cpv", "codes_cpv"):
            value = record.get(key)
            if not value:
                continue
            if isinstance(value, list):
                cpv_codes.extend(str(item) for item in value)
            else:
                cpv_codes.append(str(value))

        return NormalizedTender(
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

    def fetch(self, *, days_back: int, limit: int) -> list[NormalizedTender]:
        start_date = (datetime.now(timezone.utc) - timedelta(days=days_back)).date().isoformat()
        end_date = datetime.now(timezone.utc).date().isoformat()
        tenders: list[NormalizedTender] = []
        page_size = min(max(limit * 4, 50), 100)
        offset = 0
        scanned = 0
        max_scanned = max(settings.max_source_scan, limit * 6)

        while len(tenders) < limit and scanned < max_scanned:
            params = {
                "limit": page_size,
                "offset": offset,
                "where": f"dateparution >= date'{start_date}' AND dateparution <= date'{end_date}'",
                "order_by": "dateparution desc",
            }
            response = self.client.get(self.base_url, params=params)
            response.raise_for_status()
            data = response.json()
            results = data.get("results", [])
            if not results:
                break
            scanned += len(results)
            for record in results:
                notice = self._build_notice(record)
                if not notice:
                    continue
                preview = score_notice(notice)
                if preview.excluded or preview.fit_score < settings.candidate_fit_min:
                    continue
                tenders.append(notice)
                if len(tenders) >= limit:
                    break
            offset += len(results)
        return tenders
