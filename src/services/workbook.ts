import type { DecisionMatrix, StudyConfig, TemplateSheet, ValidationIssue, ValidationResult, WeightingId } from '../types';
import { validateDecisionInput } from '../core/validation';
import { getMethod } from '../core/methods';
import { weightingMetadata } from '../core/weightingMetadata';
import { crispFuzzy, parseDecisionValue, type FuzzyNumber } from '../core/fuzzy';
import { safeFileName, safeSheetName } from './fileNames';

interface ParsedMatrix {
  values: number[][];
  fuzzyValues: FuzzyNumber[][];
  fuzzyCellCount: number;
  fuzzyTypes: Array<'triangular' | 'trapezoidal'>;
}

function matrixFromRows(rows: Array<Record<string, string | number>>, criteria: StudyConfig['criteria']): ParsedMatrix {
  const fuzzyTypes = new Set<'triangular' | 'trapezoidal'>();
  let fuzzyCellCount = 0;
  const fuzzyValues: FuzzyNumber[][] = [];
  const values = rows.map((row, rowIndex) => criteria.map((criterion, columnIndex) => {
    const parsed = parseDecisionValue(row[criterion.id]);
    fuzzyValues[rowIndex] = fuzzyValues[rowIndex] ?? [];
    fuzzyValues[rowIndex][columnIndex] = parsed.fuzzy ?? crispFuzzy(parsed.value);
    if (parsed.fuzzyType) {
      fuzzyCellCount += 1;
      fuzzyTypes.add(parsed.fuzzyType);
    }
    return parsed.value;
  }));
  return { values, fuzzyValues, fuzzyCellCount, fuzzyTypes: Array.from(fuzzyTypes) };
}

function pairwiseFromRows(rows: Array<Record<string, string | number>>, ids: string[], rowKey: string): { crisp: number[][]; fuzzy: FuzzyNumber[][] } {
  const fuzzy: FuzzyNumber[][] = [];
  const crisp = ids.map((rowId, rowIndex) => {
    const row = rows.find((item) => String(item[rowKey] || '').trim() === rowId) ?? rows[rowIndex];
    return ids.map((columnId, columnIndex) => {
      if (rowIndex === columnIndex) {
        fuzzy[rowIndex] = fuzzy[rowIndex] ?? [];
        fuzzy[rowIndex][columnIndex] = crispFuzzy(1);
        return 1;
      }
      const parsed = parseDecisionValue(row?.[columnId]);
      fuzzy[rowIndex] = fuzzy[rowIndex] ?? [];
      fuzzy[rowIndex][columnIndex] = parsed.fuzzy ?? crispFuzzy(parsed.value);
      return parsed.value;
    });
  });
  return { crisp, fuzzy };
}

function requiredWorkbookSheets(config: StudyConfig): string[] {
  const method = getMethod(config.methodId);
  const usedSheetNames = new Set<string>();
  return method.getTemplateSchema(config)
    .map((sheet) => safeSheetName(sheet.name, usedSheetNames))
    .filter((name) => name !== 'Instructions');
}

function coerceCellValue(value: string | number): string | number {
  if (typeof value === 'number') return value;
  const trimmed = String(value ?? '').trim();
  if (trimmed === '') return '';
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) && /^-?\d+(\.\d+)?$/.test(trimmed) ? numeric : trimmed;
}

function keyValueSheetParams(
  workbook: { Sheets: Record<string, unknown> },
  XLSX: Awaited<typeof import('xlsx')>,
  sheetName: string,
  keyMap: Record<string, string> = {},
  mappedOnly = false,
): Record<string, string | number> {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return {};
  const rows = XLSX.utils.sheet_to_json<Array<string | number>>(sheet, { header: 1, defval: '' });
  return rows.slice(1).reduce<Record<string, string | number>>((params, row) => {
    const label = String(row[0] ?? '').trim();
    if (!label) return params;
    const mappedKey = keyMap[label];
    if (mappedOnly && !mappedKey) return params;
    const key = mappedKey ?? label;
    if (params[key] !== undefined) return params;
    params[key] = coerceCellValue(row[1] ?? '');
    return params;
  }, {});
}

