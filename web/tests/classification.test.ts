import { SignalType, TargetCategory } from "@prisma/client";
import { describe, expect, test } from "vitest";

import { classifySignalText } from "@/lib/classification";

describe("classifySignalText", () => {
  test("detects direct procurement signals", () => {
    const result = classifySignalText(
      "RFP for HCP engagement platform",
      "Vendor selection process for omnichannel HCP engagement and CLM workflows.",
    );

    expect(result.signalType).toBe(SignalType.DIRECT_PROCUREMENT);
    expect(result.category).toBe(TargetCategory.HCP_ENGAGEMENT);
    expect(result.isInferred).toBe(false);
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  test("detects technology change around Salesforce and Veeva", () => {
    const result = classifySignalText(
      "Program note mentions Salesforce Life Sciences Cloud rollout",
      "The team is evaluating CRM migration paths and Veeva workflow implications.",
    );

    expect(result.signalType).toBe(SignalType.TECHNOLOGY_CHANGE);
    expect(result.category).toBe(TargetCategory.SALESFORCE_LIFE_SCIENCES);
    expect(result.isInferred).toBe(true);
  });
});
