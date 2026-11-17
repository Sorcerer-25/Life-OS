/** Only AI decimal-string -> legacy numeric entity conversion point.
 * Call immediately before the existing IntentAnalysis validator (stage 2).
 */
export function amountAtValidatorBoundary(value: unknown, input: string): number | undefined {
  if (typeof value !== 'string' || !/^\d+(\.\d{1,2})?$/.test(value)) return undefined;
  const literals = input.match(/\d+(?:,\d{3})*(?:\.\d+)?/g) ?? [];
  if (!literals.some(literal => literal.replace(/,/g, '') === value)) return undefined;
  const result = Number(value);
  if (!Number.isFinite(result) || result <= 0 || result > Number.MAX_SAFE_INTEGER / 100) return undefined;
  return result;
}
