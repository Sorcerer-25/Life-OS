import { ActionItem, ActionPlan, AgentName, IntentType } from '../models/ActionPlan';
import { InputEvent } from '../models/InputEvent';
import { extractTime, getTodayDate, resolveRelativeDate } from './dateUtils';
import { IdentificationResult, IntentIdentifier } from './identifier';
import { validateActionPlan } from './schemaValidator';

interface ParsedAmount {
  amount: number;
  currency: string;
  matchedText: string;
}

const BILL_KEYWORDS: Record<string, string> = {
  electricity: 'electricity',
  power: 'electricity',
  water: 'water',
  internet: 'internet',
  wifi: 'internet',
  broadband: 'internet',
  gas: 'gas',
  rent: 'rent',
  recharge: 'recharge',
  mobile: 'mobile',
  phone: 'mobile',
  credit: 'credit_card',
  card: 'credit_card',
  insurance: 'insurance',
  subscription: 'subscription',
};

export class RuleBasedIdentifier implements IntentIdentifier {
  private baseDate?: Date;

  constructor(baseDate?: Date) {
    this.baseDate = baseDate;
  }

  public async identify(input: InputEvent): Promise<IdentificationResult> {
    const text = input.rawText.trim();
    const now = this.baseDate || new Date(input.timestamp || Date.now());

    const plan = this.buildPlanFromRules(input, text, now);
    const validation = validateActionPlan(plan);

    if (!validation.success || !validation.data) {
      // Fallback safe ActionPlan if validation ever fails
      const fallbackPlan: ActionPlan = {
        request_id: input.requestId,
        source: {
          type: input.sourceType,
          raw_input: input.rawText,
          source_app: input.sourceApp ?? null,
          timestamp: input.timestamp,
        },
        intent: 'unknown',
        confidence: 0.1,
        entities: {},
        missing_fields: ['intent_clarification'],
        required_agents: [],
        actions: [],
        requires_confirmation: false,
        execution_mode: 'pending',
      };
      return {
        plan: fallbackPlan,
        method: 'rule_based',
        warning: `Schema validation error in rule engine: ${validation.errors?.join(', ')}`,
      };
    }

    return {
      plan: validation.data,
      method: 'rule_based',
    };
  }

