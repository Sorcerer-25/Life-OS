/**
 * Date and time resolution utilities for LifeOS intent identification.
 * Resolves relative dates deterministically without guessing or inventing dates.
 */

const DAYS_OF_WEEK = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export function getTodayDate(baseDate: Date = new Date()): string {
  const year = baseDate.getFullYear();
  const month = String(baseDate.getMonth() + 1).padStart(2, '0');
  const day = String(baseDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Resolves relative dates (today, tomorrow, yesterday, next Friday, etc.)
 */
export function resolveRelativeDate(
  text: string,
  baseDate: Date = new Date()
): { dateStr: string; matchedText: string } | null {
  const lower = text.toLowerCase();

  // Match "today"
  if (/\btoday\b/.test(lower)) {
    return { dateStr: getTodayDate(baseDate), matchedText: 'today' };
  }

  // Match "tomorrow"
  if (/\btomorrow\b/.test(lower)) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + 1);
    return { dateStr: formatISODate(d), matchedText: 'tomorrow' };
  }

  // Match "yesterday"
  if (/\byesterday\b/.test(lower)) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - 1);
    return { dateStr: formatISODate(d), matchedText: 'yesterday' };
  }

  // Match "next <day>" or "this <day>" or just "<day>"
  const dayMatch = lower.match(/\b(next|this)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
  if (dayMatch) {
    const isNext = dayMatch[1]?.toLowerCase() === 'next';
    const targetDayName = dayMatch[2].toLowerCase();
    const targetDayIndex = DAYS_OF_WEEK.indexOf(targetDayName);

    if (targetDayIndex !== -1) {
      const currentDayIndex = baseDate.getDay();
      let diff = targetDayIndex - currentDayIndex;

      if (isNext) {
        // "next Friday" when today is Tuesday (diff=3): next week's Friday (3 + 7 = 10 days) or upcoming Friday if not yet passed?
        // Standard convention: if diff <= 0, diff += 7. If "next" is explicitly said and diff > 0, it usually means the upcoming Friday (or 7 + diff).
        // Let's standardly treat "next Friday" as the upcoming Friday (or next week if diff <= 0).
        if (diff <= 0) {
          diff += 7;
        }
      } else {
        // "Friday" or "this Friday"
        if (diff <= 0) {
          diff += 7;
        }
      }

      const resolved = new Date(baseDate);
      resolved.setDate(resolved.getDate() + diff);
      return { dateStr: formatISODate(resolved), matchedText: dayMatch[0] };
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
 * Extracts time of day like "3 PM", "3:30 pm", "15:00", etc.
 */
export function extractTime(text: string): { timeStr: string; matchedText: string } | null {
  // Matches "3 PM", "3:30 PM", "11:45 am"
  const ampmMatch = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const meridian = ampmMatch[3].toLowerCase();

    if (meridian === 'pm' && hours < 12) {
      hours += 12;
    } else if (meridian === 'am' && hours === 12) {
      hours = 0;
    }

    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    return { timeStr: `${hh}:${mm}:00`, matchedText: ampmMatch[0] };
  }

  // Matches 24-hour "15:00"
  const h24Match = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b/);
  if (h24Match) {
    const hh = String(parseInt(h24Match[1], 10)).padStart(2, '0');
    const mm = h24Match[2];
    const ss = h24Match[3] || '00';
    return { timeStr: `${hh}:${mm}:${ss}`, matchedText: h24Match[0] };
  }

  return null;
}

