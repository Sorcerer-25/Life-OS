import { ActionItem } from '../models/ActionPlan';
import { OrderingHint } from '../models/IntentAnalysis';

export interface DependencyResolutionResult {
  hasCycle: boolean;
  actions: ActionItem[];
  error?: string;
}

/**
 * Resolves dependencies between actions based on ordering hints and updates blocked statuses.
 */
export function resolveActionDependencies(
  actions: ActionItem[],
  orderingHints: OrderingHint[]
): DependencyResolutionResult {
  // Map sequence number to action_ids originating from that sequence
  const seqToActionIds = new Map<number, string[]>();
  for (const act of actions) {
    const list = seqToActionIds.get(act.sequence) || [];
    list.push(act.action_id);
    seqToActionIds.set(act.sequence, list);
  }

  // Populate depends_on based on ordering hints
  const updatedActions = actions.map((act) => ({
    ...act,
    depends_on: [...act.depends_on],
  }));

  for (const hint of orderingHints) {
    const fromActionIds = seqToActionIds.get(hint.from_sequence) || [];
    const toActionIds = seqToActionIds.get(hint.to_sequence) || [];

    for (const toId of toActionIds) {
      const targetAct = updatedActions.find((a) => a.action_id === toId);
      if (targetAct) {
        for (const fromId of fromActionIds) {
          if (!targetAct.depends_on.includes(fromId)) {
            targetAct.depends_on.push(fromId);
          }
        }
      }
    }
  }

  // Cycle detection via DFS
  const graph = new Map<string, string[]>();
  for (const act of updatedActions) {
    graph.set(act.action_id, act.depends_on);
  }

  const visited = new Set<string>();
  const recStack = new Set<string>();

  function checkCycle(id: string): boolean {
    visited.add(id);
    recStack.add(id);

    const deps = graph.get(id) || [];
    for (const dep of deps) {
      if (!visited.has(dep)) {
        if (checkCycle(dep)) return true;
      } else if (recStack.has(dep)) {
        return true;
      }
    }

    recStack.delete(id);
    return false;
  }

  for (const act of updatedActions) {
    if (!visited.has(act.action_id)) {
      if (checkCycle(act.action_id)) {
        return {
          hasCycle: true,
          actions: updatedActions,
          error: `Circular dependency detected involving action ${act.action_id}`,
        };
      }
    }
  }

  // Handle dependency blocking:
  // If relationship is "dependency" and the earlier action is needs_clarification or blocked,
  // then dependents become "blocked".
  for (const hint of orderingHints) {
    if (hint.relationship === 'dependency') {
      const fromActionIds = seqToActionIds.get(hint.from_sequence) || [];
      const toActionIds = seqToActionIds.get(hint.to_sequence) || [];

      const fromNeedsClarification = updatedActions.some(
        (a) => fromActionIds.includes(a.action_id) && a.status === 'needs_clarification'
      );

      if (fromNeedsClarification) {
        for (const toId of toActionIds) {
          const act = updatedActions.find((a) => a.action_id === toId);
          if (act && act.status === 'ready') {
            act.status = 'blocked';
            act.reason = `Waiting on prerequisite action from sequence #${hint.from_sequence} to resolve clarification.`;
          }
        }
      }
    }
  }

  return {
    hasCycle: false,
    actions: updatedActions,
  };
}

