import type { MethodDefinition, StudyConfig } from '../types';
import { benchmarkCoverageLabel } from './benchmarkCoverage';
import { fuzzyCapability, groupDecisionCapability, validationBoundary } from './capabilityMatrix';
import { externalValidationCoverageLabel, validationEvidence } from './validationEvidence';

export function methodCoverageItems(method: MethodDefinition, config: StudyConfig, checksPassed: number, checksTotal: number) {
  const qaMode = checksTotal
    ? `${checksPassed}/${checksTotal} built-in registry checks passed in this browser session`
    : 'Built-in registry checks run when results open';
  const benchmarkMode = `${benchmarkCoverageLabel(method.id)}. ${validationEvidence.numericalBenchmarks.count} bundled numerical checks exist across covered methods.`;

  return [
    { label: 'Method family', value: method.id === 'dematel' ? 'Cause-effect modeling' : 'Alternative ranking' },
    { label: 'Group data', value: groupDecisionCapability(method, config) },
    { label: 'Fuzzy data', value: fuzzyCapability(method, config) },
    { label: 'Weight handling', value: method.supportsWeights ? 'Manual, objective, pairwise, and rank-order weighting options' : 'Self-weighted or method-owned calculation' },
    { label: 'Template validation', value: 'Sheets, dimensions, numeric/fuzzy cells, directions, weights, and method parameters are checked before analysis' },
    { label: 'Automated QA', value: qaMode },
    { label: 'Numerical evidence', value: benchmarkMode },
    { label: 'External method validation', value: externalValidationCoverageLabel(method.id) },
    { label: 'Fuzzy validation boundary', value: validationBoundary(method) },
    { label: 'Publication package', value: 'Exports include intermediate tables, diagnostics, visual data, and reproducibility metadata; external validation status is reported separately' },
    { label: 'Evidence boundary', value: validationEvidence.externalBenchmarks.scope },
  ];
}
