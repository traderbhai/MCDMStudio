import type { DecisionMatrix, StudyConfig, ValidationIssue, ValidationResult } from '../types';
import { weightingDisplayName } from './weightingMetadata';

function parseList(value: unknown): string[] {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumberList(value: unknown): number[] {
  return parseList(value).map((item) => Number(item));
}

function validatePairwiseMatrix(matrix: number[][], size: number, sheet: string, issues: ValidationIssue[]): void {
  if (matrix.length !== size) {
    issues.push({ severity: 'error', sheet, location: 'A:Z', message: 'Pairwise matrix size must match the expected item count.' });
  }
  matrix.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
    if (!Number.isFinite(value) || value <= 0) {
      issues.push({ severity: 'error', sheet, location: `${columnIndex + 2}:${rowIndex + 2}`, message: 'Pairwise values must be positive numbers.' });
    }
    if (rowIndex === columnIndex && Number.isFinite(value) && Math.abs(value - 1) > 0.0001) {
      issues.push({ severity: 'error', sheet, location: `${columnIndex + 2}:${rowIndex + 2}`, message: 'Pairwise diagonal values must be 1.' });
    }
    if (rowIndex < columnIndex) {
      const reciprocal = Number(matrix[columnIndex]?.[rowIndex]);
      if (Number.isFinite(value) && value > 0 && Number.isFinite(reciprocal) && reciprocal > 0 && Math.abs(value * reciprocal - 1) > 0.01) {
        issues.push({ severity: 'error', sheet, location: `${columnIndex + 2}:${rowIndex + 2}`, message: 'Pairwise values must be reciprocal across the diagonal.' });
      }
    }
  }));
}

function validateDematelInfluenceMatrix(matrix: number[][], size: number, sheet: string, issues: ValidationIssue[]): void {
  if (matrix.length !== size) {
    issues.push({ severity: 'error', sheet, location: 'A:Z', message: 'DEMATEL expert matrix row count must match the factor count.' });
  }
  matrix.forEach((row, rowIndex) => {
    if (row.length !== size) {
      issues.push({ severity: 'error', sheet, location: `Row ${rowIndex + 2}`, message: 'DEMATEL expert matrix must be square with one column per factor.' });
    }
    row.forEach((value, columnIndex) => {
      if (!Number.isFinite(value)) {
        issues.push({ severity: 'error', sheet, location: `${columnIndex + 2}:${rowIndex + 2}`, message: 'DEMATEL expert influence values must be numeric or valid fuzzy values.' });
      }
      if (Number.isFinite(value) && value < 0) {
        issues.push({ severity: 'error', sheet, location: `${columnIndex + 2}:${rowIndex + 2}`, message: 'DEMATEL expert influence values must be zero or positive.' });
      }
      if (rowIndex === columnIndex && Number.isFinite(value) && value !== 0) {
        issues.push({ severity: 'warning', sheet, location: `${columnIndex + 2}:${rowIndex + 2}`, message: 'DEMATEL expert matrix diagonal values should be zero; the analysis will enforce a zero diagonal.' });
      }
    });
  });
}

function fuzzyInputMessage(input: DecisionMatrix, config: StudyConfig): string {
  const count = input.fuzzyCellCount ?? 0;
  const types = (input.fuzzyTypes ?? []).join(', ') || 'detected';
  const selectedMode = String(config.methodParams.fuzzyInputMode ?? 'Defuzzify on upload');
  const countLabel = `${count} fuzzy cell${count === 1 ? '' : 's'} (${types})`;
  if (selectedMode.toLowerCase().startsWith('native fuzzy')) {
    return `${countLabel} will be preserved for ${selectedMode} calculations where the selected method supports native fuzzy processing.`;
  }
  return `${countLabel} will be converted to crisp values by centroid before analysis.`;
}

