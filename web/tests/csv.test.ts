import { Industry } from "@prisma/client";
import { describe, expect, test } from "vitest";

import { dedupeParsedAccounts, parseAccountCsv } from "@/lib/csv";

describe("CSV parsing", () => {
  test("parses valid account rows", () => {
    const csv = [
      "name,website,industry,country,employeeCount,revenue,owner,notes",
      "Demo Pharma,https://demo.com,PHARMA,Germany,1200,1.4,EMEA Pod,Priority account",
    ].join("\n");

    const result = parseAccountCsv(csv);

    expect(result.invalidRows).toHaveLength(0);
    expect(result.rows).toEqual([
      {
        name: "Demo Pharma",
        website: "https://demo.com",
        industry: Industry.PHARMA,
        country: "Germany",
        employeeCount: 1200,
        revenue: 1.4,
        owner: "EMEA Pod",
        notes: "Priority account",
      },
    ]);
  });

  test("reports invalid rows", () => {
    const csv = [
      "name,website,industry,country",
      ",not-a-url,PHARMA,Germany",
    ].join("\n");

    const result = parseAccountCsv(csv);

    expect(result.rows).toHaveLength(0);
    expect(result.invalidRows).toHaveLength(1);
  });

  test("deduplicates imported accounts against existing keys and within the same file", () => {
    const rows = [
      { name: "Acme Pharma", website: "https://acme.com" },
      { name: "Acme Pharma", website: "https://acme.com" },
      { name: "New Medtech", website: "https://newmed.com" },
    ];

    const result = dedupeParsedAccounts(new Set(["acme pharma::acme.com"]), rows);

    expect(result.createdCount).toBe(1);
    expect(result.duplicateCount).toBe(2);
    expect(result.rows[0]?.name).toBe("New Medtech");
  });
});
