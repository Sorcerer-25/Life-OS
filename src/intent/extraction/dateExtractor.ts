import { formatISODate, getTodayDate } from '../dateUtils';

const DAYS_OF_WEEK = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export interface ExtractedDate {
  dateStr: string; // YYYY-MM-DD
  matchedText: string; // e.g. "tomorrow", "Friday", "next Friday"
}

/**
 * Resolves relative and absolute dates anchored to baseDate.
 */
export function extractDate(text: string, baseDate: Date = new Date()): ExtractedDate | null {
  const lower = text.toLowerCase();

  // "today"
  if (/\btoday\b/.test(lower)) {
    return { dateStr: getTodayDate(baseDate), matchedText: 'today' };
  }

  // "tomorrow"
  if (/\btomorrow\b/.test(lower)) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + 1);
    return { dateStr: formatISODate(d), matchedText: 'tomorrow' };
  }

  // "yesterday"
  if (/\byesterday\b/.test(lower)) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - 1);
    return { dateStr: formatISODate(d), matchedText: 'yesterday' };
  }

  // "next <day>", "this <day>", "on <day>", or bare "<day>"
  const dayMatch = lower.match(
    /\b(?:on|by|this|next)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i
  );
  if (dayMatch) {
    const targetDayName = dayMatch[1].toLowerCase();
    const targetDayIndex = DAYS_OF_WEEK.indexOf(targetDayName);

    if (targetDayIndex !== -1) {
      const currentDayIndex = baseDate.getDay();
      let diff = targetDayIndex - currentDayIndex;

      // If diff <= 0, it means that day in the upcoming week
      if (diff <= 0) {
        diff += 7;
      }

      const isExplicitNext = /\bnext\s+/i.test(dayMatch[0]);
      if (isExplicitNext && targetDayIndex > currentDayIndex) {
        diff += 7;
      }

      const resolved = new Date(baseDate);
      resolved.setDate(resolved.getDate() + diff);
      return { dateStr: formatISODate(resolved), matchedText: dayMatch[0].trim() };
    }
  }

  // Check explicit YYYY-MM-DD
  const explicitMatch = lower.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (explicitMatch) {
    return { dateStr: explicitMatch[0], matchedText: explicitMatch[0] };
  }

  return null;
}

