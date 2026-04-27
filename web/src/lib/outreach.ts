import { BuyingRole, RfpStage, type Account, type Signal, type Stakeholder, type TargetCategory } from "@prisma/client";

import { DEFAULT_STAKEHOLDER_FALLBACKS, INDUSTRY_LABELS, TARGET_CATEGORY_LABELS } from "@/lib/constants";
import type { OutreachRecommendation, RecommendedStakeholder } from "@/lib/types";

function categorySummary(categories: TargetCategory[]) {
  return categories.slice(0, 2).map((category) => TARGET_CATEGORY_LABELS[category]).join(" and ");
}

export function recommendStakeholders(signals: Signal[], stakeholders: Stakeholder[]): RecommendedStakeholder[] {
  if (!stakeholders.length) {
    return DEFAULT_STAKEHOLDER_FALLBACKS;
  }

  const wantsProcurement = signals.some((signal) => signal.signalType === "DIRECT_PROCUREMENT" || signal.signalType === "PUBLIC_TENDER");
  const wantsTech = signals.some((signal) => signal.signalType === "TECHNOLOGY_CHANGE");
  const wantsEnablement = signals.some((signal) => signal.category === "SALES_ENABLEMENT" || signal.category === "COMMERCIAL_EXCELLENCE");

  return stakeholders
    .map((stakeholder) => {
      let bonus = 0;
      if (wantsProcurement && stakeholder.buyingRole === BuyingRole.PROCUREMENT) {
        bonus += 8;
      }
      if (wantsTech && stakeholder.function.toLowerCase().includes("crm")) {
        bonus += 7;
      }
      if (wantsEnablement && stakeholder.function.toLowerCase().includes("commercial")) {
        bonus += 6;
      }
      return {
        ...stakeholder,
        relevanceScore: stakeholder.relevanceScore + bonus,
      };
    })
    .sort((left, right) => right.relevanceScore - left.relevanceScore)
    .slice(0, 4);
}

export function buildOutreachRecommendation(params: {
  account: Account;
  stage: RfpStage;
  categories: TargetCategory[];
  stakeholders: RecommendedStakeholder[];
  signals: Signal[];
}): OutreachRecommendation {
  const { account, stage, categories, stakeholders, signals } = params;
  const topStakeholder = stakeholders[0];
  const topSignal = signals[0];
  const categoryText = categories.length ? categorySummary(categories) : "commercial engagement workflows";
  const industryText = INDUSTRY_LABELS[account.industry];

  const angleByStage: Record<RfpStage, string> = {
    NO_SIGNAL: `Stay warm and map ownership around ${categoryText}.`,
    EARLY_SIGNAL: `Offer a low-pressure benchmark conversation around ${categoryText}.`,
    PRE_RFP: `Help the team shape vendor criteria before a formal process starts around ${categoryText}.`,
    ACTIVE_EVALUATION: "Position Pitcher as a benchmark option while evaluation criteria are still flexible.",
    ACTIVE_RFP: "Move fast to understand whether the shortlist is still open and where field execution gaps remain.",
    POST_DECISION: "Treat this as a late-cycle account and look for adjacent business-unit whitespace.",
  };

  const angle = angleByStage[stage];
  const personReference = topStakeholder?.name ?? "your team";
  const signalReference = topSignal?.title ?? "commercial workflow changes";

  const email = [
    `Subject: Quick benchmark on ${account.name}'s ${categoryText.toLowerCase()} review`,
    "",
    `Hi ${personReference.split(" ")[0] || "team"},`,
    "",
    `It looks like ${account.name} may be reviewing ${categoryText.toLowerCase()} after signals like "${signalReference}". I may be wrong, but teams in ${industryText.toLowerCase()} often use this window to compare field execution, compliant content usage, and CRM adoption workflows before vendor selection hardens.`,
    "",
    "Pitcher helps field teams connect HCP or customer engagement, enablement content, coaching, and CRM workflows in one operating layer. If useful, I can share a short benchmark of how similar teams evaluate this space before formal procurement starts.",
    "",
    "Worth comparing notes for 15 minutes?",
    "",
    "Best,",
    "Your name",
  ].join("\n");

  const linkedin = `It looks like ${account.name} may be revisiting ${categoryText.toLowerCase()}. I may be wrong, but teams in similar situations often benchmark field execution and CRM-adoption workflows before formal vendor selection. Worth comparing notes?`;

  const nextBestAction =
    stage === RfpStage.ACTIVE_RFP
      ? "Prioritize same-week outreach to the likely program owner and procurement contact."
      : stage === RfpStage.POST_DECISION
        ? "Look for regional or adjacent business-unit whitespace instead of pushing the current cycle."
        : "Reach out to the top stakeholder with a benchmark-led message and confirm whether evaluation criteria are already being drafted.";

  return {
    angle,
    email,
    linkedin,
    nextBestAction,
  };
}

export function deriveMissingInformation(signals: Signal[], stakeholders: RecommendedStakeholder[]) {
  const items: string[] = [];

  if (!signals.some((signal) => signal.signalType === "DIRECT_PROCUREMENT" || signal.signalType === "PUBLIC_TENDER")) {
    items.push("No confirmed procurement notice yet.");
  }
  if (!signals.some((signal) => signal.signalType === "VENDOR_SIGNAL")) {
    items.push("No explicit competitor or incumbent vendor evidence yet.");
  }
  if (!stakeholders.some((stakeholder) => stakeholder.buyingRole === BuyingRole.PROCUREMENT)) {
    items.push("Named procurement contact is still missing.");
  }
  if (!signals.some((signal) => !signal.isInferred)) {
    items.push("Most evidence is inferred rather than directly confirmed.");
  }

  return items;
}
