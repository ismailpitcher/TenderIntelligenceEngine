import {
  BuyingRole,
  Industry,
  Prisma,
  ProviderRunStatus,
  RfpStage,
  SettingType,
  type Account,
  type ScoringWeight,
  type Signal,
  type TargetCategory,
} from "@prisma/client";

import { parseAccountCsv, dedupeParsedAccounts } from "@/lib/csv";
import { MOCK_ACCOUNTS } from "@/lib/mock-data";
import { buildOutreachRecommendation, deriveMissingInformation, recommendStakeholders } from "@/lib/outreach";
import { prisma } from "@/lib/prisma";
import { generateMockSignalsForAccount } from "@/lib/providers";
import { scoreImpactForSignal, buildAccountScore } from "@/lib/scoring";
import type {
  AccountIntelligence,
  DashboardSnapshot,
  ImportAccountsResult,
  ParsedAccountRow,
  SignalWithAccount,
} from "@/lib/types";
import { buildAccountDedupeKey, maybeDate, normalizeText, slugify } from "@/lib/utils";
import { classifySignalText } from "@/lib/classification";

const accountInclude = {
  signals: {
    orderBy: [{ publishedAt: "desc" }, { detectedAt: "desc" }],
  },
  stakeholders: {
    orderBy: [{ relevanceScore: "desc" }],
  },
} satisfies Prisma.AccountInclude;

type AccountRecord = Prisma.AccountGetPayload<{ include: typeof accountInclude }>;

export interface AccountFilters {
  search?: string;
  industry?: string;
  country?: string;
  stage?: string;
  minScore?: number;
  lastDetectedDays?: number;
}

export interface SignalFilters {
  signalType?: string;
  category?: string;
  confidence?: number;
  search?: string;
}

