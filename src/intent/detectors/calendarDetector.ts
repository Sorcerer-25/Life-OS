import { computeMissingEntities } from '../../models/canonicalEntities';
import { DetectedIntent } from '../../models/IntentAnalysis';
import { extractDate } from '../extraction/dateExtractor';
import { extractTime } from '../extraction/timeExtractor';

export function detectCalendarIntent(
  text: string,
  sequence: number,
  baseDate: Date
): DetectedIntent | null {
  const lower = text.toLowerCase();

  // Safety: "Schedule a payment of ₹1500 for tomorrow" is a financial payment, NOT a calendar meeting
  if (
    /\b(schedule\s+a\s+payment|payment\s+of|pay\s+.*?\s+bill)\b/i.test(lower) &&
    !/\b(meeting|appointment|call|event|review|sync)\b/i.test(lower)
  ) {
    return null;
  }

  const hasCalendarWord = /\b(schedule|meeting|appointment|review|calendar|call with|call at|sync with|event|exam|interview|block\s+(?:my\s+)?calendar)\b/i.test(
    lower
  );
  if (!hasCalendarWord) return null;

  const dateInfo = extractDate(text, baseDate);
  const timeInfo = extractTime(text, baseDate);

  let title = text
    .replace(
      /^(please\s+)?(schedule\s+(?:a|an)?|create\s+an?\s+event\s+for|add\s+(?:my\s+)?|set\s+up\s+(?:a\s+)?meeting\s+for|book\s+a\s+slot\s+for|block\s+(?:my\s+)?calendar\s+for)\s+/i,
      ''
    )
    .trim();

  if (dateInfo) {
    title = title.replace(new RegExp(`\\b${escapeRegExp(dateInfo.matchedText)}\\b`, 'gi'), '').trim();
  }
  if (timeInfo) {
    title = title.replace(new RegExp(`\\b(?:at|by)?\\s*${escapeRegExp(timeInfo.matchedText)}\\b`, 'gi'), '').trim();
  }

  title = title
    .replace(/^for\s+(?:my\s+)?/i, '')
    .replace(/^(my\s+)/i, '')
    .replace(/[\\.,]$/, '')
    .trim();

  const entities: Record<string, unknown> = {
    title: title || 'Meeting',
  };

  if (dateInfo) {
    entities.due_date = dateInfo.dateStr;
    entities.due_date_text = dateInfo.matchedText;
  } else if (timeInfo && (/\btoday\b/i.test(lower) || /\bin\s+\w+\s+(hour|minute)/i.test(lower))) {
    const todayStr = baseDate.toISOString().slice(0, 10);
    entities.due_date = todayStr;
    entities.due_date_text = 'today';
  }

  if (timeInfo) {
    entities.start_time = timeInfo.timeStr;
    entities.time_text = timeInfo.matchedText;
    if (timeInfo.endTimeStr) {
      entities.end_time = timeInfo.endTimeStr;
    }
  }

  const durationMatch = text.match(/\b(\d+)\s*(hour|hr|minute|min)s?\b/i);
  if (durationMatch) {
    entities.duration = `${durationMatch[1]} ${durationMatch[2]}`;
  }

  const missing = computeMissingEntities('schedule_event', entities);
  const isComplete = missing.length === 0;
  const confidence = isComplete ? 0.9 : 0.55;

  return {
    sequence,
    intent: 'schedule_event',
    confidence,
    entities,
    missing,
    raw_segment: text,
  };
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

