import {
  BuyingRole,
  Industry,
  ProviderRunStatus,
  ProviderStatus,
  RfpStage,
  SettingType,
  SignalType,
  SourceType,
  TargetCategory,
} from "@prisma/client";

export const APP_NAME = "Pitcher Signal Radar";

export const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/accounts", label: "Accounts" },
  { href: "/signals", label: "Signal Feed" },
  { href: "/settings", label: "Settings" },
];

export const INDUSTRY_LABELS: Record<Industry, string> = {
  PHARMA: "Pharma",
  MEDTECH: "Medtech",
  FINANCIAL_SERVICES: "Financial Services",
  ENTERPRISE_FIELD_SALES: "Enterprise Field Sales",
  OTHER: "Other",
};

export const TARGET_CATEGORY_LABELS: Record<TargetCategory, string> = {
  SALES_ENABLEMENT: "Sales Enablement",
  REVENUE_ENABLEMENT: "Revenue Enablement",
  FIELD_ENABLEMENT: "Field Enablement",
  COMMERCIAL_EXCELLENCE: "Commercial Excellence",
  HCP_ENGAGEMENT: "HCP Engagement",
  CLM_EDETAILING: "CLM / eDetailing",
  CRM_ADOPTION: "CRM Adoption",
  SALESFORCE_LIFE_SCIENCES: "Salesforce Life Sciences Cloud",
  VEEVA_IQVIA_TRANSITION: "Veeva / IQVIA Transition",
  OMNICHANNEL: "Omnichannel Engagement",
  DIGITAL_SALES_ROOM: "Digital Sales Room / HCP Portal",
  AI_COACHING: "AI Coaching / Roleplay",
  SALES_READINESS: "Sales Readiness",
  CONTENT_GOVERNANCE: "Content Governance / DAM",
  MOBILE_FIELD_APP: "Mobile Field Sales App",
  OFFLINE_CONTENT: "Offline Content Delivery",
  SAMPLE_CONSENT: "Sample / Consent Workflows",
  SALES_ANALYTICS: "Sales Analytics",
};

export const STAGE_LABELS: Record<RfpStage, string> = {
  NO_SIGNAL: "No signal",
  EARLY_SIGNAL: "Early signal",
  PRE_RFP: "Pre-RFP",
  ACTIVE_EVALUATION: "Active evaluation",
  ACTIVE_RFP: "Active RFP / Tender",
  POST_DECISION: "Post-decision / Too late",
};

export const SIGNAL_TYPE_LABELS: Record<SignalType, string> = {
  DIRECT_PROCUREMENT: "Direct procurement",
  HIRING: "Hiring",
  TECHNOLOGY_CHANGE: "Technology change",
  ORGANIZATIONAL_CHANGE: "Organizational change",
  STRATEGIC_INITIATIVE: "Strategic initiative",
  VENDOR_SIGNAL: "Vendor / competitor",
  PUBLIC_TENDER: "Public tender",
};

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  JOB_POSTING: "Job posting",
  PRESS_RELEASE: "Press release",
  SOCIAL_POST: "Social post",
  TENDER_PORTAL: "Tender portal",
  COMPANY_SITE: "Company site",
  PARTNER_NEWS: "Partner news",
  VENDOR_CASE_STUDY: "Vendor case study",
  UPLOADED_EXPORT: "Uploaded export",
  SEARCH_RESULT: "Search result",
};

export const PROVIDER_STATUS_LABELS: Record<ProviderStatus, string> = {
  MOCK: "Mock",
  ACTIVE: "Active",
  PLANNED: "Planned",
  DISABLED: "Disabled",
};

export const PROVIDER_RUN_STATUS_LABELS: Record<ProviderRunStatus, string> = {
  SUCCESS: "Success",
  PARTIAL: "Partial",
  FAILED: "Failed",
};

export const SCORE_WEIGHT_SEED = [
  { key: "direct_procurement", label: "Direct RFP / Tender Mention", value: 40, description: "Confirmed procurement, sourcing, or tender language." },
  { key: "hiring_signal", label: "Hiring Signal", value: 15, description: "Hiring tied to CRM, enablement, or commercial transformation." },
  { key: "organizational_change", label: "New Commercial / Digital Leader", value: 10, description: "A new leader often indicates a review window." },
  { key: "vendor_signal", label: "Competitor / Vendor Mention", value: 15, description: "Competitor, partner, or rollout evidence." },
  { key: "technology_change", label: "CRM / Veeva / Salesforce / IQVIA Change", value: 20, description: "Migration, replacement, or major platform shift." },
  { key: "strategic_initiative", label: "Strategic Initiative Mention", value: 10, description: "Transformation language without direct procurement." },
  { key: "signal_cluster_bonus", label: "Multiple Signals in 90 Days", value: 10, description: "Several signals in a short period increase urgency." },
  { key: "recency_bonus", label: "Signal Freshness Within 30 Days", value: 10, description: "Fresh signals are more actionable." },
  { key: "industry_fit_bonus", label: "Target Industry Fit", value: 10, description: "Pitcher-fit industry bonus." },
  { key: "ambiguity_penalty", label: "Weak / Ambiguous Signal Penalty", value: -10, description: "Penalty for inferred-only, noisy evidence." },
];

