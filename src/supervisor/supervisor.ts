import {
  ActionItem,
  ActionPlan,
  ActionStatus,
  AgentName,
  SupervisorDecision,
  SupervisorWorkflowStatus,
} from '../models/ActionPlan';
import { IntentAnalysis } from '../models/IntentAnalysis';
import { validateIntentAnalysis } from '../intent/intentAnalysisValidator';
import { resolveActionDependencies } from './dependencyResolver';
import { SUPERVISOR_MAPPING_REGISTRY } from './mappingRegistry';

export class SupervisorAgent {
  private confidenceThreshold: number;

  constructor(confidenceThreshold: number = 0.6) {
    this.confidenceThreshold = confidenceThreshold;
  }

  public plan(analysis: IntentAnalysis): ActionPlan {
    // 1. Validate IntentAnalysis structure
    const validation = validateIntentAnalysis(analysis);
    if (!validation.success || !validation.data) {
      return {
        request_id: analysis.request_id || 'unknown_req',
        source: analysis.source,
        intents: analysis.intents || [],
        required_agents: [],
        actions: [],
        decision: {
          workflow_status: 'rejected',
          reasons: [
            `Structurally invalid IntentAnalysis: ${validation.errors?.join('; ')}`,
          ],
          clarification_needed: false,
          clarification_questions: [],
          unsupported_explanations: [],
        },
        execution_mode: 'pending',
      };
    }

    const reasons: string[] = [];
    const clarificationQuestions: string[] = [];
    const unsupportedExplanations: string[] = [];
    const requiredAgentsSet = new Set<AgentName>();

    // 2. Handle Unsupported Capabilities
    if (analysis.unsupported_components && analysis.unsupported_components.length > 0) {
      for (const un of analysis.unsupported_components) {
        unsupportedExplanations.push(
          `Capability '${un.capability}' is unsupported: ${un.reason}`
        );
      }
    }

    // 3. Handle Unrecognized Input
    if (
      analysis.intents.length === 0 &&
      (!analysis.unsupported_components || analysis.unsupported_components.length === 0)
    ) {
      return {
        request_id: analysis.request_id,
        source: analysis.source,
        intents: [],
        required_agents: [],
        actions: [],
        decision: {
          workflow_status: 'rejected',
          reasons: [
            'Input could not be understood as any supported LifeOS intent. Please try rephrasing your request.',
          ],
          clarification_needed: false,
          clarification_questions: [],
          unsupported_explanations: [],
        },
        execution_mode: 'pending',
      };
    }

    // 4. Map Intents to Proposed Actions
    const rawActions: ActionItem[] = [];

    for (const item of analysis.intents) {
      if (item.intent === 'unknown') {
        reasons.push(
          `Intent for sequence #${item.sequence} is unrecognized; no actions will be dispatched for it.`
        );
        continue;
      }

      const mappings = SUPERVISOR_MAPPING_REGISTRY[item.intent] || [];

      for (const mapping of mappings) {
        // Check condition if specified
        if (mapping.condition && !mapping.condition(item.entities)) {
          continue;
        }

        requiredAgentsSet.add(mapping.agent);

        // Assign deterministic action ID: ${request_id}_${sequence}_${operation}
        const actionId = `${analysis.request_id}_${item.sequence}_${mapping.operation}`;

        // Determine if action has missing fields or low confidence
        const missingForOp = mapping.requiredEntities.filter(
          (field) =>
            item.entities[field] === undefined ||
            item.entities[field] === null ||
            item.entities[field] === ''
        );

        let status: ActionStatus = 'ready';
        let reason = 'Valid and ready for execution plan.';
        let clarificationPrompt: string | undefined = undefined;

        if (missingForOp.length > 0) {
          status = 'needs_clarification';
          clarificationPrompt = this.generateClarificationQuestion(
            item.intent,
            mapping.operation,
            missingForOp
          );
          reason = `Missing required information: ${missingForOp.join(', ')}.`;
          clarificationQuestions.push(clarificationPrompt);
        } else if (item.confidence < this.confidenceThreshold) {
          status = 'needs_clarification';
          clarificationPrompt = `Please confirm details for ${item.intent.replace(/_/g, ' ')}. Confidence is low (${(item.confidence * 100).toFixed(0)}%).`;
          reason = `Model-reported confidence (${item.confidence.toFixed(2)}) is below threshold (${this.confidenceThreshold}).`;
          clarificationQuestions.push(clarificationPrompt);
        }

        // Construct typed action data payload
        const actionData = this.buildActionPayload(mapping.operation, item.entities);

        rawActions.push({
          action_id: actionId,
          sequence: item.sequence,
          agent: mapping.agent,
          operation: mapping.operation,
          data: actionData,
          depends_on: [],
          requires_confirmation: mapping.requiresConfirmation,
          status,
          reason,
          clarification_prompt: clarificationPrompt,
        });
      }
    }

    // 5. Resolve Dependencies and Cycle Detection
    const depResult = resolveActionDependencies(rawActions, analysis.ordering_hints);
    if (depResult.hasCycle) {
      return {
        request_id: analysis.request_id,
        source: analysis.source,
        intents: analysis.intents,
        required_agents: Array.from(requiredAgentsSet),
        actions: depResult.actions,
        decision: {
          workflow_status: 'rejected',
          reasons: [
            depResult.error || 'Circular dependency detected in execution graph.',
          ],
          clarification_needed: false,
          clarification_questions: [],
          unsupported_explanations: unsupportedExplanations,
        },
        execution_mode: 'pending',
      };
    }

    const finalActions = depResult.actions;

    // 6. Compute Workflow Status
    let workflowStatus: SupervisorWorkflowStatus = 'ready';

    if (finalActions.length === 0) {
      if (unsupportedExplanations.length > 0) {
        workflowStatus = 'unsupported';
        reasons.push('Requested capability is not supported in Phase 1.');
      } else {
        workflowStatus = 'rejected';
        reasons.push('No valid executable actions could be constructed.');
      }
    } else {
      const hasReady = finalActions.some((a) => a.status === 'ready');
      const hasClarification = finalActions.some(
        (a) => a.status === 'needs_clarification' || a.status === 'blocked'
      );

      if (hasReady && hasClarification) {
        workflowStatus = 'partial';
        reasons.push(
          'Partial workflow: one or more actions are ready while others require user clarification.'
        );
      } else if (!hasReady && hasClarification) {
        workflowStatus = 'needs_clarification';
        reasons.push('All proposed actions require additional user details.');
      } else {
        workflowStatus = 'ready';
        reasons.push('All proposed actions validated successfully.');
      }
    }

    return {
      request_id: analysis.request_id,
      source: analysis.source,
      intents: analysis.intents,
      required_agents: Array.from(requiredAgentsSet),
      actions: finalActions,
      decision: {
        workflow_status: workflowStatus,
        reasons,
        clarification_needed: clarificationQuestions.length > 0,
        clarification_questions: clarificationQuestions,
        unsupported_explanations: unsupportedExplanations,
      },
      execution_mode: 'pending',
    };
  }

