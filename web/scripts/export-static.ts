import fs from "node:fs/promises";
import path from "node:path";

import { getDashboardSnapshot } from "../src/lib/account-service";
import { STAGE_LABELS, SIGNAL_TYPE_LABELS, TARGET_CATEGORY_LABELS, INDUSTRY_LABELS, PROVIDER_STATUS_LABELS } from "../src/lib/constants";
import { renderAccountMarkdown, renderFullReport, renderMessages } from "../src/lib/export-service";
import { getSettingsSnapshot } from "../src/lib/settings-service";

async function main() {
  const [dashboard, settings] = await Promise.all([
    getDashboardSnapshot(),
    getSettingsSnapshot(),
  ]);

  const data = {
    generatedAt: new Date().toISOString(),
    summary: {
      monitoredAccounts: dashboard.monitoredAccounts,
      activeRfpSignals: dashboard.activeRfpSignals,
      preRfpSignals: dashboard.preRfpSignals,
      highPriorityAccounts: dashboard.highPriorityAccounts,
      recentSignals: dashboard.recentSignals,
    },
    accounts: dashboard.accounts.map((item) => ({
      id: item.account.id,
      name: item.account.name,
      website: item.account.website,
      industry: item.account.industry,
      industryLabel: INDUSTRY_LABELS[item.account.industry],
      country: item.account.country,
      employeeCount: item.account.employeeCount,
      revenue: item.account.revenue,
      owner: item.account.owner,
      notes: item.account.notes,
      score: item.explanation.score,
      confidence: item.explanation.confidence,
      stage: item.explanation.stage,
      stageLabel: STAGE_LABELS[item.explanation.stage],
      lastDetectedAt: item.lastDetectedAt?.toISOString() ?? null,
      topCategories: item.topCategories.map((category) => ({
        value: category,
        label: TARGET_CATEGORY_LABELS[category],
      })),
      scoringExplanation: item.explanation.lines,
      signals: item.signals.map((signal) => ({
        id: signal.id,
        title: signal.title,
        description: signal.description,
        signalType: signal.signalType,
        signalTypeLabel: SIGNAL_TYPE_LABELS[signal.signalType],
        sourceType: signal.sourceType,
        sourceName: signal.sourceName,
        sourceUrl: signal.sourceUrl,
        detectedAt: signal.detectedAt.toISOString(),
        publishedAt: signal.publishedAt?.toISOString() ?? null,
        confidence: Math.round(signal.confidence * 100),
        scoreImpact: signal.scoreImpact,
        evidenceSnippet: signal.evidenceSnippet,
        category: signal.category,
        categoryLabel: TARGET_CATEGORY_LABELS[signal.category],
        recommendedAction: signal.recommendedAction,
        isInferred: signal.isInferred,
      })),
      stakeholders: item.stakeholders,
      outreach: item.outreach,
      missingInformation: item.missingInformation,
      exports: {
        markdown: renderAccountMarkdown(item),
        messagesMarkdown: renderMessages(item, "md"),
        messagesText: renderMessages(item, "txt"),
      },
    })),
    signals: dashboard.feed.map((signal) => ({
      id: signal.id,
      accountId: signal.account.id,
      accountName: signal.account.name,
      title: signal.title,
      description: signal.description,
      signalType: signal.signalType,
      signalTypeLabel: SIGNAL_TYPE_LABELS[signal.signalType],
      category: signal.category,
      categoryLabel: TARGET_CATEGORY_LABELS[signal.category],
      confidence: Math.round(signal.confidence * 100),
      sourceName: signal.sourceName,
      sourceType: signal.sourceType,
      sourceUrl: signal.sourceUrl,
      publishedAt: signal.publishedAt?.toISOString() ?? null,
      detectedAt: signal.detectedAt.toISOString(),
      evidenceSnippet: signal.evidenceSnippet,
      recommendedAction: signal.recommendedAction,
    })),
    settings: {
      scoringWeights: settings.scoringWeights,
      keywords: settings.keywords,
      competitors: settings.competitors,
      targetSettings: settings.targetSettings,
      providerConfigs: settings.providerConfigs.map((provider) => ({
        ...provider,
        statusLabel: PROVIDER_STATUS_LABELS[provider.status],
      })),
    },
    fullReportMarkdown: renderFullReport(dashboard),
  };

  const outDir = path.resolve(process.cwd(), "../docs/data");
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, "radar.json"), JSON.stringify(data, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
