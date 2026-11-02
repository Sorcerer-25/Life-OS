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

  // "next week" → next Monday
  if (/\bnext\s+week\b/.test(lower)) {
    const d = new Date(baseDate);
    const currentDay = d.getDay();
    const daysUntilMonday = ((1 - currentDay + 7) % 7) || 7;
    d.setDate(d.getDate() + daysUntilMonday);
    return { dateStr: formatISODate(d), matchedText: 'next week' };
  }

  // "next month" → 1st of next month
  if (/\bnext\s+month\b/.test(lower)) {
    const d = new Date(baseDate);
    d.setMonth(d.getMonth() + 1, 1);
    return { dateStr: formatISODate(d), matchedText: 'next month' };
  }

  // "this weekend" → upcoming Saturday
  if (/\bthis\s+weekend\b/.test(lower) || /\bweekend\b/.test(lower)) {
    const d = new Date(baseDate);
    const currentDay = d.getDay();
    const daysUntilSat = (6 - currentDay + 7) % 7 || 7;
    d.setDate(d.getDate() + daysUntilSat);
    return { dateStr: formatISODate(d), matchedText: lower.includes('this weekend') ? 'this weekend' : 'weekend' };
  }

  // "in X hours/minutes" → resolve relative to now
  const inDurationMatch = lower.match(/\bin\s+(\w+)\s+(hour|hr|minute|min)s?\b/i);
  if (inDurationMatch) {
    const numWord = inDurationMatch[1];
    const unit = inDurationMatch[2].toLowerCase();
    const num = parseWordNumber(numWord);
    if (num !== null) {
      const d = new Date(baseDate);
      if (unit.startsWith('hour') || unit === 'hr') {
        d.setHours(d.getHours() + num);
      } else {
        d.setMinutes(d.getMinutes() + num);
      }
      return { dateStr: formatISODate(d), matchedText: inDurationMatch[0] };
    }
  }

  // "on the 15th", "by the 5th", "the 1st" — day-of-month reference
  const dayOfMonthMatch = lower.match(/\b(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)\b/);
  if (dayOfMonthMatch) {
    const day = parseInt(dayOfMonthMatch[1], 10);
    if (day >= 1 && day <= 31) {
      const d = new Date(baseDate);
      if (day <= d.getDate()) {
        // Already passed this month, assume next month
        d.setMonth(d.getMonth() + 1);
      }
      d.setDate(day);
      return { dateStr: formatISODate(d), matchedText: dayOfMonthMatch[0].trim() };
    }
  }

  // "December 5", "November 10", "January 15th" — Month + day
  const MONTH_NAMES: Record<string, number> = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  };
  const monthDayMatch = lower.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?\b/
  );
  if (monthDayMatch) {
    const month = MONTH_NAMES[monthDayMatch[1]];
    const day = parseInt(monthDayMatch[2], 10);
    if (month !== undefined && day >= 1 && day <= 31) {
      const d = new Date(baseDate);
      d.setMonth(month, day);
      // If the date is in the past, assume next year
      if (d < baseDate) {
        d.setFullYear(d.getFullYear() + 1);
      }
      return { dateStr: formatISODate(d), matchedText: monthDayMatch[0].trim() };
    }
  }

  // "5th December", "10 November" — Day + month
  const dayMonthMatch = lower.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/
  );
  if (dayMonthMatch) {
    const day = parseInt(dayMonthMatch[1], 10);
    const month = MONTH_NAMES[dayMonthMatch[2]];
    if (month !== undefined && day >= 1 && day <= 31) {
      const d = new Date(baseDate);
      d.setMonth(month, day);
      if (d < baseDate) {
        d.setFullYear(d.getFullYear() + 1);
      }
      return { dateStr: formatISODate(d), matchedText: dayMonthMatch[0].trim() };
    }
  }

  // Check explicit YYYY-MM-DD
  const explicitMatch = lower.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (explicitMatch) {
    return { dateStr: explicitMatch[0], matchedText: explicitMatch[0] };
  }

  return null;
}

/**
 * Converts number words (one, two, ..., twelve) and digit strings to numbers.
 */
function parseWordNumber(word: string): number | null {
  const map: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
    seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
    a: 1, an: 1,
  };
  const lower = word.toLowerCase();
  if (map[lower] !== undefined) return map[lower];
  const num = parseInt(lower, 10);
  return isNaN(num) ? null : num;
}

