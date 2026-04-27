import { NextRequest } from "next/server";

import { getAccountIntelligenceList } from "@/lib/account-service";
import { renderAccountsCsv } from "@/lib/export-service";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const accounts = await getAccountIntelligenceList({
    search: searchParams.get("search") ?? undefined,
    industry: searchParams.get("industry") ?? undefined,
    country: searchParams.get("country") ?? undefined,
    stage: searchParams.get("stage") ?? undefined,
    minScore: searchParams.get("minScore") ? Number(searchParams.get("minScore")) : undefined,
  });

  return new Response(renderAccountsCsv(accounts), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="pitcher-signal-radar-accounts.csv"',
    },
  });
}
