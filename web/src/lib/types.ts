import type {
  Account,
  BuyingRole,
  Competitor,
  Industry,
  Prisma,
  ProviderConfig,
  ProviderRun,
  RfpStage,
  ScoringWeight,
  SearchKeyword,
  Signal,
  SignalType,
  SourceType,
  TargetCategory,
  TargetProfileSetting,
} from "@prisma/client";

export type AccountWithRelations = Prisma.AccountGetPayload<{
  include: { signals: true; stakeholders: true };
}>;

export type SignalWithAccount = Prisma.SignalGetPayload<{
  include: { account: true };
}>;

export interface SignalClassificationResult {
  signalType: SignalType;
  category: TargetCategory;
  confidence: number;
  confidenceReason: string;
  isInferred: boolean;
}

export interface ScoreLineItem {
  key: string;
  label: string;
  value: number;
  reason: string;
}

export interface ScoringExplanation {
  score: number;
  confidence: number;
  stage: RfpStage;
  lines: ScoreLineItem[];
}

export interface RecommendedStakeholder {
  name: string;
  title: string;
  function: string;
  buyingRole: BuyingRole;
  relevanceScore: number;
  suggestedMessageAngle: string;
}

export interface OutreachRecommendation {
  angle: string;
  email: string;
  linkedin: string;
  nextBestAction: string;
}

export interface AccountIntelligence {
  account: Account;
  signals: Signal[];
  stakeholders: RecommendedStakeholder[];
  explanation: ScoringExplanation;
  outreach: OutreachRecommendation;
  missingInformation: string[];
  lastDetectedAt: Date | null;
  topCategories: TargetCategory[];
}

export interface DashboardSnapshot {
  monitoredAccounts: number;
  activeRfpSignals: number;
  preRfpSignals: number;
  highPriorityAccounts: number;
  recentSignals: number;
  accounts: AccountIntelligence[];
  feed: SignalWithAccount[];
  providerRuns: ProviderRun[];
}

export interface ParsedAccountRow {
  name: string;
  website?: string;
  industry?: Industry;
  country?: string;
  employeeCount?: number;
  revenue?: number;
  owner?: string;
  notes?: string;
}

export interface ImportAccountsResult {
  createdIds: string[];
  createdCount: number;
  duplicateCount: number;
  invalidRows: Array<{ row: number; reason: string }>;
}

export interface SettingsSnapshot {
  keywords: SearchKeyword[];
  competitors: Competitor[];
  scoringWeights: ScoringWeight[];
  targetSettings: TargetProfileSetting[];
  providerConfigs: ProviderConfig[];
}

export interface MockSignalSeed {
  providerKey: string;
  providerName: string;
  accountName: string;
  title: string;
  description: string;
  sourceType: SourceType;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  detectedAt?: string;
  evidenceSnippet: string;
  recommendedAction: string;
  confidence?: number;
  category?: TargetCategory;
  signalType?: SignalType;
  stageHint?: RfpStage;
  isInferred?: boolean;
}
