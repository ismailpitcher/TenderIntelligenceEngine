import {
  Industry,
  SourceType,
  TargetCategory,
  type Account,
} from "@prisma/client";

import type { MockSignalSeed } from "@/lib/types";
import { slugify } from "@/lib/utils";

export interface ProviderSignalCandidate {
  title: string;
  description: string;
  sourceType: SourceType;
  sourceUrlSuffix: string;
  evidenceSnippet: string;
  recommendedAction: string;
  category?: TargetCategory;
}

export interface MockSignalProvider {
  key: string;
  name: string;
  description: string;
  collect(account: Pick<Account, "name" | "industry" | "website" | "country">): ProviderSignalCandidate[];
}

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function mockUrl(accountName: string, suffix: string) {
  return `https://example.com/mock/${slugify(accountName)}/${suffix}`;
}

const hiringProvider: MockSignalProvider = {
  key: "mock-hiring-feed",
  name: "Mock Hiring Feed",
  description: "Simulates approved ATS or uploaded-job-export signals without scraping restricted platforms.",
  collect(account) {
    if (account.industry === Industry.PHARMA || account.industry === Industry.MEDTECH) {
      return [
        {
          title: `Hiring: ${account.name} seeks commercial excellence and CRM capability owner`,
          description: `Mock hiring export suggests ${account.name} is hiring around commercial excellence, field effectiveness, and CRM-adoption workflows.`,
          sourceType: SourceType.JOB_POSTING,
          sourceUrlSuffix: "commercial-excellence-hiring",
          evidenceSnippet: "Role language covers field execution, enablement, and change management responsibilities.",
          recommendedAction: "Use a benchmark-led message to learn whether a wider platform review sits behind the hiring signal.",
          category: TargetCategory.COMMERCIAL_EXCELLENCE,
        },
      ];
    }

    if (account.industry === Industry.FINANCIAL_SERVICES) {
      return [
        {
          title: `Hiring: ${account.name} opens revenue enablement and CRM workflow role`,
          description: `Mock hiring feed indicates ${account.name} may be strengthening advisor enablement and CRM workflow ownership.`,
          sourceType: SourceType.JOB_POSTING,
          sourceUrlSuffix: "revenue-enablement-hiring",
          evidenceSnippet: "Responsibilities span relationship-manager productivity, coaching, and compliant content usage.",
          recommendedAction: "Offer a benchmark conversation on field enablement and CRM-adoption workflows.",
          category: TargetCategory.REVENUE_ENABLEMENT,
        },
      ];
    }

    return [
      {
        title: `Hiring: ${account.name} expands field enablement leadership`,
        description: `Mock hiring export indicates a field-enablement role tied to mobile workflows, content access, and manager visibility.`,
        sourceType: SourceType.JOB_POSTING,
        sourceUrlSuffix: "field-enablement-hiring",
        evidenceSnippet: "The scope connects field productivity to content and coaching workflows.",
        recommendedAction: "Start with an exploratory benchmark message before assuming a formal buying process.",
        category: TargetCategory.FIELD_ENABLEMENT,
      },
    ];
  },
};

const techProvider: MockSignalProvider = {
  key: "mock-tech-watch",
  name: "Mock Technology Change Watch",
  description: "Simulates search, company-site, and exported-brief signals for platform-change programs.",
  collect(account) {
    if (account.industry === Industry.PHARMA || account.industry === Industry.MEDTECH) {
      return [
        {
          title: `${account.name} linked to CRM and content workflow redesign`,
          description: `Mock technology monitoring suggests ${account.name} is assessing CRM, content governance, and field-workflow changes across commercial teams.`,
          sourceType: SourceType.SEARCH_RESULT,
          sourceUrlSuffix: "crm-content-redesign",
          evidenceSnippet: "Program language references CRM adoption, mobile field workflows, and analytics.",
          recommendedAction: "Lead with workflow consolidation and adoption support rather than a generic platform pitch.",
          category: TargetCategory.CRM_ADOPTION,
        },
        {
          title: `${account.name} may be evaluating Salesforce, Veeva, or IQVIA workflow changes`,
          description: `Mock signal points to platform-change planning that could affect Veeva, IQVIA, or Salesforce-centric field workflows.`,
          sourceType: SourceType.COMPANY_SITE,
          sourceUrlSuffix: "crm-platform-change",
          evidenceSnippet: "Notes mention phased CRM change and field-user impact.",
          recommendedAction: "Position Pitcher as a benchmark layer for adoption, content, and HCP engagement continuity.",
          category: TargetCategory.VEEVA_IQVIA_TRANSITION,
        },
      ];
    }

    return [
      {
        title: `${account.name} reviews mobile field workflow and content access stack`,
        description: `Mock monitoring suggests ${account.name} is reviewing mobile workflow, content access, and manager analytics.`,
        sourceType: SourceType.SEARCH_RESULT,
        sourceUrlSuffix: "mobile-workflow-review",
        evidenceSnippet: "The review references content access, rep execution, and CRM adjacency.",
        recommendedAction: "Lead with field productivity and manager visibility outcomes.",
        category: TargetCategory.MOBILE_FIELD_APP,
      },
    ];
  },
};

