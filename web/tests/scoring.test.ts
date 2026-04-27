import { Industry, RfpStage, SignalType, type ScoringWeight, type Signal } from "@prisma/client";
import { describe, expect, test } from "vitest";

import { SCORE_WEIGHT_SEED } from "@/lib/constants";
import { buildAccountScore, stageFromScore } from "@/lib/scoring";

function buildWeights(): ScoringWeight[] {
  const now = new Date();
  return SCORE_WEIGHT_SEED.map((weight, index) => ({
    id: `weight-${index}`,
    createdAt: now,
    updatedAt: now,
    ...weight,
  }));
}

function buildSignal(overrides: Partial<Signal>): Signal {
  const now = new Date();
  return {
    id: "signal-1",
    fingerprint: "signal-1",
    accountId: "account-1",
    providerKey: "mock",
    title: "Signal title",
    description: "Signal description",
    signalType: SignalType.STRATEGIC_INITIATIVE,
    sourceType: "PRESS_RELEASE",
    sourceName: "Mock",
    sourceUrl: "https://example.com",
    detectedAt: now,
    publishedAt: now,
    confidence: 0.72,
    confidenceReason: "Mock",
    scoreImpact: 10,
    evidenceSnippet: "Evidence",
    category: "SALES_ENABLEMENT",
    recommendedAction: "Act",
    isInferred: true,
    stageHint: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("scoring", () => {
  test("assigns active RFP to strong direct procurement plus supporting signals", () => {
    const explanation = buildAccountScore({
      industry: Industry.PHARMA,
      weights: buildWeights(),
      signals: [
        buildSignal({
          id: "a",
          fingerprint: "a",
          signalType: SignalType.DIRECT_PROCUREMENT,
          scoreImpact: 40,
          confidence: 0.92,
          isInferred: false,
        }),
        buildSignal({
          id: "b",
          fingerprint: "b",
          signalType: SignalType.TECHNOLOGY_CHANGE,
          scoreImpact: 20,
          confidence: 0.8,
        }),
      ],
    });

    expect(explanation.score).toBeGreaterThanOrEqual(80);
    expect(explanation.stage).toBe(RfpStage.ACTIVE_RFP);
    expect(explanation.confidence).toBeGreaterThanOrEqual(80);
  });

  test("uses post decision stage hint when present", () => {
    const explanation = buildAccountScore({
      industry: Industry.MEDTECH,
      weights: buildWeights(),
      signals: [
        buildSignal({
          stageHint: RfpStage.POST_DECISION,
          signalType: SignalType.VENDOR_SIGNAL,
          scoreImpact: 15,
        }),
      ],
    });

    expect(explanation.stage).toBe(RfpStage.POST_DECISION);
  });

  test("maps score ranges to expected stages", () => {
    expect(stageFromScore(10)).toBe(RfpStage.NO_SIGNAL);
    expect(stageFromScore(30)).toBe(RfpStage.EARLY_SIGNAL);
    expect(stageFromScore(50)).toBe(RfpStage.PRE_RFP);
    expect(stageFromScore(70)).toBe(RfpStage.ACTIVE_EVALUATION);
    expect(stageFromScore(90)).toBe(RfpStage.ACTIVE_RFP);
  });
});
