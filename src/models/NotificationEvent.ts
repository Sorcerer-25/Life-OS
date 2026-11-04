import { ActionPlan } from './ActionPlan';
import { IntentAnalysis } from './IntentAnalysis';

export interface NotificationEvent {
  notification_id: string;
  source_app: string; // Android package name (e.g. com.google.android.calendar)
  app_label: string;  // Human-readable app name (e.g. Google Calendar)
  title: string;
  text: string;
  posted_at: string;  // ISO 8601 timestamp
  category?: string;  // Android notification category e.g. 'msg', 'promo', 'alarm'
  is_ongoing?: boolean;
  is_group_summary?: boolean;
  is_media?: boolean;
}

export type NotificationInboxStatus =
  | 'new'
  | 'analysed'
  | 'actioned'
  | 'dismissed'
  | 'failed';

export interface NotificationInboxItem {
  id: string; // Unique inbox item ID e.g. notif_item_xxx
  notification_id: string;
  source_app: string;
  app_label: string;
  title: string;
  text: string; // Sanitized / masked text
  posted_at: string;
  category?: string;
  status: NotificationInboxStatus;
  linked_request_id: string; // Fixed request_id associated with this notification
  dedup_key: string;
  analysis?: IntentAnalysis | null;
  action_plan?: ActionPlan | null;
  execution_result?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  last_error?: string | null;
}