export const KEYWORD_SEED = [
  { groupName: "Direct Procurement", term: "rfp", signalType: SignalType.DIRECT_PROCUREMENT, category: TargetCategory.SALES_ENABLEMENT, weight: 4 },
  { groupName: "Direct Procurement", term: "rfq", signalType: SignalType.DIRECT_PROCUREMENT, category: TargetCategory.SALES_ENABLEMENT, weight: 4 },
  { groupName: "Direct Procurement", term: "rfi", signalType: SignalType.DIRECT_PROCUREMENT, category: TargetCategory.SALES_ENABLEMENT, weight: 4 },
  { groupName: "Direct Procurement", term: "tender", signalType: SignalType.DIRECT_PROCUREMENT, category: TargetCategory.SALES_ENABLEMENT, weight: 4 },
  { groupName: "Direct Procurement", term: "vendor selection", signalType: SignalType.DIRECT_PROCUREMENT, category: TargetCategory.SALES_ENABLEMENT, weight: 4 },
  { groupName: "Sales Enablement", term: "sales enablement", signalType: SignalType.STRATEGIC_INITIATIVE, category: TargetCategory.SALES_ENABLEMENT, weight: 4 },
  { groupName: "Sales Enablement", term: "revenue enablement", signalType: SignalType.STRATEGIC_INITIATIVE, category: TargetCategory.REVENUE_ENABLEMENT, weight: 4 },
  { groupName: "Sales Enablement", term: "commercial excellence", signalType: SignalType.STRATEGIC_INITIATIVE, category: TargetCategory.COMMERCIAL_EXCELLENCE, weight: 4 },
  { groupName: "Sales Enablement", term: "field enablement", signalType: SignalType.STRATEGIC_INITIATIVE, category: TargetCategory.FIELD_ENABLEMENT, weight: 4 },
  { groupName: "Sales Enablement", term: "digital sales room", signalType: SignalType.TECHNOLOGY_CHANGE, category: TargetCategory.DIGITAL_SALES_ROOM, weight: 4 },
  { groupName: "Pharma", term: "hcp engagement", signalType: SignalType.STRATEGIC_INITIATIVE, category: TargetCategory.HCP_ENGAGEMENT, weight: 4 },
  { groupName: "Pharma", term: "clm", signalType: SignalType.TECHNOLOGY_CHANGE, category: TargetCategory.CLM_EDETAILING, weight: 4 },
  { groupName: "Pharma", term: "edetailing", signalType: SignalType.TECHNOLOGY_CHANGE, category: TargetCategory.CLM_EDETAILING, weight: 4 },
  { groupName: "Pharma", term: "veeva", signalType: SignalType.TECHNOLOGY_CHANGE, category: TargetCategory.VEEVA_IQVIA_TRANSITION, weight: 4 },
  { groupName: "Pharma", term: "iqvia", signalType: SignalType.TECHNOLOGY_CHANGE, category: TargetCategory.VEEVA_IQVIA_TRANSITION, weight: 4 },
  { groupName: "Pharma", term: "salesforce life sciences cloud", signalType: SignalType.TECHNOLOGY_CHANGE, category: TargetCategory.SALESFORCE_LIFE_SCIENCES, weight: 4 },
  { groupName: "Pharma", term: "field force effectiveness", signalType: SignalType.STRATEGIC_INITIATIVE, category: TargetCategory.COMMERCIAL_EXCELLENCE, weight: 4 },
  { groupName: "Pharma", term: "sales force effectiveness", signalType: SignalType.STRATEGIC_INITIATIVE, category: TargetCategory.COMMERCIAL_EXCELLENCE, weight: 4 },
  { groupName: "AI", term: "ai roleplay", signalType: SignalType.STRATEGIC_INITIATIVE, category: TargetCategory.AI_COACHING, weight: 4 },
  { groupName: "AI", term: "ai coaching", signalType: SignalType.STRATEGIC_INITIATIVE, category: TargetCategory.AI_COACHING, weight: 4 },
  { groupName: "AI", term: "sales readiness", signalType: SignalType.STRATEGIC_INITIATIVE, category: TargetCategory.SALES_READINESS, weight: 4 },
  { groupName: "Competitors", term: "seismic", signalType: SignalType.VENDOR_SIGNAL, category: TargetCategory.SALES_ENABLEMENT, weight: 4 },
  { groupName: "Competitors", term: "highspot", signalType: SignalType.VENDOR_SIGNAL, category: TargetCategory.SALES_ENABLEMENT, weight: 4 },
  { groupName: "Competitors", term: "showpad", signalType: SignalType.VENDOR_SIGNAL, category: TargetCategory.SALES_ENABLEMENT, weight: 4 },
  { groupName: "Competitors", term: "mindtickle", signalType: SignalType.VENDOR_SIGNAL, category: TargetCategory.AI_COACHING, weight: 4 },
  { groupName: "Competitors", term: "allego", signalType: SignalType.VENDOR_SIGNAL, category: TargetCategory.SALES_ENABLEMENT, weight: 4 },
  { groupName: "Competitors", term: "mediafly", signalType: SignalType.VENDOR_SIGNAL, category: TargetCategory.DIGITAL_SALES_ROOM, weight: 4 },
];

