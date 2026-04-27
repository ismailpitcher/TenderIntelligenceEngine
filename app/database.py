from __future__ import annotations

import csv
import io
import json
import sqlite3
from collections.abc import Iterable
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any

from .config import DATA_DIR, settings
from .types import NormalizedTender, ScoreResult


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def json_dumps(value: Any) -> str:
    return json.dumps(value if value is not None else {}, ensure_ascii=False)


def json_loads(value: str | None, fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


def _ensure_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _ensure_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(settings.db_path)
    connection.row_factory = sqlite3.Row
    return connection


@contextmanager
def get_connection() -> Iterable[sqlite3.Connection]:
    connection = _connect()
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


def init_db() -> None:
    with get_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS tenders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                external_id TEXT NOT NULL UNIQUE,
                source TEXT NOT NULL,
                source_notice_id TEXT NOT NULL,
                title TEXT NOT NULL,
                buyer_name TEXT,
                country TEXT,
                publication_date TEXT,
                deadline_date TEXT,
                notice_type TEXT,
                source_url TEXT,
                document_url TEXT,
                description TEXT,
                raw_text TEXT,
                cpv_codes TEXT,
                value_amount REAL,
                value_currency TEXT,
                fit_score REAL DEFAULT 0,
                score_label TEXT DEFAULT 'low',
                positive_reasons TEXT,
                negative_reasons TEXT,
                matched_terms TEXT,
                breakdown_json TEXT,
                excluded INTEGER DEFAULT 0,
                review_status TEXT DEFAULT 'new',
                review_notes TEXT,
                raw_payload TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                last_ingested_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_tenders_source ON tenders(source);
            CREATE INDEX IF NOT EXISTS idx_tenders_fit_score ON tenders(fit_score DESC);
            CREATE INDEX IF NOT EXISTS idx_tenders_review_status ON tenders(review_status);
            CREATE INDEX IF NOT EXISTS idx_tenders_country ON tenders(country);
            CREATE INDEX IF NOT EXISTS idx_tenders_publication_date ON tenders(publication_date DESC);

            CREATE TABLE IF NOT EXISTS ingestion_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT NOT NULL,
                started_at TEXT NOT NULL,
                finished_at TEXT,
                status TEXT NOT NULL,
                fetched_count INTEGER DEFAULT 0,
                inserted_count INTEGER DEFAULT 0,
                updated_count INTEGER DEFAULT 0,
                error_message TEXT
            );
            """
        )


def start_ingestion_run(source: str) -> int:
    started_at = utc_now()
    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO ingestion_runs(source, started_at, status)
            VALUES (?, ?, ?)
            """,
            (source, started_at, "running"),
        )
        return int(cursor.lastrowid)


def finish_ingestion_run(
    run_id: int,
    *,
    status: str,
    fetched_count: int = 0,
    inserted_count: int = 0,
    updated_count: int = 0,
    error_message: str | None = None,
) -> None:
    with get_connection() as connection:
        connection.execute(
            """
            UPDATE ingestion_runs
            SET finished_at = ?, status = ?, fetched_count = ?, inserted_count = ?, updated_count = ?, error_message = ?
            WHERE id = ?
            """,
            (utc_now(), status, fetched_count, inserted_count, updated_count, error_message, run_id),
        )


def _serialize_tender(tender: NormalizedTender, score: ScoreResult) -> dict[str, Any]:
    now = utc_now()
    return {
        "external_id": tender.external_id,
        "source": tender.source,
        "source_notice_id": tender.source_notice_id,
        "title": tender.title,
        "buyer_name": tender.buyer_name,
        "country": tender.country,
        "publication_date": tender.publication_date,
        "deadline_date": tender.deadline_date,
        "notice_type": tender.notice_type,
        "source_url": tender.source_url,
        "document_url": tender.document_url,
        "description": tender.description,
        "raw_text": tender.raw_text,
        "cpv_codes": json_dumps(tender.cpv_codes),
        "value_amount": tender.value_amount,
        "value_currency": tender.value_currency,
        "fit_score": score.fit_score,
        "score_label": score.score_label,
        "positive_reasons": json_dumps(score.positive_reasons),
        "negative_reasons": json_dumps(score.negative_reasons),
        "matched_terms": json_dumps(score.matched_terms),
        "breakdown_json": json_dumps(score.breakdown),
        "excluded": 1 if score.excluded else 0,
        "raw_payload": json_dumps(tender.raw_payload),
        "updated_at": now,
        "last_ingested_at": now,
    }


