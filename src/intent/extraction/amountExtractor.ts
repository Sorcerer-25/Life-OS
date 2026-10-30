export interface ExtractedAmount {
  amount: number;
  currency?: string;
  rawMatchedText: string;
}

/**
 * Extracts numeric amount and currency from text.
 * Strictly respects the currency rule: defaults to INR only when the input
 * says rupees, Rs, or ₹. Otherwise leaves currency undefined.
 */
export function extractAmount(text: string): ExtractedAmount | null {
  // 1. Symbol/word prefix: ₹250, Rs 1200, Rs. 1200, INR 500, $50, USD 100, €30
  const prefixMatch = text.match(/(₹|rs\.?|inr|\$|usd|eur|€)\s*([\d,]+(?:\.\d+)?)/i);
  if (prefixMatch) {
    const rawSym = prefixMatch[1].toLowerCase();
    let currency = 'INR';
    if (rawSym === '$' || rawSym === 'usd') currency = 'USD';
    if (rawSym === '€' || rawSym === 'eur') currency = 'EUR';
    const num = parseFloat(prefixMatch[2].replace(/,/g, ''));
    return { amount: num, currency, rawMatchedText: prefixMatch[0] };
  }

  // 2. Suffix: 250 rupees, 1200 rs, 500 inr, 50 dollars, 100 usd, 30 euros
  const suffixMatch = text.match(
    /([\d,]+(?:\.\d+)?)\s*(rupees|rs\.?|inr|dollars|usd|euros|eur)/i
  );
  if (suffixMatch) {
    const num = parseFloat(suffixMatch[1].replace(/,/g, ''));
    const rawCur = suffixMatch[2].toLowerCase();
    const currency =
      rawCur.includes('dollar') || rawCur === 'usd'
        ? 'USD'
        : rawCur.includes('euro') || rawCur === 'eur'
        ? 'EUR'
        : 'INR';
    return { amount: num, currency, rawMatchedText: suffixMatch[0] };
  }

  // 3. Numbers without currency symbol (e.g. "paid 200", "spent 250", "for 1200", "of 500")
  const contextMatch = text.match(
    /\b(?:spent|paid|for|of|costing|around|worth|amount\s+of)\s+([\d,]+(?:\.\d+)?)\b/i
  );
  if (contextMatch) {
    const num = parseFloat(contextMatch[1].replace(/,/g, ''));
    return { amount: num, currency: undefined, rawMatchedText: contextMatch[0] };
  }

  return null;
}

