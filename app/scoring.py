from __future__ import annotations

import re
from typing import Any

from .taxonomy import load_taxonomy
from .types import NormalizedTender, ScoreResult


WHITESPACE_RE = re.compile(r"\s+")


def _normalize_text(value: str) -> str:
    return WHITESPACE_RE.sub(" ", (value or "").strip()).lower()


def _contains_term(text: str, term: str) -> bool:
    cleaned = term.strip().lower()
    if not cleaned:
        return False
    if " " in cleaned or "-" in cleaned:
        return cleaned in text
    return re.search(rf"\b{re.escape(cleaned)}\b", text) is not None


def _flatten_text(tender: NormalizedTender) -> str:
    return _normalize_text(
        " ".join(
            [
                tender.title,
                tender.description,
                tender.raw_text,
                " ".join(tender.cpv_codes),
                tender.buyer_name,
                tender.country,
            ]
        )
    )


def _bucket_score(text: str, items: list[dict[str, Any]], cap: float) -> tuple[float, list[str]]:
    score = 0.0
    matches: list[str] = []
    for item in items:
        term = item["term"]
        if _contains_term(text, term):
            score += float(item["weight"])
            matches.append(term)
    return min(score, cap), sorted(set(matches))


def _cpv_adjustment(cpv_codes: list[str], taxonomy: dict[str, Any]) -> tuple[float, float, list[str], list[str]]:
    positive_matches: list[str] = []
    negative_matches: list[str] = []
    positive_score = 0.0
    negative_score = 0.0

    codes = [code.strip() for code in cpv_codes if code]

    for prefix in taxonomy.get("positive_cpv_prefixes", []):
        if any(code.startswith(prefix) for code in codes):
            positive_score += 7
            positive_matches.append(prefix)

    for prefix in taxonomy.get("negative_cpv_prefixes", []):
        if any(code.startswith(prefix) for code in codes):
            negative_score += 10
            negative_matches.append(prefix)

    return min(positive_score, 14), min(negative_score, 20), positive_matches, negative_matches


def score_notice(tender: NormalizedTender) -> ScoreResult:
    taxonomy = load_taxonomy()
    text = _flatten_text(tender)

    industry_score, industry_matches = _bucket_score(text, taxonomy["positive"]["industry"], 24)
    workflow_score, workflow_matches = _bucket_score(text, taxonomy["positive"]["commercial_workflows"], 34)
    buyer_score, buyer_matches = _bucket_score(text, taxonomy["positive"]["buyer_teams"], 16)
    integration_score, integration_matches = _bucket_score(text, taxonomy["positive"]["integrations"], 14)
    scale_score, scale_matches = _bucket_score(text, taxonomy["positive"]["scale_signals"], 12)

    negative_score, negative_matches = _bucket_score(text, taxonomy["negative"]["generic_exclusions"], 24)
    physical_score, physical_matches = _bucket_score(text, taxonomy["negative"]["physical_goods_exclusions"], 20)

    cpv_positive_score, cpv_negative_score, cpv_positive_matches, cpv_negative_matches = _cpv_adjustment(
        tender.cpv_codes,
        taxonomy,
    )

    synergy_score = 0.0
    if industry_matches and workflow_matches:
        synergy_score += 8
    if buyer_matches and integration_matches:
        synergy_score += 4
    if scale_matches and workflow_matches:
        synergy_score += 3

    positive_total = industry_score + workflow_score + buyer_score + integration_score + scale_score + cpv_positive_score + synergy_score
    negative_total = negative_score + physical_score + cpv_negative_score
    fit_score = max(0.0, min(100.0, positive_total - negative_total))

    excluded = False
    if physical_score >= 16 or (negative_score >= 16 and positive_total < 40):
        excluded = True
        fit_score = min(fit_score, 24)
    if physical_score >= 12 and fit_score < 30:
        excluded = True

    if fit_score >= 75:
        score_label = "high"
    elif fit_score >= 50:
        score_label = "medium"
    elif fit_score >= 30:
        score_label = "low"
    else:
        score_label = "discard"

    positive_reasons = []
    if industry_matches:
        positive_reasons.append("Target-industry language matched")
    if workflow_matches:
        positive_reasons.append("Commercial workflow terms matched Pitcher-style use cases")
    if buyer_matches:
        positive_reasons.append("Buyer-team language suggests sales or commercial ownership")
    if integration_matches:
        positive_reasons.append("Integration stack signals point to CRM, ERP, or enablement ecosystems")
    if scale_matches:
        positive_reasons.append("Scale signals suggest a budgeted enterprise-style transformation")
    if cpv_positive_matches:
        positive_reasons.append("CPV codes align with software, IT services, or business applications")

    negative_reasons = []
    if negative_matches:
        negative_reasons.append("Generic exclusion terms suggest broad or unrelated procurement")
    if physical_matches:
        negative_reasons.append("Physical-goods or operational procurement signals dominate the notice")
    if cpv_negative_matches:
        negative_reasons.append("CPV codes point to physical supplies, construction, or non-Pitcher categories")

    matched_terms = {
        "industry": industry_matches,
        "commercial_workflows": workflow_matches,
        "buyer_teams": buyer_matches,
        "integrations": integration_matches,
        "scale_signals": scale_matches,
        "negative_terms": negative_matches,
        "physical_goods": physical_matches,
        "positive_cpv_prefixes": cpv_positive_matches,
        "negative_cpv_prefixes": cpv_negative_matches,
    }

    breakdown = {
        "industry": round(industry_score, 2),
        "commercial_workflows": round(workflow_score, 2),
        "buyer_teams": round(buyer_score, 2),
        "integrations": round(integration_score, 2),
        "scale_signals": round(scale_score, 2),
        "cpv_positive": round(cpv_positive_score, 2),
        "synergy": round(synergy_score, 2),
        "negative_terms": round(negative_score, 2),
        "physical_goods": round(physical_score, 2),
        "cpv_negative": round(cpv_negative_score, 2),
    }

    return ScoreResult(
        fit_score=round(fit_score, 2),
        score_label=score_label,
        positive_reasons=positive_reasons,
        negative_reasons=negative_reasons,
        matched_terms=matched_terms,
        breakdown=breakdown,
        excluded=excluded,
    )
