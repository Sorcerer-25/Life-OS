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

  // 2. Planned Expense: "I need to pay ₹1200 tomorrow", "plan to spend", "have to pay", "will pay"
  if (
    /\b(need\s+to\s+pay|plan\s+to\s+spend|planning\s+to|have\s+to\s+pay|will\s+pay|must\s+pay)\b/.test(
      lower
    )
  ) {
    const amountInfo = extractAmount(text);
    const dateInfo = extractDate(text, baseDate);
    const billType = extractBillType(text);

    let description = text
      .replace(
        /^(i\s+)?(need\s+to\s+pay|plan\s+to\s+spend|planning\s+to|have\s+to\s+pay|will\s+pay|must\s+pay)\s+(?:for\s+)?/i,
        ''
      )
      .trim();

    if (amountInfo) {
      description = description.replace(new RegExp(escapeRegExp(amountInfo.rawMatchedText), 'gi'), '').trim();
    }
    if (dateInfo) {
      description = description.replace(new RegExp(`\\b${dateInfo.matchedText}\\b`, 'gi'), '').trim();
    }

    description = description.replace(/^for\s+/i, '').replace(/[\.,]$/, '').trim();

    const entities: Record<string, unknown> = {};
    if (billType) {
      entities.bill_type = billType;
      entities.description = description || `${billType} bill`;
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

  // 3. Completed Expense: "I paid ₹500 for groceries", "I spent ₹200 on lunch", "received a refund of ₹500"
  if (
    /\b(spent|paid|bought|purchased|refund|received\s+a\s+refund|cost\s+me)\b/.test(lower)
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

  return null;
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
