import { computeMissingEntities } from '../../models/canonicalEntities';
import { DetectedIntent } from '../../models/IntentAnalysis';
import { extractAmount } from '../extraction/amountExtractor';
import { extractDate } from '../extraction/dateExtractor';

const BILL_KEYWORDS: Record<string, string> = {
  electricity: 'electricity',
  power: 'electricity',
  water: 'water',
  internet: 'internet',
  wifi: 'internet',
  broadband: 'internet',
  gas: 'gas',
  rent: 'rent',
  recharge: 'recharge',
  mobile: 'mobile',
  phone: 'mobile',
  credit: 'credit_card',
  card: 'credit_card',
  insurance: 'insurance',
  subscription: 'subscription',
};

export function detectExpenseIntent(
  text: string,
  sequence: number,
  baseDate: Date
): DetectedIntent | null {
  const lower = text.toLowerCase();

  // 1. Pending payment safety: "My electricity bill payment is pending", "Payment of ₹1200 is pending"
  // Never interpret pending or future payments as completed expenses.
  if (
    /\bpending\b/.test(lower) &&
    (/\bpayment\b/.test(lower) || /\btransaction\b/.test(lower) || /\bbill\b/.test(lower))
  ) {
    const amountInfo = extractAmount(text);
    const dateInfo = extractDate(text, baseDate);
    const billType = extractBillType(text);

    const entities: Record<string, unknown> = {
      status: 'pending',
    };
    if (billType) {
      entities.bill_type = billType;
      entities.description = `${billType} bill`;
    }
    if (amountInfo) {
      entities.amount = amountInfo.amount;
      if (amountInfo.currency) entities.currency = amountInfo.currency;
    }
    if (dateInfo) {
      entities.due_date = dateInfo.dateStr;
      entities.due_date_text = dateInfo.matchedText;
    }

    const missing = computeMissingEntities('planned_expense', entities);
    return {
      sequence,
      intent: 'planned_expense',
      confidence: 0.5,
      entities,
      missing,
      raw_segment: text,
    };
  }

  // 1b. Negation safety: "I haven't paid", "didn't pay", "not paid yet", "yet to pay"
  // These indicate the expense is NOT completed — route to planned_expense.
  if (
    /\b(haven'?t\s+paid|didn'?t\s+pay|not\s+(?:yet\s+)?paid|yet\s+to\s+pay|still\s+(?:not\s+)?(?:paid|due)|is\s+still\s+due|still\s+due|unpaid)\b/.test(lower)
  ) {
    return buildPlannedExpense(text, lower, baseDate, sequence);
  }

  // 2. Planned Expense: "I need to pay ₹1200 tomorrow", "plan to spend", "have to pay", "will pay"
  //    Also: "is due", "owe", "keep aside", "set aside", "schedule a payment", "might spend"
  if (
    /\b(need\s+to\s+pay|plan\s+to\s+spend|planning\s+to|have\s+to\s+pay|will\s+(?:have\s+to\s+)?pay|must\s+pay|is\s+due|due\s+on|(?:keep|set)\s+.*?aside|i\s+owe|owe\s+my|schedule\s+a\s+payment|might\s+spend|may\s+pay)\b/.test(
      lower
    )
  ) {
    return buildPlannedExpense(text, lower, baseDate, sequence);
  }

  // 3. Completed Expense: "I paid ₹500 for groceries", "I spent ₹200 on lunch", "received a refund of ₹500"
  //    Also: "record an expense", "add ... as ... expense", "log an expense"
  if (
    /\b(spent|paid|bought|purchased|refund|received\s+a\s+refund|cost\s+me)\b/.test(lower) ||
    /\b(record\s+(?:an?\s+)?expense|log\s+(?:an?\s+)?expense|add\s+[\d₹].*?\s+(?:as\s+)?(?:my\s+)?(?:\w+\s+)?expense)\b/.test(lower)
  ) {
    const amountInfo = extractAmount(text);
    const dateInfo = extractDate(text, baseDate);
    const isRefund = /\b(refund|received\s+a\s+refund|returned)\b/.test(lower);

    let description = text
      .replace(
        /^(i\s+)?(spent|paid|bought|purchased|received\s+a\s+refund\s+of|received\s+a\s+refund|got\s+a\s+refund\s+of|got\s+a\s+refund)\s+/i,
        ''
      )
      .trim();

    if (amountInfo) {
      description = description.replace(new RegExp(escapeRegExp(amountInfo.rawMatchedText), 'gi'), '').trim();
    }
    if (dateInfo) {
      description = description.replace(new RegExp(`\\b${dateInfo.matchedText}\\b`, 'gi'), '').trim();
    }

    description = description
      .replace(/^(on|for)\s+/i, '')
      .replace(/^an?\s+expense\s+(?:of\s+)?/i, '')
      .replace(/[\.,]$/, '')
      .trim();

    const entities: Record<string, unknown> = {
      description: description || (isRefund ? 'refund' : 'general expense'),
    };

    if (amountInfo) {
      entities.amount = amountInfo.amount;
      if (amountInfo.currency) entities.currency = amountInfo.currency;
    }

    if (dateInfo) {
      entities.due_date = dateInfo.dateStr;
      entities.due_date_text = dateInfo.matchedText;
    } else {
      // Default completed transaction date to today
      const todayDate = baseDate.toISOString().slice(0, 10);
      entities.due_date = todayDate;
      entities.due_date_text = 'today';
    }

    if (isRefund) {
      entities.type = 'refund';
    }

    const missing = computeMissingEntities('expense_logged', entities);
    const confidence = missing.length === 0 ? 0.95 : 0.65;

    return {
      sequence,
      intent: 'expense_logged',
      confidence,
      entities,
      missing,
      raw_segment: text,
    };
  }

  // 4. Standalone expense pattern: e.g. "₹90 for tea and snacks", "250 for travel"
  const amountInfo = extractAmount(text);
  if (amountInfo && /\b(for|on)\s+([a-zA-Z]+)/i.test(lower)) {
    const dateInfo = extractDate(text, baseDate);
    let description = text;
    if (amountInfo) {
      description = description.replace(new RegExp(escapeRegExp(amountInfo.rawMatchedText), 'gi'), '').trim();
    }
    if (dateInfo) {
      description = description.replace(new RegExp(`\\b${dateInfo.matchedText}\\b`, 'gi'), '').trim();
    }
    description = description
      .replace(/^(on|for)\s+/i, '')
      .replace(/[\.,]$/, '')
      .trim();

    if (description.length > 0) {
      const entities: Record<string, unknown> = {
        description,
        amount: amountInfo.amount,
      };
      if (amountInfo.currency) entities.currency = amountInfo.currency;

      if (dateInfo) {
        entities.due_date = dateInfo.dateStr;
        entities.due_date_text = dateInfo.matchedText;
      } else {
        const todayDate = baseDate.toISOString().slice(0, 10);
        entities.due_date = todayDate;
        entities.due_date_text = 'today';
      }

      const missing = computeMissingEntities('expense_logged', entities);
      return {
        sequence,
        intent: 'expense_logged',
        confidence: missing.length === 0 ? 0.9 : 0.6,
        entities,
        missing,
        raw_segment: text,
      };
    }
  }

  return null;
}

