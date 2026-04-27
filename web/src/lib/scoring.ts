import { Industry, RfpStage, SignalType, type ScoringWeight, type Signal } from "@prisma/client";

import type { ScoreLineItem, ScoringExplanation } from "@/lib/types";
import { clamp, daysSince } from "@/lib/utils";

export function weightMap(weights: ScoringWeight[]) {
  return Object.fromEntries(weights.map((weight) => [weight.key, weight.value]));
}

export function scoreImpactForSignal(signalType: SignalType, weights: Record<string, number>) {
  switch (signalType) {
    case SignalType.DIRECT_PROCUREMENT:
      return weights.direct_procurement ?? 40;
    case SignalType.PUBLIC_TENDER:
      return Math.max(30, weights.direct_procurement ?? 40);
    case SignalType.HIRING:
      return weights.hiring_signal ?? 15;
    case SignalType.ORGANIZATIONAL_CHANGE:
      return weights.organizational_change ?? 10;
    case SignalType.VENDOR_SIGNAL:
      return weights.vendor_signal ?? 15;
    case SignalType.TECHNOLOGY_CHANGE:
      return weights.technology_change ?? 20;
    case SignalType.STRATEGIC_INITIATIVE:
    default:
      return weights.strategic_initiative ?? 10;
  }
}

export function stageFromScore(score: number, hasPostDecision = false): RfpStage {
  if (hasPostDecision) {
    return RfpStage.POST_DECISION;
  }
  if (score <= 20) {
    return RfpStage.NO_SIGNAL;
  }
  if (score <= 40) {
    return RfpStage.EARLY_SIGNAL;
  }
  if (score <= 60) {
    return RfpStage.PRE_RFP;
  }
  if (score <= 80) {
    return RfpStage.ACTIVE_EVALUATION;
  }
  return RfpStage.ACTIVE_RFP;
}

export function buildAccountScore(params: {
  industry: Industry;
  signals: Signal[];
  weights: ScoringWeight[];
}): ScoringExplanation {
  const { industry, signals, weights } = params;
  if (!signals.length) {
    return {
      score: 0,
      confidence: 20,
      stage: RfpStage.NO_SIGNAL,
      lines: [{ key: "no_signal", label: "No signals", value: 0, reason: "No signals detected yet for this account." }],
    };
  }

  const map = weightMap(weights);
  const lines: ScoreLineItem[] = [];
  const hasPostDecision = signals.some((signal) => signal.stageHint === RfpStage.POST_DECISION);
  const maxByType = new Map<SignalType, number>();

  for (const signal of signals) {
    const impact = signal.scoreImpact || scoreImpactForSignal(signal.signalType, map);
    const current = maxByType.get(signal.signalType) ?? 0;
    if (impact > current) {
      maxByType.set(signal.signalType, impact);
    }
  }

  let score = 0;
  for (const [signalType, value] of maxByType.entries()) {
    score += value;
    lines.push({
      key: signalType,
      label: signalType.replaceAll("_", " "),
      value,
      reason: `Strongest ${signalType.toLowerCase().replaceAll("_", " ")} signal contributes to the account score.`,
    });
  }

  const recentSignals = signals.filter((signal) => {
    const days = daysSince(signal.publishedAt ?? signal.detectedAt);
    return days !== null && days <= 90;
  });
  if (recentSignals.length >= 2) {
    const value = map.signal_cluster_bonus ?? 10;
    score += value;
    lines.push({
      key: "signal_cluster_bonus",
      label: "Multiple signals in 90 days",
      value,
      reason: "Several signals in a short window usually mean the initiative is becoming concrete.",
    });
  }

  const hasFreshSignal = signals.some((signal) => {
    const days = daysSince(signal.publishedAt ?? signal.detectedAt);
    return days !== null && days <= 30;
  });
  if (hasFreshSignal) {
    const value = map.recency_bonus ?? 10;
    score += value;
    lines.push({
      key: "recency_bonus",
      label: "Recent signal bonus",
      value,
      reason: "Fresh signals are more actionable for a BDR.",
    });
  }

  if (
    industry === Industry.PHARMA ||
    industry === Industry.MEDTECH ||
    industry === Industry.FINANCIAL_SERVICES ||
    industry === Industry.ENTERPRISE_FIELD_SALES
  ) {
    const value = map.industry_fit_bonus ?? 10;
    score += value;
    lines.push({
      key: "industry_fit_bonus",
      label: "Target industry fit",
      value,
      reason: "Pitcher-fit industry bonus for the ideal customer profile.",
    });
  }

  const avgConfidence = signals.reduce((sum, signal) => sum + signal.confidence, 0) / signals.length;
  const allInferred = signals.every((signal) => signal.isInferred);
  if (allInferred && !signals.some((signal) => signal.signalType === SignalType.DIRECT_PROCUREMENT || signal.signalType === SignalType.PUBLIC_TENDER)) {
    const value = Math.abs(map.ambiguity_penalty ?? -10);
    score -= value;
    lines.push({
      key: "ambiguity_penalty",
      label: "Ambiguity penalty",
      value: -value,
      reason: "All signals are inferred and none directly mention procurement.",
    });
  }

  score = clamp(score, 0, 100);
  let confidence = clamp(Math.round(avgConfidence * 100), 25, 95);
  if (signals.some((signal) => signal.signalType === SignalType.DIRECT_PROCUREMENT || signal.signalType === SignalType.PUBLIC_TENDER)) {
    confidence = clamp(confidence + 10, 0, 100);
  }
  if (allInferred) {
    confidence = clamp(confidence - 8, 0, 100);
  }

  return {
    score,
    confidence,
    stage: stageFromScore(score, hasPostDecision),
    lines,
  };
}
