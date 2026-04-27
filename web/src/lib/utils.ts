import { clsx, type ClassValue } from "clsx";
import { formatDistanceToNowStrict, isValid, parseISO } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeAccountName(value: string) {
  return normalizeText(value)
    .replace(/\b(inc|corp|corporation|ltd|llc|gmbh|ag|plc|sa|bv)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildAccountDedupeKey(name: string, website?: string | null) {
  const normalizedName = normalizeAccountName(name);
  const normalizedWebsite = normalizeText((website ?? "").replace(/^https?:\/\//, "").replace(/^www\./, ""));
  return normalizedWebsite ? `${normalizedName}::${normalizedWebsite}` : normalizedName;
}

export function maybeDate(value?: string | Date | null) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

export function daysSince(value?: string | Date | null) {
  const date = maybeDate(value);
  if (!date) {
    return null;
  }
  const diff = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function freshnessLabel(value?: string | Date | null) {
  const date = maybeDate(value);
  if (!date) {
    return "Unknown";
  }
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

export function formatCurrencyBillions(value?: number | null) {
  if (value === null || value === undefined) {
    return "Unknown";
  }
  if (value >= 1) {
    return `$${value.toFixed(1)}B`;
  }
  return `$${(value * 1000).toFixed(0)}M`;
}

export function formatConfidence(value: number) {
  return `${Math.round(value)}%`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
