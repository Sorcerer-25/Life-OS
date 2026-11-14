import { NotificationInboxItem } from '../models/NotificationEvent';

export type TriageCategory = 'useful' | 'other';

export interface TriageResult {
  category: TriageCategory;
  reason: string;
  isUserOverride?: boolean;
  extractedAmount?: string;
  plainSummary?: string;
}

// Media placeholder patterns representing empty or non-text content
const MEDIA_PLACEHOLDER_REGEX = /^(image|photo|video|gif|sticker|media|audio|attachment|null|undefined)$/i;

// Explicit promotional & marketing patterns (Other)
// Note: These identify marketing offers, discounts, cashbacks, contest wins, etc.
const PROMO_KEYWORDS_REGEX = /\b(cashback|cash\s*back|coupon|promo\s*code|voucher|discount|flat\s*\d+%\s*off|up\s*to\s*\d+%\s*off|free\s*delivery|limited\s*time\s*(deal|offer|discount)?|deal\s*of\s*the\s*day|spin\s*to\s*win|lucky\s*draw|jackpot|bonus\s*points|reward\s*points|refer\s*(and|&)\s*earn|special\s*offer|mega\s*sale|exclusive\s*deal|festive\s*offer)\b/i;

// Phony urgency / sales hooks (Other)
const MARKETING_HOOK_REGEX = /\b(claim\s*(your|free)|don'?t\s*miss\s*out|miss\s*(out\s*on\s*)?₹?\s*\d+|hurry\s*up|valid\s*till\s*today|grab\s*now|shop\s*now|avail\s*offer|upgrade\s*(offer|and\s*get)|pre-?approved\s*(loan|card)|instant\s*loan|at\s*just\s*₹?\s*\d+\s*\/\s*(month|year|day))\b/i;

// Real banking & transaction confirmation patterns (Useful)
// Real financial alerts state an account has been debited/credited/spent/paid/withdrawn with an amount
const REAL_DEBIT_REGEX = /\b(debited\s*(by|for|with)?|spent|paid\s*(to|for|at|via)|transferred\s*to|withdrawn|charged\s*to|purchase\s*of)\b/i;
const REAL_CREDIT_REGEX = /\b(credited\s*(to|with|by)?|refund\s*of|received\s*(from)?|salary\s*credited)\b/i;
const ACCOUNT_MARKER_REGEX = /\b(a\/c|acct|acc|account|card\s*ending|ending\s*in|vpa|upi\s*ref|avl\s*bal|available\s*balance|bal\s*:)\b/i;

// Amount currency regex
const CURRENCY_AMOUNT_REGEX = /(?:rs\.?|inr|₹|\$)\s*([\d,]+(?:\.\d{1,2})?)/i;

// Bill due / payment deadline patterns (Useful)
const BILL_DUE_REGEX = /\b(bill\s*(is\s*)?due|payment\s*(is\s*)?due|due\s*date|due\s*on|overdue|bill\s*generated|minimum\s*amount\s*due|statement\s*generated|recharge\s*due)\b/i;

// Calendar, meeting, event invitation patterns (Useful)
const MEETING_EVENT_REGEX = /\b(invited\s*to|invitation|meeting\s*(with|on|at)?|zoom|google\s*meet|teams\s*meeting|webinar|schedule|scheduled\s*(for|on)?|appointment\s*(with|at)?|interview\s*(scheduled|at)?)\b/i;

// Reminder & task deadline patterns (Useful)
const REMINDER_DEADLINE_REGEX = /\b(reminder\s*:?|remind\s*me|don'?t\s*forget\s*to|deadline\s*:?|due\s*by|submit\s*(before|by)?|assignment\s*due|task\s*assigned)\b/i;

/**
 * Extracts a formatted currency amount if present in text or title.
 */
export function extractAmount(text: string): string | undefined {
  const match = text.match(CURRENCY_AMOUNT_REGEX);
  if (!match) return undefined;
  const rawSymbol = match[0].trim();
  const value = match[1];
  if (rawSymbol.startsWith('₹') || rawSymbol.toLowerCase().startsWith('rs') || rawSymbol.toLowerCase().startsWith('inr')) {
    return `₹${value}`;
  }
  if (rawSymbol.startsWith('$')) {
    return `$${value}`;
  }
  return rawSymbol;
}

/**
 * Generates a clean, readable one-line summary for a useful notification.
 */
export function generatePlainSummary(title: string, text: string): string {
  const combined = `${title} ${text}`.trim();
  const amount = extractAmount(combined);

  if (REAL_DEBIT_REGEX.test(combined) && amount) {
    // Try to extract merchant / beneficiary
    const merchantMatch = combined.match(/(?:at|to|for|via)\s+([A-Za-z0-9&.\s]{3,24})(?:[\.\,\;]|\s+on|\s+avl|\s+ref)/i);
    const merchant = merchantMatch ? merchantMatch[1].trim() : '';
    return merchant ? `Debit of ${amount} at ${merchant}` : `Debit alert of ${amount}`;
  }

  if (REAL_CREDIT_REGEX.test(combined) && amount) {
    const senderMatch = combined.match(/(?:from|by)\s+([A-Za-z0-9&.\s]{3,24})(?:[\.\,\;]|\s+on|\s+avl|\s+ref)/i);
    const sender = senderMatch ? senderMatch[1].trim() : '';
    return sender ? `Credit of ${amount} from ${sender}` : `Credit of ${amount} received`;
  }

  if (BILL_DUE_REGEX.test(combined)) {
    return amount ? `Bill due: ${amount}` : 'Bill payment due';
  }

  if (MEETING_EVENT_REGEX.test(combined)) {
    return title || 'Meeting / Event invitation';
  }

  if (REMINDER_DEADLINE_REGEX.test(combined)) {
    return title || 'Scheduled reminder';
  }

  return title || text.slice(0, 40);
}

/**
 * Deterministic rule-based triage classifier for notifications.
 *
 * Rules:
 * 1. User overrides: If the user explicitly moved the item, respect it.
 * 2. Media / Empty: Empty text or placeholders like "Image" -> Other ("No actionable text").
 * 3. Marketing / Promo: Offers, cashbacks, discounts, sales, fake instructions -> Other ("Promotional wording" or "Marketing offer").
 *    Exception: Real transaction debit/credit confirmations with account markers are NOT treated as promos.
 * 4. Useful Categories:
 *    - Transaction alerts (debited / credited with amount) -> Useful ("Spending alert" / "Transaction alert")
 *    - Bill payment due -> Useful ("Bill payment due")
 *    - Meetings & invitations -> Useful ("Meeting invitation" / "Scheduled event")
 *    - Reminders & deadlines -> Useful ("Reminder / deadline")
 *    - Existing parser / action plan present -> Useful ("Actionable request")
 * 5. Bias rule: When unsure, classify as Useful ("Important notice").
 */
export function classifyNotification(
  item: Pick<NotificationInboxItem, 'title' | 'text'> & {
    category?: string;
    execution_result?: Record<string, unknown> | null;
    analysis?: any;
    action_plan?: any;
  }
): TriageResult {
  // 1. Check user override stored in existing storage (execution_result.triage_override)
  const override = item.execution_result?.triage_override;
  if (override === 'useful') {
    return {
      category: 'useful',
      reason: 'Marked useful by you',
      isUserOverride: true,
      extractedAmount: extractAmount(`${item.title} ${item.text}`),
      plainSummary: generatePlainSummary(item.title, item.text),
    };
  }
  if (override === 'other') {
    return {
      category: 'other',
      reason: 'Marked other by you',
      isUserOverride: true,
    };
  }

  const rawTitle = (item.title || '').trim();
  const rawText = (item.text || '').trim();
  const combined = `${rawTitle} ${rawText}`.trim();
  const amount = extractAmount(combined);

  // 2. Empty or media placeholder check (e.g. "Image", "Photo")
  if (!combined || MEDIA_PLACEHOLDER_REGEX.test(rawText) || (rawText.length < 2 && MEDIA_PLACEHOLDER_REGEX.test(rawTitle))) {
    return {
      category: 'other',
      reason: 'No actionable text',
    };
  }

  // 3. Check for genuine banking/financial debit or credit confirmation
  const isRealDebit = REAL_DEBIT_REGEX.test(combined) && (Boolean(amount) || ACCOUNT_MARKER_REGEX.test(combined));
  const isRealCredit = REAL_CREDIT_REGEX.test(combined) && (Boolean(amount) || ACCOUNT_MARKER_REGEX.test(combined));
  const hasAccountMarker = ACCOUNT_MARKER_REGEX.test(combined);

  // 4. Check for Promotional / Marketing wording
  const hasPromoWords = PROMO_KEYWORDS_REGEX.test(combined);
  const hasMarketingHook = MARKETING_HOOK_REGEX.test(combined);

  // If message has promotional wording or marketing hooks:
  // ONLY classify as Useful if it is a genuine bank transaction confirmation (e.g. debit SMS that mentions 5 reward points)
  if ((hasPromoWords || hasMarketingHook) && !(isRealDebit && hasAccountMarker)) {
    if (MARKETING_HOOK_REGEX.test(combined) && !hasPromoWords) {
      return {
        category: 'other',
        reason: 'Promotional wording',
      };
    }
    return {
      category: 'other',
      reason: 'Promotional wording',
    };
  }

  // 5. Useful: Transaction alerts
  if (isRealDebit) {
    return {
      category: 'useful',
      reason: 'Spending alert',
      extractedAmount: amount,
      plainSummary: generatePlainSummary(rawTitle, rawText),
    };
  }

  if (isRealCredit) {
    return {
      category: 'useful',
      reason: 'Transaction alert',
      extractedAmount: amount,
      plainSummary: generatePlainSummary(rawTitle, rawText),
    };
  }

  // 6. Useful: Bill or payment due
  if (BILL_DUE_REGEX.test(combined)) {
    return {
      category: 'useful',
      reason: 'Bill payment due',
      extractedAmount: amount,
      plainSummary: generatePlainSummary(rawTitle, rawText),
    };
  }

  // 7. Useful: Meeting / Event invitation
  if (MEETING_EVENT_REGEX.test(combined)) {
    return {
      category: 'useful',
      reason: 'Meeting invitation',
      plainSummary: generatePlainSummary(rawTitle, rawText),
    };
  }

  // 8. Useful: Reminder / Deadline
  if (REMINDER_DEADLINE_REGEX.test(combined)) {
    return {
      category: 'useful',
      reason: 'Reminder / deadline',
      extractedAmount: amount,
      plainSummary: generatePlainSummary(rawTitle, rawText),
    };
  }

  // 9. Useful: Existing parser / action plan extracted an action
  if (item.action_plan?.actions?.length > 0 || (item.analysis?.intents && item.analysis.intents.length > 0)) {
    return {
      category: 'useful',
      reason: 'Actionable request',
      extractedAmount: amount,
      plainSummary: generatePlainSummary(rawTitle, rawText),
    };
  }

  // 10. Bias rule: When unsure, classify as Useful
  // "Wrongly hiding something important is worse than showing a promo."
  return {
    category: 'useful',
    reason: 'Important notice',
    extractedAmount: amount,
    plainSummary: generatePlainSummary(rawTitle, rawText),
  };
}
