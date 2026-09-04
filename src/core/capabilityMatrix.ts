import type { MethodDefinition, StudyConfig } from '../types';

export function groupDecisionCapability(method: MethodDefinition, config?: StudyConfig): string {
  const dataInputMode = String(config?.methodParams.dataInputMode ?? (method.id === 'dematel' ? 'Single expert matrix' : 'Single aggregated dataset'));
  if (method.id === 'dematel') {
    if (dataInputMode === 'Multiple experts') {
      return `Each expert gets a separate direct-relation matrix. The app combines them with ${String(config?.methodParams.dematelAggregation ?? 'Arithmetic mean')} and reports agreement.`;
    }
    return 'Use one final influence matrix from an expert, panel, or committee.';
  }
  if (method.id === 'ahp') {
    return "AHP can combine several people's pairwise judgments and checks consistency after combining them.";
  }
  if (dataInputMode === 'Multiple respondents') {
    return `Each respondent gets a separate decision matrix. The app combines them with ${String(config?.methodParams.respondentAggregation ?? 'Arithmetic mean')} and reports agreement.`;
  }
  return 'Use one final decision matrix for all alternatives and criteria.';
}

export function fuzzyCapability(method: MethodDefinition, config?: StudyConfig): string {
  const fuzzyInputMode = String(config?.methodParams.fuzzyInputMode ?? 'Defuzzify on upload');
  if (method.fuzzySupport.nativeModeLabel && fuzzyInputMode === method.fuzzySupport.nativeModeLabel) {
    return `${method.fuzzySupport.nativeModeLabel}: fuzzy ranges stay as ranges through this method's calculation.`;
  }
  if (method.fuzzySupport.nativeModeLabel) {
    return `You can upload fuzzy ranges and convert them to single values, or switch to ${method.fuzzySupport.nativeModeLabel}.`;
  }
  return 'You can upload triangular or trapezoidal fuzzy ranges; the app converts them to single values before ranking.';
}

export function validationBoundary(method: MethodDefinition): string {
  if (method.fuzzySupport.mode === 'native-fuzzy') {
    return 'Native fuzzy output has automated checks. Published fuzzy examples are still needed for a stronger publication claim.';
  }
  return 'Fuzzy uploads are checked after conversion to single values. State this clearly if you publish a study with fuzzy inputs.';
}
