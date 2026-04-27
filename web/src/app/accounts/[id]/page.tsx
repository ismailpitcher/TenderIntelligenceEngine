import { notFound } from "next/navigation";

import { getAccountIntelligenceById } from "@/lib/account-service";
import {
  INDUSTRY_LABELS,
  SOURCE_TYPE_LABELS,
  TARGET_CATEGORY_LABELS,
} from "@/lib/constants";
import { freshnessLabel, formatCurrencyBillions } from "@/lib/utils";
import { ConfidenceBadge, SignalTypeBadge, StageBadge } from "@/components/badges";
import { PageHeader, Panel, ScoreMeter, TextLink } from "@/components/ui";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const intelligence = await getAccountIntelligenceById(id);

  if (!intelligence) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account detail"
        title={intelligence.account.name}
        description={intelligence.account.notes ?? "Account-level intelligence, evidence, stakeholders, and outreach recommendations."}
        actions={
          <>
            <TextLink href="/accounts">Back to accounts</TextLink>
            <TextLink href={`/api/export/account/${intelligence.account.id}/markdown`}>Export markdown</TextLink>
            <TextLink href={`/api/export/account/${intelligence.account.id}/messages`}>Export messages</TextLink>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
        <div className="space-y-6">
          <Panel title="Account overview" description="Core account profile and ranking summary.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Industry</div>
                <div className="mt-2 text-lg font-semibold text-slate-950">{INDUSTRY_LABELS[intelligence.account.industry]}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Country</div>
                <div className="mt-2 text-lg font-semibold text-slate-950">{intelligence.account.country}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Employees</div>
                <div className="mt-2 text-lg font-semibold text-slate-950">{intelligence.account.employeeCount ?? "Unknown"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Revenue</div>
                <div className="mt-2 text-lg font-semibold text-slate-950">{formatCurrencyBillions(intelligence.account.revenue)}</div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <StageBadge stage={intelligence.explanation.stage} />
              <ConfidenceBadge confidence={intelligence.explanation.confidence} />
              {intelligence.account.website ? (
                <a href={intelligence.account.website} target="_blank" rel="noreferrer" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
                  Visit website
                </a>
              ) : null}
            </div>
            <div className="mt-5">
              <ScoreMeter score={intelligence.explanation.score} />
            </div>
          </Panel>

          <Panel title="Why this is ranked here" description="Explainable scoring so BDRs can trust the recommendation.">
            <div className="space-y-3">
              {intelligence.explanation.lines.map((line) => (
                <div key={line.key} className="rounded-[20px] border border-slate-200/80 bg-slate-50/80 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="font-semibold text-slate-950">{line.label}</div>
                    <div className={`text-sm font-semibold ${line.value >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {line.value >= 0 ? "+" : ""}
                      {line.value}
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{line.reason}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Recommended stakeholders" description="Who to contact first and why they matter.">
            <div className="space-y-3">
              {intelligence.stakeholders.map((stakeholder) => (
                <div key={`${stakeholder.name}-${stakeholder.title}`} className="rounded-[20px] border border-slate-200/80 bg-white p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-slate-950">{stakeholder.name}</div>
                      <div className="text-sm text-slate-600">{stakeholder.title}</div>
                    </div>
                    <div className="text-sm font-semibold text-slate-500">{stakeholder.relevanceScore}</div>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{stakeholder.suggestedMessageAngle}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Detected signals" description="Evidence timeline with source links and suggested actions.">
            <div className="space-y-4">
              {intelligence.signals.map((signal) => (
                <article key={signal.id} className="rounded-[22px] border border-slate-200/80 bg-slate-50/70 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <SignalTypeBadge signalType={signal.signalType} />
                    <ConfidenceBadge confidence={Math.round(signal.confidence * 100)} />
                    <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{TARGET_CATEGORY_LABELS[signal.category]}</span>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-slate-950">{signal.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{signal.description}</p>
                  <div className="mt-3 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                    <div>
                      <div className="font-medium text-slate-900">Evidence</div>
                      <div className="mt-1">{signal.evidenceSnippet}</div>
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">Recommended action</div>
                      <div className="mt-1">{signal.recommendedAction}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                    <span>{SOURCE_TYPE_LABELS[signal.sourceType]}</span>
                    <span>{freshnessLabel(signal.publishedAt ?? signal.detectedAt)}</span>
                    <a href={signal.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-emerald-700 hover:text-emerald-800">
                      Open evidence
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </Panel>

          <Panel title="Recommended outreach" description="Consultative copy designed to start a benchmark conversation without overstating the evidence.">
            <div className="space-y-5">
              <div className="rounded-[22px] border border-emerald-100 bg-emerald-50/60 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-emerald-700/80">Angle</div>
                <p className="mt-2 text-sm leading-6 text-emerald-950">{intelligence.outreach.angle}</p>
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">Suggested email</div>
                <pre className="mt-2 overflow-x-auto rounded-[22px] border border-slate-200 bg-slate-950 p-4 text-sm leading-6 text-slate-100">{intelligence.outreach.email}</pre>
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">Suggested LinkedIn message</div>
                <pre className="mt-2 overflow-x-auto rounded-[22px] border border-slate-200 bg-slate-950 p-4 text-sm leading-6 text-slate-100">{intelligence.outreach.linkedin}</pre>
              </div>
              <div className="rounded-[22px] border border-sky-100 bg-sky-50/60 p-4">
                <div className="text-sm font-semibold text-slate-900">Next best action</div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{intelligence.outreach.nextBestAction}</p>
              </div>
            </div>
          </Panel>

          <Panel title="Missing information" description="Gaps the BDR should try to close during discovery.">
            <div className="space-y-3">
              {intelligence.missingInformation.map((item) => (
                <div key={item} className="rounded-[20px] border border-slate-200/80 bg-white p-4 text-sm leading-6 text-slate-600">
                  {item}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