def upsert_tender(tender: NormalizedTender, score: ScoreResult) -> str:
    payload = _serialize_tender(tender, score)
    created_at = utc_now()

    with get_connection() as connection:
        existing = connection.execute(
            "SELECT id FROM tenders WHERE external_id = ?",
            (tender.external_id,),
        ).fetchone()

        if existing:
            connection.execute(
                """
                UPDATE tenders
                SET source = :source,
                    source_notice_id = :source_notice_id,
                    title = :title,
                    buyer_name = :buyer_name,
                    country = :country,
                    publication_date = :publication_date,
                    deadline_date = :deadline_date,
                    notice_type = :notice_type,
                    source_url = :source_url,
                    document_url = :document_url,
                    description = :description,
                    raw_text = :raw_text,
                    cpv_codes = :cpv_codes,
                    value_amount = :value_amount,
                    value_currency = :value_currency,
                    fit_score = :fit_score,
                    score_label = :score_label,
                    positive_reasons = :positive_reasons,
                    negative_reasons = :negative_reasons,
                    matched_terms = :matched_terms,
                    breakdown_json = :breakdown_json,
                    excluded = :excluded,
                    raw_payload = :raw_payload,
                    updated_at = :updated_at,
                    last_ingested_at = :last_ingested_at
                WHERE external_id = :external_id
                """,
                payload,
            )
            return "updated"

        payload["created_at"] = created_at
        connection.execute(
            """
            INSERT INTO tenders(
                external_id, source, source_notice_id, title, buyer_name, country,
                publication_date, deadline_date, notice_type, source_url, document_url,
                description, raw_text, cpv_codes, value_amount, value_currency,
                fit_score, score_label, positive_reasons, negative_reasons, matched_terms,
                breakdown_json, excluded, raw_payload, created_at, updated_at, last_ingested_at
            )
            VALUES(
                :external_id, :source, :source_notice_id, :title, :buyer_name, :country,
                :publication_date, :deadline_date, :notice_type, :source_url, :document_url,
                :description, :raw_text, :cpv_codes, :value_amount, :value_currency,
                :fit_score, :score_label, :positive_reasons, :negative_reasons, :matched_terms,
                :breakdown_json, :excluded, :raw_payload, :created_at, :updated_at, :last_ingested_at
            )
            """,
            payload,
        )
        return "inserted"


def _row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item["cpv_codes"] = _ensure_list(json_loads(item.get("cpv_codes"), []))
    item["positive_reasons"] = _ensure_list(json_loads(item.get("positive_reasons"), []))
    item["negative_reasons"] = _ensure_list(json_loads(item.get("negative_reasons"), []))
    item["matched_terms"] = _ensure_dict(json_loads(item.get("matched_terms"), {}))
    item["breakdown"] = _ensure_dict(json_loads(item.get("breakdown_json"), {}))
    item["raw_payload"] = _ensure_dict(json_loads(item.get("raw_payload"), {}))
    item["excluded"] = bool(item.get("excluded"))
    item.pop("breakdown_json", None)
    return item


