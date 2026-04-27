from app.scoring import score_notice
from app.types import NormalizedTender


def build_notice(raw_text: str, title: str = "Commercial Excellence CRM Transformation") -> NormalizedTender:
    return NormalizedTender(
        source="test",
        source_notice_id="1",
        title=title,
        buyer_name="Example Pharma",
        country="France",
        publication_date="2026-04-20",
        deadline_date="2026-05-12",
        source_url="https://example.com",
        document_url=None,
        description="",
        raw_text=raw_text,
        cpv_codes=["48445000"],
    )


def test_pitcher_like_notice_scores_high():
    notice = build_notice(
        "Global pharma commercial excellence program. CRM integration with Salesforce and SAP. "
        "Field force effectiveness, sales enablement, content delivery, analytics, and multichannel engagement."
    )
    result = score_notice(notice)
    assert result.fit_score >= 75
    assert result.score_label == "high"
    assert not result.excluded


def test_physical_procurement_scores_low():
    notice = build_notice(
        "Supply of cleaning materials, uniforms, hardware, hospital beds, and maintenance services.",
        title="Supply of hospital beds and cleaning materials",
    )
    result = score_notice(notice)
    assert result.fit_score < 30
    assert result.excluded


def test_generic_software_without_pitcher_signals_is_excluded():
    notice = build_notice(
        "Annual ICT software subscription and general licensing support for internal back-office users.",
        title="General ICT Software Subscription",
    )
    result = score_notice(notice)
    assert result.excluded
    assert result.fit_score < 25