export function validateDecisionInput(input: DecisionMatrix, config: StudyConfig): ValidationResult {
  const issues: ValidationIssue[] = [];
  const dataInputMode = String(config.methodParams.dataInputMode ?? (config.methodId === 'dematel' ? 'Single expert matrix' : 'Single aggregated dataset'));
  const respondentCount = Number(config.methodParams.respondentCount ?? 1);
  const ahpRespondentCount = Number(config.methodParams.ahpRespondentCount ?? respondentCount);
  const dematelExpertCount = Number(config.methodParams.dematelExpertCount ?? 1);
  if (config.methodId !== 'dematel' && dataInputMode === 'Multiple respondents') {
    if (!Number.isInteger(respondentCount) || respondentCount < 2) {
      issues.push({ severity: 'error', sheet: 'Study Settings', location: 'Respondent count', message: 'Multiple-respondent studies require at least 2 respondents.' });
    }
    if ((config.methodId === 'ahp' || config.weightingId === 'ahp') && (!Number.isInteger(ahpRespondentCount) || ahpRespondentCount < 2)) {
      issues.push({ severity: 'error', sheet: 'Study Settings', location: 'AHP pairwise respondent count', message: 'AHP group pairwise studies require at least 2 pairwise respondent matrices.' });
    }
  }
  if (config.methodId === 'dematel' && dataInputMode === 'Multiple experts' && (!Number.isInteger(dematelExpertCount) || dematelExpertCount < 2)) {
    issues.push({ severity: 'error', sheet: 'Study Settings', location: 'Expert count', message: 'Multiple-expert DEMATEL studies require at least 2 experts.' });
  }
  if (!input.alternatives.length) {
    issues.push({ severity: 'error', sheet: 'Alternatives', location: 'A2', message: 'At least one alternative is required.' });
  }
  if (!input.criteria.length) {
    issues.push({ severity: 'error', sheet: 'Criteria', location: 'A2', message: 'At least one criterion is required.' });
  }
  const alternativeIds = new Set<string>();
  input.alternatives.forEach((alternative, index) => {
    if (!alternative.id.trim()) {
      issues.push({ severity: 'error', sheet: 'Alternatives', location: `A${index + 2}`, message: 'Alternative ID is required.' });
    }
    if (alternativeIds.has(alternative.id)) {
      issues.push({ severity: 'error', sheet: 'Alternatives', location: `A${index + 2}`, message: `Duplicate alternative ID "${alternative.id}".` });
    }
    alternativeIds.add(alternative.id);
  });
  const criterionIds = new Set<string>();
  input.criteria.forEach((criterion, index) => {
    if (!criterion.id.trim()) {
      issues.push({ severity: 'error', sheet: 'Criteria', location: `A${index + 2}`, message: 'Criterion ID is required.' });
    }
    if (criterionIds.has(criterion.id)) {
      issues.push({ severity: 'error', sheet: 'Criteria', location: `A${index + 2}`, message: `Duplicate criterion ID "${criterion.id}".` });
    }
    criterionIds.add(criterion.id);
    if (!['benefit', 'cost'].includes(criterion.direction)) {
      issues.push({ severity: 'error', sheet: 'Criteria', location: `C${index + 2}`, message: 'Direction must be benefit or cost.' });
    }
    if (config.weightingId === 'manual' && (!Number.isFinite(criterion.weight) || criterion.weight < 0)) {
      issues.push({ severity: 'error', sheet: 'Criteria', location: `D${index + 2}`, message: 'Weight must be a non-negative number.' });
    }
  });
  const weightSum = input.criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
  if (config.weightingId === 'manual' && Math.abs(weightSum - 1) > 0.01) {
    issues.push({ severity: 'warning', sheet: 'Criteria', location: 'D:D', message: `Weights sum to ${weightSum.toFixed(4)}; they will be normalized during analysis.` });
  }
  if (config.weightingId !== 'manual' && config.methodId !== 'dematel') {
    issues.push({ severity: 'info', sheet: 'Criteria', location: 'D:D', message: `${weightingDisplayName(config.weightingId)} weighting is selected; uploaded/manual weights are ignored for this run.` });
  }
  if (config.weightingId === 'merecG') {
    issues.push({ severity: 'info', sheet: 'MEREC-G Parameters', location: 'Mode', message: 'MEREC-G geometric removal-effect weights will be calculated from the uploaded decision matrix.' });
  }
  if (config.weightingId === 'wenslo') {
    issues.push({ severity: 'info', sheet: 'WENSLO Parameters', location: 'Mode', message: 'WENSLO envelope-slope objective weights will be calculated from the uploaded decision matrix.' });
  }
  if (config.weightingId === 'angular') {
    issues.push({ severity: 'info', sheet: 'Angular Parameters', location: 'Mode', message: 'Angular objective weights will be calculated from the uploaded decision matrix.' });
  }
  if (config.weightingId === 'gini') {
    issues.push({ severity: 'info', sheet: 'Gini Parameters', location: 'Mode', message: 'Gini coefficient objective weights will be calculated from the uploaded decision matrix.' });
  }
  if (config.weightingId === 'mpsi') {
    issues.push({ severity: 'info', sheet: 'MPSI Parameters', location: 'Mode', message: 'MPSI objective weights will be calculated from normalized preference-value variation in the uploaded decision matrix.' });
  }
  if (config.weightingId === 'cimas') {
    issues.push({ severity: 'info', sheet: 'CIMAS Parameters', location: 'Mode', message: 'CIMAS objective weights will be calculated from linear normalization and max-min criterion distance in the uploaded decision matrix.' });
  }
  if (config.weightingId === 'bwm') {
    const bestCriterion = String(config.methodParams.bwmBestCriterion ?? '');
    const worstCriterion = String(config.methodParams.bwmWorstCriterion ?? '');
    const criterionIds = input.criteria.map((criterion) => criterion.id);
    const bestToOthers = parseNumberList(config.methodParams.bwmBestToOthers);
    const othersToWorst = parseNumberList(config.methodParams.bwmOthersToWorst);
    if (!criterionIds.includes(bestCriterion)) {
      issues.push({ severity: 'error', sheet: 'BWM Parameters', location: 'Best criterion', message: 'BWM best criterion must match an existing criterion ID.' });
    }
    if (!criterionIds.includes(worstCriterion)) {
      issues.push({ severity: 'error', sheet: 'BWM Parameters', location: 'Worst criterion', message: 'BWM worst criterion must match an existing criterion ID.' });
    }
    if (bestCriterion && worstCriterion && bestCriterion === worstCriterion && input.criteria.length > 1) {
      issues.push({ severity: 'error', sheet: 'BWM Parameters', location: 'Best/Worst criterion', message: 'BWM best and worst criteria must be different.' });
    }
    if (bestToOthers.length !== input.criteria.length || bestToOthers.some((value) => !Number.isFinite(value) || value < 1)) {
      issues.push({ severity: 'error', sheet: 'BWM Parameters', location: 'Best-to-others vector', message: 'BWM best-to-others vector must contain one numeric value per criterion, each greater than or equal to 1.' });
    }
    if (othersToWorst.length !== input.criteria.length || othersToWorst.some((value) => !Number.isFinite(value) || value < 1)) {
      issues.push({ severity: 'error', sheet: 'BWM Parameters', location: 'Others-to-worst vector', message: 'BWM others-to-worst vector must contain one numeric value per criterion, each greater than or equal to 1.' });
    }
    const bestIndex = criterionIds.indexOf(bestCriterion);
    const worstIndex = criterionIds.indexOf(worstCriterion);
    if (bestIndex >= 0 && bestToOthers[bestIndex] !== 1) {
      issues.push({ severity: 'error', sheet: 'BWM Parameters', location: 'Best-to-others vector', message: 'BWM best criterion must compare to itself with value 1.' });
    }
    if (worstIndex >= 0 && othersToWorst[worstIndex] !== 1) {
      issues.push({ severity: 'error', sheet: 'BWM Parameters', location: 'Others-to-worst vector', message: 'BWM worst criterion must compare to itself with value 1.' });
    }
  }
  if (config.weightingId === 'dibr') {
    const order = parseList(config.methodParams.dibrOrder);
    const adjacentRatios = parseNumberList(config.methodParams.dibrAdjacentRatios);
    const firstLastRatio = Number(config.methodParams.dibrFirstLastRatio ?? 1);
    const criterionIds = input.criteria.map((criterion) => criterion.id);
    const orderSet = new Set(order);
    if (order.length !== input.criteria.length || orderSet.size !== input.criteria.length || !criterionIds.every((id) => orderSet.has(id))) {
      issues.push({ severity: 'error', sheet: 'DIBR Parameters', location: 'Criterion order', message: 'DIBR criterion order must list every criterion ID exactly once, from most important to least important.' });
    }
    if (adjacentRatios.length !== Math.max(input.criteria.length - 1, 0) || adjacentRatios.some((value) => !Number.isFinite(value) || value < 1)) {
      issues.push({ severity: 'error', sheet: 'DIBR Parameters', location: 'Adjacent importance ratios', message: 'DIBR adjacent ratios must contain n-1 numeric values, each greater than or equal to 1.' });
    }
    if (!Number.isFinite(firstLastRatio) || firstLastRatio < 1) {
      issues.push({ severity: 'error', sheet: 'DIBR Parameters', location: 'First-to-last control ratio', message: 'DIBR first-to-last control ratio must be numeric and greater than or equal to 1.' });
    }
    if (adjacentRatios.length === Math.max(input.criteria.length - 1, 0) && adjacentRatios.every((value) => Number.isFinite(value) && value >= 1) && Number.isFinite(firstLastRatio) && firstLastRatio >= 1) {
      const impliedRatio = adjacentRatios.reduce((product, value) => product * value, 1);
      const relativeGap = Math.abs(impliedRatio - firstLastRatio) / Math.max(firstLastRatio, 1e-12);
      if (relativeGap > 0.1) {
        issues.push({ severity: 'warning', sheet: 'DIBR Parameters', location: 'First-to-last control ratio', message: 'DIBR control ratio differs from the product of adjacent ratios by more than 10%; review expert judgments for consistency.' });
      }
    }
  }
  if (config.weightingId === 'simos') {
    const groups = String(config.methodParams.simosGroups ?? '')
      .split('|')
      .map((group) => group.split(',').map((item) => item.trim()).filter(Boolean))
      .filter((group) => group.length);
    const blankCards = parseNumberList(config.methodParams.simosBlankCards);
    const zRatio = Number(config.methodParams.simosZRatio ?? 1);
    const criterionIds = input.criteria.map((criterion) => criterion.id);
    const flattened = groups.flat();
    const groupSet = new Set(flattened);
    if (!groups.length || flattened.length !== input.criteria.length || groupSet.size !== input.criteria.length || !criterionIds.every((id) => groupSet.has(id))) {
      issues.push({ severity: 'error', sheet: 'SRF Cards Parameters', location: 'Card groups', message: 'SRF card groups must list every criterion ID exactly once, from least important to most important. Use commas for ties and vertical bars between groups.' });
    }
    if (blankCards.length !== Math.max(groups.length - 1, 0) || blankCards.some((value) => !Number.isFinite(value) || value < 0 || !Number.isInteger(value))) {
      issues.push({ severity: 'error', sheet: 'SRF Cards Parameters', location: 'Blank cards between groups', message: 'SRF blank cards must contain one whole non-negative number between each pair of groups.' });
    }
    if (!Number.isFinite(zRatio) || zRatio < 1) {
      issues.push({ severity: 'error', sheet: 'SRF Cards Parameters', location: 'Z ratio', message: 'SRF Z ratio must be numeric and greater than or equal to 1.' });
    }
  }
  if (config.weightingId === 'swara') {
    const order = parseList(config.methodParams.swaraOrder);
    const comparative = parseNumberList(config.methodParams.swaraComparativeImportance);
    const criterionIds = input.criteria.map((criterion) => criterion.id);
    const orderSet = new Set(order);
    if (order.length !== input.criteria.length || orderSet.size !== input.criteria.length || !criterionIds.every((id) => orderSet.has(id))) {
      issues.push({ severity: 'error', sheet: 'SWARA Parameters', location: 'Criterion order', message: 'SWARA criterion order must list every criterion ID exactly once.' });
    }
    if (comparative.length !== input.criteria.length || comparative.some((value) => !Number.isFinite(value) || value < 0)) {
      issues.push({ severity: 'error', sheet: 'SWARA Parameters', location: 'Comparative importance values', message: 'SWARA comparative importance must contain one non-negative numeric value per criterion.' });
    }
  }
  if (config.weightingId === 'roc') {
    const order = parseList(config.methodParams.rocOrder);
    const criterionIds = input.criteria.map((criterion) => criterion.id);
    const orderSet = new Set(order);
    if (order.length !== input.criteria.length || orderSet.size !== input.criteria.length || !criterionIds.every((id) => orderSet.has(id))) {
      issues.push({ severity: 'error', sheet: 'ROC Parameters', location: 'Criterion order', message: 'ROC criterion order must list every criterion ID exactly once.' });
    }
  }
  if (config.weightingId === 'fucom') {
    const order = parseList(config.methodParams.fucomOrder);
    const priorities = parseNumberList(config.methodParams.fucomComparativePriorities);
    const criterionIds = input.criteria.map((criterion) => criterion.id);
    const orderSet = new Set(order);
    if (order.length !== input.criteria.length || orderSet.size !== input.criteria.length || !criterionIds.every((id) => orderSet.has(id))) {
      issues.push({ severity: 'error', sheet: 'FUCOM Parameters', location: 'Criterion order', message: 'FUCOM criterion order must list every criterion ID exactly once.' });
    }
    if (priorities.length !== Math.max(input.criteria.length - 1, 0) || priorities.some((value) => !Number.isFinite(value) || value < 1)) {
      issues.push({ severity: 'error', sheet: 'FUCOM Parameters', location: 'Adjacent comparative priorities', message: 'FUCOM comparative priorities must contain n-1 numeric values, each greater than or equal to 1.' });
    }
  }
  if (config.weightingId === 'lbwa') {
    const levels = parseNumberList(config.methodParams.lbwaLevels);
    const importance = parseNumberList(config.methodParams.lbwaImportance);
    const elasticity = Number(config.methodParams.lbwaElasticity ?? 5);
    if (levels.length !== input.criteria.length || levels.some((value) => !Number.isFinite(value) || value < 1 || !Number.isInteger(value))) {
      issues.push({ severity: 'error', sheet: 'LBWA Parameters', location: 'Criterion levels', message: 'LBWA levels must contain one whole-number level per criterion, each greater than or equal to 1.' });
    }
    if (importance.length !== input.criteria.length || importance.some((value) => !Number.isFinite(value) || value < 0)) {
      issues.push({ severity: 'error', sheet: 'LBWA Parameters', location: 'Level importance values', message: 'LBWA importance values must contain one non-negative numeric value per criterion.' });
    }
    if (!Number.isFinite(elasticity) || elasticity < Math.max(...levels.filter(Number.isFinite), 1)) {
      issues.push({ severity: 'error', sheet: 'LBWA Parameters', location: 'Elasticity coefficient', message: 'LBWA elasticity coefficient must be numeric and at least as large as the maximum level value.' });
    }
    if (levels.length === input.criteria.length && importance.length === input.criteria.length) {
      const hasReference = levels.some((level, index) => level === 1 && importance[index] === 0);
      if (!hasReference) {
        issues.push({ severity: 'warning', sheet: 'LBWA Parameters', location: 'Reference criterion', message: 'LBWA usually includes the most important criterion at level 1 with importance value 0.' });
      }
    }
  }
  if (config.weightingId === 'piprecia') {
    const order = parseList(config.methodParams.pipreciaOrder);
    const significance = parseNumberList(config.methodParams.pipreciaRelativeSignificance);
    const criterionIds = input.criteria.map((criterion) => criterion.id);
    const orderSet = new Set(order);
    if (order.length !== input.criteria.length || orderSet.size !== input.criteria.length || !criterionIds.every((id) => orderSet.has(id))) {
      issues.push({ severity: 'error', sheet: 'PIPRECIA Parameters', location: 'Criterion order', message: 'PIPRECIA criterion order must list every criterion ID exactly once.' });
    }
    if (significance.length !== input.criteria.length || significance.some((value) => !Number.isFinite(value) || value <= 0 || value >= 2)) {
      issues.push({ severity: 'error', sheet: 'PIPRECIA Parameters', location: 'Relative significance values', message: 'PIPRECIA relative significance must contain one numeric value per criterion, each greater than 0 and less than 2.' });
    }
    if (significance.length && Number.isFinite(significance[0]) && Math.abs(significance[0] - 1) > 0.0001) {
      issues.push({ severity: 'warning', sheet: 'PIPRECIA Parameters', location: 'First relative significance', message: 'The first PIPRECIA relative significance value is usually 1 because it is the reference criterion in the ordered list.' });
    }
  }
  if (config.weightingId === 'rankSum') {
    const order = parseList(config.methodParams.rankSumOrder);
    const criterionIds = input.criteria.map((criterion) => criterion.id);
    const orderSet = new Set(order);
    if (order.length !== input.criteria.length || orderSet.size !== input.criteria.length || !criterionIds.every((id) => orderSet.has(id))) {
      issues.push({ severity: 'error', sheet: 'Rank Sum Parameters', location: 'Criterion order', message: 'Rank Sum criterion order must list every criterion ID exactly once.' });
    }
  }
  if (config.weightingId === 'rankReciprocal') {
    const order = parseList(config.methodParams.rankReciprocalOrder);
    const criterionIds = input.criteria.map((criterion) => criterion.id);
    const orderSet = new Set(order);
    if (order.length !== input.criteria.length || orderSet.size !== input.criteria.length || !criterionIds.every((id) => orderSet.has(id))) {
      issues.push({ severity: 'error', sheet: 'Rank Reciprocal Parameters', location: 'Criterion order', message: 'Rank Reciprocal criterion order must list every criterion ID exactly once.' });
    }
  }
  if (config.weightingId === 'rancom') {
    const ranks = parseNumberList(config.methodParams.rancomRanks);
    if (ranks.length !== input.criteria.length || ranks.some((value) => !Number.isFinite(value) || value < 1)) {
      issues.push({ severity: 'error', sheet: 'RANCOM Parameters', location: 'Rank positions', message: 'RANCOM rank positions must contain one positive numeric rank per criterion. Equal ranks are allowed for ties.' });
    }
  }
  input.values.forEach((row, rowIndex) => {
    if (row.length !== input.criteria.length) {
      issues.push({ severity: 'error', sheet: 'Decision Matrix', location: `Row ${rowIndex + 2}`, message: 'Decision row does not match criteria count.' });
    }
    row.forEach((value, columnIndex) => {
      if (!Number.isFinite(value)) {
        issues.push({ severity: 'error', sheet: 'Decision Matrix', location: `${input.criteria[columnIndex]?.id ?? columnIndex + 1}${rowIndex + 2}`, message: 'Decision matrix values must be numeric.' });
      }
    });
  });
  input.respondentMatrices?.forEach((matrix, respondentIndex) => {
    if (matrix.length !== input.alternatives.length) {
      issues.push({ severity: 'error', sheet: `Respondent ${respondentIndex + 1}`, location: 'A:Z', message: 'Respondent matrix row count must match the number of alternatives.' });
    }
    matrix.forEach((row, rowIndex) => {
      if (row.length !== input.criteria.length) {
        issues.push({ severity: 'error', sheet: `Respondent ${respondentIndex + 1}`, location: `Row ${rowIndex + 2}`, message: 'Respondent row does not match criteria count.' });
      }
      row.forEach((value, columnIndex) => {
        if (!Number.isFinite(value)) {
          issues.push({ severity: 'error', sheet: `Respondent ${respondentIndex + 1}`, location: `${input.criteria[columnIndex]?.id ?? columnIndex + 1}${rowIndex + 2}`, message: 'Respondent values must be numeric or fuzzy values in (l,m,u) / (a,b,c,d) form.' });
        }
      });
    });
  });
  input.respondentFuzzyMatrices?.forEach((matrix, respondentIndex) => {
    if (matrix.length !== input.alternatives.length) {
      issues.push({ severity: 'error', sheet: `Respondent ${respondentIndex + 1}`, location: 'A:Z', message: 'Fuzzy respondent matrix row count must match the number of alternatives.' });
    }
    matrix.forEach((row, rowIndex) => {
      if (row.length !== input.criteria.length) {
        issues.push({ severity: 'error', sheet: `Respondent ${respondentIndex + 1}`, location: `Row ${rowIndex + 2}`, message: 'Fuzzy respondent row does not match criteria count.' });
      }
      row.forEach((value, columnIndex) => {
        if (!value || !value.values.length || value.values.some((component) => !Number.isFinite(component))) {
          issues.push({ severity: 'error', sheet: `Respondent ${respondentIndex + 1}`, location: `${input.criteria[columnIndex]?.id ?? columnIndex + 1}${rowIndex + 2}`, message: 'Fuzzy respondent values must be valid triangular or trapezoidal numbers.' });
        }
      });
    });
  });
  if (input.respondentMatrices?.length && config.methodId !== 'dematel') {
    issues.push({ severity: 'info', sheet: 'Study Settings', location: 'Respondent aggregation', message: `${input.respondentMatrices.length} respondent matrix${input.respondentMatrices.length === 1 ? '' : 'es'} will be aggregated before analysis using ${String(config.methodParams.respondentAggregation ?? 'Arithmetic mean')}.` });
  }
  if (input.respondentFuzzyMatrices?.length && String(config.methodParams.fuzzyInputMode ?? '').startsWith('Native fuzzy')) {
    issues.push({ severity: 'info', sheet: 'Study Settings', location: 'Fuzzy input mode', message: `${input.respondentFuzzyMatrices.length} fuzzy respondent matrix${input.respondentFuzzyMatrices.length === 1 ? '' : 'es'} will be aggregated as fuzzy tuples before native fuzzy analysis.` });
  }
  if (input.fuzzyCellCount) {
    issues.push({ severity: 'info', sheet: 'Study Settings', location: 'Fuzzy input mode', message: fuzzyInputMessage(input, config) });
  }
  if (input.values.length !== input.alternatives.length) {
    issues.push({ severity: 'error', sheet: config.methodId === 'dematel' ? 'Direct Relation Matrix' : 'Decision Matrix', location: 'A:Z', message: 'Matrix row count does not match the number of alternatives/factors.' });
  }
  input.criteria.forEach((criterion, columnIndex) => {
    const missingColumn = input.values.some((row) => row[columnIndex] === undefined || Number.isNaN(row[columnIndex]));
    if (missingColumn) {
      issues.push({ severity: 'error', sheet: config.methodId === 'dematel' ? 'Direct Relation Matrix' : 'Decision Matrix', location: criterion.id, message: `Matrix column "${criterion.id}" is missing or incomplete.` });
    }
  });
  if (config.methodId === 'dematel') {
    if (input.alternatives.length !== input.criteria.length) {
      issues.push({ severity: 'error', sheet: 'Direct Relation Matrix', location: 'A:Z', message: 'DEMATEL requires the same factors as rows and columns.' });
    }
    if (input.values.length !== input.criteria.length) {
      issues.push({ severity: 'error', sheet: 'Direct Relation Matrix', location: 'A:Z', message: 'DEMATEL direct relation matrix must be square.' });
    }
    input.values.forEach((row, rowIndex) => {
      row.forEach((value, columnIndex) => {
        if (value < 0) {
          issues.push({ severity: 'error', sheet: 'Direct Relation Matrix', location: `${columnIndex + 2}:${rowIndex + 2}`, message: 'DEMATEL influence values must be zero or positive.' });
        }
        if (rowIndex === columnIndex && value !== 0) {
          issues.push({ severity: 'warning', sheet: 'Direct Relation Matrix', location: `${columnIndex + 2}:${rowIndex + 2}`, message: 'DEMATEL diagonal values should be zero; the analysis will enforce a zero diagonal.' });
        }
      });
    });
    const expectedExpertCount = Math.max(1, Number(config.methodParams.dematelExpertCount) || 1);
    if (dataInputMode === 'Multiple experts') {
      if (!input.expertMatrices?.length) {
        issues.push({ severity: 'error', sheet: 'Expert 1', location: 'Sheet', message: 'DEMATEL multiple-expert studies require at least one expert matrix sheet.' });
      }
      if ((input.expertMatrices?.length ?? 0) !== expectedExpertCount) {
        issues.push({ severity: 'error', sheet: 'Study Settings', location: 'Expert count', message: `DEMATEL expected ${expectedExpertCount} expert matrix sheet${expectedExpertCount === 1 ? '' : 's'}, but found ${input.expertMatrices?.length ?? 0}.` });
      }
    }
    input.expertMatrices?.forEach((matrix, expertIndex) => {
      validateDematelInfluenceMatrix(matrix, input.criteria.length, `Expert ${expertIndex + 1}`, issues);
    });
  }
  if (config.methodId === 'ahp' || config.weightingId === 'ahp') {
    const pairwiseMode = String(config.methodParams.ahpPairwiseMode ?? 'Criteria only');
    const threshold = Number(config.methodParams.ahpConsistencyThreshold ?? 0.1);
    if (!['Criteria only', 'Criteria and alternatives'].includes(pairwiseMode)) {
      issues.push({ severity: 'error', sheet: 'Consistency Settings', location: 'Pairwise mode', message: 'AHP pairwise mode must be Criteria only or Criteria and alternatives.' });
    }
    if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
      issues.push({ severity: 'error', sheet: 'Consistency Settings', location: 'Threshold', message: 'AHP consistency threshold must be greater than 0 and no more than 1.' });
    }
    const pairwise = config.ahpCriteriaPairwise ?? [];
    validatePairwiseMatrix(pairwise, input.criteria.length, 'Criteria Pairwise Matrix', issues);
    config.ahpCriteriaRespondentPairwise?.forEach((matrix, index) => validatePairwiseMatrix(matrix, input.criteria.length, `AHP Criteria Respondent ${index + 1}`, issues));
    Object.entries(config.ahpAlternativeRespondentPairwise ?? {}).forEach(([criterionId, matrices]) => {
      matrices.forEach((matrix, index) => validatePairwiseMatrix(matrix, input.alternatives.length, `AHP Alternatives Respondent ${index + 1} (${criterionId})`, issues));
    });
  }
  if (config.methodId === 'vikor') {
    const v = Number(config.methodParams.vikorV ?? config.vikorV);
    const advantageMode = String(config.methodParams.vikorAcceptableAdvantageMode ?? 'Auto DQ = 1/(m-1)');
    const dq = Number(config.methodParams.vikorAcceptableAdvantageDQ ?? 1 / Math.max(input.alternatives.length - 1, 1));
    const stabilityRule = String(config.methodParams.vikorStabilityRule ?? 'Q winner must also lead S or R');
    if (!Number.isFinite(v) || v < 0 || v > 1) {
      issues.push({ severity: 'error', sheet: 'VIKOR Parameters', location: 'B2', message: 'VIKOR strategy coefficient v must be between 0 and 1.' });
    }
    if (!['Auto DQ = 1/(m-1)', 'Manual DQ'].includes(advantageMode)) {
      issues.push({ severity: 'error', sheet: 'VIKOR Parameters', location: 'Acceptable advantage mode', message: 'VIKOR acceptable advantage mode must be Auto DQ = 1/(m-1) or Manual DQ.' });
    }
    if (advantageMode === 'Manual DQ' && (!Number.isFinite(dq) || dq < 0 || dq > 1)) {
      issues.push({ severity: 'error', sheet: 'VIKOR Parameters', location: 'Acceptable advantage DQ', message: 'Manual VIKOR DQ must be between 0 and 1.' });
    }
    if (!['Q winner must also lead S or R', 'Diagnostic only'].includes(stabilityRule)) {
      issues.push({ severity: 'error', sheet: 'VIKOR Parameters', location: 'Stability rule', message: 'VIKOR stability rule must be Q winner must also lead S or R, or Diagnostic only.' });
    }
  }
  if (config.methodId === 'topsis') {
    const normalization = String(config.methodParams.normalization ?? 'Vector normalization');
    const distanceMetric = String(config.methodParams.distanceMetric ?? 'Euclidean');
    const idealSolution = String(config.methodParams.idealSolution ?? 'Benefit/cost aware');
    if (!['Vector normalization', 'Linear normalization'].includes(normalization)) {
      issues.push({ severity: 'error', sheet: 'Normalization Settings', location: 'Normalization', message: 'TOPSIS normalization must be Vector normalization or Linear normalization.' });
    }
    if (distanceMetric !== 'Euclidean') {
      issues.push({ severity: 'error', sheet: 'Normalization Settings', location: 'Distance metric', message: 'TOPSIS currently supports Euclidean distance.' });
    }
    if (idealSolution !== 'Benefit/cost aware') {
      issues.push({ severity: 'error', sheet: 'Normalization Settings', location: 'Ideal solution', message: 'TOPSIS ideal solution handling must be Benefit/cost aware.' });
    }
  }
  if (config.methodId === 'marcos') {
    const scoreMode = String(config.methodParams.marcosScoreMode ?? 'Standard utility function f(K)');
    if (!['Standard utility function f(K)', 'Published range-scaled f(K+) convention'].includes(scoreMode)) {
      issues.push({ severity: 'error', sheet: 'MARCOS Settings', location: 'Ranking convention', message: 'MARCOS ranking convention must be Standard utility function f(K) or Published range-scaled f(K+) convention.' });
    }
  }
  if (config.methodId === 'psi') {
    const scoreMode = String(config.methodParams.psiScoreMode ?? 'Criterion objective weights');
    if (!['Criterion objective weights', 'Alternative preference index'].includes(scoreMode)) {
      issues.push({ severity: 'error', sheet: 'PSI Settings', location: 'Scoring convention', message: 'PSI scoring convention must be Criterion objective weights or Alternative preference index.' });
    }
  }
  if (config.methodId === 'lmaw') {
    const scoreMode = String(config.methodParams.lmawScoreMode ?? 'Nonlinear Q utility');
    if (!['Nonlinear Q utility', 'Weighted log sum'].includes(scoreMode)) {
      issues.push({ severity: 'error', sheet: 'LMAW Settings', location: 'Scoring convention', message: 'LMAW scoring convention must be Nonlinear Q utility or Weighted log sum.' });
    }
  }
  if (config.methodId === 'promethee') {
    const preferenceFunction = String(config.methodParams.preferenceFunction ?? 'Usual');
    const q = Number(config.methodParams.prometheeIndifferenceThreshold ?? 0);
    const p = Number(config.methodParams.prometheePreferenceThreshold ?? 1);
    const sigma = Number(config.methodParams.prometheeGaussianSigma ?? 1);
    const functionsWithQ = ['U-shape', 'Level', 'Linear'];
    const functionsWithP = ['V-shape', 'Level', 'Linear'];
    if (!['Usual', 'U-shape', 'V-shape', 'Level', 'Linear', 'Gaussian'].includes(preferenceFunction)) {
      issues.push({ severity: 'error', sheet: 'PROMETHEE Settings', location: 'Preference function', message: 'PROMETHEE preference function must be Usual, U-shape, V-shape, Level, Linear, or Gaussian.' });
    }
    if (functionsWithQ.includes(preferenceFunction) && (!Number.isFinite(q) || q < 0)) {
      issues.push({ severity: 'error', sheet: 'PROMETHEE Settings', location: 'Indifference threshold q', message: 'PROMETHEE indifference threshold q must be a non-negative number.' });
    }
    if (functionsWithP.includes(preferenceFunction) && (!Number.isFinite(p) || p <= 0)) {
      issues.push({ severity: 'error', sheet: 'PROMETHEE Settings', location: 'Preference threshold p', message: 'PROMETHEE preference threshold p must be greater than zero.' });
    }
    if (['Level', 'Linear'].includes(preferenceFunction) && Number.isFinite(q) && Number.isFinite(p) && p <= q) {
      issues.push({ severity: 'error', sheet: 'PROMETHEE Settings', location: 'Thresholds q/p', message: 'PROMETHEE preference threshold p must be greater than indifference threshold q for Level and Linear functions.' });
    }
    if (preferenceFunction === 'Gaussian' && (!Number.isFinite(sigma) || sigma <= 0)) {
      issues.push({ severity: 'error', sheet: 'PROMETHEE Settings', location: 'Gaussian sigma', message: 'PROMETHEE Gaussian sigma must be greater than zero.' });
    }
  }
  if (config.methodId === 'waspas') {
    const lambda = Number(config.methodParams.waspasLambda ?? config.waspasLambda);
    if (!Number.isFinite(lambda) || lambda < 0 || lambda > 1) {
      issues.push({ severity: 'error', sheet: 'Lambda Settings', location: 'B2', message: 'WASPAS lambda must be between 0 and 1.' });
    }
  }
  if (config.methodId === 'codas') {
    const normalization = String(config.methodParams.normalization ?? 'Linear normalization');
    const tau = Number(config.methodParams.codasTau ?? 0.02);
    if (normalization !== 'Linear normalization') {
      issues.push({ severity: 'error', sheet: 'CODAS Settings', location: 'Normalization', message: 'CODAS currently supports Linear normalization.' });
    }
    if (!Number.isFinite(tau) || tau < 0) {
      issues.push({ severity: 'error', sheet: 'CODAS Settings', location: 'Tau threshold', message: 'CODAS tau threshold must be a non-negative number.' });
    }
  }
  if (config.methodId === 'cocoso') {
    const normalization = String(config.methodParams.normalization ?? 'Linear normalization');
    const lambda = Number(config.methodParams.cocosoLambda ?? 0.5);
    if (normalization !== 'Linear normalization') {
      issues.push({ severity: 'error', sheet: 'CoCoSo Settings', location: 'Normalization', message: 'CoCoSo currently supports Linear normalization.' });
    }
    if (!Number.isFinite(lambda) || lambda < 0 || lambda > 1) {
      issues.push({ severity: 'error', sheet: 'CoCoSo Settings', location: 'Lambda', message: 'CoCoSo lambda must be between 0 and 1.' });
    }
  }
  if (config.methodId === 'ram') {
    const normalization = String(config.methodParams.normalization ?? 'Column-sum normalization');
    if (normalization !== 'Column-sum normalization') {
      issues.push({ severity: 'error', sheet: 'Method Parameters', location: 'normalization', message: 'RAM currently supports Column-sum normalization.' });
    }
  }
  if (config.methodId === 'arlon') {
    const gamma = Number(config.methodParams.arlonGamma ?? 0.5);
    if (!Number.isFinite(gamma) || gamma < 0 || gamma > 1) {
      issues.push({ severity: 'error', sheet: 'ARLON Settings', location: 'Gamma', message: 'ARLON gamma must be between 0 and 1.' });
    }
  }
  if (config.methodId === 'seca') {
    const epsilon = Number(config.methodParams.secaEpsilon ?? 0.001);
    const balance = Number(config.methodParams.secaReferenceBalance ?? 0.5);
    if (!Number.isFinite(epsilon) || epsilon < 0 || epsilon > 1 / Math.max(input.criteria.length, 1)) {
      issues.push({ severity: 'error', sheet: 'SECA Settings', location: 'epsilon', message: 'SECA epsilon must be non-negative and no greater than 1 divided by the criteria count.' });
    }
    if (!Number.isFinite(balance) || balance < 0 || balance > 1) {
      issues.push({ severity: 'error', sheet: 'SECA Settings', location: 'reference balance', message: 'SECA reference balance must be between 0 and 1.' });
    }
  }
  if (config.methodId === 'eamr') {
    const beta = Number(config.methodParams.eamrBeta ?? 0.5);
    const lambda = Number(config.methodParams.eamrLambda ?? 0.5);
    if (!Number.isFinite(beta) || beta < 0 || beta > 1) {
      issues.push({ severity: 'error', sheet: 'EAMR Settings', location: 'beta', message: 'EAMR beta must be between 0 and 1.' });
    }
    if (!Number.isFinite(lambda) || lambda < 0 || lambda > 1) {
      issues.push({ severity: 'error', sheet: 'EAMR Settings', location: 'lambda', message: 'EAMR lambda must be between 0 and 1.' });
    }
  }
  if (config.methodId === 'comet') {
    const characteristicMode = String(config.methodParams.cometCharacteristicValues ?? 'min,mid,max');
    const preferenceModel = String(config.methodParams.cometPreferenceModel ?? 'Weight-directed preference');
    const allowedModes = new Set(['min,max', 'min,mid,max', 'quartiles']);
    if (!allowedModes.has(characteristicMode)) {
      issues.push({ severity: 'error', sheet: 'COMET Settings', location: 'Characteristic values', message: 'COMET characteristic values must be min,max; min,mid,max; or quartiles.' });
    }
    if (!['Weight-directed preference', 'TOPSIS expert'].includes(preferenceModel)) {
      issues.push({ severity: 'error', sheet: 'COMET Settings', location: 'Preference model', message: 'COMET preference model must be Weight-directed preference or TOPSIS expert.' });
    }
    if (input.criteria.length > 8 && characteristicMode === 'quartiles') {
      issues.push({ severity: 'warning', sheet: 'COMET Settings', location: 'Characteristic values', message: 'Quartile COMET with more than 8 criteria creates many characteristic objects; consider min,mid,max for smoother browser performance.' });
    }
    if (input.criteria.length > 12 && characteristicMode !== 'min,max') {
      issues.push({ severity: 'warning', sheet: 'COMET Settings', location: 'Characteristic values', message: 'COMET characteristic-object count grows quickly with criteria count; review whether the selected characteristic-value density is practical.' });
    }
  }
  if (config.methodId === 'macont') {
    const lambda = Number(config.methodParams.macontLambda ?? 1 / 3);
    const mu = Number(config.methodParams.macontMu ?? 1 / 3);
    const delta = Number(config.methodParams.macontDelta ?? 0.5);
    const theta = Number(config.methodParams.macontTheta ?? 0.5);
    if (!Number.isFinite(lambda) || lambda < 0 || lambda > 1) {
      issues.push({ severity: 'error', sheet: 'MACONT Settings', location: 'lambda', message: 'MACONT lambda must be between 0 and 1.' });
    }
    if (!Number.isFinite(mu) || mu < 0 || mu > 1) {
      issues.push({ severity: 'error', sheet: 'MACONT Settings', location: 'mu', message: 'MACONT mu must be between 0 and 1.' });
    }
    if (Number.isFinite(lambda) && Number.isFinite(mu) && lambda + mu > 1) {
      issues.push({ severity: 'error', sheet: 'MACONT Settings', location: 'lambda + mu', message: 'MACONT lambda plus mu must be less than or equal to 1.' });
    }
    if (!Number.isFinite(delta) || delta < 0 || delta > 1) {
      issues.push({ severity: 'error', sheet: 'MACONT Settings', location: 'delta', message: 'MACONT delta must be between 0 and 1.' });
    }
    if (!Number.isFinite(theta) || theta < 0 || theta > 1) {
      issues.push({ severity: 'error', sheet: 'MACONT Settings', location: 'theta', message: 'MACONT theta must be between 0 and 1.' });
    }
  }
  if (config.methodId === 'dematel') {
    const expertCount = Number(config.methodParams.dematelExpertCount);
    const aggregation = String(config.methodParams.dematelAggregation ?? 'Arithmetic mean');
    const thresholdMode = String(config.methodParams.dematelThreshold ?? 'Mean threshold');
    const fuzzyCalculation = String(config.methodParams.dematelFuzzyCalculation ?? 'Component-wise fuzzy total relation');
    if (!Number.isInteger(expertCount) || expertCount < 1) {
      issues.push({ severity: 'error', sheet: 'Study Settings', location: 'Expert count', message: 'DEMATEL expert count must be a whole number greater than or equal to 1.' });
    }
    if (dataInputMode === 'Multiple experts' && aggregation !== 'Arithmetic mean') {
      issues.push({ severity: 'error', sheet: 'Study Settings', location: 'Aggregation', message: 'DEMATEL currently supports Arithmetic mean expert aggregation.' });
    }
    if (!['Mean threshold', 'Manual threshold'].includes(thresholdMode)) {
      issues.push({ severity: 'error', sheet: 'Threshold Settings', location: 'Threshold method', message: 'DEMATEL threshold method must be Mean threshold or Manual threshold.' });
    }
    if (!['Component-wise fuzzy total relation', 'Defuzzify before total relation'].includes(fuzzyCalculation)) {
      issues.push({ severity: 'error', sheet: 'Threshold Settings', location: 'Fuzzy DEMATEL calculation', message: 'DEMATEL fuzzy calculation must be Component-wise fuzzy total relation or Defuzzify before total relation.' });
    }
    if (thresholdMode === 'Manual threshold') {
      const threshold = Number(config.methodParams.dematelManualThreshold);
      if (!Number.isFinite(threshold) || threshold < 0) {
        issues.push({ severity: 'error', sheet: 'Threshold Settings', location: 'Manual threshold value', message: 'DEMATEL manual threshold must be a non-negative numeric value.' });
      }
    }
  }
  if (config.methodId === 'multimoora') {
    const aggregation = String(config.methodParams.multimooraAggregation ?? '').trim() || 'Dominance theory';
    if (!['Dominance theory', 'Rank sum'].includes(aggregation)) {
      issues.push({ severity: 'error', sheet: 'Method Parameters', location: 'multimooraAggregation', message: 'MULTIMOORA aggregation must be Dominance theory or Rank sum.' });
    }
  }
  if (config.methodId === 'electre') {
    const concordance = Number(config.methodParams.electreConcordance ?? 0.6);
    const discordance = Number(config.methodParams.electreDiscordance ?? 0.4);
    if (!Number.isFinite(concordance) || concordance < 0 || concordance > 1) {
      issues.push({ severity: 'error', sheet: 'Method Parameters', location: 'electreConcordance', message: 'ELECTRE concordance threshold must be between 0 and 1.' });
    }
    if (!Number.isFinite(discordance) || discordance < 0 || discordance > 1) {
      issues.push({ severity: 'error', sheet: 'Method Parameters', location: 'electreDiscordance', message: 'ELECTRE discordance threshold must be between 0 and 1.' });
    }
  }
  if (config.methodId === 'todim') {
    const theta = Number(config.methodParams.todimTheta ?? 1);
    if (!Number.isFinite(theta) || theta <= 0) {
      issues.push({ severity: 'error', sheet: 'Method Parameters', location: 'todimTheta', message: 'TODIM loss attenuation theta must be greater than 0.' });
    }
  }
  if (config.methodId === 'spotis') {
    const boundsMode = String(config.methodParams.spotisBounds ?? 'Observed data range');
    if (!['Observed data range', 'Manual bounds'].includes(boundsMode)) {
      issues.push({ severity: 'error', sheet: 'SPOTIS Bounds', location: 'Criterion bounds', message: 'SPOTIS criterion bounds must be Observed data range or Manual bounds.' });
    }
  }
  if (config.methodId === 'spotis' && config.methodParams.spotisBounds === 'Manual bounds') {
    const lower = parseNumberList(config.methodParams.spotisLowerBounds);
    const upper = parseNumberList(config.methodParams.spotisUpperBounds);
    if (lower.length !== input.criteria.length || lower.some((value) => !Number.isFinite(value))) {
      issues.push({ severity: 'error', sheet: 'SPOTIS Bounds', location: 'Lower Bound', message: 'SPOTIS lower bounds must contain one numeric value per criterion.' });
    }
    if (upper.length !== input.criteria.length || upper.some((value) => !Number.isFinite(value))) {
      issues.push({ severity: 'error', sheet: 'SPOTIS Bounds', location: 'Upper Bound', message: 'SPOTIS upper bounds must contain one numeric value per criterion.' });
    }
    input.criteria.forEach((criterion, columnIndex) => {
      const min = lower[columnIndex];
      const max = upper[columnIndex];
      if (Number.isFinite(min) && Number.isFinite(max)) {
        if (min >= max) {
          issues.push({ severity: 'error', sheet: 'SPOTIS Bounds', location: criterion.id, message: `SPOTIS lower bound must be less than upper bound for ${criterion.id}.` });
        }
        input.values.forEach((row, rowIndex) => {
          const value = row[columnIndex];
          if (Number.isFinite(value) && (value < min || value > max)) {
            issues.push({ severity: 'error', sheet: 'SPOTIS Bounds', location: `${criterion.id}${rowIndex + 2}`, message: `Decision value ${value} is outside the SPOTIS bounds for ${criterion.id}.` });
          }
        });
      }
    });
  }
  if (config.methodId === 'espSpotis') {
    const expected = parseNumberList(config.methodParams.espSpotisPoint);
    const boundsMode = String(config.methodParams.espSpotisBounds ?? 'Observed data range');
    const manualBounds = boundsMode === 'Manual bounds';
    const lower = parseNumberList(config.methodParams.spotisLowerBounds);
    const upper = parseNumberList(config.methodParams.spotisUpperBounds);
    if (!['Observed data range', 'Manual bounds'].includes(boundsMode)) {
      issues.push({ severity: 'error', sheet: 'ESP-SPOTIS Point', location: 'Bounds Mode', message: 'ESP-SPOTIS bounds mode must be Observed data range or Manual bounds.' });
    }
    if (expected.length !== input.criteria.length || expected.some((value) => !Number.isFinite(value))) {
      issues.push({ severity: 'error', sheet: 'ESP-SPOTIS Point', location: 'Expected Point', message: 'ESP-SPOTIS expected solution point must contain one numeric value per criterion.' });
    }
    if (manualBounds && (lower.length !== input.criteria.length || lower.some((value) => !Number.isFinite(value)) || upper.length !== input.criteria.length || upper.some((value) => !Number.isFinite(value)))) {
      issues.push({ severity: 'error', sheet: 'ESP-SPOTIS Point', location: 'Lower/Upper Bound', message: 'ESP-SPOTIS manual bounds must contain one lower and upper numeric value per criterion.' });
    }
    const observedBounds = input.criteria.map((_, column) => {
      const values = input.values.map((row) => row[column]);
      return { min: Math.min(...values), max: Math.max(...values) };
    });
    input.criteria.forEach((criterion, columnIndex) => {
      const min = manualBounds ? lower[columnIndex] : observedBounds[columnIndex].min;
      const max = manualBounds ? upper[columnIndex] : observedBounds[columnIndex].max;
      const value = expected[columnIndex];
      if (Number.isFinite(min) && Number.isFinite(max) && min >= max) {
        issues.push({ severity: 'error', sheet: 'ESP-SPOTIS Point', location: criterion.id, message: `ESP-SPOTIS lower bound must be less than upper bound for ${criterion.id}.` });
      }
      if (Number.isFinite(value) && Number.isFinite(min) && Number.isFinite(max) && (value < min || value > max)) {
        issues.push({ severity: 'warning', sheet: 'ESP-SPOTIS Point', location: criterion.id, message: `Expected point for ${criterion.id} is outside bounds and will be clipped during analysis.` });
      }
    });
  }
  if (config.methodId === 'balancedSpotis') {
    const expected = parseNumberList(config.methodParams.espSpotisPoint);
    const boundsMode = String(config.methodParams.balancedSpotisBounds ?? 'Observed data range');
    const alpha = Number(config.methodParams.balancedSpotisAlpha ?? 0.5);
    const lower = parseNumberList(config.methodParams.spotisLowerBounds);
    const upper = parseNumberList(config.methodParams.spotisUpperBounds);
    if (!['Observed data range', 'Manual bounds'].includes(boundsMode)) {
      issues.push({ severity: 'error', sheet: 'B-SPOTIS Settings', location: 'Bounds Mode', message: 'B-SPOTIS bounds mode must be Observed data range or Manual bounds.' });
    }
    if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
      issues.push({ severity: 'error', sheet: 'B-SPOTIS Settings', location: 'Alpha', message: 'B-SPOTIS alpha must be between 0 and 1.' });
    }
    if (expected.length !== input.criteria.length || expected.some((value) => !Number.isFinite(value))) {
      issues.push({ severity: 'error', sheet: 'B-SPOTIS Settings', location: 'Expected Point', message: 'B-SPOTIS expected solution point must contain one numeric value per criterion.' });
    }
    if (boundsMode === 'Manual bounds') {
      if (lower.length !== input.criteria.length || upper.length !== input.criteria.length || lower.some((value) => !Number.isFinite(value)) || upper.some((value) => !Number.isFinite(value))) {
        issues.push({ severity: 'error', sheet: 'B-SPOTIS Settings', location: 'Lower/Upper Bound', message: 'B-SPOTIS manual bounds must contain one lower and upper numeric value per criterion.' });
      }
      input.criteria.forEach((criterion, index) => {
        if (!Number.isFinite(lower[index]) || !Number.isFinite(upper[index])) return;
        if (lower[index] >= upper[index]) {
          issues.push({ severity: 'error', sheet: 'B-SPOTIS Settings', location: criterion.id, message: `B-SPOTIS lower bound must be less than upper bound for ${criterion.id}.` });
        }
        if (Number.isFinite(expected[index]) && (expected[index] < lower[index] || expected[index] > upper[index])) {
          issues.push({ severity: 'warning', sheet: 'B-SPOTIS Settings', location: criterion.id, message: `Expected point for ${criterion.id} is outside bounds and will be clipped during analysis.` });
        }
      });
    }
  }
  if (config.methodId === 'rim') {
    const referenceMode = String(config.methodParams.rimReference ?? 'Observed ideal point');
    if (!['Observed ideal point', 'Manual ideal interval'].includes(referenceMode)) {
      issues.push({ severity: 'error', sheet: 'RIM Ideal Intervals', location: 'Reference ideal', message: 'RIM reference ideal must be Observed ideal point or Manual ideal interval.' });
    }
  }
  if (config.methodId === 'sprobid') {
    const referenceMode = String(config.methodParams.sprobidReference ?? 'First/last-quarter ideal distance');
    if (referenceMode !== 'First/last-quarter ideal distance') {
      issues.push({ severity: 'error', sheet: 'SPROBID Settings', location: 'Reference model', message: 'SPROBID reference model must be First/last-quarter ideal distance.' });
    }
  }
  if (config.methodId === 'rim' && config.methodParams.rimReference === 'Manual ideal interval') {
    const domainLower = parseNumberList(config.methodParams.rimDomainLower);
    const domainUpper = parseNumberList(config.methodParams.rimDomainUpper);
    const lower = parseNumberList(config.methodParams.rimIdealLower);
    const upper = parseNumberList(config.methodParams.rimIdealUpper);
    if (domainLower.length !== input.criteria.length || domainLower.some((value) => !Number.isFinite(value))) {
      issues.push({ severity: 'error', sheet: 'RIM Ideal Intervals', location: 'Domain Lower', message: 'RIM domain lower bounds must contain one numeric value per criterion.' });
    }
    if (domainUpper.length !== input.criteria.length || domainUpper.some((value) => !Number.isFinite(value))) {
      issues.push({ severity: 'error', sheet: 'RIM Ideal Intervals', location: 'Domain Upper', message: 'RIM domain upper bounds must contain one numeric value per criterion.' });
    }
    if (lower.length !== input.criteria.length || lower.some((value) => !Number.isFinite(value))) {
      issues.push({ severity: 'error', sheet: 'RIM Ideal Intervals', location: 'Ideal Lower', message: 'RIM ideal lower interval must contain one numeric value per criterion.' });
    }
    if (upper.length !== input.criteria.length || upper.some((value) => !Number.isFinite(value))) {
      issues.push({ severity: 'error', sheet: 'RIM Ideal Intervals', location: 'Ideal Upper', message: 'RIM ideal upper interval must contain one numeric value per criterion.' });
    }
    input.criteria.forEach((criterion, columnIndex) => {
      const observed = input.values.map((row) => row[columnIndex]);
      const observedMin = Math.min(...observed);
      const observedMax = Math.max(...observed);
      const domainMin = domainLower[columnIndex];
      const domainMax = domainUpper[columnIndex];
      const min = lower[columnIndex];
      const max = upper[columnIndex];
      if (Number.isFinite(min) && Number.isFinite(max)) {
        if (Number.isFinite(domainMin) && Number.isFinite(domainMax) && domainMin > domainMax) {
          issues.push({ severity: 'error', sheet: 'RIM Ideal Intervals', location: criterion.id, message: `RIM domain lower bound must be less than or equal to domain upper bound for ${criterion.id}.` });
        }
        if (Number.isFinite(domainMin) && Number.isFinite(domainMax) && (observedMin < domainMin || observedMax > domainMax)) {
          issues.push({ severity: 'error', sheet: 'RIM Ideal Intervals', location: criterion.id, message: `Observed values for ${criterion.id} must stay inside the RIM domain bounds.` });
        }
        if (min > max) {
          issues.push({ severity: 'error', sheet: 'RIM Ideal Intervals', location: criterion.id, message: `RIM ideal lower interval must be less than or equal to ideal upper interval for ${criterion.id}.` });
        }
        if (Number.isFinite(domainMin) && Number.isFinite(domainMax) && (min < domainMin || max > domainMax)) {
          issues.push({ severity: 'error', sheet: 'RIM Ideal Intervals', location: criterion.id, message: `RIM ideal interval for ${criterion.id} must stay inside the domain bounds.` });
        }
      }
    });
  }
  if (config.methodId === 'gra' || config.methodId === 'grp') {
    const zeta = Number(config.methodParams.graZeta ?? 0.5);
    if (!Number.isFinite(zeta) || zeta < 0 || zeta > 1) {
      issues.push({ severity: 'error', sheet: 'Method Parameters', location: 'graZeta', message: 'Grey distinguishing coefficient zeta must be between 0 and 1.' });
    }
  }
  if (config.methodId === 'aroman') {
    const beta = Number(config.methodParams.aromanBeta ?? 0.5);
    const lambda = Number(config.methodParams.aromanLambda ?? 0.5);
    if (!Number.isFinite(beta) || beta < 0 || beta > 1) {
      issues.push({ severity: 'error', sheet: 'AROMAN Settings', location: 'beta', message: 'AROMAN beta must be between 0 and 1.' });
    }
    if (!Number.isFinite(lambda) || lambda < 0 || lambda > 1) {
      issues.push({ severity: 'error', sheet: 'AROMAN Settings', location: 'lambda', message: 'AROMAN lambda must be between 0 and 1.' });
    }
  }
  if (config.methodId === 'ervd') {
    const lambda = Number(config.methodParams.ervdLambda ?? 2.25);
    const alpha = Number(config.methodParams.ervdAlpha ?? 0.88);
    const referenceMode = String(config.methodParams.ervdReferenceMode ?? 'Observed mean');
    if (!['Observed mean', 'Manual reference point'].includes(referenceMode)) {
      issues.push({ severity: 'error', sheet: 'ERVD Settings', location: 'Reference point', message: 'ERVD reference point mode must be Observed mean or Manual reference point.' });
    }
    if (!Number.isFinite(lambda) || lambda <= 0) {
      issues.push({ severity: 'error', sheet: 'ERVD Settings', location: 'lambda', message: 'ERVD lambda must be greater than 0.' });
    }
    if (!Number.isFinite(alpha) || alpha <= 0) {
      issues.push({ severity: 'error', sheet: 'ERVD Settings', location: 'alpha', message: 'ERVD alpha must be greater than 0.' });
    }
    if (config.methodParams.ervdReferenceMode === 'Manual reference point') {
      const reference = parseNumberList(config.methodParams.ervdReferencePoint);
      if (reference.length !== input.criteria.length || reference.some((value) => !Number.isFinite(value))) {
        issues.push({ severity: 'error', sheet: 'ERVD Reference Point', location: 'Reference Value', message: 'ERVD manual reference point must contain one numeric value per criterion.' });
      }
    }
  }
  if (config.methodId === 'rafsi') {
    const lower = Number(config.methodParams.rafsiIntervalLower ?? 1);
    const upper = Number(config.methodParams.rafsiIntervalUpper ?? 6);
    const referenceMode = String(config.methodParams.rafsiReferenceMode ?? 'Observed extremes');
    if (!Number.isFinite(lower) || lower <= 0) {
      issues.push({ severity: 'error', sheet: 'RAFSI Interval', location: 'Interval lower bound', message: 'RAFSI interval lower bound must be greater than 0.' });
    }
    if (!Number.isFinite(upper) || upper <= lower) {
      issues.push({ severity: 'error', sheet: 'RAFSI Interval', location: 'Interval upper bound', message: 'RAFSI interval upper bound must be greater than the lower bound.' });
    }
    if (!['Observed extremes', 'Manual reference values'].includes(referenceMode)) {
      issues.push({ severity: 'error', sheet: 'RAFSI Interval', location: 'Reference mode', message: 'RAFSI reference mode must be Observed extremes or Manual reference values.' });
    }
    if (referenceMode === 'Manual reference values') {
      const idealValues = parseNumberList(config.methodParams.rafsiIdealValues);
      const antiIdealValues = parseNumberList(config.methodParams.rafsiAntiIdealValues);
      if (idealValues.length !== input.criteria.length || idealValues.some((value) => !Number.isFinite(value))) {
        issues.push({ severity: 'error', sheet: 'RAFSI Interval', location: 'Ideal Value', message: 'RAFSI ideal values must contain one numeric value per criterion.' });
      }
      if (antiIdealValues.length !== input.criteria.length || antiIdealValues.some((value) => !Number.isFinite(value))) {
        issues.push({ severity: 'error', sheet: 'RAFSI Interval', location: 'Anti-Ideal Value', message: 'RAFSI anti-ideal values must contain one numeric value per criterion.' });
      }
      if (idealValues.length === input.criteria.length && antiIdealValues.length === input.criteria.length) {
        input.criteria.forEach((criterion, index) => {
          const ideal = idealValues[index];
          const antiIdeal = antiIdealValues[index];
          if (Number.isFinite(ideal) && Number.isFinite(antiIdeal) && Math.abs(ideal - antiIdeal) <= 1e-12) {
            issues.push({ severity: 'error', sheet: 'RAFSI Interval', location: criterion.id, message: `RAFSI ideal and anti-ideal values must differ for ${criterion.id}.` });
          }
          if (criterion.direction === 'benefit' && ideal <= antiIdeal) {
            issues.push({ severity: 'error', sheet: 'RAFSI Interval', location: criterion.id, message: `RAFSI benefit criterion ${criterion.id} requires ideal value greater than anti-ideal value.` });
          }
          if (criterion.direction === 'cost' && ideal >= antiIdeal) {
            issues.push({ severity: 'error', sheet: 'RAFSI Interval', location: criterion.id, message: `RAFSI cost criterion ${criterion.id} requires ideal value lower than anti-ideal value.` });
          }
        });
      }
    }
  }
  if (config.methodId === 'lopm') {
    const limitsMode = String(config.methodParams.lopmLimitsMode ?? 'Observed limits');
    const targetTolerance = Number(config.methodParams.lopmTargetTolerance ?? 0);
    if (!['Observed limits', 'Manual property limits'].includes(limitsMode)) {
      issues.push({ severity: 'error', sheet: 'LoPM Property Limits', location: 'Property limits', message: 'LoPM property limits mode must be Observed limits or Manual property limits.' });
    }
    if (!Number.isFinite(targetTolerance) || targetTolerance < 0) {
      issues.push({ severity: 'error', sheet: 'Method Parameters', location: 'lopmTargetTolerance', message: 'LoPM target tolerance must be 0 or greater.' });
    }
  }
  if (config.methodId === 'lopm' && config.methodParams.lopmLimitsMode === 'Manual property limits') {
    const types = parseList(config.methodParams.lopmPropertyTypes);
    const limits = parseNumberList(config.methodParams.lopmPropertyLimits);
    const allowed = new Set(['lower', 'upper', 'target']);
    if (types.length !== input.criteria.length || types.some((value) => !allowed.has(value.toLowerCase()))) {
      issues.push({ severity: 'error', sheet: 'LoPM Property Limits', location: 'Property Type', message: 'LoPM property types must contain one value per criterion: lower, upper, or target.' });
    }
    if (limits.length !== input.criteria.length || limits.some((value) => !Number.isFinite(value) || value === 0)) {
      issues.push({ severity: 'error', sheet: 'LoPM Property Limits', location: 'Property Limit', message: 'LoPM property limits must contain one nonzero numeric value per criterion.' });
    }
  }
  if (config.methodId === 'lexicographic') {
    const order = parseList(config.methodParams.lexicographicOrder);
    const criterionIds = input.criteria.map((criterion) => criterion.id);
    if (order.length !== criterionIds.length || new Set(order).size !== criterionIds.length || order.some((id) => !criterionIds.includes(id))) {
      issues.push({ severity: 'error', sheet: 'Lexicographic Settings', location: 'Criterion priority order', message: 'Lexicographic criterion priority order must list every criterion ID exactly once.' });
    }
  }
  if (config.methodId === 'smarter') {
    const order = parseList(config.methodParams.smarterOrder);
    const utilityMode = String(config.methodParams.smarterUtilityMode ?? 'Normalize performances');
    const scoreMode = String(config.methodParams.smarterScoreMode ?? 'Raw additive utility');
    const criterionIds = input.criteria.map((criterion) => criterion.id);
    if (order.length !== criterionIds.length || new Set(order).size !== criterionIds.length || order.some((id) => !criterionIds.includes(id))) {
      issues.push({ severity: 'error', sheet: 'SMARTER Settings', location: 'Ranked swing-weight order', message: 'SMARTER ranked swing-weight order must list every criterion ID exactly once.' });
    }
    if (!['Normalize performances', 'Input values are utilities'].includes(utilityMode)) {
      issues.push({ severity: 'error', sheet: 'SMARTER Settings', location: 'Utility input', message: 'SMARTER utility input must be Normalize performances or Input values are utilities.' });
    }
    if (!['Raw additive utility', 'Normalize total scores'].includes(scoreMode)) {
      issues.push({ severity: 'error', sheet: 'SMARTER Settings', location: 'Reported score', message: 'SMARTER reported score must be Raw additive utility or Normalize total scores.' });
    }
  }
  if (config.methodId === 'macbeth') {
    const anchors = parseNumberList(config.methodParams.macbethCategoryScale);
    if (anchors.length !== 7 || anchors.some((value) => !Number.isFinite(value) || value < 0)) {
      issues.push({ severity: 'error', sheet: 'MACBETH-style Settings', location: 'Category value anchors', message: 'MACBETH-style category value anchors must contain seven non-negative numeric values.' });
    }
    anchors.forEach((value, index) => {
      if (index && Number.isFinite(value) && Number.isFinite(anchors[index - 1]) && value < anchors[index - 1]) {
        issues.push({ severity: 'error', sheet: 'MACBETH-style Settings', location: 'Category value anchors', message: 'MACBETH-style anchors must be monotonic from no difference to extreme difference.' });
      }
    });
  }
  if (config.methodId === 'pugh') {
    const baselineId = String(config.methodParams.pughBaselineAlternative ?? '');
    const tolerance = Number(config.methodParams.pughIndifferenceTolerance ?? 0);
    const scoringMode = String(config.methodParams.pughScoringMode ?? 'Compare performance to baseline');
    const scoreTransform = String(config.methodParams.pughScoreTransform ?? 'Raw uploaded scores');
    if (!['Compare performance to baseline', 'Use uploaded Pugh scores'].includes(scoringMode)) {
      issues.push({ severity: 'error', sheet: 'Pugh Matrix Settings', location: 'Scoring mode', message: 'Pugh scoring mode must be Compare performance to baseline or Use uploaded Pugh scores.' });
    }
    if (scoringMode === 'Compare performance to baseline' && !input.alternatives.some((alternative) => alternative.id === baselineId)) {
      issues.push({ severity: 'error', sheet: 'Pugh Matrix Settings', location: 'Baseline alternative ID', message: 'Pugh baseline alternative must match an existing alternative ID.' });
    }
    if (!Number.isFinite(tolerance) || tolerance < 0) {
      issues.push({ severity: 'error', sheet: 'Pugh Matrix Settings', location: 'Same-as-baseline tolerance', message: 'Pugh same-as-baseline tolerance must be a non-negative number.' });
    }
    if (!['Raw uploaded scores', 'Global 0-1 rescale'].includes(scoreTransform)) {
      issues.push({ severity: 'error', sheet: 'Pugh Matrix Settings', location: 'Uploaded score transform', message: 'Pugh uploaded score transform must be Raw uploaded scores or Global 0-1 rescale.' });
    }
  }
  if (input.criteria.length !== config.criteria.length) {
    issues.push({ severity: 'info', sheet: 'Criteria', location: 'A:D', message: 'Uploaded criteria count differs from the current configuration; uploaded workbook values are being used.' });
  }
  return { ok: !issues.some((issue) => issue.severity === 'error'), issues };
}
