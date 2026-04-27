from __future__ import annotations

import argparse
import json

from .database import get_dashboard_stats, init_db, rescore_all
from .scoring import score_notice
from .services.ingestion import available_sources, sync_sources


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Tender Intelligence Engine CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("init-db", help="Initialize the SQLite database")

    sync_parser = subparsers.add_parser("sync", help="Sync source data")
    sync_parser.add_argument("--days-back", type=int, default=10)
    sync_parser.add_argument("--limit-per-source", type=int, default=20)
    sync_parser.add_argument(
        "--sources",
        nargs="+",
        default=available_sources(),
        choices=available_sources(),
    )

    subparsers.add_parser("rescore", help="Re-score all stored notices")
    subparsers.add_parser("stats", help="Print dashboard stats as JSON")
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    init_db()

    if args.command == "init-db":
        print("Database initialized.")
        return

    if args.command == "sync":
        result = sync_sources(
            sources=args.sources,
            days_back=args.days_back,
            limit_per_source=args.limit_per_source,
        )
        print(json.dumps(result, indent=2))
        return

    if args.command == "rescore":
        count = rescore_all(score_notice)
        print(f"Rescored {count} tenders.")
        return

    if args.command == "stats":
        print(json.dumps(get_dashboard_stats(), indent=2))


if __name__ == "__main__":
    main()