  private buildPlanFromRules(input: InputEvent, text: string, now: Date): ActionPlan {
    const lower = text.toLowerCase();

    // 1. PENDING PAYMENT SAFETY CHECK
    // "A notification saying a payment is pending must never become a completed expense."
    if (/\bpending\b/.test(lower) && (/\bpayment\b/.test(lower) || /\btransaction\b/.test(lower) || /\btransfer\b/.test(lower))) {
      const parsedAmount = this.extractAmount(text);
      const entities: Record<string, unknown> = {
        status: 'pending',
      };
      if (parsedAmount) {
        entities.amount = parsedAmount.amount;
        entities.currency = parsedAmount.currency;
      }

      return {
        request_id: input.requestId,
        source: {
          type: input.sourceType,
          raw_input: input.rawText,
          source_app: input.sourceApp ?? null,
          timestamp: input.timestamp,
        },
        intent: 'planned_expense', // Classified as planned, never completed expense
        confidence: 0.45,
        entities,
        missing_fields: ['action_clarification', 'payee_or_source'],
        required_agents: ['finance_agent'],
        actions: [], // Do not dispatch completed transaction actions
        requires_confirmation: true,
        execution_mode: 'pending',
      };
    }

    // 2. BILL PAYMENT REMINDER (Multi-agent: reminder_agent + finance_agent)
    // Check for "remind" + ("bill" or bill keywords) OR "need to pay ... bill" with reminder words
    const hasReminderWord = /\b(remind|reminder|alert me|notify me|don't forget)\b/.test(lower);
    const hasBillWord = /\b(bill|electricity|water|internet|wifi|gas|rent|recharge|dth)\b/.test(lower);
    const hasPayWord = /\b(pay|payment|due)\b/.test(lower);

    if (hasReminderWord && (hasBillWord || (hasPayWord && /\bfor\b/.test(lower)))) {
      const parsedAmount = this.extractAmount(text);
      const relativeDate = resolveRelativeDate(text, now);
      const billType = this.extractBillType(text);
      const missingFields: string[] = [];

      const entities: Record<string, unknown> = {};
      if (billType) {
        entities.bill_type = billType;
      } else {
        missingFields.push('bill_type');
      }

      if (parsedAmount) {
        entities.amount = parsedAmount.amount;
        entities.currency = parsedAmount.currency;
      } else {
        missingFields.push('amount');
      }

      if (relativeDate) {
        entities.due_date = relativeDate.dateStr;
      } else {
        // "Remind me about the bill" -> do not invent due date
        missingFields.push('due_date');
      }

      const isComplete = missingFields.length === 0;
      const confidence = isComplete ? 0.9 : missingFields.length === 1 ? 0.6 : 0.4;

      const actions: ActionItem[] = [];
      const requiredAgents: AgentName[] = ['reminder_agent', 'finance_agent'];

      if (entities.due_date || billType) {
        actions.push({
          action_id: 'act_001',
          agent: 'reminder_agent',
          operation: 'create_reminder',
          depends_on: [],
          data: {
            title: `Pay ${billType || 'bill'}`,
            due_date: entities.due_date,
            amount: entities.amount,
            currency: entities.currency,
          },
        });
      }

      if (entities.amount !== undefined || billType) {
        actions.push({
          action_id: 'act_002',
          agent: 'finance_agent',
          operation: 'create_planned_expense', // Planned expense, NOT completed expense!
          depends_on: actions.length > 0 ? ['act_001'] : [],
          data: {
            category: 'bill',
            bill_type: billType,
            amount: entities.amount,
            currency: entities.currency,
            due_date: entities.due_date,
          },
        });
      }

      return {
        request_id: input.requestId,
        source: {
          type: input.sourceType,
          raw_input: input.rawText,
          source_app: input.sourceApp ?? null,
          timestamp: input.timestamp,
        },
        intent: 'bill_payment_reminder',
        confidence,
        entities,
        missing_fields: missingFields,
        required_agents: requiredAgents,
        actions,
        requires_confirmation: !isComplete,
        execution_mode: 'pending',
      };
    }

    // 3. GENERAL REMINDER (set_reminder)
    if (hasReminderWord) {
      const relativeDate = resolveRelativeDate(text, now);
      const timeInfo = extractTime(text);
      const missingFields: string[] = [];

      let title = text
        .replace(/^(please\s+)?(remind\s+me\s+to|remind\s+me\s+about|remind\s+me|reminder\s+to|set\s+a\s+reminder\s+for|set\s+reminder\s+to)\s+/i, '')
        .trim();

      if (relativeDate) {
        title = title.replace(new RegExp(`\\b${relativeDate.matchedText}\\b`, 'gi'), '').trim();
      }
      if (timeInfo) {
        title = title.replace(new RegExp(`\\b(at\\s+)?${timeInfo.matchedText}\\b`, 'gi'), '').trim();
      }

      const entities: Record<string, unknown> = {
        title: title || 'Reminder',
      };

      if (relativeDate) {
        entities.date = relativeDate.dateStr;
      } else {
        missingFields.push('date');
      }

      if (timeInfo) {
        entities.time = timeInfo.timeStr;
      }

      const isComplete = missingFields.length === 0;
      const confidence = isComplete ? 0.88 : 0.45;

      const actions: ActionItem[] = [
        {
          action_id: 'act_001',
          agent: 'reminder_agent',
          operation: 'create_reminder',
          depends_on: [],
          data: {
            title: entities.title,
            date: entities.date,
            time: entities.time,
          },
        },
      ];

      return {
        request_id: input.requestId,
        source: {
          type: input.sourceType,
          raw_input: input.rawText,
          source_app: input.sourceApp ?? null,
          timestamp: input.timestamp,
        },
        intent: 'set_reminder',
        confidence,
        entities,
        missing_fields: missingFields,
        required_agents: ['reminder_agent'],
        actions,
        requires_confirmation: !isComplete,
        execution_mode: 'pending',
      };
    }

    // 4. SCHEDULE EVENT (schedule_event)
    const hasScheduleWord = /\b(schedule|meeting|appointment|review|calendar|call with)\b/.test(lower);
    if (hasScheduleWord && !hasPayWord) {
      const relativeDate = resolveRelativeDate(text, now);
      const timeInfo = extractTime(text);
      const missingFields: string[] = [];

      let title = text
        .replace(/^(please\s+)?(schedule\s+a|schedule\s+an|schedule|set\s+up\s+a\s+meeting\s+for|book\s+a\s+slot\s+for)\s+/i, '')
        .trim();

      if (relativeDate) {
        title = title.replace(new RegExp(`\\b${relativeDate.matchedText}\\b`, 'gi'), '').trim();
      }
      if (timeInfo) {
        title = title.replace(new RegExp(`\\b(at\\s+)?${timeInfo.matchedText}\\b`, 'gi'), '').trim();
      }

      // Title cleanup
      title = title.replace(/^for\s+/i, '').replace(/[\.,]$/, '').trim();

      const entities: Record<string, unknown> = {
        title: title || 'Event',
      };

      if (relativeDate) {
        entities.date = relativeDate.dateStr;
      } else {
        missingFields.push('date');
      }

      if (timeInfo) {
        entities.time = timeInfo.timeStr;
      } else {
        missingFields.push('time');
      }

      // Do not invent duration; mark missing if not provided
      const durationMatch = text.match(/\b(\d+)\s*(hour|hr|minute|min)s?\b/i);
      if (durationMatch) {
        entities.duration = `${durationMatch[1]} ${durationMatch[2]}`;
      } else {
        missingFields.push('duration');
      }

      const isComplete = !missingFields.includes('date') && !missingFields.includes('time');
      const confidence = isComplete ? 0.85 : 0.5;

      const actions: ActionItem[] = [
        {
          action_id: 'act_001',
          agent: 'calendar_agent',
          operation: 'schedule_event',
          depends_on: [],
          data: {
            title: entities.title,
            date: entities.date,
            time: entities.time,
            duration: entities.duration,
          },
        },
      ];

      return {
        request_id: input.requestId,
        source: {
          type: input.sourceType,
          raw_input: input.rawText,
          source_app: input.sourceApp ?? null,
          timestamp: input.timestamp,
        },
        intent: 'schedule_event',
        confidence,
        entities,
        missing_fields: missingFields,
        required_agents: ['calendar_agent'],
        actions,
        requires_confirmation: !isComplete,
        execution_mode: 'pending',
      };
    }

    // 5. ADD TASK (add_task)
    const hasTaskWord = /\b(add\s+a\s+task|create\s+a\s+task|new\s+task|todo|to-do|task:)\b/.test(lower) ||
      /\b(clean\s+my\s+room|finish\s+homework|submit\s+assignment|buy\s+milk|wash\s+clothes)\b/.test(lower);

    if (hasTaskWord) {
      let taskTitle = text
        .replace(/^(please\s+)?(add\s+a\s+task\s+to|add\s+a\s+task|create\s+a\s+task\s+to|create\s+a\s+task|todo:?|to-do:?|task:?)\s+/i, '')
        .trim();

      const relativeDate = resolveRelativeDate(text, now);
      if (relativeDate) {
        taskTitle = taskTitle.replace(new RegExp(`\\b${relativeDate.matchedText}\\b`, 'gi'), '').trim();
      }

      taskTitle = taskTitle.replace(/[\.,]$/, '').trim();

      const entities: Record<string, unknown> = {
        title: taskTitle || text,
      };
      if (relativeDate) {
        entities.due_date = relativeDate.dateStr;
      }

      const actions: ActionItem[] = [
        {
          action_id: 'act_001',
          agent: 'task_agent',
          operation: 'create_task',
          depends_on: [],
          data: {
            title: entities.title,
            due_date: entities.due_date,
          },
        },
      ];

      return {
        request_id: input.requestId,
        source: {
          type: input.sourceType,
          raw_input: input.rawText,
          source_app: input.sourceApp ?? null,
          timestamp: input.timestamp,
        },
        intent: 'add_task',
        confidence: 0.9,
        entities,
        missing_fields: [],
        required_agents: ['task_agent'],
        actions,
        requires_confirmation: false,
        execution_mode: 'pending',
      };
    }

    // 6. EXPENSE LOGGED (Completed transaction: "I spent ₹250 on lunch today", "I received a refund of ₹500 yesterday")
    const hasCompletedExpense = /\b(spent|paid|bought|purchased|refund|received\s+a\s+refund|cost\s+me)\b/.test(lower);
    if (hasCompletedExpense) {
      const parsedAmount = this.extractAmount(text);
      const relativeDate = resolveRelativeDate(text, now);
      const isRefund = /\b(refund|received\s+a\s+refund|returned)\b/.test(lower);
      const missingFields: string[] = [];

      let description = text
        .replace(/^(i\s+)?(spent|paid|bought|purchased|received\s+a\s+refund\s+of|received\s+a\s+refund|got\s+a\s+refund\s+of|got\s+a\s+refund)\s+/i, '')
        .trim();

      if (parsedAmount) {
        description = description.replace(new RegExp(this.escapeRegExp(parsedAmount.matchedText), 'gi'), '').trim();
      }
      if (relativeDate) {
        description = description.replace(new RegExp(`\\b${relativeDate.matchedText}\\b`, 'gi'), '').trim();
      }

      description = description
        .replace(/^(on|for)\s+/i, '')
        .replace(/[\.,]$/, '')
        .trim();

      if (isRefund && !description) {
        description = 'refund';
      }

      const entities: Record<string, unknown> = {
        description: description || (isRefund ? 'refund' : 'general expense'),
      };

      if (parsedAmount) {
        entities.amount = parsedAmount.amount;
        entities.currency = parsedAmount.currency;
      } else {
        missingFields.push('amount');
      }

      if (relativeDate) {
        entities.date = relativeDate.dateStr;
      } else {
        // Default to today if completed action doesn't specify
        entities.date = getTodayDate(now);
      }

      if (isRefund) {
        entities.type = 'refund';
      }

      const isComplete = missingFields.length === 0;
      const confidence = isComplete ? 0.92 : 0.5;

      const actions: ActionItem[] = [
        {
          action_id: 'act_001',
          agent: 'finance_agent',
          operation: 'create_expense',
          depends_on: [],
          data: {
            amount: entities.amount,
            currency: entities.currency,
            description: entities.description,
            date: entities.date,
            type: isRefund ? 'income' : 'expense',
          },
        },
      ];

      return {
        request_id: input.requestId,
        source: {
          type: input.sourceType,
          raw_input: input.rawText,
          source_app: input.sourceApp ?? null,
          timestamp: input.timestamp,
        },
        intent: 'expense_logged',
        confidence,
        entities,
        missing_fields: missingFields,
        required_agents: ['finance_agent'],
        actions,
        requires_confirmation: !isComplete,
        execution_mode: 'pending',
      };
    }

    // 7. PLANNED EXPENSE ("I need to pay my internet bill next Friday", "planning to spend ₹500 on shoes")
    if (/\b(need\s+to\s+pay|plan\s+to\s+spend|planning\s+to|have\s+to\s+pay|will\s+pay)\b/.test(lower) || (hasBillWord && hasPayWord)) {
      const parsedAmount = this.extractAmount(text);
      const relativeDate = resolveRelativeDate(text, now);
      const billType = this.extractBillType(text);
      const missingFields: string[] = [];

      const entities: Record<string, unknown> = {};

      if (billType) {
        entities.bill_type = billType;
        entities.description = `${billType} bill`;
      } else {
        entities.description = 'planned expense';
      }

      if (parsedAmount) {
        entities.amount = parsedAmount.amount;
        entities.currency = parsedAmount.currency;
      } else {
        missingFields.push('amount');
      }

      if (relativeDate) {
        entities.due_date = relativeDate.dateStr;
      } else {
        missingFields.push('due_date');
      }

      const isComplete = missingFields.length === 0;
      const confidence = isComplete ? 0.85 : 0.55;

      const actions: ActionItem[] = [
        {
          action_id: 'act_001',
          agent: 'finance_agent',
          operation: 'create_planned_expense',
          depends_on: [],
          data: {
            amount: entities.amount,
            currency: entities.currency,
            description: entities.description,
            bill_type: entities.bill_type,
            due_date: entities.due_date,
          },
        },
      ];

      return {
        request_id: input.requestId,
        source: {
          type: input.sourceType,
          raw_input: input.rawText,
          source_app: input.sourceApp ?? null,
          timestamp: input.timestamp,
        },
        intent: 'planned_expense',
        confidence,
        entities,
        missing_fields: missingFields,
        required_agents: ['finance_agent'],
        actions,
        requires_confirmation: !isComplete,
        execution_mode: 'pending',
      };
    }

    // 8. UNKNOWN / AMBIGUOUS FALLBACK
    return {
      request_id: input.requestId,
      source: {
        type: input.sourceType,
        raw_input: input.rawText,
        source_app: input.sourceApp ?? null,
        timestamp: input.timestamp,
      },
      intent: 'unknown',
      confidence: 0.15,
      entities: {},
      missing_fields: ['intent_clarification'],
      required_agents: [],
      actions: [],
      requires_confirmation: true,
      execution_mode: 'pending',
    };
  }

  private extractAmount(text: string): ParsedAmount | null {
    // Matches: ₹250, ₹ 250, Rs 1200, Rs. 1200, INR 500, $50, USD 100, 250 rs, or just 1200 after 'for' or 'of'
    const symbolMatch = text.match(/(₹|rs\.?|inr|\$|usd|eur)\s*([\d,]+(?:\.\d+)?)/i);
    if (symbolMatch) {
      const rawSym = symbolMatch[1].toLowerCase();
      let currency = 'INR';
      if (rawSym === '$' || rawSym === 'usd') currency = 'USD';
      if (rawSym === 'eur') currency = 'EUR';
      const num = parseFloat(symbolMatch[2].replace(/,/g, ''));
      return { amount: num, currency, matchedText: symbolMatch[0] };
    }

    // Matches suffix: "250 rupees", "1200 rs", "500 inr"
    const suffixMatch = text.match(/([\d,]+(?:\.\d+)?)\s*(rupees|rs\.?|inr|dollars|usd)/i);
    if (suffixMatch) {
      const num = parseFloat(suffixMatch[1].replace(/,/g, ''));
      const rawCur = suffixMatch[2].toLowerCase();
      const currency = (rawCur.includes('dollar') || rawCur === 'usd') ? 'USD' : 'INR';
      return { amount: num, currency, matchedText: suffixMatch[0] };
    }

    // Matches context: "for 1200", "of 500"
    const contextMatch = text.match(/\b(?:for|of|costing)\s+([\d,]+(?:\.\d+)?)\b/i);
    if (contextMatch) {
      const num = parseFloat(contextMatch[1].replace(/,/g, ''));
      return { amount: num, currency: 'INR', matchedText: contextMatch[0] };
    }

    return null;
  }

  private extractBillType(text: string): string | null {
    const lower = text.toLowerCase();
    for (const [kw, normalized] of Object.entries(BILL_KEYWORDS)) {
      if (new RegExp(`\\b${kw}\\b`, 'i').test(lower)) {
        return normalized;
      }
    }
    return null;
  }

  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

