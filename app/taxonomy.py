from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from .config import TAXONOMY_PATH


@lru_cache(maxsize=1)
def load_taxonomy() -> dict[str, Any]:
    with TAXONOMY_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def reload_taxonomy() -> dict[str, Any]:
    load_taxonomy.cache_clear()
    return load_taxonomy()

