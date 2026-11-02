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
    /\b(remind|reminder|remainder|alert me|notify me|don't forget|don't let me forget|make sure\s+(?:that\s+)?i|ensure\s+i|ping me|nudge me|can you remind me)\b/i.test(
      lower
    );
  if (!hasReminderWord) return null;

  const dateInfo = extractDate(text, baseDate);
  const timeInfo = extractTime(text, baseDate);
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
      /^(please\s+)?(can\s+you\s+remind\s+me\s+to|can\s+you\s+remind\s+me|remind\s+me\s+to|remind\s+me\s+about|remind\s+me|add\s+(?:a\s+)?(?:reminder|remainder)\s+(?:named\s+|called\s+|to\s+|for\s+)?|create\s+(?:a\s+)?(?:reminder|remainder)\s+(?:named\s+|called\s+|to\s+|for\s+)?|reminder\s+to|set\s+a\s+reminder\s+for|set\s+reminder\s+to|set\s+(?:a\s+)?(?:reminder|remainder)\s+(?:named\s+|called\s+|to\s+|for\s+)?|(?:reminder|remainder)\s+(?:named\s+|called\s+)?|don'?t\s+let\s+me\s+forget\s+to|don'?t\s+forget\s+to|alert\s+me\s+to|ping\s+me\s+to|nudge\s+me\s+to|make\s+sure\s+(?:that\s+)?i\s+|ensure\s+i\s+)\s*/i,
      ''
    )
    .trim();

  if (dateInfo) {
    title = title.replace(new RegExp(`\\b${escapeRegExp(dateInfo.matchedText)}\\b`, 'gi'), '').trim();
  }
  if (timeInfo) {
    title = title.replace(new RegExp(`\\b(?:for|at|by)?\\s*${escapeRegExp(timeInfo.matchedText)}\\b`, 'gi'), '').trim();
  }

  const recurrenceMatch = text.match(
    /\b(every\s+(?:morning|evening|afternoon|day|week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|daily|weekly|monthly)\b/i
  );
  if (recurrenceMatch) {
    title = title.replace(new RegExp(`\\b${escapeRegExp(recurrenceMatch[0])}\\b`, 'gi'), '').trim();
  }

  title = title
    .replace(/^named\s+/i, '')
    .replace(/^called\s+/i, '')
    .replace(/^about\s+/i, '')
    .replace(/^for\s+/i, '')
    .replace(/[\.,]$/, '')
    .trim();

  const entities: Record<string, unknown> = {
    title: title || 'Reminder',
  };

  if (dateInfo) {
    entities.due_date = dateInfo.dateStr;
    entities.due_date_text = dateInfo.matchedText;
  } else if (/\bin\s+\w+\s+(hour|minute)/i.test(lower)) {
    const todayStr = baseDate.toISOString().slice(0, 10);
    entities.due_date = todayStr;
    entities.due_date_text = 'today';
  } else if (recurrenceMatch) {
    const todayStr = baseDate.toISOString().slice(0, 10);
    entities.due_date = todayStr;
    entities.due_date_text = recurrenceMatch[0];
  }

  if (timeInfo) {
    entities.start_time = timeInfo.timeStr;
    entities.time_text = timeInfo.matchedText;
  }

  if (recurrenceMatch) {
    entities.recurrence = recurrenceMatch[0].toLowerCase();
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
