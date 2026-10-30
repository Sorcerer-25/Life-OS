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
