import { getSignalFeed } from "@/lib/account-service";
import { SIGNAL_TYPE_LABELS, TARGET_CATEGORY_LABELS } from "@/lib/constants";
import { firstValue, numberValue, type SearchParamMap } from "@/lib/query";
import { freshnessLabel } from "@/lib/utils";
import { ConfidenceBadge, SignalTypeBadge } from "@/components/badges";
import { EmptyState, PageHeader, Panel, TextLink } from "@/components/ui";

async function parseSearchParams(searchParams?: Promise<SearchParamMap>) {
  const raw = (await searchParams) ?? {};
  return {
    search: firstValue(raw.search) ?? "",
    signalType: firstValue(raw.signalType) ?? "ALL",
    category: firstValue(raw.category) ?? "ALL",
    confidence: numberValue(raw.confidence) ?? 0,
  };
}

export default async function SignalFeedPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParamMap>;
}) {
  const params = await parseSearchParams(searchParams);
  const signals = await getSignalFeed({
    search: params.search || undefined,
    signalType: params.signalType,
    category: params.category,
    confidence: params.confidence,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Signal feed"
        title="Review the latest procurement and transformation evidence"
        description="Scan the chronological feed to spot fresh openings, validate signal quality, and move from weak hints to targeted outreach."
        actions={
          <>
            <TextLink href="/accounts">Open accounts</TextLink>
            <TextLink href="/api/export/report">Export report</TextLink>
          </>
        }
      />

      <Panel title="Feed filters" description="Focus the timeline on the signal types and confidence levels you care about.">
        <form method="GET" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>Search</span>
            <input name="search" defaultValue={params.search} placeholder="RFP, Salesforce, Seismic" className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>Signal type</span>
            <select name="signalType" defaultValue={params.signalType} className="w-full rounded-2xl border border-slate-200 px-4 py-3">
              <option value="ALL">All</option>
              {Object.entries(SIGNAL_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>Target category</span>
            <select name="category" defaultValue={params.category} className="w-full rounded-2xl border border-slate-200 px-4 py-3">
              <option value="ALL">All</option>
              {Object.entries(TARGET_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>Minimum confidence</span>
            <input name="confidence" type="number" min="0" max="100" defaultValue={params.confidence} className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
          </label>
          <div className="md:col-span-2 xl:col-span-4 flex flex-wrap gap-3">
            <button type="submit" className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">Apply filters</button>
            <a href="/signals" className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950">Reset</a>
          </div>
        </form>
      </Panel>

      <Panel title="Chronological signal timeline" description={`${signals.length} signal(s) match the current filters.`}>
        {!signals.length ? (
          <EmptyState
            title="No signals match these filters"
            description="Try widening the confidence threshold or removing the signal-type restriction to see more early-stage evidence."
            actionLabel="Reset filters"
            actionHref="/signals"
          />
        ) : (
          <div className="space-y-4">
            {signals.map((signal) => (
              <div key={signal.id} className="rounded-[24px] border border-slate-200/80 bg-slate-50/70 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <SignalTypeBadge signalType={signal.signalType} />
                  <ConfidenceBadge confidence={Math.round(signal.confidence * 100)} />
                  <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{TARGET_CATEGORY_LABELS[signal.category]}</span>
                </div>
                <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">{signal.title}</h2>
                    <div className="mt-1 text-sm text-slate-600">
                      <a href={`/accounts/${signal.account.id}`} className="font-medium text-emerald-700 hover:text-emerald-800">
                        {signal.account.name}
                      </a>
                      {" "}• {freshnessLabel(signal.publishedAt ?? signal.detectedAt)}
                    </div>
                  </div>
                  <a href={signal.sourceUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-slate-700 hover:text-slate-950">
                    Open evidence
                  </a>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{signal.description}</p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-[20px] border border-white bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900">Evidence snippet</div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{signal.evidenceSnippet}</p>
                  </div>
                  <div className="rounded-[20px] border border-white bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900">Recommended action</div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{signal.recommendedAction}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
