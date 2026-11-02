import { UnsupportedComponent } from '../../models/IntentAnalysis';

interface UnsupportedPattern {
  capability: string;
  regex: RegExp;
  reason: string;
}

const UNSUPPORTED_PATTERNS: UnsupportedPattern[] = [
  {
    capability: 'flight_search_or_booking',
    regex: /\b(flight|flights|airline|airfare|plane\s+tickets?)\b/i,
    reason:
      'Flight search and travel booking are external integrations not supported in LifeOS Phase 1.',
  },
  {
    capability: 'hotel_reservation',
    regex: /\b(book\s+a\s+hotel|hotel\s+room|resort\s+booking|airbnb)\b/i,
    reason:
      'Hotel and lodging reservation is an external service not supported in LifeOS Phase 1.',
  },
  {
    capability: 'food_delivery',
    regex: /\b(order\s+(?:a\s+)?(?:pizza|food|burger|meal|biryani)|dominos|zomato|swiggy|ubereats)\b/i,
    reason:
      'Online food ordering is an external commercial integration not supported in LifeOS Phase 1.',
  },
  {
    capability: 'ride_hailing',
    regex: /\b(book\s+(?:an?\s+)?uber|book\s+(?:an?\s+)?ola|call\s+(?:an?\s+)?cab|taxi\s+booking)\b/i,
    reason:
      'Ride hailing and taxi dispatch are not supported in LifeOS Phase 1.',
  },
  {
    capability: 'weather_forecast',
    regex: /\b(weather|temperature\s+outside|is\s+it\s+raining)\b/i,
    reason:
      'Live weather queries are external third-party APIs not supported in LifeOS Phase 1.',
  },
  {
    capability: 'language_translation',
    regex: /\b(translate\s+.*?\s+to\s+[a-z]+|how\s+do\s+you\s+say\s+.*?\s+in\s+[a-z]+)\b/i,
    reason:
      'Language translation services are not supported in LifeOS Phase 1.',
  },
  {
    capability: 'money_transfer',
    regex: /\b(send\s+.*?\s+(?:through|via)?\s*upi|transfer\s+money|send\s+money|pay\s+\w+\s+via\s+upi)\b/i,
    reason:
      'Direct peer-to-peer money transfers via UPI are not supported in LifeOS Phase 1.',
  },
  {
    capability: 'web_search',
    regex: /\b(search\s+the\s+internet|google\s+search|browse\s+the\s+web|look\s+up\s+online)\b/i,
    reason:
      'General web browsing and search are not supported in LifeOS Phase 1.',
  },
  {
    capability: 'document_processing',
    regex: /\b(read\s+this\s+pdf|summarize\s+(?:this\s+)?pdf|parse\s+document)\b/i,
    reason:
      'Document and PDF parsing or summarization is not supported in LifeOS Phase 1.',
  },
  {
    capability: 'live_location_tracking',
    regex: /\b(track\s+(?:my\s+)?(?:live\s+)?location|share\s+my\s+location|where\s+am\s+i)\b/i,
    reason:
      'Live GPS location tracking is not supported in LifeOS Phase 1.',
  },
  {
    capability: 'online_shopping',
    regex: /\b(buy\s+(?:a\s+)?(?:laptop|phone|tv|item|shoes|clothes)|purchase\s+online)\b/i,
    reason:
      'Online e-commerce purchasing is not supported in LifeOS Phase 1.',
  },
  {
    capability: 'calendar_modification',
    regex: /\b(move\s+(?:my\s+)?meeting|reschedule\s+(?:my\s+)?meeting|postpone\s+meeting|change\s+meeting\s+time)\b/i,
    reason:
      'Modifying or rescheduling existing calendar events is not yet supported in LifeOS Phase 1.',
  },
  {
    capability: 'reminder_cancellation',
    regex: /\b(don'?t\s+remind\s+me\s+about\s+.*?\s+anymore|cancel\s+(?:my\s+)?reminder|delete\s+reminder|stop\s+reminding\s+me)\b/i,
    reason:
      'Canceling or modifying existing reminders is not yet supported in LifeOS Phase 1.',
  },
];

/**
 * Detects if a text segment is requesting an unsupported capability.
 */
export function detectUnsupportedCapability(text: string): UnsupportedComponent | null {
  for (const pattern of UNSUPPORTED_PATTERNS) {
    if (pattern.regex.test(text)) {
      return {
        raw_text: text,
        capability: pattern.capability,
        reason: pattern.reason,
      };
    }
  }
  return null;
}