function espSpotisPointParams(workbook: { Sheets: Record<string, unknown> }, XLSX: Awaited<typeof import('xlsx')>): Record<string, string | number> {
  const sheet = workbook.Sheets['ESP-SPOTIS Point'];
  if (!sheet) return {};
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' });
  if (!rows.length) return {};
  return {
    espSpotisPoint: rows.map((row) => row['Expected Point']).join(','),
    spotisLowerBounds: rows.map((row) => row['Lower Bound']).join(','),
    spotisUpperBounds: rows.map((row) => row['Upper Bound']).join(','),
    espSpotisBounds: String(rows[0]['Bounds Mode'] || 'Observed data range'),
  };
}

function balancedSpotisParams(workbook: { Sheets: Record<string, unknown> }, XLSX: Awaited<typeof import('xlsx')>): Record<string, string | number> {
  const sheet = workbook.Sheets['B-SPOTIS Settings'];
  if (!sheet) return {};
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' });
  if (!rows.length) return {};
  return {
    espSpotisPoint: rows.map((row) => row['Expected Point']).join(','),
    spotisLowerBounds: rows.map((row) => row['Lower Bound']).join(','),
    spotisUpperBounds: rows.map((row) => row['Upper Bound']).join(','),
    balancedSpotisBounds: String(rows[0]['Bounds Mode'] || 'Observed data range'),
    balancedSpotisAlpha: coerceCellValue(rows.find((row) => row.Alpha !== '')?.Alpha ?? rows[0].Alpha ?? 0.5),
  };
}

function spotisBoundsParams(workbook: { Sheets: Record<string, unknown> }, XLSX: Awaited<typeof import('xlsx')>): Record<string, string | number> {
  const sheet = workbook.Sheets['SPOTIS Bounds'];
  if (!sheet) return {};
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' });
  if (!rows.length) return {};
  return {
    spotisLowerBounds: rows.map((row) => row['Lower Bound']).join(','),
    spotisUpperBounds: rows.map((row) => row['Upper Bound']).join(','),
    spotisBounds: String(rows[0].Mode || 'Observed data range'),
  };
}

function rimIdealIntervalParams(workbook: { Sheets: Record<string, unknown> }, XLSX: Awaited<typeof import('xlsx')>): Record<string, string | number> {
  const sheet = workbook.Sheets['RIM Ideal Intervals'];
  if (!sheet) return {};
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' });
  if (!rows.length) return {};
  return {
    rimIdealLower: rows.map((row) => row['Ideal Lower']).join(','),
    rimIdealUpper: rows.map((row) => row['Ideal Upper']).join(','),
    rimDomainLower: rows.map((row) => row['Domain Lower']).join(','),
    rimDomainUpper: rows.map((row) => row['Domain Upper']).join(','),
    rimReference: String(rows[0].Mode || 'Observed ideal point'),
  };
}

function rafsiReferenceParams(workbook: { Sheets: Record<string, unknown> }, XLSX: Awaited<typeof import('xlsx')>): Record<string, string | number> {
  const sheet = workbook.Sheets['RAFSI Reference Values'] ?? workbook.Sheets['RAFSI Interval'];
  if (!sheet) return {};
  const rows = XLSX.utils.sheet_to_json<Array<string | number>>(sheet, { header: 1, defval: '' });
  const tableHeaderIndex = rows.findIndex((row) => String(row[0] ?? '').trim() === 'Criterion ID');
  if (tableHeaderIndex < 0) return {};
  const valueRows = rows.slice(tableHeaderIndex + 1).filter((row) => String(row[0] ?? '').trim());
  if (!valueRows.length) return {};
  return {
    rafsiIdealValues: valueRows.map((row) => row[1]).join(','),
    rafsiAntiIdealValues: valueRows.map((row) => row[2]).join(','),
  };
}

function lopmPropertyLimitParams(workbook: { Sheets: Record<string, unknown> }, XLSX: Awaited<typeof import('xlsx')>): Record<string, string | number> {
  const sheet = workbook.Sheets['LoPM Property Limits'];
  if (!sheet) return {};
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' });
  if (!rows.length) return {};
  return {
    lopmPropertyTypes: rows.map((row) => row['Property Type']).join(','),
    lopmPropertyLimits: rows.map((row) => row['Property Limit']).join(','),
    lopmLimitsMode: String(rows[0].Mode || 'Observed limits'),
  };
}

function ervdReferencePointParams(workbook: { Sheets: Record<string, unknown> }, XLSX: Awaited<typeof import('xlsx')>): Record<string, string | number> {
  const sheet = workbook.Sheets['ERVD Reference Point'];
  if (!sheet) return {};
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' });
  if (!rows.length) return {};
  return {
    ervdReferencePoint: rows.map((row) => row['Reference Value']).join(','),
    ervdReferenceMode: String(rows[0].Mode || 'Observed mean'),
  };
}

