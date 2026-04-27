import { Industry } from "@prisma/client";
import Papa from "papaparse";
import { z } from "zod";

import type { ImportAccountsResult, ParsedAccountRow } from "@/lib/types";
import { buildAccountDedupeKey } from "@/lib/utils";

const rowSchema = z.object({
  name: z.string().trim().min(1),
  website: z.string().trim().url().optional().or(z.literal("")).optional(),
  industry: z.nativeEnum(Industry).optional(),
  country: z.string().trim().min(2).optional(),
  employeeCount: z.number().int().positive().optional(),
  revenue: z.number().positive().optional(),
  owner: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

function normalizeIndustry(value?: string) {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (normalized in Industry) {
    return normalized as Industry;
  }
  return undefined;
}

function parseOptionalNumber(value?: string) {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseAccountCsv(csvText: string) {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const rows: ParsedAccountRow[] = [];
  const invalidRows: Array<{ row: number; reason: string }> = [];

  parsed.data.forEach((rawRow, index) => {
    const candidate = {
      name: rawRow.name ?? rawRow.Name ?? "",
      website: rawRow.website ?? rawRow.Website ?? undefined,
      industry: normalizeIndustry(rawRow.industry ?? rawRow.Industry),
      country: rawRow.country ?? rawRow.Country ?? undefined,
      employeeCount: parseOptionalNumber(rawRow.employeeCount ?? rawRow.EmployeeCount),
      revenue: parseOptionalNumber(rawRow.revenue ?? rawRow.Revenue),
      owner: rawRow.owner ?? rawRow.Owner ?? undefined,
      notes: rawRow.notes ?? rawRow.Notes ?? undefined,
    };

    const result = rowSchema.safeParse(candidate);
    if (!result.success) {
      invalidRows.push({
        row: index + 2,
        reason: result.error.issues[0]?.message ?? "Invalid row",
      });
      return;
    }
    rows.push(result.data);
  });

  return { rows, invalidRows };
}

export function dedupeParsedAccounts(existingDedupeKeys: Set<string>, rows: ParsedAccountRow[]): ImportAccountsResult & { rows: ParsedAccountRow[] } {
  const created: ParsedAccountRow[] = [];
  let duplicateCount = 0;

  for (const row of rows) {
    const key = buildAccountDedupeKey(row.name, row.website);
    if (existingDedupeKeys.has(key)) {
      duplicateCount += 1;
      continue;
    }
    existingDedupeKeys.add(key);
    created.push(row);
  }

  return {
    createdIds: [],
    createdCount: created.length,
    duplicateCount,
    invalidRows: [],
    rows: created,
  };
}
