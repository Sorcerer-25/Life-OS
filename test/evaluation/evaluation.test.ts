import { runDatasetEvaluation } from './evaluateDataset';

describe('Evaluation Test Suite (50+ Labelled Examples)', () => {
  it('achieves >95% intent accuracy, 100% financial safety, and accurate supervisor decisions', async () => {
    const result = await runDatasetEvaluation();

    console.log(`\n[Evaluation Suite] Evaluated ${result.total} test cases:`);
    console.log(`  Intent Accuracy: ${result.intentAccuracy.toFixed(1)}% (${result.intentMatches}/${result.total})`);
    console.log(`  Agent Mapping Accuracy: ${result.agentAccuracy.toFixed(1)}% (${result.agentMatches}/${result.total})`);
    console.log(`  Workflow Status Accuracy: ${result.statusAccuracy.toFixed(1)}% (${result.statusMatches}/${result.total})`);
    console.log(`  Clarification Rate: ${result.clarificationTriggered}/${result.clarificationExpected}`);
    console.log(`  Financial Safety Violations: ${result.financialSafetyViolations}`);

    const failures = result.details.filter(
      (d) => !d.intentsPassed || !d.agentsPassed || !d.statusPassed
    );
    if (failures.length > 0) {
      console.log(`\n  Mismatched Cases (${failures.length}):`);
      for (const f of failures) {
        console.log(
          `    - [${f.id}] "${f.input}":\n        actualIntents: [${f.actualIntents.join(', ')}]\n        actualAgents: [${f.actualAgents.join(', ')}]\n        actualStatus: ${f.actualStatus}`
        );
      }
    }

    expect(result.total).toBeGreaterThanOrEqual(50);
    expect(result.financialSafetyViolations).toBe(0);
    expect(result.intentAccuracy).toBeGreaterThanOrEqual(95);
    expect(result.agentAccuracy).toBeGreaterThanOrEqual(95);
    expect(result.statusAccuracy).toBeGreaterThanOrEqual(95);
  });
});
