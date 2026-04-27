from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field

from .config import settings
from .database import (
    export_tenders_csv,
    get_dashboard_stats,
    get_tender,
    init_db,
    list_countries,
    list_sources,
    list_tenders,
    rescore_all,
    update_tender_review,
)
from .scoring import score_notice
from .services.ingestion import available_sources, sync_sources
from .taxonomy import load_taxonomy


app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

static_dir = Path(__file__).resolve().parent / "static"
templates_dir = Path(__file__).resolve().parent / "templates"
app.mount("/static", StaticFiles(directory=static_dir), name="static")
templates = Jinja2Templates(directory=str(templates_dir))


class SyncRequest(BaseModel):
    sources: list[str] = Field(default_factory=available_sources)
    days_back: int = Field(default=settings.default_sync_days, ge=1, le=365)
    limit_per_source: int = Field(default=settings.sync_limit_per_source, ge=1, le=100)


class ReviewRequest(BaseModel):
    review_status: str = Field(pattern="^(new|qualified|watch|rejected)$")
    review_notes: str | None = None


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/", response_class=HTMLResponse)
def index(request: Request) -> HTMLResponse:
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "app_name": settings.app_name,
            "app_subtitle": settings.app_subtitle,
        },
    )


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/stats")
def api_stats() -> dict:
    return get_dashboard_stats()


@app.get("/api/meta")
def api_meta() -> dict:
    return {
        "sources": list_sources() or available_sources(),
        "countries": list_countries(),
        "taxonomy": load_taxonomy(),
        "defaults": {
            "days_back": settings.default_sync_days,
            "limit_per_source": settings.sync_limit_per_source,
        },
    }


@app.get("/api/tenders")
def api_tenders(
    q: str | None = Query(default=None),
    source: str | None = Query(default=None),
    country: str | None = Query(default=None),
    review_status: str | None = Query(default=None),
    fit_min: float = Query(default=0, ge=0, le=100),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict:
    return list_tenders(
        q=q,
        source=source,
        country=country,
        review_status=review_status,
        fit_min=fit_min,
        limit=limit,
        offset=offset,
    )


@app.get("/api/tenders/{tender_id}")
def api_tender_detail(tender_id: int) -> dict:
    tender = get_tender(tender_id)
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    return tender


@app.patch("/api/tenders/{tender_id}")
def api_update_tender(tender_id: int, payload: ReviewRequest) -> dict:
    tender = update_tender_review(tender_id, payload.review_status, payload.review_notes)
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    return tender


@app.post("/api/sync")
def api_sync(payload: SyncRequest) -> dict:
    unknown = sorted(set(payload.sources) - set(available_sources()))
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown sources: {', '.join(unknown)}")
    summaries = sync_sources(
        sources=payload.sources,
        days_back=payload.days_back,
        limit_per_source=payload.limit_per_source,
    )
    return {"runs": summaries}


@app.post("/api/rescore")
def api_rescore() -> dict:
    count = rescore_all(score_notice)
    return {"rescored": count}


@app.get("/api/export.csv")
def api_export_csv(
    q: str | None = Query(default=None),
    source: str | None = Query(default=None),
    country: str | None = Query(default=None),
    review_status: str | None = Query(default=None),
    fit_min: float = Query(default=0, ge=0, le=100),
) -> PlainTextResponse:
    csv_text = export_tenders_csv(
        q=q,
        source=source,
        country=country,
        review_status=review_status,
        fit_min=fit_min,
    )
    headers = {"Content-Disposition": "attachment; filename=tender-intelligence-export.csv"}
    return PlainTextResponse(csv_text, media_type="text/csv", headers=headers)
