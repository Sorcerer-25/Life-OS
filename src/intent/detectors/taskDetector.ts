import { computeMissingEntities } from '../../models/canonicalEntities';
import { DetectedIntent } from '../../models/IntentAnalysis';
import { extractDate } from '../extraction/dateExtractor';
import { extractTime } from '../extraction/timeExtractor';

export function detectTaskIntent(
  text: string,
  sequence: number,
  baseDate: Date
): DetectedIntent | null {
  const lower = text.toLowerCase();

  const isTaskMatch =
    /\b(add\s+(?:a\s+)?task|create\s+(?:a\s+)?task|new\s+task|todo|to-do|task:)\b/.test(lower) ||
    /\b(need\s+to\s+send|send\s+.*?\s+the\s+project\s+report|submit\s+my\s+assignment|clean\s+my\s+room|buy\s+groceries|finish\s+homework|wash\s+clothes)\b/.test(
      lower
    ) ||
    /^(?:need\s+to|have\s+to)\s+(?:send|submit|finish|complete|write|prepare|clean)\b/i.test(text);

  if (!isTaskMatch) return null;

  const dateInfo = extractDate(text, baseDate);
  const timeInfo = extractTime(text);

  let taskTitle = text
    .replace(
      /^(please\s+)?(add\s+(?:a\s+)?task\s+to|add\s+(?:a\s+)?task|create\s+(?:a\s+)?task\s+to|create\s+(?:a\s+)?task|todo:?|to-do:?|task:?|need\s+to\s+|have\s+to\s+)\s+/i,
      ''
    )
    .trim();

  if (dateInfo) {
    taskTitle = taskTitle.replace(new RegExp(`\\b${escapeRegExp(dateInfo.matchedText)}\\b`, 'gi'), '').trim();
  }
  if (timeInfo) {
    taskTitle = taskTitle.replace(new RegExp(`\\b(?:by|at)?\\s*${escapeRegExp(timeInfo.matchedText)}\\b`, 'gi'), '').trim();
  }

  taskTitle = taskTitle.replace(/[\.,]$/, '').trim();

  const entities: Record<string, unknown> = {
    title: taskTitle || text,
  };

  if (dateInfo) {
    entities.due_date = dateInfo.dateStr;
    entities.due_date_text = dateInfo.matchedText;
  }

  if (timeInfo) {
    entities.start_time = timeInfo.timeStr;
    entities.time_text = timeInfo.matchedText;
  }

  // Extract recipient (e.g. "send Rahul the project report" -> recipient: "Rahul")
  const recipientMatch = text.match(/\b(?:send|tell|give|deliver\s+to|email)\s+([A-Z][a-z]+)\b/);
  if (recipientMatch) {
    entities.recipient = recipientMatch[1];
  }

  const missing = computeMissingEntities('add_task', entities);

  return {
    sequence,
    intent: 'add_task',
    confidence: 0.9,
    entities,
    missing,
    raw_segment: text,
  };
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
