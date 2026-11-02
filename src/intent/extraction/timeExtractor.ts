export interface ExtractedTime {
  timeStr: string; // HH:mm:ss
  matchedText: string; // e.g. "10 AM", "3 PM", "by 5 PM"
  endTimeStr?: string; // e.g. "11:00:00" for "from 10 to 11 AM"
}

/**
 * Extracts time of day from text and normalizes to HH:mm:ss.
 */
export function extractTime(text: string, baseDate: Date = new Date()): ExtractedTime | null {
  // 1. Time range: "from 10 to 11 AM", "from 10:00 to 11:30 am", "10 to 11 AM", "from 10.00 to 11.30 am"
  const rangeMatch = text.match(
    /\b(?:from\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*(?:to|-)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/i
  );
  if (rangeMatch) {
    let startH = parseInt(rangeMatch[1], 10);
    const startM = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : 0;
    const startMeridian = (rangeMatch[3] || rangeMatch[7])?.toLowerCase();

    let endH = parseInt(rangeMatch[4], 10);
    const endM = rangeMatch[5] ? parseInt(rangeMatch[5], 10) : 0;
    const endMeridian = rangeMatch[6].toLowerCase();

    if (startH >= 1 && startH <= 12 && endH >= 1 && endH <= 12) {
      if (startMeridian === 'pm' && startH < 12) startH += 12;
      if (startMeridian === 'am' && startH === 12) startH = 0;
      if (endMeridian === 'pm' && endH < 12) endH += 12;
      if (endMeridian === 'am' && endH === 12) endH = 0;

      // If start had no meridian, infer from end
      if (!rangeMatch[3] && endMeridian === 'pm') {
        if (startH < 12 && startH < endH - 12) {
          startH += 12;
        }
      }

      const startStr = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}:00`;
      const endStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`;
      return {
        timeStr: startStr,
        endTimeStr: endStr,
        matchedText: rangeMatch[0].trim(),
      };
    }
  }

  // 2. Matches "at 10 AM", "by 5 PM", "3:30 pm", "12.54 pm", "11:45 am", "10am", "5pm", "for 12.54 pm"
  const ampmMatch = text.match(/\b(?:at|by|for)?\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const meridian = ampmMatch[3].toLowerCase();

    if (hours >= 1 && hours <= 12 && minutes >= 0 && minutes <= 59) {
      if (meridian === 'pm' && hours < 12) {
        hours += 12;
      } else if (meridian === 'am' && hours === 12) {
        hours = 0;
      }

      const hh = String(hours).padStart(2, '0');
      const mm = String(minutes).padStart(2, '0');
      const cleanText = ampmMatch[0].replace(/^(?:at|by|for)\s+/i, '').trim();
      return { timeStr: `${hh}:${mm}:00`, matchedText: cleanText };
    }
  }

  // 3. Matches 24-hour time "15:00", "09:30", "15.00"
  const h24Match = text.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)(?:[:.]([0-5]\d))?\b/);
  if (h24Match) {
    const hh = String(parseInt(h24Match[1], 10)).padStart(2, '0');
    const mm = h24Match[2];
    const ss = h24Match[3] || '00';
    return { timeStr: `${hh}:${mm}:${ss}`, matchedText: h24Match[0].trim() };
  }

  // 4. "in two hours", "in 2 hours", "in 30 minutes"
  const inHoursMatch = text.match(/\bin\s+(\w+)\s+(hour|hr|minute|min)s?\b/i);
  if (inHoursMatch) {
    const num = parseWordNumber(inHoursMatch[1]);
    if (num !== null) {
      const d = new Date(baseDate);
      if (inHoursMatch[2].toLowerCase().startsWith('hour') || inHoursMatch[2].toLowerCase() === 'hr') {
        d.setHours(d.getHours() + num);
      } else {
        d.setMinutes(d.getMinutes() + num);
      }
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return { timeStr: `${hh}:${mm}:00`, matchedText: inHoursMatch[0] };
    }
  }

  // 5. "at 5" (bare hour with "at" or "by")
  const bareAtMatch = text.match(/\b(?:at|by)\s+(\d{1,2})\b/i);
  if (bareAtMatch) {
    let hours = parseInt(bareAtMatch[1], 10);
    // Typical business hour assumption if <= 6: assume evening (e.g. at 5 -> 17:00)
    if (hours >= 1 && hours <= 6) {
      hours += 12;
    }
    const hh = String(hours).padStart(2, '0');
    return { timeStr: `${hh}:00:00`, matchedText: bareAtMatch[0] };
  }

  // 6. Named times of day: "afternoon", "morning", "evening", "night"
  if (/\bafternoon\b/i.test(text)) {
    return { timeStr: '14:00:00', matchedText: 'afternoon' };
  }
  if (/\bmorning\b/i.test(text)) {
    return { timeStr: '09:00:00', matchedText: 'morning' };
  }
  if (/\bevening\b/i.test(text)) {
    return { timeStr: '18:00:00', matchedText: 'evening' };
  }

  return null;
}

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