function uploadedMethodParams(workbook: { Sheets: Record<string, unknown> }, XLSX: Awaited<typeof import('xlsx')>, fallback: StudyConfig): StudyConfig['methodParams'] {
  return {
    ...fallback.methodParams,
    ...keyValueSheetParams(workbook, XLSX, 'Study Settings', {
      'Data input mode': 'dataInputMode',
      'Respondent count': 'respondentCount',
      'Respondent aggregation': 'respondentAggregation',
      'Fuzzy input mode': 'fuzzyInputMode',
      'Expert count': 'dematelExpertCount',
      Aggregation: 'dematelAggregation',
      Threshold: 'dematelThreshold',
      'Manual threshold value': 'dematelManualThreshold',
      'Fuzzy DEMATEL calculation': 'dematelFuzzyCalculation',
    }, true),
    ...keyValueSheetParams(workbook, XLSX, 'Method Parameters'),
    ...keyValueSheetParams(workbook, XLSX, 'Normalization Settings', {
      Normalization: 'normalization',
      'Distance metric': 'distanceMetric',
      'Ideal solution': 'idealSolution',
    }),
    ...keyValueSheetParams(workbook, XLSX, 'Threshold Settings', {
      'Threshold method': 'dematelThreshold',
      'Manual threshold value': 'dematelManualThreshold',
      'Fuzzy DEMATEL calculation': 'dematelFuzzyCalculation',
    }),
    ...keyValueSheetParams(workbook, XLSX, 'VIKOR Parameters', {
      v: 'vikorV',
      'Acceptable advantage mode': 'vikorAcceptableAdvantageMode',
      'Acceptable advantage DQ': 'vikorAcceptableAdvantageDQ',
      'Stability rule': 'vikorStabilityRule',
    }),
    ...keyValueSheetParams(workbook, XLSX, 'PROMETHEE Settings', {
      'Preference function': 'preferenceFunction',
      'Indifference threshold q': 'prometheeIndifferenceThreshold',
      'Preference threshold p': 'prometheePreferenceThreshold',
      'Gaussian sigma': 'prometheeGaussianSigma',
    }),
    ...keyValueSheetParams(workbook, XLSX, 'Lambda Settings', { lambda: 'waspasLambda' }),
    ...keyValueSheetParams(workbook, XLSX, 'SECA Settings', { epsilon: 'secaEpsilon', 'reference balance': 'secaReferenceBalance' }),
    ...keyValueSheetParams(workbook, XLSX, 'DEAR Settings', { Aggregation: 'dearAggregation' }),
    ...keyValueSheetParams(workbook, XLSX, 'EAMR Settings', { beta: 'eamrBeta', lambda: 'eamrLambda' }),
    ...keyValueSheetParams(workbook, XLSX, 'COMET Settings', {
      'Characteristic values': 'cometCharacteristicValues',
      'Preference model': 'cometPreferenceModel',
    }),
    ...keyValueSheetParams(workbook, XLSX, 'MOOSRA Settings', { Normalization: 'normalization' }),
    ...keyValueSheetParams(workbook, XLSX, 'MARCOS Settings', { Normalization: 'normalization', 'Ranking convention': 'marcosScoreMode' }),
    ...keyValueSheetParams(workbook, XLSX, 'ARLON Settings', { Gamma: 'arlonGamma' }),
    ...keyValueSheetParams(workbook, XLSX, 'MACONT Settings', { lambda: 'macontLambda', mu: 'macontMu', delta: 'macontDelta', theta: 'macontTheta' }),
    ...keyValueSheetParams(workbook, XLSX, 'COBRA Settings', { 'Distance model': 'cobraDistanceMode' }),
    ...keyValueSheetParams(workbook, XLSX, 'MARA Settings', { Normalization: 'normalization' }),
    ...keyValueSheetParams(workbook, XLSX, 'RAPS Settings', { Normalization: 'normalization' }),
    ...keyValueSheetParams(workbook, XLSX, 'ORESTE Settings', { 'Rank model': 'oresteRankModel' }),
    ...keyValueSheetParams(workbook, XLSX, 'QUALIFLEX Settings', { 'Exact permutation limit': 'qualiflexExactLimit' }),
    ...keyValueSheetParams(workbook, XLSX, 'REGIME Settings', { 'Preference model': 'regimePreferenceModel' }),
    ...keyValueSheetParams(workbook, XLSX, 'EVAMIX Settings', { 'Data mode': 'evamixDataMode' }),
    ...keyValueSheetParams(workbook, XLSX, 'DIBR Parameters', {
      'Criterion order': 'dibrOrder',
      'Adjacent importance ratios': 'dibrAdjacentRatios',
      'First-to-last control ratio': 'dibrFirstLastRatio',
    }),
    ...keyValueSheetParams(workbook, XLSX, 'SRF Cards Parameters', {
      'Card groups': 'simosGroups',
      'Blank cards between groups': 'simosBlankCards',
      'Z ratio': 'simosZRatio',
    }),
    ...keyValueSheetParams(workbook, XLSX, 'Consistency Settings', {
      Threshold: 'ahpConsistencyThreshold',
      'Pairwise mode': 'ahpPairwiseMode',
      'Fuzzy input mode': 'fuzzyInputMode',
    }),
    ...keyValueSheetParams(workbook, XLSX, 'AROMAN Settings', { beta: 'aromanBeta', lambda: 'aromanLambda' }),
    ...keyValueSheetParams(workbook, XLSX, 'CRADIS Settings', { Normalization: 'normalization' }),
    ...keyValueSheetParams(workbook, XLSX, 'PSI Settings', { Normalization: 'normalization', 'Scoring convention': 'psiScoreMode' }),
    ...keyValueSheetParams(workbook, XLSX, 'ERVD Settings', { lambda: 'ervdLambda', alpha: 'ervdAlpha' }),
    ...keyValueSheetParams(workbook, XLSX, 'LMAW Settings', { Scaling: 'lmawScaling', 'Scoring convention': 'lmawScoreMode' }),
    ...ervdReferencePointParams(workbook, XLSX),
    ...spotisBoundsParams(workbook, XLSX),
    ...keyValueSheetParams(workbook, XLSX, 'ESP-SPOTIS Point', {
      'Expected Point': 'espSpotisPoint',
      'Lower Bound': 'spotisLowerBounds',
      'Upper Bound': 'spotisUpperBounds',
      'Bounds Mode': 'espSpotisBounds',
    }),
    ...espSpotisPointParams(workbook, XLSX),
    ...balancedSpotisParams(workbook, XLSX),
    ...rimIdealIntervalParams(workbook, XLSX),
    ...keyValueSheetParams(workbook, XLSX, 'RAFSI Interval', {
      'Reference mode': 'rafsiReferenceMode',
      'Interval lower bound': 'rafsiIntervalLower',
      'Interval upper bound': 'rafsiIntervalUpper',
    }),
    ...rafsiReferenceParams(workbook, XLSX),
    ...lopmPropertyLimitParams(workbook, XLSX),
  };
}

