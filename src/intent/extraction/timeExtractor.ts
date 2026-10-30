export interface ExtractedTime {
  timeStr: string; // HH:mm:ss
  matchedText: string; // e.g. "10 AM", "3 PM", "by 5 PM"
}

/**
 * Extracts time of day from text and normalizes to HH:mm:ss.
 */
export function extractTime(text: string): ExtractedTime | null {
  // Matches "at 10 AM", "by 5 PM", "3:30 pm", "11:45 am", "10am", "5pm"
  const ampmMatch = text.match(/\b(?:at|by)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
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
    const cleanText = ampmMatch[0].replace(/^(?:at|by)\s+/i, '').trim();
    return { timeStr: `${hh}:${mm}:00`, matchedText: cleanText };
  }

  // Matches 24-hour time "15:00", "09:30"
  const h24Match = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b/);
  if (h24Match) {
    const hh = String(parseInt(h24Match[1], 10)).padStart(2, '0');
    const mm = h24Match[2];
    const ss = h24Match[3] || '00';
    return { timeStr: `${hh}:${mm}:${ss}`, matchedText: h24Match[0].trim() };
  }

  return null;
}
