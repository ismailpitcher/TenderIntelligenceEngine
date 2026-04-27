import { PrismaClient } from "@prisma/client";

import {
  COMPETITOR_SEED,
  KEYWORD_SEED,
  PROVIDER_CONFIG_SEED,
  SCORE_WEIGHT_SEED,
  TARGET_PROFILE_SEED,
} from "@/lib/constants";
import { classifySignalText } from "@/lib/classification";
import { MOCK_ACCOUNTS, MOCK_PROVIDER_RUNS, MOCK_SIGNALS } from "@/lib/mock-data";
import { scoreImpactForSignal } from "@/lib/scoring";
import { buildAccountDedupeKey, maybeDate, slugify } from "@/lib/utils";

const prisma = new PrismaClient();

function fingerprintForSignal(accountId: string, providerKey: string, title: string, publishedAt?: string) {
  const dayPart = maybeDate(publishedAt)?.toISOString().slice(0, 10) ?? "undated";
  return `${accountId}:${providerKey}:${slugify(title)}:${dayPart}`;
}

async function main() {
  await prisma.signal.deleteMany();
  await prisma.stakeholder.deleteMany();
  await prisma.account.deleteMany();
  await prisma.providerRun.deleteMany();
  await prisma.searchKeyword.deleteMany();
  await prisma.competitor.deleteMany();
  await prisma.scoringWeight.deleteMany();
  await prisma.providerConfig.deleteMany();
  await prisma.targetProfileSetting.deleteMany();

  await prisma.searchKeyword.createMany({
    data: KEYWORD_SEED,
  });

  await prisma.competitor.createMany({
    data: COMPETITOR_SEED.map((name) => ({ name })),
  });

  await prisma.scoringWeight.createMany({
    data: SCORE_WEIGHT_SEED,
  });

  await prisma.providerConfig.createMany({
    data: PROVIDER_CONFIG_SEED,
  });

  await prisma.targetProfileSetting.createMany({
    data: TARGET_PROFILE_SEED,
  });

  for (const accountSeed of MOCK_ACCOUNTS) {
    await prisma.account.create({
      data: {
        name: accountSeed.name,
        dedupeKey: buildAccountDedupeKey(accountSeed.name, accountSeed.website),
        website: accountSeed.website,
        industry: accountSeed.industry,
        country: accountSeed.country,
        employeeCount: accountSeed.employeeCount,
        revenue: accountSeed.revenue,
        owner: accountSeed.owner,
        notes: accountSeed.notes,
        stakeholders: {
          create: accountSeed.stakeholders,
        },
      },
    });
  }

  const weights = await prisma.scoringWeight.findMany();
  const weightMap = Object.fromEntries(weights.map((weight) => [weight.key, weight.value]));
  const accounts = await prisma.account.findMany({
    select: { id: true, name: true },
  });
  const accountMap = new Map(accounts.map((account) => [account.name, account.id]));

  for (const signalSeed of MOCK_SIGNALS) {
    const accountId = accountMap.get(signalSeed.accountName);
    if (!accountId) {
      continue;
    }
    const classification = classifySignalText(signalSeed.title, signalSeed.description);
    const signalType = signalSeed.signalType ?? classification.signalType;
    const category = signalSeed.category ?? classification.category;

    await prisma.signal.create({
      data: {
        fingerprint: fingerprintForSignal(accountId, signalSeed.providerKey, signalSeed.title, signalSeed.publishedAt),
        accountId,
        providerKey: signalSeed.providerKey,
        title: signalSeed.title,
        description: signalSeed.description,
        signalType,
        sourceType: signalSeed.sourceType,
        sourceName: signalSeed.sourceName,
        sourceUrl: signalSeed.sourceUrl,
        detectedAt: maybeDate(signalSeed.detectedAt ?? signalSeed.publishedAt) ?? new Date(),
        publishedAt: maybeDate(signalSeed.publishedAt),
        confidence: signalSeed.confidence ?? classification.confidence,
        confidenceReason: classification.confidenceReason,
        scoreImpact: scoreImpactForSignal(signalType, weightMap),
        evidenceSnippet: signalSeed.evidenceSnippet,
        category,
        recommendedAction: signalSeed.recommendedAction,
        isInferred: signalSeed.isInferred ?? classification.isInferred,
        stageHint: signalSeed.stageHint,
      },
    });
  }

  await prisma.providerRun.createMany({
    data: MOCK_PROVIDER_RUNS.map((run) => ({
      ...run,
      startedAt: maybeDate(run.startedAt) ?? new Date(),
      finishedAt: maybeDate(run.finishedAt) ?? new Date(),
    })),
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