function topCategories(signals: Signal[]) {
  const counts = new Map<TargetCategory, number>();
  for (const signal of signals) {
    counts.set(signal.category, (counts.get(signal.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([category]) => category);
}

function latestSignalDate(signals: Signal[]) {
  const dates = signals
    .map((signal) => maybeDate(signal.publishedAt ?? signal.detectedAt))
    .filter((value): value is Date => value instanceof Date);
  if (!dates.length) {
    return null;
  }
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

function buildDefaultStakeholders(account: Pick<Account, "name" | "industry">) {
  if (account.industry === Industry.PHARMA || account.industry === Industry.MEDTECH) {
    return [
      {
        name: `${account.name} Commercial Lead`,
        title: "VP Commercial Excellence",
        function: "Commercial Excellence",
        buyingRole: BuyingRole.PROGRAM_OWNER,
        relevanceScore: 84,
        suggestedMessageAngle: "Benchmarking field execution, HCP engagement, and coaching workflows before procurement takes shape.",
      },
      {
        name: `${account.name} CRM Lead`,
        title: "Director, CRM and Omnichannel Programs",
        function: "Commercial Technology",
        buyingRole: BuyingRole.CHAMPION,
        relevanceScore: 79,
        suggestedMessageAngle: "Reducing friction across CRM, content, and mobile field workflows.",
      },
      {
        name: `${account.name} Procurement Lead`,
        title: "Category Manager, Commercial Technology",
        function: "Procurement",
        buyingRole: BuyingRole.PROCUREMENT,
        relevanceScore: 62,
        suggestedMessageAngle: "Checking whether formal vendor discovery has started.",
      },
    ];
  }

  return [
    {
      name: `${account.name} Revenue Lead`,
      title: "VP Revenue Enablement",
      function: "Revenue Enablement",
      buyingRole: BuyingRole.PROGRAM_OWNER,
      relevanceScore: 80,
      suggestedMessageAngle: "Benchmarking enablement and CRM workflow consistency across field teams.",
    },
    {
      name: `${account.name} Systems Lead`,
      title: "Director, Field Systems",
      function: "Commercial Technology",
      buyingRole: BuyingRole.CHAMPION,
      relevanceScore: 74,
      suggestedMessageAngle: "Improving CRM adoption, content access, and manager visibility.",
    },
  ];
}

function fingerprintForSignal(accountId: string, providerKey: string, title: string, publishedAt?: string | Date | null) {
  const dayPart = maybeDate(publishedAt)?.toISOString().slice(0, 10) ?? "undated";
  return `${accountId}:${providerKey}:${slugify(title)}:${dayPart}`;
}

async function getScoringWeights() {
  const weights = await prisma.scoringWeight.findMany({
    orderBy: [{ label: "asc" }],
  });
  return weights;
}

function signalSortValue(signal: Signal) {
  return maybeDate(signal.publishedAt ?? signal.detectedAt)?.getTime() ?? 0;
}

function hydrateAccountIntelligence(record: AccountRecord, weights: ScoringWeight[]): AccountIntelligence {
  const signals = [...record.signals].sort((left, right) => signalSortValue(right) - signalSortValue(left));
  const explanation = buildAccountScore({
    industry: record.industry,
    signals,
    weights,
  });
  const stakeholders = recommendStakeholders(signals, record.stakeholders);
  const categories = topCategories(signals);
  return {
    account: record,
    signals,
    stakeholders,
    explanation,
    outreach: buildOutreachRecommendation({
      account: record,
      stage: explanation.stage,
      categories,
      stakeholders,
      signals,
    }),
    missingInformation: deriveMissingInformation(signals, stakeholders),
    lastDetectedAt: latestSignalDate(signals),
    topCategories: categories,
  };
}

function matchesAccountFilters(account: AccountIntelligence, filters: AccountFilters) {
  if (filters.search) {
    const haystack = normalizeText(
      `${account.account.name} ${account.account.country} ${account.account.owner ?? ""} ${account.signals.map((signal) => signal.title).join(" ")}`,
    );
    if (!haystack.includes(normalizeText(filters.search))) {
      return false;
    }
  }

  if (filters.industry && filters.industry !== "ALL" && account.account.industry !== filters.industry) {
    return false;
  }
  if (filters.country && filters.country !== "ALL" && account.account.country !== filters.country) {
    return false;
  }
  if (filters.stage && filters.stage !== "ALL" && account.explanation.stage !== filters.stage) {
    return false;
  }
  if (typeof filters.minScore === "number" && account.explanation.score < filters.minScore) {
    return false;
  }
  if (typeof filters.lastDetectedDays === "number" && account.lastDetectedAt) {
    const threshold = Date.now() - filters.lastDetectedDays * 24 * 60 * 60 * 1000;
    if (account.lastDetectedAt.getTime() < threshold) {
      return false;
    }
  }
  return true;
}

function matchesSignalFilters(signal: SignalWithAccount, filters: SignalFilters) {
  if (filters.signalType && filters.signalType !== "ALL" && signal.signalType !== filters.signalType) {
    return false;
  }
  if (filters.category && filters.category !== "ALL" && signal.category !== filters.category) {
    return false;
  }
  if (typeof filters.confidence === "number" && Math.round(signal.confidence * 100) < filters.confidence) {
    return false;
  }
  if (filters.search) {
    const haystack = normalizeText(`${signal.account.name} ${signal.title} ${signal.description}`);
    if (!haystack.includes(normalizeText(filters.search))) {
      return false;
    }
  }
  return true;
}

export async function getAccountIntelligenceList(filters: AccountFilters = {}) {
  const [records, weights] = await Promise.all([
    prisma.account.findMany({
      include: accountInclude,
      orderBy: [{ name: "asc" }],
    }),
    getScoringWeights(),
  ]);

  return records
    .map((record) => hydrateAccountIntelligence(record, weights))
    .filter((record) => matchesAccountFilters(record, filters))
    .sort((left, right) => {
      if (right.explanation.score !== left.explanation.score) {
        return right.explanation.score - left.explanation.score;
      }
      return (right.lastDetectedAt?.getTime() ?? 0) - (left.lastDetectedAt?.getTime() ?? 0);
    });
}

export async function getAccountIntelligenceById(id: string) {
  const [record, weights] = await Promise.all([
    prisma.account.findUnique({
      where: { id },
      include: accountInclude,
    }),
    getScoringWeights(),
  ]);

  if (!record) {
    return null;
  }

  return hydrateAccountIntelligence(record, weights);
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const [accounts, feed, providerRuns] = await Promise.all([
    getAccountIntelligenceList(),
    prisma.signal.findMany({
      include: { account: true },
      orderBy: [{ detectedAt: "desc" }, { publishedAt: "desc" }],
      take: 30,
    }),
    prisma.providerRun.findMany({
      orderBy: [{ startedAt: "desc" }],
      take: 8,
    }),
  ]);

  const recentSignals = feed.filter((signal) => {
    const value = maybeDate(signal.publishedAt ?? signal.detectedAt);
    return value ? value.getTime() >= Date.now() - 30 * 24 * 60 * 60 * 1000 : false;
  }).length;

  return {
    monitoredAccounts: accounts.length,
    activeRfpSignals: accounts.filter((account) => account.explanation.stage === RfpStage.ACTIVE_RFP).length,
    preRfpSignals: accounts.filter((account) => account.explanation.stage === RfpStage.PRE_RFP).length,
    highPriorityAccounts: accounts.filter((account) => account.explanation.score >= 60).length,
    recentSignals,
    accounts,
    feed,
    providerRuns,
  };
}

export async function getSignalFeed(filters: SignalFilters = {}) {
  const signals = await prisma.signal.findMany({
    include: { account: true },
    orderBy: [{ detectedAt: "desc" }, { publishedAt: "desc" }],
  });

  return signals.filter((signal) => matchesSignalFilters(signal, filters));
}

export async function getAccountFilterOptions() {
  const [countries, owners] = await Promise.all([
    prisma.account.findMany({ select: { country: true }, distinct: ["country"], orderBy: { country: "asc" } }),
    prisma.account.findMany({ select: { owner: true }, distinct: ["owner"], where: { owner: { not: null } }, orderBy: { owner: "asc" } }),
  ]);

  return {
    countries: countries.map((item) => item.country),
    owners: owners.map((item) => item.owner).filter((item): item is string => Boolean(item)),
  };
}

async function createSignalsForAccount(account: Account, weights: ScoringWeight[]) {
  const signalSeeds = generateMockSignalsForAccount(account);
  if (!signalSeeds.length) {
    return 0;
  }

  let created = 0;
  for (const seed of signalSeeds) {
    const classification = classifySignalText(seed.title, seed.description);
    const signalType = seed.signalType ?? classification.signalType;
    const category = seed.category ?? classification.category;
    const fingerprint = fingerprintForSignal(account.id, seed.providerKey, seed.title, seed.publishedAt);

    const result = await prisma.signal.upsert({
      where: { fingerprint },
      update: {
        title: seed.title,
        description: seed.description,
        sourceType: seed.sourceType,
        sourceName: seed.sourceName,
        sourceUrl: seed.sourceUrl,
        detectedAt: maybeDate(seed.detectedAt ?? seed.publishedAt) ?? new Date(),
        publishedAt: maybeDate(seed.publishedAt),
        confidence: seed.confidence ?? classification.confidence,
        confidenceReason: classification.confidenceReason,
        scoreImpact: scoreImpactForSignal(signalType, Object.fromEntries(weights.map((weight) => [weight.key, weight.value]))),
        evidenceSnippet: seed.evidenceSnippet,
        category,
        recommendedAction: seed.recommendedAction,
        signalType,
        isInferred: seed.isInferred ?? classification.isInferred,
        stageHint: seed.stageHint,
      },
      create: {
        fingerprint,
        accountId: account.id,
        providerKey: seed.providerKey,
        title: seed.title,
        description: seed.description,
        sourceType: seed.sourceType,
        sourceName: seed.sourceName,
        sourceUrl: seed.sourceUrl,
        detectedAt: maybeDate(seed.detectedAt ?? seed.publishedAt) ?? new Date(),
        publishedAt: maybeDate(seed.publishedAt),
        confidence: seed.confidence ?? classification.confidence,
        confidenceReason: classification.confidenceReason,
        scoreImpact: scoreImpactForSignal(signalType, Object.fromEntries(weights.map((weight) => [weight.key, weight.value]))),
        evidenceSnippet: seed.evidenceSnippet,
        category,
        recommendedAction: seed.recommendedAction,
        signalType,
        isInferred: seed.isInferred ?? classification.isInferred,
        stageHint: seed.stageHint,
      },
    });
    if (result) {
      created += 1;
    }
  }

  await prisma.providerRun.create({
    data: {
      providerKey: "mock-on-demand-scan",
      providerName: "Mock On-Demand Account Scan",
      status: ProviderRunStatus.SUCCESS,
      summary: `Generated ${created} mock signals for ${account.name}.`,
      accountsScanned: 1,
      signalsCreated: created,
      startedAt: new Date(),
      finishedAt: new Date(),
    },
  });

  return created;
}

async function createStakeholdersForAccount(account: Account) {
  const existing = await prisma.stakeholder.count({ where: { accountId: account.id } });
  if (existing > 0) {
    return 0;
  }
  const seeds = buildDefaultStakeholders(account);
  await prisma.stakeholder.createMany({
    data: seeds.map((seed) => ({
      accountId: account.id,
      ...seed,
    })),
  });
  return seeds.length;
}

export async function createAccount(input: ParsedAccountRow) {
  const dedupeKey = buildAccountDedupeKey(input.name, input.website);
  const existing = await prisma.account.findUnique({ where: { dedupeKey } });
  if (existing) {
    return { created: false, accountId: existing.id };
  }

  const account = await prisma.account.create({
    data: {
      name: input.name,
      dedupeKey,
      website: input.website,
      industry: input.industry ?? Industry.OTHER,
      country: input.country ?? "Unknown",
      employeeCount: input.employeeCount,
      revenue: input.revenue,
      owner: input.owner ?? "Unassigned",
      notes: input.notes,
    },
  });

  const weights = await getScoringWeights();
  await createStakeholdersForAccount(account);
  await createSignalsForAccount(account, weights);

  return { created: true, accountId: account.id };
}

export async function importAccountsFromCsv(csvText: string): Promise<ImportAccountsResult> {
  const parsed = parseAccountCsv(csvText);
  const existing = await prisma.account.findMany({
    select: { dedupeKey: true },
  });
  const deduped = dedupeParsedAccounts(
    new Set(existing.map((account) => account.dedupeKey)),
    parsed.rows,
  );

  const createdIds: string[] = [];
  let duplicateCount = deduped.duplicateCount;

  for (const row of deduped.rows) {
    const result = await createAccount(row);
    if (result.created) {
      createdIds.push(result.accountId);
    } else {
      duplicateCount += 1;
    }
  }

  return {
    createdIds,
    createdCount: createdIds.length,
    duplicateCount,
    invalidRows: parsed.invalidRows,
  };
}

export async function seedAccountDefaultsIfNeeded() {
  const count = await prisma.account.count();
  if (count > 0) {
    return;
  }

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
}

export async function getTargetProfileCountries() {
  const rows = await prisma.targetProfileSetting.findMany({
    where: { type: SettingType.TARGET_COUNTRY },
    orderBy: { label: "asc" },
  });
  return rows.map((row) => row.label);
}
