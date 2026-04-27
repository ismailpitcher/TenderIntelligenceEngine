from __future__ import annotations

from typing import Any

from ..connectors.boamp import BOAMPConnector
from ..connectors.contracts_finder import ContractsFinderConnector
from ..connectors.find_tender import FindTenderConnector
from ..connectors.ted import TEDConnector
from ..database import finish_ingestion_run, start_ingestion_run, upsert_tender
from ..scoring import score_notice


CONNECTOR_REGISTRY = {
    "ted": TEDConnector,
    "boamp": BOAMPConnector,
    "contracts_finder": ContractsFinderConnector,
    "find_tender": FindTenderConnector,
}


def available_sources() -> list[str]:
    return sorted(CONNECTOR_REGISTRY.keys())


def sync_sources(
    *,
    sources: list[str],
    days_back: int,
    limit_per_source: int,
) -> list[dict[str, Any]]:
    summaries: list[dict[str, Any]] = []

    for source in sources:
        connector_cls = CONNECTOR_REGISTRY[source]
        connector = connector_cls()
        run_id = start_ingestion_run(source)
        fetched_count = 0
        inserted_count = 0
        updated_count = 0

        try:
            notices = connector.fetch(days_back=days_back, limit=limit_per_source)
            fetched_count = len(notices)
            for notice in notices:
                score = score_notice(notice)
                action = upsert_tender(notice, score)
                if action == "inserted":
                    inserted_count += 1
                else:
                    updated_count += 1
            finish_ingestion_run(
                run_id,
                status="success",
                fetched_count=fetched_count,
                inserted_count=inserted_count,
                updated_count=updated_count,
            )
            summaries.append(
                {
                    "source": source,
                    "status": "success",
                    "fetched_count": fetched_count,
                    "inserted_count": inserted_count,
                    "updated_count": updated_count,
                }
            )
        except Exception as exc:  # noqa: BLE001
            finish_ingestion_run(
                run_id,
                status="failed",
                fetched_count=fetched_count,
                inserted_count=inserted_count,
                updated_count=updated_count,
                error_message=str(exc),
            )
            summaries.append(
                {
                    "source": source,
                    "status": "failed",
                    "fetched_count": fetched_count,
                    "inserted_count": inserted_count,
                    "updated_count": updated_count,
                    "error_message": str(exc),
                }
            )
    return summaries