function buildPlannedExpense(
  text: string,
  lower: string,
  baseDate: Date,
  sequence: number
): DetectedIntent {
  const amountInfo = extractAmount(text);
  const dateInfo = extractDate(text, baseDate);
  const billType = extractBillType(text);

  let description = text
    .replace(
      /^(i\s+)?(need\s+to\s+pay|plan\s+to\s+spend|planning\s+to|have\s+to\s+pay|will\s+(?:have\s+to\s+)?pay|must\s+pay|haven'?t\s+paid|didn'?t\s+pay|not\s+(?:yet\s+)?paid|yet\s+to\s+pay|schedule\s+a\s+payment\s+(?:of\s+)?|keep\s+.*?aside\s+(?:for\s+)?|set\s+.*?aside\s+(?:for\s+)?|i\s+owe\s+(?:my\s+friend\s+)?|owe\s+my\s+\w+\s+|might\s+spend|may\s+pay)\s+/i,
      ''
    )
    .trim();

  if (amountInfo) {
    description = description.replace(new RegExp(escapeRegExp(amountInfo.rawMatchedText), 'gi'), '').trim();
  }
  if (dateInfo) {
    description = description.replace(new RegExp(`\\b${dateInfo.matchedText}\\b`, 'gi'), '').trim();
  }

  // Remove trailing or leading noise
  description = description
    .replace(/\b(is\s+due|due|pending|still\s+due|yet)\b/gi, '')
    .replace(/^for\s+/i, '')
    .replace(/[\.,]$/, '')
    .trim();

  const entities: Record<string, unknown> = {};
  if (billType) {
    entities.bill_type = billType;
    entities.description = description || `${billType} bill`;
  } else if (/owe/i.test(lower)) {
    entities.description = description || 'debt / money owed';
  } else {
    entities.description = description || 'planned expense';
  }

  if (amountInfo) {
    entities.amount = amountInfo.amount;
    if (amountInfo.currency) entities.currency = amountInfo.currency;
  }

  if (dateInfo) {
    entities.due_date = dateInfo.dateStr;
    entities.due_date_text = dateInfo.matchedText;
  }

  const missing = computeMissingEntities('planned_expense', entities);
  const confidence = missing.length === 0 ? 0.9 : 0.6;

  return {
    sequence,
    intent: 'planned_expense',
    confidence,
    entities,
    missing,
    raw_segment: text,
  };
}

function extractBillType(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [kw, normalized] of Object.entries(BILL_KEYWORDS)) {
    if (new RegExp(`\\b${kw}\\b`, 'i').test(lower)) {
      return normalized;
    }
  }
  return null;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
