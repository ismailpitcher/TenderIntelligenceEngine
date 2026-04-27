import { Industry } from "@prisma/client";
import Link from "next/link";

import { addAccountAction, uploadAccountsAction } from "@/app/actions";
import { getAccountFilterOptions, getAccountIntelligenceList } from "@/lib/account-service";
import { INDUSTRY_LABELS, STAGE_LABELS, TARGET_CATEGORY_LABELS } from "@/lib/constants";
import { firstValue, numberValue, type SearchParamMap } from "@/lib/query";
import { freshnessLabel } from "@/lib/utils";
import { ConfidenceBadge, StageBadge } from "@/components/badges";
import { EmptyState, PageHeader, Panel, ScoreMeter, TextLink } from "@/components/ui";

async function parseSearchParams(searchParams?: Promise<SearchParamMap>) {
  const raw = (await searchParams) ?? {};
  return {
    search: firstValue(raw.search) ?? "",
    industry: firstValue(raw.industry) ?? "ALL",
    country: firstValue(raw.country) ?? "ALL",
    stage: firstValue(raw.stage) ?? "ALL",
    minScore: numberValue(raw.minScore) ?? 0,
    imported: numberValue(raw.imported),
    duplicates: numberValue(raw.duplicates),
    invalid: numberValue(raw.invalid),
    error: firstValue(raw.error),
  };
}

export default async function AccountsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParamMap>;
}) {
  const params = await parseSearchParams(searchParams);
  const [accounts, options] = await Promise.all([
    getAccountIntelligenceList({
      search: params.search || undefined,
      industry: params.industry,
      country: params.country,
      stage: params.stage,
      minScore: params.minScore,
    }),
    getAccountFilterOptions(),
  ]);

  const queryString = new URLSearchParams({
    ...(params.search ? { search: params.search } : {}),
    ...(params.industry !== "ALL" ? { industry: params.industry } : {}),
    ...(params.country !== "ALL" ? { country: params.country } : {}),
    ...(params.stage !== "ALL" ? { stage: params.stage } : {}),
    ...(params.minScore ? { minScore: String(params.minScore) } : {}),
  }).toString();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Accounts"
        title="Monitor target accounts and surface the best timing windows"
        description="Upload or add target accounts, filter by stage and score, then open each account to review evidence, stakeholders, and ready-to-send outreach."
        actions={
          <>
            <TextLink href={`/api/export/accounts${queryString ? `?${queryString}` : ""}`}>Export current view CSV</TextLink>
            <TextLink href="/signals">Review signal feed</TextLink>
          </>
        }
      />

      {params.error ? (
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{params.error}</div>
      ) : null}
      {params.imported !== undefined ? (
        <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Imported {params.imported} account(s), skipped {params.duplicates ?? 0} duplicate(s), and flagged {params.invalid ?? 0} invalid row(s).
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel title="Account filters" description="Trim the account list down to the signals that matter for this week.">
          <form method="GET" className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-2 text-sm font-medium text-slate-700">
              <span>Search</span>
              <input name="search" defaultValue={params.search} placeholder="Novo, CRM, omnichannel" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none ring-0 transition focus:border-emerald-400" />
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-700">
              <span>Industry</span>
              <select name="industry" defaultValue={params.industry} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none">
                <option value="ALL">All</option>
                {Object.entries(INDUSTRY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-700">
              <span>Country</span>
              <select name="country" defaultValue={params.country} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none">
                <option value="ALL">All</option>
                {options.countries.map((country) => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-700">
              <span>Stage</span>
              <select name="stage" defaultValue={params.stage} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none">
                <option value="ALL">All</option>
                {Object.entries(STAGE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-700">
              <span>Minimum score</span>
              <input name="minScore" type="number" min="0" max="100" defaultValue={params.minScore} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none" />
            </label>
            <div className="md:col-span-2 xl:col-span-5 flex flex-wrap gap-3 pt-1">
              <button type="submit" className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                Apply filters
              </button>
              <Link href="/accounts" className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950">
                Reset
              </Link>
            </div>
          </form>
        </Panel>

        <div className="grid gap-6">
          <Panel title="Upload target accounts" description="CSV headers: name, website, industry, country, employeeCount, revenue, owner, notes.">
            <form action={uploadAccountsAction} className="space-y-4">
              <input type="file" name="file" accept=".csv,text/csv" required className="block w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600" />
              <button type="submit" className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500">
                Upload CSV
              </button>
            </form>
          </Panel>

          <Panel title="Add account manually" description="New accounts trigger a mock local scan so you can test the workflow end to end.">
            <form action={addAccountAction} className="grid gap-3 md:grid-cols-2">
              <input name="name" placeholder="Account name" required className="rounded-2xl border border-slate-200 px-4 py-3" />
              <input name="website" placeholder="https://company.com" className="rounded-2xl border border-slate-200 px-4 py-3" />
              <select name="industry" defaultValue={Industry.OTHER} className="rounded-2xl border border-slate-200 px-4 py-3">
                {Object.entries(INDUSTRY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <input name="country" placeholder="Country" required className="rounded-2xl border border-slate-200 px-4 py-3" />
              <input name="employeeCount" type="number" min="1" placeholder="Employees" className="rounded-2xl border border-slate-200 px-4 py-3" />
              <input name="revenue" type="number" step="0.1" min="0" placeholder="Revenue ($B)" className="rounded-2xl border border-slate-200 px-4 py-3" />
              <input name="owner" placeholder="Owner" className="rounded-2xl border border-slate-200 px-4 py-3 md:col-span-2" />
              <textarea name="notes" placeholder="Notes" rows={3} className="rounded-2xl border border-slate-200 px-4 py-3 md:col-span-2" />
              <button type="submit" className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 md:col-span-2">
                Create account
              </button>
            </form>
          </Panel>
        </div>
      </div>

      <Panel title="Target account list" description={`${accounts.length} account(s) match the current filters.`}>
        {!accounts.length ? (
          <EmptyState
            title="No accounts match these filters"
            description="Try lowering the minimum score, widening the country scope, or resetting the stage filter."
            actionLabel="Reset filters"
            actionHref="/accounts"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="pb-3 font-medium">Account</th>
                  <th className="pb-3 font-medium">Stage</th>
                  <th className="pb-3 font-medium">Score</th>
                  <th className="pb-3 font-medium">Confidence</th>
                  <th className="pb-3 font-medium">Top category</th>
                  <th className="pb-3 font-medium">Signals</th>
                  <th className="pb-3 font-medium">Last signal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accounts.map((item) => (
                  <tr key={item.account.id} className="align-top">
                    <td className="py-4 pr-4">
                      <Link href={`/accounts/${item.account.id}`} className="block font-semibold text-slate-950 hover:text-emerald-700">
                        {item.account.name}
                      </Link>
                      <div className="mt-1 text-xs text-slate-500">
                        {INDUSTRY_LABELS[item.account.industry]} • {item.account.country}
                      </div>
                    </td>
                    <td className="py-4 pr-4"><StageBadge stage={item.explanation.stage} /></td>
                    <td className="py-4 pr-4 min-w-[170px]"><ScoreMeter score={item.explanation.score} /></td>
                    <td className="py-4 pr-4"><ConfidenceBadge confidence={item.explanation.confidence} /></td>
                    <td className="py-4 pr-4 text-slate-600">{item.topCategories[0] ? TARGET_CATEGORY_LABELS[item.topCategories[0]] : "General enablement"}</td>
                    <td className="py-4 pr-4 text-slate-600">{item.signals.length}</td>
                    <td className="py-4 text-slate-600">{freshnessLabel(item.lastDetectedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
