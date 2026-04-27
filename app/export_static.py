from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .database import get_dashboard_stats, list_countries, list_sources, list_tenders, utc_now
from .taxonomy import load_taxonomy


def build_snapshot(limit: int = 1000) -> dict[str, Any]:
    dataset = list_tenders(fit_min=0, limit=limit, offset=0)
    return {
        "generated_at": utc_now(),
        "total": dataset["total"],
        "stats": get_dashboard_stats(),
        "meta": {
            "sources": list_sources(),
            "countries": list_countries(),
            "taxonomy": load_taxonomy(),
            "mode": "static",
        },
        "tenders": dataset["items"],
    }


def write_snapshot(out_dir: Path, limit: int = 1000) -> dict[str, Any]:
    out_dir.mkdir(parents=True, exist_ok=True)
    snapshot = build_snapshot(limit=limit)
    (out_dir / "snapshot.json").write_text(
        json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    return snapshot