const strategyProvider: MockSignalProvider = {
  key: "mock-strategy-watch",
  name: "Mock Strategic Initiative Watch",
  description: "Simulates PR, uploaded exports, and strategy notes around transformation programs.",
  collect(account) {
    if (account.industry === Industry.PHARMA || account.industry === Industry.MEDTECH) {
      return [
        {
          title: `${account.name} highlights omnichannel and field effectiveness initiative`,
          description: `Mock strategy feed suggests ${account.name} is advancing an omnichannel and field-effectiveness initiative tied to commercial transformation.`,
          sourceType: SourceType.PRESS_RELEASE,
          sourceUrlSuffix: "omnichannel-field-effectiveness",
          evidenceSnippet: "Language connects commercial transformation to execution quality and analytics.",
          recommendedAction: "Reach out to shape criteria before supplier discussions become formal.",
          category: TargetCategory.OMNICHANNEL,
        },
      ];
    }

    return [
      {
        title: `${account.name} expands digital commercial transformation scope`,
        description: `Mock strategy signal suggests ${account.name} is widening a commercial-transformation program across field teams.`,
        sourceType: SourceType.UPLOADED_EXPORT,
        sourceUrlSuffix: "digital-transformation-scope",
        evidenceSnippet: "Themes include enablement, customer engagement, and manager coaching.",
        recommendedAction: "Offer a light benchmark conversation on sequencing and evaluation criteria.",
        category: TargetCategory.SALES_ENABLEMENT,
      },
    ];
  },
};

const vendorProvider: MockSignalProvider = {
  key: "mock-vendor-intel",
  name: "Mock Vendor / Competitor Intel",
  description: "Simulates approved competitor, partner, and case-study monitoring.",
  collect(account) {
    return [
      {
        title: `${account.name} benchmark may include a known enablement or coaching vendor`,
        description: `Mock competitor-intel feed suggests ${account.name} is at least aware of adjacent enablement vendors during research.`,
        sourceType: SourceType.VENDOR_CASE_STUDY,
        sourceUrlSuffix: "vendor-benchmark-signal",
        evidenceSnippet: "The signal points to vendor comparison behavior rather than a confirmed procurement.",
        recommendedAction: "Use a compare-and-contrast angle focused on field execution depth and industry fit.",
        category: TargetCategory.SALES_ENABLEMENT,
      },
    ];
  },
};

export const MOCK_PROVIDERS: MockSignalProvider[] = [
  hiringProvider,
  techProvider,
  strategyProvider,
  vendorProvider,
];

export function generateMockSignalsForAccount(account: Pick<Account, "name" | "industry" | "website" | "country">): MockSignalSeed[] {
  return MOCK_PROVIDERS.flatMap((provider, index) =>
    provider.collect(account).map((candidate) => ({
      providerKey: provider.key,
      providerName: provider.name,
      accountName: account.name,
      title: candidate.title,
      description: candidate.description,
      sourceType: candidate.sourceType,
      sourceName: provider.name,
      sourceUrl: mockUrl(account.name, candidate.sourceUrlSuffix),
      publishedAt: isoDaysAgo(9 + index * 7),
      evidenceSnippet: candidate.evidenceSnippet,
      recommendedAction: candidate.recommendedAction,
      category: candidate.category,
    })),
  );
}
