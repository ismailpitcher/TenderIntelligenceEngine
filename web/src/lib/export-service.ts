import { APP_NAME, INDUSTRY_LABELS, SIGNAL_TYPE_LABELS, STAGE_LABELS, TARGET_CATEGORY_LABELS } from "@/lib/constants";
import type { AccountIntelligence, DashboardSnapshot } from "@/lib/types";
import { formatConfidence, formatCurrencyBillions, freshnessLabel } from "@/lib/utils";

function csvEscape(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}

export function renderAccountsCsv(accounts: AccountIntelligence[]) {
  const header = [
    "Account Name",
    "Industry",
    "Country",
    "Owner",
    "Employees",
    "Revenue ($B)",
    "Stage",
    "Signal Score",
    "Confidence",
    "Top Categories",
    "Last Signal",
  ];

  const rows = accounts.map((item) => [
    item.account.name,
    INDUSTRY_LABELS[item.account.industry],
    item.account.country,
    item.account.owner ?? "",
    item.account.employeeCount ?? "",
    item.account.revenue ?? "",
    STAGE_LABELS[item.explanation.stage],
    item.explanation.score,
    formatConfidence(item.explanation.confidence),
    item.topCategories.map((category) => TARGET_CATEGORY_LABELS[category]).join("; "),
    item.lastDetectedAt ? item.lastDetectedAt.toISOString() : "",
  ]);

  return [header, ...rows].map((row) => row.map((value) => csvEscape(value)).join(",")).join("\n");
}

export function renderAccountMarkdown(account: AccountIntelligence) {
  const lines = [
    `# ${account.account.name}`,
    "",
    `- Industry: ${INDUSTRY_LABELS[account.account.industry]}`,
    `- Country: ${account.account.country}`,
    `- Employees: ${account.account.employeeCount ?? "Unknown"}`,
    `- Revenue: ${formatCurrencyBillions(account.account.revenue)}`,
    `- Stage: ${STAGE_LABELS[account.explanation.stage]}`,
    `- Signal score: ${account.explanation.score}/100`,
    `- Confidence: ${formatConfidence(account.explanation.confidence)}`,
    "",
    "## Why this account is ranked here",
    "",
    ...account.explanation.lines.map((line) => `- ${line.label}: ${line.value > 0 ? "+" : ""}${line.value} — ${line.reason}`),
    "",
    "## Signals",
    "",
    ...account.signals.flatMap((signal) => [
      `### ${signal.title}`,
      `- Type: ${SIGNAL_TYPE_LABELS[signal.signalType]}`,
      `- Category: ${TARGET_CATEGORY_LABELS[signal.category]}`,
      `- Confidence: ${formatConfidence(signal.confidence * 100)}`,
      `- Source: ${signal.sourceName}`,
      `- Published: ${signal.publishedAt ? signal.publishedAt.toISOString() : "Unknown"}`,
      `- Evidence: ${signal.evidenceSnippet}`,
      `- Action: ${signal.recommendedAction}`,
      `- URL: ${signal.sourceUrl}`,
      "",
    ]),
    "## Stakeholders",
    "",
    ...account.stakeholders.map((stakeholder) => `- ${stakeholder.name}, ${stakeholder.title} (${stakeholder.function}) — ${stakeholder.suggestedMessageAngle}`),
    "",
    "## Outreach angle",
    "",
    account.outreach.angle,
    "",
    "## Suggested email",
    "",
    "```text",
    account.outreach.email,
    "```",
    "",
    "## Suggested LinkedIn message",
    "",
    "```text",
    account.outreach.linkedin,
    "```",
    "",
    "## Missing information",
    "",
    ...account.missingInformation.map((item) => `- ${item}`),
    "",
  ];

  return lines.join("\n");
}

export function renderMessages(account: AccountIntelligence, format: "txt" | "md" = "md") {
  if (format === "txt") {
    return [
      `${account.account.name} outreach pack`,
      "",
      "Email",
      account.outreach.email,
      "",
      "LinkedIn",
      account.outreach.linkedin,
      "",
      "Next best action",
      account.outreach.nextBestAction,
    ].join("\n");
  }

  return [
    `# ${account.account.name} outreach pack`,
    "",
    "## Email",
    "",
    "```text",
    account.outreach.email,
    "```",
    "",
    "## LinkedIn",
    "",
    "```text",
    account.outreach.linkedin,
    "```",
    "",
    "## Next best action",
    "",
    account.outreach.nextBestAction,
    "",
  ].join("\n");
}

export function renderFullReport(snapshot: DashboardSnapshot) {
  const lines = [
    `# ${APP_NAME} report`,
    "",
    `Generated with ${snapshot.monitoredAccounts} monitored accounts and ${snapshot.feed.length} recent signals.`,
    "",
    "## KPI snapshot",
    "",
    `- Active RFP accounts: ${snapshot.activeRfpSignals}`,
    `- Pre-RFP accounts: ${snapshot.preRfpSignals}`,
    `- High-priority accounts: ${snapshot.highPriorityAccounts}`,
    `- Recent signals: ${snapshot.recentSignals}`,
    "",
    "## Priority accounts",
    "",
    ...snapshot.accounts.slice(0, 10).map((account) => `- ${account.account.name}: ${STAGE_LABELS[account.explanation.stage]} (${account.explanation.score}/100, ${formatConfidence(account.explanation.confidence)})`),
    "",
    "## Recent feed",
    "",
    ...snapshot.feed.slice(0, 15).map((signal) => `- ${signal.account.name}: ${signal.title} [${SIGNAL_TYPE_LABELS[signal.signalType]}] (${freshnessLabel(signal.publishedAt ?? signal.detectedAt)})`),
    "",
  ];
  return lines.join("\n");
}