def list_tenders(
    *,
    q: str | None = None,
    source: str | None = None,
    country: str | None = None,
    review_status: str | None = None,
    fit_min: float = 0,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    where_clauses = ["fit_score >= ?"]
    params: list[Any] = [fit_min]

    if q:
        where_clauses.append("(LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(raw_text) LIKE ?)")
        pattern = f"%{q.lower()}%"
        params.extend([pattern, pattern, pattern])
    if source:
        where_clauses.append("source = ?")
        params.append(source)
    if country:
        where_clauses.append("country = ?")
        params.append(country)
    if review_status:
        where_clauses.append("review_status = ?")
        params.append(review_status)

    where_sql = " AND ".join(where_clauses)

    with get_connection() as connection:
        total = connection.execute(
            f"SELECT COUNT(*) AS count FROM tenders WHERE {where_sql}",
            params,
        ).fetchone()["count"]

        rows = connection.execute(
            f"""
            SELECT *
            FROM tenders
            WHERE {where_sql}
            ORDER BY fit_score DESC, publication_date DESC, updated_at DESC
            LIMIT ? OFFSET ?
            """,
            [*params, limit, offset],
        ).fetchall()

    return {
        "total": int(total),
        "items": [_row_to_dict(row) for row in rows],
    }


def get_tender(tender_id: int) -> dict[str, Any] | None:
    with get_connection() as connection:
        row = connection.execute(
            "SELECT * FROM tenders WHERE id = ?",
            (tender_id,),
        ).fetchone()
    return _row_to_dict(row) if row else None


def update_tender_review(tender_id: int, review_status: str, review_notes: str | None) -> dict[str, Any] | None:
    with get_connection() as connection:
        connection.execute(
            """
            UPDATE tenders
            SET review_status = ?, review_notes = ?, updated_at = ?
            WHERE id = ?
            """,
            (review_status, review_notes, utc_now(), tender_id),
        )
    return get_tender(tender_id)


def list_sources() -> list[str]:
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT DISTINCT source FROM tenders ORDER BY source ASC"
        ).fetchall()
    return [row["source"] for row in rows]


def list_countries() -> list[str]:
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT DISTINCT country FROM tenders WHERE country IS NOT NULL AND country != '' ORDER BY country ASC"
        ).fetchall()
    return [row["country"] for row in rows]


def get_dashboard_stats() -> dict[str, Any]:
    with get_connection() as connection:
        score_bands = connection.execute(
            """
            SELECT
                SUM(CASE WHEN fit_score >= 75 THEN 1 ELSE 0 END) AS high_fit,
                SUM(CASE WHEN fit_score >= 50 AND fit_score < 75 THEN 1 ELSE 0 END) AS medium_fit,
                SUM(CASE WHEN fit_score < 50 THEN 1 ELSE 0 END) AS low_fit,
                COUNT(*) AS total
            FROM tenders
            """
        ).fetchone()

        reviews = connection.execute(
            """
            SELECT review_status, COUNT(*) AS count
            FROM tenders
            GROUP BY review_status
            """
        ).fetchall()

        sources = connection.execute(
            """
            SELECT source, COUNT(*) AS count
            FROM tenders
            GROUP BY source
            ORDER BY count DESC, source ASC
            """
        ).fetchall()

        recent_runs = connection.execute(
            """
            SELECT *
            FROM ingestion_runs
            ORDER BY started_at DESC
            LIMIT 10
            """
        ).fetchall()

    return {
        "score_bands": dict(score_bands),
        "reviews": [dict(row) for row in reviews],
        "sources": [dict(row) for row in sources],
        "recent_runs": [dict(row) for row in recent_runs],
    }


def rescore_all(score_notice: Any) -> int:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT *
            FROM tenders
            ORDER BY id ASC
            """
        ).fetchall()

    rescored = 0
    for row in rows:
        tender = NormalizedTender(
            source=row["source"],
            source_notice_id=row["source_notice_id"],
            title=row["title"],
            buyer_name=row["buyer_name"] or "",
            country=row["country"] or "",
            publication_date=row["publication_date"],
            deadline_date=row["deadline_date"],
            source_url=row["source_url"] or "",
            document_url=row["document_url"],
            description=row["description"] or "",
            raw_text=row["raw_text"] or "",
            cpv_codes=json_loads(row["cpv_codes"], []),
            notice_type=row["notice_type"],
            value_amount=row["value_amount"],
            value_currency=row["value_currency"],
            raw_payload=json_loads(row["raw_payload"], {}),
        )
        score = score_notice(tender)
        upsert_tender(tender, score)
        rescored += 1
    return rescored


def export_tenders_csv(**filters: Any) -> str:
    dataset = list_tenders(limit=5000, offset=0, **filters)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "ID",
            "Source",
            "Title",
            "Buyer",
            "Country",
            "Publication Date",
            "Deadline",
            "Fit Score",
            "Score Label",
            "Review Status",
            "Source URL",
        ]
    )
    for item in dataset["items"]:
        writer.writerow(
            [
                item["id"],
                item["source"],
                item["title"],
                item["buyer_name"],
                item["country"],
                item["publication_date"],
                item["deadline_date"],
                item["fit_score"],
                item["score_label"],
                item["review_status"],
                item["source_url"],
            ]
        )
    return buffer.getvalue()