function isWeightingId(value: unknown): value is WeightingId {
  return typeof value === 'string' && value in weightingMetadata;
}

function workbookSettingIssue(location: string, message: string): ValidationIssue {
  return {
    severity: 'error',
    sheet: 'Study Settings',
    location,
    message,
  };
}

function mergeValidation(base: ValidationResult, issues: ValidationIssue[]): ValidationResult {
  const hasError = issues.some((issue) => issue.severity === 'error');
  return { ok: base.ok && !hasError, issues: [...issues, ...base.issues] };
}

function sanitizeWorkbookConfig(workbook: { Sheets: Record<string, unknown> }, XLSX: Awaited<typeof import('xlsx')>, fallback: StudyConfig): { config: StudyConfig; issues: ValidationIssue[] } {
  const method = getMethod(fallback.methodId);
  const settingsRows = workbook.Sheets['Study Settings']
    ? XLSX.utils.sheet_to_json<Record<string, string | number>>(workbook.Sheets['Study Settings'], { header: ['Field', 'Value'], range: 1, defval: '' })
    : [];
  const issues: ValidationIssue[] = [];
  const uploadedWeighting = String(settingsRows.find((row) => row.Field === 'Weighting')?.Value ?? fallback.weightingId).trim();
  const fallbackWeighting = isWeightingId(fallback.weightingId) ? fallback.weightingId : 'manual';
  let weightingId: WeightingId = fallbackWeighting;

  if (method.id === 'ahp') {
    weightingId = 'ahp';
  } else if (!method.supportsWeights) {
    weightingId = 'manual';
    if (uploadedWeighting && uploadedWeighting !== 'manual') {
      issues.push(workbookSettingIssue('B5', `${method.name} is self-weighted and cannot use the uploaded weighting method "${uploadedWeighting}".`));
    }
  } else if (isWeightingId(uploadedWeighting)) {
    weightingId = uploadedWeighting;
  } else if (uploadedWeighting) {
    issues.push(workbookSettingIssue('B5', `Unsupported weighting method "${uploadedWeighting}" in the uploaded workbook.`));
  }

  const uploadedParams = uploadedMethodParams(workbook, XLSX, fallback);
  const defaultDataMode = method.id === 'dematel' ? 'Single expert matrix' : 'Single aggregated dataset';
  const allowedDataModes = method.id === 'dematel'
    ? ['Single expert matrix', 'Multiple experts']
    : ['Single aggregated dataset', 'Multiple respondents'];
  const requestedDataMode = String(uploadedParams.dataInputMode ?? defaultDataMode);
  const dataInputMode = allowedDataModes.includes(requestedDataMode) ? requestedDataMode : defaultDataMode;
  if (!allowedDataModes.includes(requestedDataMode)) {
    issues.push(workbookSettingIssue('B6', `Unsupported data input mode "${requestedDataMode}" for ${method.name}.`));
  }

  const allowedFuzzyModes = method.fuzzySupport.nativeModeLabel ? ['Defuzzify on upload', method.fuzzySupport.nativeModeLabel] : ['Defuzzify on upload'];
  const requestedFuzzyMode = String(uploadedParams.fuzzyInputMode ?? 'Defuzzify on upload');
  const fallbackFuzzyMode = allowedFuzzyModes.includes(String(fallback.methodParams.fuzzyInputMode)) ? String(fallback.methodParams.fuzzyInputMode) : 'Defuzzify on upload';
  const fuzzyInputMode = allowedFuzzyModes.includes(requestedFuzzyMode) ? requestedFuzzyMode : fallbackFuzzyMode;
  if (!allowedFuzzyModes.includes(requestedFuzzyMode)) {
    issues.push(workbookSettingIssue('B10', `Unsupported fuzzy input mode "${requestedFuzzyMode}" for ${method.name}.`));
  }

  const respondentCount = dataInputMode === 'Multiple respondents'
    ? Math.max(2, Number(uploadedParams.respondentCount) || 2)
    : 1;
  const dematelExpertCount = dataInputMode === 'Multiple experts'
    ? Math.max(2, Number(uploadedParams.dematelExpertCount) || 2)
    : Math.max(1, Number(uploadedParams.dematelExpertCount) || 1);
  const ahpRespondentCount = dataInputMode === 'Multiple respondents' && (method.id === 'ahp' || weightingId === 'ahp')
    ? Math.max(2, Number(uploadedParams.ahpRespondentCount ?? uploadedParams.respondentCount) || 2)
    : 1;

  return {
    config: {
      ...fallback,
      weightingId,
      methodParams: {
        ...uploadedParams,
        dataInputMode,
        respondentCount,
        dematelExpertCount,
        ahpRespondentCount,
        fuzzyInputMode,
      },
    },
    issues,
  };
}