export const COMPETITOR_SEED = [
  "Seismic",
  "Highspot",
  "Showpad",
  "Bigtincan",
  "Mindtickle",
  "Allego",
  "Veeva Vault",
  "Saleshood",
  "Spekit",
  "Mediafly",
  "IQVIA OCE",
  "Salesforce Life Sciences Cloud",
];

export const TARGET_PROFILE_SEED = [
  { type: SettingType.TARGET_INDUSTRY, value: Industry.PHARMA, label: "Pharma" },
  { type: SettingType.TARGET_INDUSTRY, value: Industry.MEDTECH, label: "Medtech" },
  { type: SettingType.TARGET_INDUSTRY, value: Industry.FINANCIAL_SERVICES, label: "Financial Services" },
  { type: SettingType.TARGET_INDUSTRY, value: Industry.ENTERPRISE_FIELD_SALES, label: "Enterprise Field Sales" },
  { type: SettingType.TARGET_COUNTRY, value: "United Kingdom", label: "United Kingdom" },
  { type: SettingType.TARGET_COUNTRY, value: "Germany", label: "Germany" },
  { type: SettingType.TARGET_COUNTRY, value: "Switzerland", label: "Switzerland" },
  { type: SettingType.TARGET_COUNTRY, value: "Netherlands", label: "Netherlands" },
  { type: SettingType.TARGET_COUNTRY, value: "Denmark", label: "Denmark" },
];

export const PROVIDER_CONFIG_SEED = [
  { key: "mock-hiring-feed", name: "Mock Hiring Feed", status: ProviderStatus.MOCK, description: "Simulated job-posting signals for the MVP.", notes: "Replace with approved LinkedIn or ATS exports later." },
  { key: "mock-tech-watch", name: "Mock Technology Change Watch", status: ProviderStatus.MOCK, description: "Simulated CRM, Veeva, Salesforce, and platform-shift signals.", notes: "Future source: search, RSS, and partner APIs." },
  { key: "mock-strategy-watch", name: "Mock Strategic Initiative Watch", status: ProviderStatus.MOCK, description: "Transformation and launch-excellence signals from public narratives.", notes: "Future source: company sites, PR, and Google Alerts exports." },
  { key: "mock-organizational-watch", name: "Mock Organizational Watch", status: ProviderStatus.MOCK, description: "Simulated leadership-change and org-design signals.", notes: "Future source: approved people-data providers and company news." },
  { key: "mock-vendor-intel", name: "Mock Vendor / Competitor Intel", status: ProviderStatus.MOCK, description: "Simulated competitor case-study and partner references.", notes: "Future source: competitor sites and partner PR." },
  { key: "mock-public-tender", name: "Mock Public Tender Monitor", status: ProviderStatus.MOCK, description: "Simulated procurement notices and public tender signals.", notes: "Future source: TED, Find a Tender, NHS, UNGM, SAM.gov." },
  { key: "hubspot-target-list", name: "HubSpot Target List", status: ProviderStatus.PLANNED, description: "Planned CRM sync for account ownership and target lists.", notes: "Local-first MVP keeps this as a placeholder." },
];

export const DEFAULT_STAKEHOLDER_FALLBACKS = [
  {
    name: "Open commercial owner",
    title: "VP Commercial Excellence / Sales Operations",
    function: "Commercial Operations",
    buyingRole: BuyingRole.PROGRAM_OWNER,
    relevanceScore: 82,
    suggestedMessageAngle: "Benchmarking commercial workflow and field execution gaps before procurement hardens.",
  },
  {
    name: "Open platform owner",
    title: "CRM / Digital Engagement Program Lead",
    function: "Commercial Technology",
    buyingRole: BuyingRole.CHAMPION,
    relevanceScore: 78,
    suggestedMessageAngle: "Reducing adoption friction across CRM, content, and field engagement workflows.",
  },
  {
    name: "Open procurement contact",
    title: "Category Manager, Commercial Technology",
    function: "Procurement",
    buyingRole: BuyingRole.PROCUREMENT,
    relevanceScore: 65,
    suggestedMessageAngle: "Confirming whether a benchmark or supplier-shortlist conversation has started.",
  },
];
