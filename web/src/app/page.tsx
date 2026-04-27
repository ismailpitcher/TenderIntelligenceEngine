import { getDashboardSnapshot } from "@/lib/account-service";
import { INDUSTRY_LABELS, TARGET_CATEGORY_LABELS } from "@/lib/constants";
import { freshnessLabel, formatConfidence } from "@/lib/utils";
import { ConfidenceBadge, ProviderRunStatusBadge, SignalTypeBadge, StageBadge } from "@/components/badges";
import { MetricCard, PageHeader, Panel, ScoreMeter, TextLink } from "@/components/ui";

export default async function DashboardPage() {
  const snapshot = await getDashboardSnapshot();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title="Detect pre-RFP motion before the shortlist closes"
        description="Rank target accounts by explainable signal strength, review the latest evidence, and give BDRs a practical angle to get Pitcher into the evaluation earlier."
        actions={
          <>
            <TextLink href="/signals">Open signal feed</TextLink>
            <TextLink href="/api/export/report">Export markdown report</TextLink>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Accounts monitored" value={snapshot.monitoredAccounts} hint="Seeded demo accounts plus anything you upload locally." />
        <MetricCard label="Active RFP accounts" value={snapshot.activeRfpSignals} hint="Accounts with direct procurement or tender-stage evidence." />
        <MetricCard label="Pre-RFP accounts" value={snapshot.preRfpSignals} hint="Accounts showing meaningful pre-procurement motion." />
        <MetricCard label="High-priority accounts" value={snapshot.highPriorityAccounts} hint="Accounts scoring 60+ where outreach should be timely." />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel
          title="Priority account queue"
          description="Use this list to focus outreach where signal strength, timing, and Pitcher fit overlap."
          action={<TextLink href="/accounts">See all accounts</TextLink>}
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="pb-3 font-medium">Account</th>
                  <th className="pb-3 font-medium">Stage</th>
                  <th className="pb-3 font-medium">Score</th>
                  <th className="pb-3 font-medium">Category</th>
                  <th className="pb-3 font-medium">Last signal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {snapshot.accounts.slice(0, 8).map((item) => (
                  <tr key={item.account.id} className="align-top">
                    <td className="py-4 pr-4">
                      <a href={`/accounts/${item.account.id}`} className="block font-semibold text-slate-950 hover:text-emerald-700">
                        {item.account.name}
                      </a>
                      <div className="mt-1 text-xs text-slate-500">
                        {INDUSTRY_LABELS[item.account.industry]} • {item.account.country}
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <StageBadge stage={item.explanation.stage} />
                    </td>
                    <td className="py-4 pr-4">
                      <div className="min-w-[170px]">
                        <ScoreMeter score={item.explanation.score} />
                      </div>
                    </td>
                    <td className="py-4 pr-4 text-slate-600">
                      {item.topCategories[0] ? TARGET_CATEGORY_LABELS[item.topCategories[0]] : "General enablement"}
                    </td>
                    <td className="py-4 text-slate-600">{freshnessLabel(item.lastDetectedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="Recent signal feed"
          description="Latest evidence across all providers, ranked by freshness."
          action={<TextLink href="/signals">Open full feed</TextLink>}
        >
          <div className="space-y-4">
            {snapshot.feed.slice(0, 8).map((signal) => (
              <div key={signal.id} className="rounded-[22px] border border-slate-200/80 bg-slate-50/70 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <SignalTypeBadge signalType={signal.signalType} />
                  <ConfidenceBadge confidence={Math.round(signal.confidence * 100)} />
                  <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{freshnessLabel(signal.publishedAt ?? signal.detectedAt)}</span>
                </div>
                <div className="mt-3 text-base font-semibold text-slate-950">{signal.title}</div>
                <div className="mt-1 text-sm text-slate-600">{signal.account.name}</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{signal.evidenceSnippet}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel
          title="Provider run health"
          description="Mock provider history and system coverage for the local MVP."
        >
          <div className="space-y-3">
            {snapshot.providerRuns.map((run) => (
              <div key={run.id} className="flex flex-col gap-3 rounded-[22px] border border-slate-200/80 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-semibold text-slate-950">{run.providerName}</div>
                  <div className="mt-1 text-sm text-slate-600">{run.summary}</div>
                  <div className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                    {run.accountsScanned} accounts • {run.signalsCreated} signals
                  </div>
                </div>
                <ProviderRunStatusBadge status={run.status} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Recent outreach-ready accounts"
          description="The accounts below already have a plausible message angle and enough context to start a discovery conversation."
        >
          <div className="space-y-4">
            {snapshot.accounts.slice(0, 5).map((item) => (
              <div key={item.account.id} className="rounded-[22px] border border-slate-200/80 bg-slate-50/60 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StageBadge stage={item.explanation.stage} />
                  <ConfidenceBadge confidence={item.explanation.confidence} />
                </div>
                <div className="mt-3 flex items-start justify-between gap-4">
                  <div>
                    <a href={`/accounts/${item.account.id}`} className="text-lg font-semibold text-slate-950 hover:text-emerald-700">
                      {item.account.name}
                    </a>
                    <div className="mt-1 text-sm text-slate-600">{item.outreach.angle}</div>
                  </div>
                  <div className="min-w-[130px] text-right text-sm font-medium text-slate-500">
                    {formatConfidence(item.explanation.confidence)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
