from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
TAXONOMY_PATH = DATA_DIR / "pitcher_taxonomy.json"


@dataclass(frozen=True)
class Settings:
    app_name: str = "Tender Intelligence Engine"
    app_subtitle: str = "Europe-first Pitcher-fit procurement radar"
    db_path: Path = Path(os.getenv("TIE_DB_PATH", DATA_DIR / "tender_intelligence.db"))
    user_agent: str = os.getenv(
        "TIE_USER_AGENT",
        "TenderIntelligenceEngine/1.0 (+https://github.com/ismailpitcher/TenderIntelligenceEngine)",
    )
    request_timeout: int = int(os.getenv("TIE_REQUEST_TIMEOUT", "30"))
    default_sync_days: int = int(os.getenv("TIE_DEFAULT_SYNC_DAYS", "10"))
    sync_limit_per_source: int = int(os.getenv("TIE_SYNC_LIMIT_PER_SOURCE", "20"))
    max_raw_text_length: int = int(os.getenv("TIE_MAX_RAW_TEXT_LENGTH", "50000"))


settings = Settings()

