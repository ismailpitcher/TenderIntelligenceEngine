import { SignalType, TargetCategory } from "@prisma/client";

import { COMPETITOR_SEED } from "@/lib/constants";
import type { SignalClassificationResult } from "@/lib/types";
import { normalizeText } from "@/lib/utils";

const SIGNAL_PATTERNS: Array<{ type: SignalType; phrases: string[] }> = [
  { type: SignalType.DIRECT_PROCUREMENT, phrases: ["rfp", "rfq", "rfi", "tender", "procurement", "supplier registration", "vendor selection", "call for proposals", "sourcing event"] },
  { type: SignalType.HIRING, phrases: ["hiring", "job post", "open role", "commercial excellence lead", "sales enablement", "crm manager", "omnichannel manager", "field excellence"] },
  { type: SignalType.TECHNOLOGY_CHANGE, phrases: ["crm migration", "salesforce life sciences cloud", "veeva", "iqvia", "clm replacement", "enablement platform review", "salesforce implementation"] },
  { type: SignalType.ORGANIZATIONAL_CHANGE, phrases: ["new head of", "new vp", "new chief commercial officer", "new digital transformation", "centralization of commercial operations"] },
  { type: SignalType.STRATEGIC_INITIATIVE, phrases: ["commercial transformation", "sales transformation", "digital transformation", "omnichannel transformation", "field force productivity", "launch excellence", "ai in sales", "rep readiness"] },
  { type: SignalType.VENDOR_SIGNAL, phrases: ["case study", "partner announcement", "renewal timing", "rollout", ...COMPETITOR_SEED.map((item) => item.toLowerCase())] },
  { type: SignalType.PUBLIC_TENDER, phrases: ["ted", "find a tender", "nhs procurement", "ungm", "world bank procurement", "procurement portal"] },
];

const CATEGORY_PATTERNS: Array<{ category: TargetCategory; phrases: string[] }> = [
  { category: TargetCategory.SALES_ENABLEMENT, phrases: ["sales enablement", "sales content", "guided selling", "showpad", "seismic", "highspot"] },
  { category: TargetCategory.REVENUE_ENABLEMENT, phrases: ["revenue enablement"] },
  { category: TargetCategory.FIELD_ENABLEMENT, phrases: ["field enablement", "field execution", "field workflow"] },
  { category: TargetCategory.COMMERCIAL_EXCELLENCE, phrases: ["commercial excellence", "sales force effectiveness", "field force effectiveness", "launch excellence"] },
  { category: TargetCategory.HCP_ENGAGEMENT, phrases: ["hcp engagement", "customer engagement"] },
  { category: TargetCategory.CLM_EDETAILING, phrases: ["clm", "edetailing", "closed loop marketing"] },
  { category: TargetCategory.CRM_ADOPTION, phrases: ["crm adoption", "crm workflow", "crm transformation"] },
  { category: TargetCategory.SALESFORCE_LIFE_SCIENCES, phrases: ["salesforce life sciences cloud"] },
  { category: TargetCategory.VEEVA_IQVIA_TRANSITION, phrases: ["veeva", "iqvia", "vault crm", "oce"] },
  { category: TargetCategory.OMNICHANNEL, phrases: ["omnichannel", "multichannel", "digital customer engagement"] },
  { category: TargetCategory.DIGITAL_SALES_ROOM, phrases: ["digital sales room", "hcp portal", "portal"] },
  { category: TargetCategory.AI_COACHING, phrases: ["ai coaching", "ai roleplay", "conversation simulation"] },
  { category: TargetCategory.SALES_READINESS, phrases: ["sales readiness", "field training", "rep certification"] },
  { category: TargetCategory.CONTENT_GOVERNANCE, phrases: ["content governance", "dam", "mlr", "content workflow"] },
  { category: TargetCategory.MOBILE_FIELD_APP, phrases: ["mobile field sales", "mobile field app"] },
  { category: TargetCategory.OFFLINE_CONTENT, phrases: ["offline content", "offline delivery"] },
  { category: TargetCategory.SAMPLE_CONSENT, phrases: ["sample management", "consent management"] },
  { category: TargetCategory.SALES_ANALYTICS, phrases: ["sales analytics", "dashboard", "field performance"] },
];

function includesPhrase(haystack: string, phrases: string[]) {
  return phrases.some((phrase) => haystack.includes(phrase));
}

export function classifySignalText(title: string, description: string): SignalClassificationResult {
  const haystack = normalizeText(`${title} ${description}`);
  const signal = SIGNAL_PATTERNS.find((candidate) => includesPhrase(haystack, candidate.phrases));
  const category = CATEGORY_PATTERNS.find((candidate) => includesPhrase(haystack, candidate.phrases));

  const signalType = signal?.type ?? SignalType.STRATEGIC_INITIATIVE;
  const targetCategory = category?.category ?? TargetCategory.SALES_ENABLEMENT;
  const directMention = signalType === SignalType.DIRECT_PROCUREMENT || signalType === SignalType.PUBLIC_TENDER;
  const confidence = directMention ? 0.9 : signalType === SignalType.TECHNOLOGY_CHANGE ? 0.78 : signalType === SignalType.HIRING ? 0.72 : 0.6;

  return {
    signalType,
    category: targetCategory,
    confidence,
    confidenceReason: directMention
      ? "Direct procurement language detected in the evidence."
      : signal
        ? `Inferred from ${signalType.toLowerCase().replaceAll("_", " ")} language.`
        : "Weak inferred signal based on transformation language.",
    isInferred: !directMention,
  };
}
