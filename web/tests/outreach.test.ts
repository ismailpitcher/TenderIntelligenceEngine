import { BuyingRole, Industry, RfpStage, type Account } from "@prisma/client";
import { describe, expect, test } from "vitest";

import { buildOutreachRecommendation, recommendStakeholders } from "@/lib/outreach";

function buildAccount(): Account {
  const now = new Date();
  return {
    id: "account-1",
    name: "Demo Pharma",
    dedupeKey: "demo",
    website: "https://demo.com",
    industry: Industry.PHARMA,
    country: "Germany",
    employeeCount: 1000,
    revenue: 1.4,
    owner: "Owner",
    notes: null,
    createdAt: now,
    updatedAt: now,
  };
}

describe("outreach recommendations", () => {
  test("falls back to default stakeholders when none are present", () => {
    const stakeholders = recommendStakeholders([], []);

    expect(stakeholders.length).toBeGreaterThan(0);
    expect(stakeholders.some((stakeholder) => stakeholder.buyingRole === BuyingRole.PROCUREMENT)).toBe(true);
  });

  test("generates consultative outreach without overstating certainty", () => {
    const outreach = buildOutreachRecommendation({
      account: buildAccount(),
      stage: RfpStage.PRE_RFP,
      categories: ["HCP_ENGAGEMENT", "CRM_ADOPTION"],
      stakeholders: [
        {
          name: "Anna Example",
          title: "VP Commercial Excellence",
          function: "Commercial Excellence",
          buyingRole: BuyingRole.PROGRAM_OWNER,
          relevanceScore: 90,
          suggestedMessageAngle: "Benchmarking enablement workflows.",
        },
      ],
      signals: [],
    });

    expect(outreach.email).toContain("It looks like");
    expect(outreach.linkedin).toContain("I may be wrong");
    expect(outreach.nextBestAction.length).toBeGreaterThan(10);
  });
});
