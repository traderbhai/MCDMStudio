import type { MethodDefinition, StudyConfig } from '../types';

export function groupDecisionCapability(method: MethodDefinition, config?: StudyConfig): string {
  const dataInputMode = String(config?.methodParams.dataInputMode ?? (method.id === 'dematel' ? 'Single expert matrix' : 'Single aggregated dataset'));
  if (method.id === 'dematel') {
    if (dataInputMode === 'Multiple experts') {
      return `Multiple expert direct-relation matrices are aggregated by ${String(config?.methodParams.dematelAggregation ?? 'Arithmetic mean')}; expert disagreement and consensus are reported.`;
    }
    return 'Use one direct-relation matrix from a single expert, panel, or already aggregated committee response.';
  }
  if (method.id === 'ahp') {
    return 'AHP supports multiple respondent pairwise matrices aggregated by geometric mean, with consistency diagnostics after aggregation.';
  }
  if (dataInputMode === 'Multiple respondents') {
    return `Multiple respondent decision matrices are aggregated by ${String(config?.methodParams.respondentAggregation ?? 'Arithmetic mean')}; mean, max, relative disagreement, and consensus level are reported.`;
  }
  return 'Use one alternatives-by-criteria decision matrix, either measured directly or pre-aggregated outside the app.';
}

export function fuzzyCapability(method: MethodDefinition, config?: StudyConfig): string {
  const fuzzyInputMode = String(config?.methodParams.fuzzyInputMode ?? 'Defuzzify on upload');
  if (method.fuzzySupport.nativeModeLabel && fuzzyInputMode === method.fuzzySupport.nativeModeLabel) {
    return `${method.fuzzySupport.nativeModeLabel}: triangular and trapezoidal cells remain fuzzy through method-specific tables, then ranked by the method's documented fuzzy score convention.`;
  }
  if (method.fuzzySupport.nativeModeLabel) {
    return `Triangular and trapezoidal cells can be defuzzified by centroid, or switched to ${method.fuzzySupport.nativeModeLabel} when a native fuzzy run is required.`;
  }
  return 'Triangular and trapezoidal cells are accepted and defuzzified by centroid before crisp analysis; native fuzzy validation is not claimed for this method.';
}

export function validationBoundary(method: MethodDefinition): string {
  if (method.fuzzySupport.mode === 'native-fuzzy') {
    return 'Native fuzzy output is smoke-tested and crisp-equivalence tested; publication-grade fuzzy claims still require method-specific published fixtures.';
  }
  return 'Fuzzy input acceptance is smoke-tested through centroid defuzzification; publication-grade fuzzy claims require a future native fuzzy fixture or explicit defuzzified-study framing.';
}
