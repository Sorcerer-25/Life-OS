/**
 * Notification Sanitizer & Masking
 * 
 * Protects user privacy by masking long credit card numbers and account numbers
 * before storing in SQLite or passing to intent analysis.
 * Treats all notification text as untrusted data.
 */

export function sanitizeNotificationText(text: string): string {
  if (!text) return '';

  let sanitized = text.trim();

  // 1. Mask 16-digit credit/debit card numbers: e.g. 1234-5678-9012-3456 or 1234 5678 9012 3456
  sanitized = sanitized.replace(
    /\b(\d{4})[- ]?(\d{4})[- ]?(\d{4})[- ]?(\d{4})\b/g,
    '****-****-****-$4'
  );

  // 2. Mask 10-18 digit account numbers: e.g. A/C 987654321012 -> A/C ****1012
  sanitized = sanitized.replace(
    /(?:A\/C|acct|account(?:\s+no\.?)?|a\/c\s+no\.?)\s*:?\s*(\d{6,14})(\d{4})\b/gi,
    (match, prefixDigits, last4) => {
      const label = match.split(/\d/)[0];
      return `${label}****${last4}`;
    }
  );

  // 3. Standalone long numbers (10+ digits) that look like bank accounts or internal reference IDs
  sanitized = sanitized.replace(/\b(\d{6,14})(\d{4})\b/g, '****$2');

  // 4. Collapse excessive whitespaces
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  return sanitized;
}

