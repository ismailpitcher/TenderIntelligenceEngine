"use server";

import { Industry } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createAccount, importAccountsFromCsv } from "@/lib/account-service";

const manualAccountSchema = z.object({
  name: z.string().trim().min(2),
  website: z.string().trim().url().optional().or(z.literal("")).optional(),
  industry: z.nativeEnum(Industry).default(Industry.OTHER),
  country: z.string().trim().min(2),
  employeeCount: z.number().int().positive().optional(),
  revenue: z.number().positive().optional(),
  owner: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

function revalidateApp() {
  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/signals");
  revalidatePath("/settings");
}

function optionalNumber(value: FormDataEntryValue | null) {
  if (!value || typeof value !== "string" || !value.trim()) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function addAccountAction(formData: FormData) {
  const parsed = manualAccountSchema.safeParse({
    name: formData.get("name"),
    website: formData.get("website"),
    industry: formData.get("industry"),
    country: formData.get("country"),
    employeeCount: optionalNumber(formData.get("employeeCount")),
    revenue: optionalNumber(formData.get("revenue")),
    owner: formData.get("owner"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    redirect(`/accounts?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid account input")}`);
  }

  const result = await createAccount(parsed.data);
  revalidateApp();

  if (result.created) {
    redirect(`/accounts/${result.accountId}?created=1`);
  }

  redirect(`/accounts/${result.accountId}?duplicate=1`);
}

export async function uploadAccountsAction(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    redirect("/accounts?error=Upload%20a%20CSV%20file");
  }

  const text = await file.text();
  const result = await importAccountsFromCsv(text);
  revalidateApp();

  const params = new URLSearchParams({
    imported: String(result.createdCount),
    duplicates: String(result.duplicateCount),
    invalid: String(result.invalidRows.length),
  });
  redirect(`/accounts?${params.toString()}`);
}
