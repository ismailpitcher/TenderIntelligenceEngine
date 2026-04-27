import { SettingType } from "@prisma/client";

import { MOCK_PROVIDERS } from "@/lib/providers";
import { getSettingsSnapshot } from "@/lib/settings-service";
import { INDUSTRY_LABELS, SIGNAL_TYPE_LABELS, TARGET_CATEGORY_LABELS } from "@/lib/constants";
import { ProviderStatusBadge } from "@/components/badges";
import { PageHeader, Panel } from "@/components/ui";

export default async function SettingsPage() {
  const settings = await getSettingsSnapshot();
  const keywordsByGroup = Object.groupBy(settings.keywords, (keyword) => keyword.groupName);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Tune keywords, scoring, and provider coverage"
        description="This MVP keeps everything local-first and explainable: scoring weights, ICP settings, mock provider placeholders, and the seed keyword taxonomy."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel title="Scoring weights" description="Adjust these values as the team learns which signals really correlate with open buying windows.">
          <div className="space-y-3">
            {settings.scoringWeights.map((weight) => (
              <div key={weight.id} className="rounded-[20px] border border-slate-200/80 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="font-semibold text-slate-950">{weight.label}</div>
                  <div className="text-lg font-semibold text-slate-950">{weight.value}</div>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{weight.description}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Provider registry" description="Mock today, replaceable with approved real providers later.">
          <div className="space-y-3">
            {settings.providerConfigs.map((provider) => {
              const mockDefinition = MOCK_PROVIDERS.find((item) => item.key === provider.key);
              return (
                <div key={provider.id} className="rounded-[20px] border border-slate-200/80 bg-white p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="font-semibold text-slate-950">{provider.name}</div>
                    <ProviderStatusBadge status={provider.status} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{provider.description}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                    {mockDefinition?.description ?? provider.notes ?? "Placeholder provider for future integration."}
                  </p>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel title="Keyword taxonomy" description="Seeded keywords for procurement, enablement, pharma workflows, AI coaching, and competitor detection.">
          <div className="space-y-4">
            {Object.entries(keywordsByGroup).map(([group, items]) => (
              <div key={group} className="rounded-[20px] border border-slate-200/80 bg-slate-50/70 p-4">
                <div className="text-sm font-semibold text-slate-950">{group}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(items ?? []).map((keyword) => (
                    <span key={keyword.id} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                      {keyword.term}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Target profile and competitors" description="Ideal industries, target countries, and competitor set used to bias the scoring and outbound framing.">
          <div className="space-y-5">
            <div>
              <div className="text-sm font-semibold text-slate-950">Target profile</div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {settings.targetSettings.map((setting) => (
                  <div key={setting.id} className="rounded-[20px] border border-slate-200/80 bg-white p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      {setting.type === SettingType.TARGET_INDUSTRY ? "Industry" : "Country"}
                    </div>
                    <div className="mt-2 font-semibold text-slate-950">
                      {setting.type === SettingType.TARGET_INDUSTRY
                        ? INDUSTRY_LABELS[setting.value as keyof typeof INDUSTRY_LABELS]
                        : setting.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-950">Competitor watchlist</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {settings.competitors.map((competitor) => (
                  <span key={competitor.id} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                    {competitor.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Signal categories in use" description="These are the target categories and signal families the MVP already understands.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(TARGET_CATEGORY_LABELS).map(([value, label]) => (
            <div key={value} className="rounded-[20px] border border-slate-200/80 bg-slate-50/70 p-4">
              <div className="font-semibold text-slate-950">{label}</div>
              <div className="mt-1 text-sm text-slate-600">{Object.values(SIGNAL_TYPE_LABELS).slice(0, 3).join(" • ")}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