export async function downloadTemplate(sheets: TemplateSheet[], filename: string): Promise<void> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const usedSheetNames = new Set<string>();
  sheets.forEach((sheet) => {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows);
    worksheet['!cols'] = sheet.rows[0]?.map(() => ({ wch: 24 })) ?? [];
    XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName(sheet.name, usedSheetNames));
  });
  XLSX.writeFile(workbook, safeFileName(filename));
}

export async function parseWorkbook(file: File, fallback: StudyConfig): Promise<{ input: DecisionMatrix; validation: ValidationResult; config?: StudyConfig }> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer);
  const { config: parsedConfig, issues: configIssues } = sanitizeWorkbookConfig(workbook, XLSX, fallback);
  const settingsRows = workbook.Sheets['Study Settings']
    ? XLSX.utils.sheet_to_json<Record<string, string | number>>(workbook.Sheets['Study Settings'], { header: ['Field', 'Value'], range: 1, defval: '' })
    : [];
  const uploadedMethod = String(settingsRows.find((row) => row.Field === 'Method')?.Value ?? '').trim();
  const expectedMethod = getMethod(fallback.methodId).name;
  const methodIssue = uploadedMethod && uploadedMethod !== expectedMethod ? [{
    severity: 'error' as const,
    sheet: 'Study Settings',
    location: 'B3',
    message: `This workbook is for ${uploadedMethod}, but the selected method is ${expectedMethod}.`,
  }] : [];
  const requiredSheets = requiredWorkbookSheets(parsedConfig);
  const missingIssues = requiredSheets.filter((sheet) => !workbook.Sheets[sheet]).map((sheet) => ({
    severity: 'error' as const,
    sheet,
    location: 'Sheet',
    message: `Required sheet "${sheet}" is missing.`,
  }));
  if (methodIssue.length || missingIssues.length) {
    return {
      input: {
        alternatives: fallback.alternatives,
        criteria: fallback.criteria,
        values: fallback.alternatives.map(() => fallback.criteria.map(() => Number.NaN)),
      },
      validation: { ok: false, issues: [...methodIssue, ...configIssues, ...missingIssues] },
    };
  }
  if (fallback.methodId === 'dematel') {
    const factorRows = XLSX.utils.sheet_to_json<Record<string, string | number>>(workbook.Sheets.Factors ?? {}, { defval: '' });
    const matrixRows = XLSX.utils.sheet_to_json<Record<string, string | number>>(workbook.Sheets['Direct Relation Matrix'] ?? {}, { defval: '' });
    const criteria = factorRows.map((row, index) => ({
      id: String(row['Factor ID'] || `F${index + 1}`).trim(),
      name: String(row['Factor Name'] || row['Factor ID'] || `Factor ${index + 1}`).trim(),
      direction: 'benefit' as const,
      weight: 1 / Math.max(factorRows.length, 1),
    })).filter((item) => item.id);
    const alternatives = criteria.map((item) => ({ id: item.id, name: item.name }));
    const parsedValues = matrixFromRows(matrixRows, criteria);
    const expertCount = Math.max(1, Number(parsedConfig.methodParams.dematelExpertCount) || 1);
    let fuzzyCellCount = parsedValues.fuzzyCellCount;
    const fuzzyTypes = new Set(parsedValues.fuzzyTypes);
    const expertMatrices = Array.from({ length: expertCount }, (_, index) => {
      const sheet = workbook.Sheets[`Expert ${index + 1}`];
      if (!sheet) return null;
      const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' });
      const parsed = matrixFromRows(rows, criteria);
      fuzzyCellCount += parsed.fuzzyCellCount;
      parsed.fuzzyTypes.forEach((type) => fuzzyTypes.add(type));
      return parsed.values;
    }).filter((matrix): matrix is number[][] => Boolean(matrix));
    const expertFuzzyMatrices = Array.from({ length: expertCount }, (_, index) => {
      const sheet = workbook.Sheets[`Expert ${index + 1}`];
      if (!sheet) return null;
      const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' });
      return matrixFromRows(rows, criteria).fuzzyValues;
    }).filter((matrix): matrix is FuzzyNumber[][] => Boolean(matrix));
    const input: DecisionMatrix = { alternatives, criteria, values: parsedValues.values, expertMatrices: expertMatrices.length ? expertMatrices : undefined, expertFuzzyMatrices: expertFuzzyMatrices.length ? expertFuzzyMatrices : undefined, fuzzyCellCount, fuzzyTypes: Array.from(fuzzyTypes), fuzzyValues: parsedValues.fuzzyValues };
    return { input, config: parsedConfig, validation: mergeValidation(validateDecisionInput(input, parsedConfig), configIssues) };
  }
  const alternativeRows = XLSX.utils.sheet_to_json<Record<string, string | number>>(workbook.Sheets.Alternatives ?? {}, { defval: '' });
  const criteriaRows = XLSX.utils.sheet_to_json<Record<string, string | number>>(workbook.Sheets.Criteria ?? {}, { defval: '' });
  const matrixRows = XLSX.utils.sheet_to_json<Record<string, string | number>>(workbook.Sheets['Decision Matrix'] ?? {}, { defval: '' });
  const criteria = criteriaRows.map((row) => ({
    id: String(row['Criterion ID'] || '').trim(),
    name: String(row['Criterion Name'] || '').trim(),
    direction: String(row.Direction || 'benefit').toLowerCase() === 'cost' ? 'cost' as const : 'benefit' as const,
    weight: Number(row.Weight ?? row['Manual Weight'] ?? row['Weight Source']),
  })).filter((item) => item.id);
  const alternatives = matrixRows.map((row) => {
    const id = String(row['Alternative ID'] || '').trim();
    const workbookAlternative = alternativeRows.find((item) => String(item['Alternative ID']).trim() === id);
    const fallbackAlternative = fallback.alternatives.find((item) => item.id === id);
    return { id, name: String(workbookAlternative?.['Alternative Name'] || fallbackAlternative?.name || id).trim() };
  }).filter((item) => item.id);
  const parsedValues = matrixFromRows(matrixRows, criteria);
  let fuzzyCellCount = parsedValues.fuzzyCellCount;
  const fuzzyTypes = new Set(parsedValues.fuzzyTypes);
  const respondentCount = Math.max(1, Number(parsedConfig.methodParams.respondentCount) || 1);
  const respondentMatrices = Array.from({ length: respondentCount }, (_, index) => {
    const sheet = workbook.Sheets[`Respondent ${index + 1}`];
    if (!sheet) return null;
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' });
    const parsed = matrixFromRows(rows, criteria);
    fuzzyCellCount += parsed.fuzzyCellCount;
    parsed.fuzzyTypes.forEach((type) => fuzzyTypes.add(type));
    return parsed.values;
  }).filter((matrix): matrix is number[][] => Boolean(matrix));
  const respondentFuzzyMatrices = Array.from({ length: respondentCount }, (_, index) => {
    const sheet = workbook.Sheets[`Respondent ${index + 1}`];
    if (!sheet) return null;
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' });
    return matrixFromRows(rows, criteria).fuzzyValues;
  }).filter((matrix): matrix is FuzzyNumber[][] => Boolean(matrix));
  const pairwiseRows = workbook.Sheets['Criteria Pairwise Matrix']
    ? XLSX.utils.sheet_to_json<Record<string, string | number>>(workbook.Sheets['Criteria Pairwise Matrix'], { defval: '' })
    : [];
  const ahpCriteriaPairwise = pairwiseRows.length
    ? pairwiseFromRows(pairwiseRows, criteria.map((criterion) => criterion.id), 'Criterion').crisp
    : fallback.ahpCriteriaPairwise;
  const ahpCriteriaFuzzyPairwise = pairwiseRows.length
    ? pairwiseFromRows(pairwiseRows, criteria.map((criterion) => criterion.id), 'Criterion').fuzzy
    : fallback.ahpCriteriaFuzzyPairwise;
  const ahpRespondentCount = Math.max(1, Number(parsedConfig.methodParams.ahpRespondentCount ?? parsedConfig.methodParams.respondentCount) || 1);
  const ahpCriteriaRespondentPairwise = Array.from({ length: ahpRespondentCount }, (_, index) => {
    const sheet = workbook.Sheets[`AHP Criteria Respondent ${index + 1}`];
    if (!sheet) return null;
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' });
    return pairwiseFromRows(rows, criteria.map((criterion) => criterion.id), 'Criterion').crisp;
  }).filter((matrix): matrix is number[][] => Boolean(matrix));
  const ahpCriteriaRespondentFuzzyPairwise = Array.from({ length: ahpRespondentCount }, (_, index) => {
    const sheet = workbook.Sheets[`AHP Criteria Respondent ${index + 1}`];
    if (!sheet) return null;
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' });
    return pairwiseFromRows(rows, criteria.map((criterion) => criterion.id), 'Criterion').fuzzy;
  }).filter((matrix): matrix is FuzzyNumber[][] => Boolean(matrix));
  const altPairwiseRows = workbook.Sheets['Alternative Pairwise Matrices']
    ? XLSX.utils.sheet_to_json<Record<string, string | number>>(workbook.Sheets['Alternative Pairwise Matrices'], { defval: '' })
    : [];
  const ahpAlternativePairwise = altPairwiseRows.length
    ? criteria.reduce<Record<string, number[][]>>((acc, criterion) => {
      const rows = altPairwiseRows.filter((row) => String(row.Criterion || '').trim() === criterion.id);
      if (rows.length) {
        acc[criterion.id] = pairwiseFromRows(rows, alternatives.map((alternative) => alternative.id), 'Alternative').crisp;
      }
      return acc;
    }, {})
    : fallback.ahpAlternativePairwise;
  const ahpAlternativeFuzzyPairwise = altPairwiseRows.length
    ? criteria.reduce<Record<string, FuzzyNumber[][]>>((acc, criterion) => {
      const rows = altPairwiseRows.filter((row) => String(row.Criterion || '').trim() === criterion.id);
      if (rows.length) acc[criterion.id] = pairwiseFromRows(rows, alternatives.map((alternative) => alternative.id), 'Alternative').fuzzy;
      return acc;
    }, {})
    : fallback.ahpAlternativeFuzzyPairwise;
  const ahpAlternativeRespondentPairwise = Array.from({ length: ahpRespondentCount }, (_, respondentIndex) => {
    const sheet = workbook.Sheets[`AHP Alternatives Respondent ${respondentIndex + 1}`];
    if (!sheet) return null;
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' });
    return criteria.reduce<Record<string, number[][]>>((acc, criterion) => {
      const criterionRows = rows.filter((row) => String(row.Criterion || '').trim() === criterion.id);
      if (criterionRows.length) {
        acc[criterion.id] = pairwiseFromRows(criterionRows, alternatives.map((alternative) => alternative.id), 'Alternative').crisp;
      }
      return acc;
    }, {});
  }).filter((item): item is Record<string, number[][]> => Boolean(item));
  const ahpAlternativeRespondentFuzzyPairwise = Array.from({ length: ahpRespondentCount }, (_, respondentIndex) => {
    const sheet = workbook.Sheets[`AHP Alternatives Respondent ${respondentIndex + 1}`];
    if (!sheet) return null;
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' });
    return criteria.reduce<Record<string, FuzzyNumber[][]>>((acc, criterion) => {
      const criterionRows = rows.filter((row) => String(row.Criterion || '').trim() === criterion.id);
      if (criterionRows.length) acc[criterion.id] = pairwiseFromRows(criterionRows, alternatives.map((alternative) => alternative.id), 'Alternative').fuzzy;
      return acc;
    }, {});
  }).filter((item): item is Record<string, FuzzyNumber[][]> => Boolean(item));
  const mergedAHPAlternativeRespondents = ahpAlternativeRespondentPairwise.reduce<Record<string, number[][][]>>((acc, respondent) => {
    Object.entries(respondent).forEach(([criterionId, matrix]) => {
      acc[criterionId] = [...(acc[criterionId] ?? []), matrix];
    });
    return acc;
  }, {});
  const mergedAHPAlternativeFuzzyRespondents = ahpAlternativeRespondentFuzzyPairwise.reduce<Record<string, FuzzyNumber[][][]>>((acc, respondent) => {
    Object.entries(respondent).forEach(([criterionId, matrix]) => {
      acc[criterionId] = [...(acc[criterionId] ?? []), matrix];
    });
    return acc;
  }, {});
  const input: DecisionMatrix = {
    alternatives: alternatives.length ? alternatives : fallback.alternatives,
    criteria: criteria.length ? criteria : fallback.criteria,
    values: parsedValues.values.length ? parsedValues.values : fallback.alternatives.map(() => fallback.criteria.map(() => Number.NaN)),
    respondentMatrices: respondentMatrices.length ? respondentMatrices : undefined,
    respondentFuzzyMatrices: respondentFuzzyMatrices.length ? respondentFuzzyMatrices : undefined,
    fuzzyCellCount,
    fuzzyTypes: Array.from(fuzzyTypes),
    fuzzyValues: parsedValues.fuzzyValues.length ? parsedValues.fuzzyValues : undefined,
  };
  const nextConfig = parsedConfig.methodId === 'ahp' || parsedConfig.weightingId === 'ahp' ? {
    ...parsedConfig,
    ahpCriteriaPairwise,
    ahpCriteriaFuzzyPairwise,
    ahpCriteriaRespondentPairwise: ahpCriteriaRespondentPairwise.length ? ahpCriteriaRespondentPairwise : fallback.ahpCriteriaRespondentPairwise,
    ahpCriteriaRespondentFuzzyPairwise: ahpCriteriaRespondentFuzzyPairwise.length ? ahpCriteriaRespondentFuzzyPairwise : fallback.ahpCriteriaRespondentFuzzyPairwise,
    ahpAlternativePairwise,
    ahpAlternativeFuzzyPairwise,
    ahpAlternativeRespondentPairwise: Object.keys(mergedAHPAlternativeRespondents).length ? mergedAHPAlternativeRespondents : fallback.ahpAlternativeRespondentPairwise,
    ahpAlternativeRespondentFuzzyPairwise: Object.keys(mergedAHPAlternativeFuzzyRespondents).length ? mergedAHPAlternativeFuzzyRespondents : fallback.ahpAlternativeRespondentFuzzyPairwise,
  } : parsedConfig;
  return { input, config: nextConfig, validation: mergeValidation(validateDecisionInput(input, nextConfig), configIssues) };
}
