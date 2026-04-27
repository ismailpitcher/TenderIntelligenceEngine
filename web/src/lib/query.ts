export type SearchParamValue = string | string[] | undefined;
export type SearchParamMap = Record<string, SearchParamValue>;

export function firstValue(value: SearchParamValue) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function numberValue(value: SearchParamValue) {
  const first = firstValue(value);
  if (!first) {
    return undefined;
  }
  const parsed = Number(first);
  return Number.isFinite(parsed) ? parsed : undefined;
}
