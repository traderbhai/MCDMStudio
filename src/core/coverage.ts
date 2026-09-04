import type { MethodDefinition, StudyConfig } from '../types';
import { benchmarkCoverageLabel } from './benchmarkCoverage';
import { fuzzyCapability, groupDecisionCapability, validationBoundary } from './capabilityMatrix';
import { externalValidationCoverageLabel, validationEvidence } from './validationEvidence';

export function methodCoverageItems(method: MethodDefinition, config: StudyConfig, checksPassed: number, checksTotal: number) {
  const qaMode = checksTotal
    ? `${checksPassed} of ${checksTotal} quality checks passed in this browser session`
    : 'Built-in checks run when results open';
  const benchmarkMode = `${benchmarkCoverageLabel(method.id)}. ${validationEvidence.numericalBenchmarks.count} numerical checks are bundled across the app.`;

  return [
    { label: 'Decision type', value: method.id === 'dematel' ? 'Factor influence study' : 'Option ranking' },
    { label: 'Group data', value: groupDecisionCapability(method, config) },
    { label: 'Fuzzy data', value: fuzzyCapability(method, config) },
    { label: 'Weights', value: method.supportsWeights ? 'Choose manual weights, automatic weights, pairwise judgments, or rank-order weights.' : 'This method calculates its own scoring structure.' },
    { label: 'Before analysis', value: 'The app checks sheet names, table size, numbers, fuzzy ranges, criterion type, weights, and method settings.' },
    { label: 'App checks', value: qaMode },
    { label: 'Benchmarks', value: benchmarkMode },
    { label: 'Published examples', value: externalValidationCoverageLabel(method.id) },
    { label: 'Fuzzy validation boundary', value: validationBoundary(method) },
    { label: 'Exports', value: 'Excel, DOCX, PDF, and project files include the tables, checks, charts, and reproducibility details needed to review the study.' },
    { label: 'Evidence boundary', value: 'Published-example coverage is still being expanded across crisp, fuzzy, and group setups.' },
  ];
}