  private buildActionPayload(
    operation: string,
    entities: Record<string, unknown>
  ): Record<string, unknown> {
    switch (operation) {
      case 'create_expense':
        return {
          operation: 'create_expense',
          amount: entities.amount,
          currency: entities.currency,
          description: entities.description,
          date: entities.due_date || entities.date,
          category: entities.category,
          type: entities.type || 'expense',
        };
      case 'create_planned_expense':
        return {
          operation: 'create_planned_expense',
          amount: entities.amount,
          currency: entities.currency,
          description: entities.description || `${entities.bill_type || 'planned'} expense`,
          bill_type: entities.bill_type,
          due_date: entities.due_date,
          category: entities.category,
          status: entities.status || 'planned',
        };
      case 'create_reminder':
        return {
          operation: 'create_reminder',
          title: entities.title,
          due_date: entities.due_date,
          time: entities.start_time,
          recipient: entities.recipient,
          amount: entities.amount,
          currency: entities.currency,
        };
      case 'create_task':
        return {
          operation: 'create_task',
          title: entities.title,
          due_date: entities.due_date,
          time: entities.start_time,
          recipient: entities.recipient,
          priority: entities.priority,
        };
      case 'create_event':
        return {
          operation: 'create_event',
          title: entities.title,
          date: entities.due_date,
          start_time: entities.start_time,
          end_time: entities.end_time,
          duration: entities.duration,
          location: entities.location,
        };
      default:
        return { ...entities, operation };
    }
  }

  private generateClarificationQuestion(
    intent: string,
    operation: string,
    missingFields: string[]
  ): string {
    if (intent === 'set_reminder' && missingFields.includes('due_date')) {
      return 'When would you like to be reminded? Please provide a date or time.';
    }
    if (intent === 'expense_logged' && missingFields.includes('amount')) {
      return 'How much was spent on this expense?';
    }
    if (intent === 'expense_logged' && missingFields.includes('currency')) {
      return 'What currency was this expense in? (e.g. INR, USD)';
    }
    if (intent === 'planned_expense' && missingFields.includes('amount')) {
      return 'What is the planned payment amount?';
    }
    if (intent === 'schedule_event' && missingFields.includes('due_date')) {
      return 'What date should the event be scheduled for?';
    }
    if (intent === 'schedule_event' && missingFields.includes('start_time')) {
      return 'What time does the event begin?';
    }
    return `Please provide missing details (${missingFields.join(', ')}) for ${operation}.`;
  }
}

