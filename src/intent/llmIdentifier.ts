import { ActionPlan } from '../models/ActionPlan';
import { InputEvent } from '../models/InputEvent';
import { getTodayDate } from './dateUtils';
import { IdentificationResult, IntentIdentifier } from './identifier';
import { LlmProvider } from './llmProvider';
import { RuleBasedIdentifier } from './ruleIdentifier';
import { cleanAndParseJson, validateActionPlan } from './schemaValidator';

export class LlmIntentIdentifier implements IntentIdentifier {
  private provider: LlmProvider;
  private fallbackIdentifier: IntentIdentifier;
  private baseDate?: Date;

  constructor(
    provider: LlmProvider,
    fallbackIdentifier?: IntentIdentifier,
    baseDate?: Date
  ) {
    this.provider = provider;
    this.fallbackIdentifier = fallbackIdentifier || new RuleBasedIdentifier(baseDate);
    this.baseDate = baseDate;
  }

  public async identify(input: InputEvent): Promise<IdentificationResult> {
    const startTime = Date.now();

    // Check if provider is configured
    if (!this.provider.isConfigured()) {
      const fallbackResult = await this.fallbackIdentifier.identify(input);
      return {
        plan: fallbackResult.plan,
        method: 'fallback_rule_based',
        warning: `LLM provider (${this.provider.name}) is not configured with an API key. Used rule-based fallback.`,
        executionTimeMs: Date.now() - startTime,
      };
    }

    const todayStr = getTodayDate(this.baseDate || new Date(input.timestamp || Date.now()));
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    const systemPrompt = this.buildSystemPrompt(todayStr, timezone);
    const userPrompt = this.buildUserPrompt(input, todayStr, timezone);

    // Attempt 1
    let rawOutput = '';
    try {
      rawOutput = await this.provider.generate(userPrompt, systemPrompt);
      const plan = this.validateAndNormalize(rawOutput, input);
      return {
        plan,
        method: 'llm',
        executionTimeMs: Date.now() - startTime,
      };
    } catch (firstError: unknown) {
      const firstErrorMessage = (firstError as Error).message || String(firstError);

      // If it's a schema validation or JSON parsing failure, retry once with corrective feedback
      const isSchemaError =
        firstErrorMessage.toLowerCase().includes('schema') ||
        firstErrorMessage.toLowerCase().includes('json') ||
        firstErrorMessage.toLowerCase().includes('validation') ||
        firstErrorMessage.toLowerCase().includes('actionplan');

      if (isSchemaError) {
        // Retry once with a corrective prompt
        try {
          const correctivePrompt = `${userPrompt}\n\nIMPORTANT: Your previous output failed schema validation with: ${firstErrorMessage}. Please correct the issues and output ONLY a valid ActionPlan JSON adhering strictly to the schema.`;
          const retryOutput = await this.provider.generate(correctivePrompt, systemPrompt);
          const plan = this.validateAndNormalize(retryOutput, input);
          return {
            plan,
            method: 'llm',
            warning: 'LLM required 1 retry to generate valid schema.',
            executionTimeMs: Date.now() - startTime,
          };
        } catch (retryError: unknown) {
          const retryMsg = (retryError as Error).message || String(retryError);
          // Retry failed: fall back to rule-based
          const fallback = await this.fallbackIdentifier.identify(input);
          return {
            plan: fallback.plan,
            method: 'fallback_rule_based',
            warning: `LLM response validation failed after retry (${retryMsg}). Used rule-based fallback.`,
            executionTimeMs: Date.now() - startTime,
          };
        }
      }

      // API failure or network timeout: fall back to rule-based
      const fallback = await this.fallbackIdentifier.identify(input);
      return {
        plan: fallback.plan,
        method: 'fallback_rule_based',
        warning: `LLM request failed (${firstErrorMessage}). Used rule-based fallback.`,
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  private validateAndNormalize(rawOutput: string, input: InputEvent): ActionPlan {
    let parsed: unknown;
    try {
      parsed = cleanAndParseJson(rawOutput);
    } catch (err: unknown) {
      throw new Error(`Failed to parse LLM response as JSON: ${(err as Error).message}`);
    }

    // Ensure request_id and source match input
    if (typeof parsed === 'object' && parsed !== null) {
      const record = parsed as Record<string, unknown>;
      record.request_id = input.requestId;
      if (!record.source || typeof record.source !== 'object') {
        record.source = {
          type: input.sourceType,
          raw_input: input.rawText,
          source_app: input.sourceApp ?? null,
          timestamp: input.timestamp,
        };
      }
    }

    const validation = validateActionPlan(parsed);
    if (!validation.success || !validation.data) {
      throw new Error(`ActionPlan validation errors: ${validation.errors?.join('; ')}`);
    }

    return validation.data;
  }

  private buildSystemPrompt(todayStr: string, timezone: string): string {
    return `You are the Intent Identifier for LifeOS, an event-driven personal workflow orchestration system.
Your goal is to parse raw user input and output a normalized, app-independent ActionPlan JSON.

TODAY'S LOCAL DATE: ${todayStr}
TIMEZONE: ${timezone}

ALLOWED INTENTS:
- expense_logged: A completed payment or transaction (e.g. "I spent ₹250 on lunch today", "I received a refund of ₹500").
- planned_expense: An intended or upcoming expense (e.g. "I need to pay my internet bill next Friday", "planning to buy shoes").
- set_reminder: A general reminder with a date/time (e.g. "Remind me to call Mom tomorrow at 5 PM").
- bill_payment_reminder: A reminder specifically for a bill/utility payment. Requires BOTH reminder_agent and finance_agent. The finance action MUST be create_planned_expense (NEVER create_expense).
- add_task: A to-do task (e.g. "Add a task to clean my room").
- schedule_event: A calendar event with date/time (e.g. "Schedule project review tomorrow at 3 PM").
- unknown: When the input is ambiguous, incomprehensible, or missing critical intent.

ALLOWED AGENTS:
- reminder_agent
- finance_agent
- task_agent
- calendar_agent

ALLOWED ACTION OPERATIONS:
- reminder_agent: create_reminder, cancel_reminder
- finance_agent: create_expense (completed only), create_planned_expense (planned/pending bills only)
- task_agent: create_task, complete_task
- calendar_agent: schedule_event, cancel_event

CRITICAL SAFETY & INTEGRITY RULES:
1. A planned expense is NOT a completed transaction.
2. A payment reported as "pending" must NEVER become a completed expense (create_expense).
3. Relative dates (today, tomorrow, Friday, next week) MUST be resolved against TODAY'S LOCAL DATE: ${todayStr}.
4. NEVER invent or hallucinate missing information (amounts, due dates, times, durations). If missing, include the field name in "missing_fields" array and lower confidence.
5. If duration is not specified for a scheduled event, do NOT invent one. Put "duration" in missing_fields.
6. Confidence is a model-reported float between 0.0 and 1.0. Lower it when information is incomplete.
7. Return JSON ONLY matching the ActionPlan schema. Do not include markdown preamble or conversational explanations.`;
  }

  private buildUserPrompt(input: InputEvent, todayStr: string, timezone: string): string {
    return JSON.stringify(
      {
        input_event: {
          request_id: input.requestId,
          source_type: input.sourceType,
          raw_text: input.rawText,
          source_app: input.sourceApp ?? null,
          timestamp: input.timestamp,
        },
        context: {
          current_local_date: todayStr,
          timezone,
        },
        instructions:
          'Produce the ActionPlan JSON conforming strictly to the schema. Output JSON only.',
      },
      null,
      2
    );
  }
}
