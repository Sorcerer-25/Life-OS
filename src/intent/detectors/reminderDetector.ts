import { computeMissingEntities } from '../../models/canonicalEntities';
import { DetectedIntent } from '../../models/IntentAnalysis';
import { extractAmount } from '../extraction/amountExtractor';
import { extractDate } from '../extraction/dateExtractor';
import { extractTime } from '../extraction/timeExtractor';

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

export function detectReminderIntent(
  text: string,
  sequence: number,
  baseDate: Date
): DetectedIntent | null {
  const lower = text.toLowerCase();

  const hasReminderWord =
    /\b(remind|reminder|alert me|notify me|don't forget|make sure\s+(?:that\s+)?i|ensure\s+i)\b/.test(
      lower
    );
  if (!hasReminderWord) return null;

  const dateInfo = extractDate(text, baseDate);
  const timeInfo = extractTime(text);
  const amountInfo = extractAmount(text);
  const billType = extractBillType(text);

  // Check if it's a bill payment reminder
  const hasBillWord =
    /\b(bill|recharge|rent|dth)\b/.test(lower) ||
    /\b(water|electricity|power|gas|internet|wifi|phone|mobile)\s+bill\b/.test(lower);
  const hasPayWord = /\b(pay|payment|due)\b/.test(lower);

  if (hasBillWord || (hasPayWord && billType)) {
    const entities: Record<string, unknown> = {};
    if (billType) {
      entities.bill_type = billType;
      entities.title = `Pay ${billType} bill`;
    } else {
      entities.title = 'Pay bill';
    }

    if (amountInfo) {
      entities.amount = amountInfo.amount;
      if (amountInfo.currency) entities.currency = amountInfo.currency;
    }

    if (dateInfo) {
      entities.due_date = dateInfo.dateStr;
      entities.due_date_text = dateInfo.matchedText;
    }

    if (timeInfo) {
      entities.start_time = timeInfo.timeStr;
      entities.time_text = timeInfo.matchedText;
    }

    const missing = computeMissingEntities('bill_payment_reminder', entities);
    const confidence = missing.length === 0 ? 0.92 : 0.5;

    return {
      sequence,
      intent: 'bill_payment_reminder',
      confidence,
      entities,
      missing,
      raw_segment: text,
    };
  }

  // General Reminder (set_reminder)
  let title = text
    .replace(
      /^(please\s+)?(remind\s+me\s+to|remind\s+me\s+about|remind\s+me|reminder\s+to|set\s+a\s+reminder\s+for|set\s+reminder\s+to)\s+/i,
      ''
    )
    .trim();

  if (dateInfo) {
    title = title.replace(new RegExp(`\\b${escapeRegExp(dateInfo.matchedText)}\\b`, 'gi'), '').trim();
  }
  if (timeInfo) {
    title = title.replace(new RegExp(`\\b(?:at\\s+|by\\s+)?${escapeRegExp(timeInfo.matchedText)}\\b`, 'gi'), '').trim();
  }

  title = title.replace(/^about\s+/i, '').replace(/[\.,]$/, '').trim();

  const entities: Record<string, unknown> = {
    title: title || 'Reminder',
  };

  if (dateInfo) {
    entities.due_date = dateInfo.dateStr;
    entities.due_date_text = dateInfo.matchedText;
  }

  if (timeInfo) {
    entities.start_time = timeInfo.timeStr;
    entities.time_text = timeInfo.matchedText;
  }

  // Extract recipient if mentioned ("remind me to call Rahul")
  const personMatch = text.match(/\b(?:call|tell|meet|message|contact)\s+([A-Z][a-z]+)\b/);
  if (personMatch) {
    entities.recipient = personMatch[1];
  }

  const missing = computeMissingEntities('set_reminder', entities);
  const isComplete = missing.length === 0;
  // If date is missing (e.g. "Remind me about the payment"), confidence is lower but recognized as reminder!
  const confidence = isComplete ? 0.9 : 0.55;

  return {
    sequence,
    intent: 'set_reminder',
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
