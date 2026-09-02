import { methodRegistry } from './methods';
import { methodPurpose } from './methodMetadata';
import { validateDecisionInput } from './validation';
import { crispFuzzy, parseDecisionValue } from './fuzzy';
import { sampleConfig, sampleMatrix } from '../data/sampleStudy';
import type { DecisionMatrix, MethodId, StudyConfig } from '../types';

export interface SmokeCheckResult {
  method: string;
  passed: boolean;
  message: string;
}

function methodInput(methodId: MethodId): DecisionMatrix {
  if (methodId === 'dematel') {
    return {
      alternatives: sampleConfig.criteria.slice(0, 4).map((criterion) => ({ id: criterion.id, name: criterion.name })),
      criteria: sampleConfig.criteria.slice(0, 4),
      values: [
        [0, 3, 4, 2],
        [2, 0, 3, 1],
        [4, 2, 0, 3],
        [3, 2, 4, 0],
      ],
    };
  }
  return sampleMatrix;
}

function requiredTemplateSheets(methodId: MethodId): string[] {
  if (methodId === 'dematel') return ['Instructions', 'Study Settings', 'Factors', 'Direct Relation Matrix', 'Threshold Settings'];
  const common = ['Instructions', 'Study Settings', 'Alternatives', 'Criteria', 'Decision Matrix', 'Weights', 'Method Parameters', 'Group Decision Guide'];
  if (methodId === 'ahp') return [...common, 'Criteria Pairwise Matrix', 'Alternative Pairwise Matrices', 'Consistency Settings'];
  if (methodId === 'topsis') return [...common, 'Criterion Types', 'Normalization Settings'];
  if (methodId === 'vikor') return [...common, 'VIKOR Parameters'];
  if (methodId === 'promethee') return [...common, 'PROMETHEE Settings'];
  if (methodId === 'waspas') return [...common, 'Lambda Settings'];
  if (methodId === 'fuca') return [...common, 'FUCA Settings'];
  if (methodId === 'seca') return [...common, 'SECA Settings'];
  if (methodId === 'dear') return [...common, 'DEAR Settings'];
  if (methodId === 'eamr') return [...common, 'EAMR Settings'];
  if (methodId === 'rawec') return [...common, 'RAWEC Settings'];
  if (methodId === 'comet') return [...common, 'COMET Settings', 'Characteristic Values'];
  if (methodId === 'arlon') return [...common, 'ARLON Settings'];
  if (methodId === 'macont') return [...common, 'MACONT Settings'];
  if (methodId === 'aroman') return [...common, 'AROMAN Settings'];
  if (methodId === 'cobra') return [...common, 'COBRA Settings'];
  if (methodId === 'cradis') return [...common, 'CRADIS Settings'];
  if (methodId === 'ervd') return [...common, 'ERVD Reference Point', 'ERVD Settings'];
  if (methodId === 'spotis') return [...common, 'SPOTIS Bounds'];
  if (methodId === 'rim') return [...common, 'RIM Ideal Intervals'];
  if (methodId === 'rafsi') return [...common, 'RAFSI Interval'];
  if (methodId === 'lopm') return [...common, 'LoPM Property Limits'];
  if (methodId === 'espSpotis') return [...common, 'ESP-SPOTIS Point'];
  if (methodId === 'balancedSpotis') return [...common, 'B-SPOTIS Settings'];
  return common;
}

function excelSafeSheetName(name: string): string {
  return name.replace(/[\\/:?*[\]]/g, '-').slice(0, 31);
}

function sheetContainsValue(rows: Array<Array<string | number>>, expected: string): boolean {
  return rows.some((row) => row.some((cell) => String(cell) === expected));
}

function missingTemplateParameters(
  sheets: ReturnType<typeof methodRegistry[number]['getTemplateSchema']>,
  methodId: MethodId,
  methodParameters: string[],
): string[] {
  const missing = methodParameters.filter((parameter) => {
    if (methodId === 'dematel') return false;
    if (methodId === 'promethee' && ['preferenceFunction', 'prometheeIndifferenceThreshold', 'prometheePreferenceThreshold', 'prometheeGaussianSigma'].includes(parameter)) {
      return !sheets.find((sheet) => sheet.name === 'PROMETHEE Settings' && sheetContainsValue(sheet.rows, parameter === 'preferenceFunction' ? 'Preference function' : parameter === 'prometheeIndifferenceThreshold' ? 'Indifference threshold q' : parameter === 'prometheePreferenceThreshold' ? 'Preference threshold p' : 'Gaussian sigma'));
    }
    const parameterSheet = sheets.find((sheet) => sheet.name === 'Method Parameters');
    return !parameterSheet || !sheetContainsValue(parameterSheet.rows, parameter);
  });

  const sheetAssertions: Array<[MethodId, string, string]> = [
    ['topsis', 'Normalization Settings', 'Normalization'],
    ['topsis', 'Normalization Settings', 'Distance metric'],
    ['topsis', 'Normalization Settings', 'Ideal solution'],
    ['ahp', 'Consistency Settings', 'Threshold'],
    ['ahp', 'Consistency Settings', 'Pairwise mode'],
    ['dematel', 'Study Settings', 'Expert count'],
    ['dematel', 'Study Settings', 'Aggregation'],
    ['dematel', 'Threshold Settings', 'Threshold method'],
    ['vikor', 'VIKOR Parameters', 'v'],
    ['vikor', 'VIKOR Parameters', 'Acceptable advantage mode'],
    ['vikor', 'VIKOR Parameters', 'Acceptable advantage DQ'],
    ['vikor', 'VIKOR Parameters', 'Stability rule'],
    ['promethee', 'PROMETHEE Settings', 'Preference function'],
    ['promethee', 'PROMETHEE Settings', 'Indifference threshold q'],
    ['promethee', 'PROMETHEE Settings', 'Preference threshold p'],
    ['promethee', 'PROMETHEE Settings', 'Gaussian sigma'],
    ['waspas', 'Lambda Settings', 'lambda'],
    ['fuca', 'FUCA Settings', 'Rank mode'],
    ['seca', 'SECA Settings', 'epsilon'],
    ['dear', 'DEAR Settings', 'Aggregation'],
    ['arlon', 'ARLON Settings', 'Gamma'],
    ['macont', 'MACONT Settings', 'lambda'],
    ['aroman', 'AROMAN Settings', 'beta'],
    ['aroman', 'AROMAN Settings', 'lambda'],
    ['cobra', 'COBRA Settings', 'Distance model'],
    ['cradis', 'CRADIS Settings', 'Normalization'],
    ['ervd', 'ERVD Settings', 'lambda'],
    ['ervd', 'ERVD Settings', 'alpha'],
    ['ervd', 'ERVD Reference Point', 'Reference Value'],
    ['electre', 'Method Parameters', 'electreConcordance'],
    ['electre', 'Method Parameters', 'electreDiscordance'],
    ['todim', 'Method Parameters', 'todimTheta'],
    ['gra', 'Method Parameters', 'graZeta'],
    ['spotis', 'Method Parameters', 'spotisBounds'],
    ['spotis', 'SPOTIS Bounds', 'Lower Bound'],
    ['spotis', 'SPOTIS Bounds', 'Upper Bound'],
    ['espSpotis', 'ESP-SPOTIS Point', 'Expected Point'],
    ['balancedSpotis', 'B-SPOTIS Settings', 'Expected Point'],
    ['balancedSpotis', 'B-SPOTIS Settings', 'Alpha'],
    ['wedba', 'Method Parameters', 'wedbaNormalization'],
    ['lmaw', 'Method Parameters', 'lmawScaling'],
    ['dnma', 'Method Parameters', 'dnmaIntegration'],
    ['probid', 'Method Parameters', 'probidReference'],
    ['sprobid', 'Method Parameters', 'sprobidReference'],
    ['rim', 'Method Parameters', 'rimReference'],
    ['rim', 'RIM Ideal Intervals', 'Domain Lower'],
    ['rim', 'RIM Ideal Intervals', 'Domain Upper'],
    ['rim', 'RIM Ideal Intervals', 'Ideal Lower'],
    ['rim', 'RIM Ideal Intervals', 'Ideal Upper'],
    ['rafsi', 'Method Parameters', 'rafsiIntervalLower'],
    ['rafsi', 'Method Parameters', 'rafsiIntervalUpper'],
    ['rafsi', 'RAFSI Interval', 'Interval lower bound'],
    ['rafsi', 'RAFSI Interval', 'Interval upper bound'],
    ['lopm', 'Method Parameters', 'lopmLimitsMode'],
    ['lopm', 'LoPM Property Limits', 'Property Type'],
    ['lopm', 'LoPM Property Limits', 'Property Limit'],
  ];

  sheetAssertions.forEach(([assertedMethod, sheetName, expected]) => {
    if (assertedMethod !== methodId) return;
    const sheet = sheets.find((item) => item.name === sheetName);
    if (!sheet || !sheetContainsValue(sheet.rows, expected)) missing.push(`${sheetName}:${expected}`);
  });

  return missing;
}

function hasOnlyFiniteNumbers(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(hasOnlyFiniteNumbers);
  if (value && typeof value === 'object') return Object.values(value).every(hasOnlyFiniteNumbers);
  return true;
}

export function runRegistryIntegritySmokeChecks(): SmokeCheckResult[] {
  const ids = methodRegistry.map((method) => method.id);
  const names = methodRegistry.map((method) => method.name);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index);
  const metadataIssues = methodRegistry.flatMap((method) => {
    const issues: string[] = [];
    if (!method.fullName.trim()) issues.push('missing full name');
    if (!method.description.trim()) issues.push('missing description');
    if (!method.outputs.length) issues.push('missing declared outputs');
    if (!methodPurpose[method.id]?.trim()) issues.push('missing selector purpose text');
    if (!method.fuzzySupport.enabled) issues.push('missing fuzzy input support declaration');
    if (!method.fuzzySupport.note.trim()) issues.push('missing fuzzy support note');
    if (method.fuzzySupport.mode !== 'defuzzified-input' && method.fuzzySupport.mode !== 'native-fuzzy') issues.push('invalid fuzzy support mode');
    method.specificationFields.forEach((field) => {
      if (!field.key.trim()) issues.push('blank specification key');
      if (!field.label.trim()) issues.push(`blank label for ${field.key}`);
      if (!method.parameters.includes(field.key)) issues.push(`specification field ${field.key} is not declared in parameters`);
      if (field.defaultValue === undefined || field.defaultValue === null || String(field.defaultValue).trim() === '') issues.push(`missing default for ${field.key}`);
      if (field.type === 'select' && (!field.options?.length || !field.options.includes(String(field.defaultValue)))) issues.push(`invalid options/default for ${field.key}`);
    });
    method.parameters.forEach((parameter) => {
      if (!method.specificationFields.some((field) => field.key === parameter)) issues.push(`parameter ${parameter} has no specification field`);
    });
    return issues.map((issue) => `${method.id}: ${issue}`);
  });
  const extraPurposeIds = Object.keys(methodPurpose).filter((id) => !ids.includes(id as MethodId));
  const problems = [
    duplicateIds.length ? `duplicate ids ${duplicateIds.join(', ')}` : '',
    duplicateNames.length ? `duplicate names ${duplicateNames.join(', ')}` : '',
    metadataIssues.length ? metadataIssues.join('; ') : '',
    extraPurposeIds.length ? `unused selector purpose ids ${extraPurposeIds.join(', ')}` : '',
  ].filter(Boolean);
  return [{
    method: 'Registry Integrity',
    passed: !problems.length,
    message: problems.length ? problems.join('; ') : `Registry integrity OK: ${methodRegistry.length} methods have unique IDs, defaults, outputs, and selector metadata.`,
  }];
}

export function runFuzzyInputSmokeChecks(): SmokeCheckResult[] {
  const triangular = parseDecisionValue('(1,2,4)');
  const trapezoidal = parseDecisionValue('(1,2,4,5)');
  const malformed = parseDecisionValue('(4,2,1)');
  const fuzzyInput: DecisionMatrix = {
    ...sampleMatrix,
    values: [
      [triangular.value, sampleMatrix.values[0][1], sampleMatrix.values[0][2], sampleMatrix.values[0][3], sampleMatrix.values[0][4], sampleMatrix.values[0][5], sampleMatrix.values[0][6]],
      ...sampleMatrix.values.slice(1),
    ],
    fuzzyCellCount: 1,
    fuzzyTypes: [triangular.fuzzyType ?? 'triangular'],
  };
  const result = methodRegistry.find((method) => method.id === 'topsis')!.runAnalysis(fuzzyInput, sampleConfig);
  const vikorResult = methodRegistry.find((method) => method.id === 'vikor')!.runAnalysis(sampleMatrix, { ...sampleConfig, methodId: 'vikor' });
  const nativeFuzzyResult = methodRegistry.find((method) => method.id === 'topsis')!.runAnalysis({
    ...sampleMatrix,
    fuzzyCellCount: 2,
    fuzzyTypes: ['triangular', 'trapezoidal'],
    fuzzyValues: sampleMatrix.values.map((row, rowIndex) => row.map((value, columnIndex) => {
      if (rowIndex === 0 && columnIndex === 0) return { values: [70, 72, 75], type: 'triangular' as const };
      if (rowIndex === 1 && columnIndex === 1) return { values: [72, 74, 76, 78], type: 'trapezoidal' as const };
      return crispFuzzy(value);
    })),
  }, { ...sampleConfig, methodId: 'topsis', methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy TOPSIS' } });
  const fuzzyAhpPairwise = (sampleConfig.ahpCriteriaPairwise ?? []).map((row, rowIndex) => row.map((value, columnIndex) => {
    if (rowIndex === columnIndex) return crispFuzzy(1);
    const center = Math.max(value, 1 / 9);
    return { values: [Math.max(1 / 9, center * 0.9), center, Math.min(9, center * 1.1)], type: 'triangular' as const };
  }));
  const nativeFuzzyAhpResult = methodRegistry.find((method) => method.id === 'ahp')!.runAnalysis(sampleMatrix, {
    ...sampleConfig,
    methodId: 'ahp',
    weightingId: 'ahp',
    ahpCriteriaFuzzyPairwise: fuzzyAhpPairwise,
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy AHP' },
  });
  const nativeFuzzyVikorResult = methodRegistry.find((method) => method.id === 'vikor')!.runAnalysis({
    ...sampleMatrix,
    fuzzyCellCount: 2,
    fuzzyTypes: ['triangular', 'trapezoidal'],
    fuzzyValues: sampleMatrix.values.map((row, rowIndex) => row.map((value, columnIndex) => {
      if (rowIndex === 0 && columnIndex === 0) return { values: [70, 72, 75], type: 'triangular' as const };
      if (rowIndex === 1 && columnIndex === 1) return { values: [72, 74, 76, 78], type: 'trapezoidal' as const };
      return crispFuzzy(value);
    })),
  }, { ...sampleConfig, methodId: 'vikor', methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy VIKOR' } });
  const fuzzyDecisionInput: DecisionMatrix = {
    ...sampleMatrix,
    fuzzyCellCount: 2,
    fuzzyTypes: ['triangular', 'trapezoidal'],
    fuzzyValues: sampleMatrix.values.map((row, rowIndex) => row.map((value, columnIndex) => {
      if (rowIndex === 0 && columnIndex === 0) return { values: [70, 72, 75], type: 'triangular' as const };
      if (rowIndex === 1 && columnIndex === 1) return { values: [72, 74, 76, 78], type: 'trapezoidal' as const };
      return crispFuzzy(value);
    })),
  };
  const nativeFuzzyWaspasResult = methodRegistry.find((method) => method.id === 'waspas')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'waspas',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy WASPAS' },
  });
  const nativeFuzzyCoprasResult = methodRegistry.find((method) => method.id === 'copras')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'copras',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy COPRAS' },
  });
  const nativeFuzzyEdasResult = methodRegistry.find((method) => method.id === 'edas')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'edas',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy EDAS' },
  });
  const nativeFuzzySawResult = methodRegistry.find((method) => method.id === 'saw')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'saw',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy SAW' },
  });
  const nativeFuzzyWpmResult = methodRegistry.find((method) => method.id === 'wpm')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'wpm',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy WPM' },
  });
  const nativeFuzzyMooraResult = methodRegistry.find((method) => method.id === 'moora')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'moora',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy MOORA' },
  });
  const nativeFuzzyArasResult = methodRegistry.find((method) => method.id === 'aras')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'aras',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy ARAS' },
  });
  const nativeFuzzyMabacResult = methodRegistry.find((method) => method.id === 'mabac')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'mabac',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy MABAC' },
  });
  const nativeFuzzyMarcosResult = methodRegistry.find((method) => method.id === 'marcos')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'marcos',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy MARCOS' },
  });
  const nativeFuzzyCocosoResult = methodRegistry.find((method) => method.id === 'cocoso')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'cocoso',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy CoCoSo' },
  });
  const nativeFuzzyMaircaResult = methodRegistry.find((method) => method.id === 'mairca')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'mairca',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy MAIRCA' },
  });
  const nativeFuzzyPrometheeResult = methodRegistry.find((method) => method.id === 'promethee')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'promethee',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy PROMETHEE' },
  });
  const nativeFuzzyElectreResult = methodRegistry.find((method) => method.id === 'electre')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'electre',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy ELECTRE' },
  });
  const nativeFuzzyOcraResult = methodRegistry.find((method) => method.id === 'ocra')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'ocra',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy OCRA' },
  });
  const nativeFuzzyPivResult = methodRegistry.find((method) => method.id === 'piv')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'piv',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy PIV' },
  });
  const nativeFuzzyRovResult = methodRegistry.find((method) => method.id === 'rov')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'rov',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy ROV' },
  });
  const nativeFuzzyWispResult = methodRegistry.find((method) => method.id === 'wisp')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'wisp',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy WISP' },
  });
  const nativeFuzzyTodimResult = methodRegistry.find((method) => method.id === 'todim')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'todim',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy TODIM', todimTheta: 1 },
  });
  const nativeFuzzyCodasResult = methodRegistry.find((method) => method.id === 'codas')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'codas',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy CODAS' },
  });
  const nativeFuzzyGraResult = methodRegistry.find((method) => method.id === 'gra')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'gra',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy GRA' },
  });
  const nativeFuzzySpotisResult = methodRegistry.find((method) => method.id === 'spotis')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'spotis',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy SPOTIS' },
  });
  const nativeFuzzyRamResult = methodRegistry.find((method) => method.id === 'ram')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'ram',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy RAM' },
  });
  const nativeFuzzySmartResult = methodRegistry.find((method) => method.id === 'smart')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'smart',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy SMART' },
  });
  const nativeFuzzyMultimooraResult = methodRegistry.find((method) => method.id === 'multimoora')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'multimoora',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy MULTIMOORA' },
  });
  const nativeFuzzyPsiResult = methodRegistry.find((method) => method.id === 'psi')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'psi',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy PSI' },
  });
  const nativeFuzzyMautResult = methodRegistry.find((method) => method.id === 'maut')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'maut',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy MAUT', mautUtilityShape: 'Concave' },
  });
  const nativeFuzzyLmawResult = methodRegistry.find((method) => method.id === 'lmaw')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'lmaw',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy LMAW' },
  });
  const nativeFuzzyWedbaResult = methodRegistry.find((method) => method.id === 'wedba')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'wedba',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy WEDBA' },
  });
  const nativeFuzzyDnmaResult = methodRegistry.find((method) => method.id === 'dnma')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'dnma',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy DNMA' },
  });
  const nativeFuzzyProbidResult = methodRegistry.find((method) => method.id === 'probid')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'probid',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy PROBID' },
  });
  const nativeFuzzyRimResult = methodRegistry.find((method) => method.id === 'rim')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'rim',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy RIM', rimReference: 'Manual ideal interval', rimDomainLower: '0,0,0,0', rimDomainUpper: '1,1,1,1', rimIdealLower: '0.5,0.5,0.5,0.5', rimIdealUpper: '1,1,1,1' },
  });
  const nativeFuzzyRafsiResult = methodRegistry.find((method) => method.id === 'rafsi')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'rafsi',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy RAFSI' },
  });
  const nativeFuzzyLopmResult = methodRegistry.find((method) => method.id === 'lopm')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'lopm',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy LoPM', lopmLimitsMode: 'Manual property limits', lopmPropertyTypes: 'lower,upper,target,lower', lopmPropertyLimits: '60,5,8,70' },
  });
  const nativeFuzzyAromanResult = methodRegistry.find((method) => method.id === 'aroman')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'aroman',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy AROMAN', aromanBeta: 0.6, aromanLambda: 0.4 },
  });
  const nativeFuzzyCobraResult = methodRegistry.find((method) => method.id === 'cobra')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'cobra',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy COBRA' },
  });
  const nativeFuzzyErvdResult = methodRegistry.find((method) => method.id === 'ervd')!.runAnalysis(fuzzyDecisionInput, {
    ...sampleConfig,
    methodId: 'ervd',
    methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy ERVD', ervdReferenceMode: 'Observed mean' },
  });
  return [
    {
      method: 'Triangular Fuzzy Parser',
      passed: triangular.fuzzyType === 'triangular' && Math.abs(triangular.value - 7 / 3) < 1e-9,
      message: triangular.fuzzyType === 'triangular' ? 'Triangular fuzzy value defuzzified by centroid.' : 'Triangular fuzzy value was not parsed correctly.',
    },
    {
      method: 'Trapezoidal Fuzzy Parser',
      passed: trapezoidal.fuzzyType === 'trapezoidal' && trapezoidal.value === 3,
      message: trapezoidal.fuzzyType === 'trapezoidal' ? 'Trapezoidal fuzzy value defuzzified by centroid.' : 'Trapezoidal fuzzy value was not parsed correctly.',
    },
    {
      method: 'Malformed Fuzzy Parser',
      passed: Number.isNaN(malformed.value),
      message: Number.isNaN(malformed.value) ? 'Malformed fuzzy tuple rejected.' : 'Malformed fuzzy tuple was incorrectly accepted.',
    },
    {
      method: 'Fuzzy Result Diagnostic',
      passed: result.diagnostics.some((diagnostic) => diagnostic.label === 'Fuzzy input handling') && result.reproducibility.fuzzyCellCount === 1,
      message: result.diagnostics.some((diagnostic) => diagnostic.label === 'Fuzzy input handling') ? 'Fuzzy preprocessing is visible in result diagnostics.' : 'Fuzzy preprocessing diagnostic is missing.',
    },
    {
      method: 'TOPSIS Distance Output',
      passed: result.tables.some((table) => table.id === 'topsis-distances'),
      message: result.tables.some((table) => table.id === 'topsis-distances') ? 'TOPSIS reports separation distances and closeness coefficients.' : 'TOPSIS separation distance table is missing.',
    },
    {
      method: 'Native Fuzzy TOPSIS',
      passed: nativeFuzzyResult.tables.some((table) => table.id === 'fuzzy-weighted')
        && nativeFuzzyResult.tables.some((table) => table.id === 'fuzzy-topsis-distances')
        && nativeFuzzyResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy TOPSIS')
        && nativeFuzzyResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyResult.tables.some((table) => table.id === 'fuzzy-topsis-distances') ? 'Native fuzzy TOPSIS tables and diagnostics generated.' : 'Native fuzzy TOPSIS outputs are missing.',
    },
    {
      method: 'Native Fuzzy AHP',
      passed: nativeFuzzyAhpResult.tables.some((table) => table.id === 'fuzzy-criteria-pairwise')
        && nativeFuzzyAhpResult.tables.some((table) => table.id === 'fuzzy-criteria-geomean')
        && nativeFuzzyAhpResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy AHP')
        && nativeFuzzyAhpResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyAhpResult.tables.some((table) => table.id === 'fuzzy-criteria-geomean') ? 'Native fuzzy AHP tables and diagnostics generated.' : 'Native fuzzy AHP outputs are missing.',
    },
    {
      method: 'Native Fuzzy VIKOR',
      passed: nativeFuzzyVikorResult.tables.some((table) => table.id === 'fuzzy-vikor-ideal')
        && nativeFuzzyVikorResult.tables.some((table) => table.id === 'fuzzy-vikor-regret')
        && nativeFuzzyVikorResult.tables.some((table) => table.id === 'fuzzy-vikor-measures')
        && nativeFuzzyVikorResult.tables.some((table) => table.id === 'fuzzy-vikor-acceptable-solution')
        && nativeFuzzyVikorResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy VIKOR')
        && nativeFuzzyVikorResult.diagnostics.some((diagnostic) => diagnostic.label === 'VIKOR acceptable advantage')
        && nativeFuzzyVikorResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyVikorResult.tables.some((table) => table.id === 'fuzzy-vikor-measures') ? 'Native fuzzy VIKOR tables and diagnostics generated.' : 'Native fuzzy VIKOR outputs are missing.',
    },
    {
      method: 'VIKOR Acceptable Solution Output',
      passed: vikorResult.tables.some((table) => table.id === 'vikor-acceptable-solution')
        && vikorResult.diagnostics.some((diagnostic) => diagnostic.label === 'VIKOR acceptable advantage')
        && vikorResult.diagnostics.some((diagnostic) => diagnostic.label === 'VIKOR acceptable stability')
        && vikorResult.reproducibility.vikorDQ != null,
      message: vikorResult.tables.some((table) => table.id === 'vikor-acceptable-solution') ? 'VIKOR reports acceptable advantage and stability checks.' : 'VIKOR acceptable-solution table is missing.',
    },
    {
      method: 'Native Fuzzy WASPAS',
      passed: nativeFuzzyWaspasResult.tables.some((table) => table.id === 'fuzzy-waspas-normalized')
        && nativeFuzzyWaspasResult.tables.some((table) => table.id === 'fuzzy-waspas-weighted')
        && nativeFuzzyWaspasResult.tables.some((table) => table.id === 'fuzzy-waspas-components')
        && nativeFuzzyWaspasResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy WASPAS')
        && nativeFuzzyWaspasResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyWaspasResult.tables.some((table) => table.id === 'fuzzy-waspas-components') ? 'Native fuzzy WASPAS tables and diagnostics generated.' : 'Native fuzzy WASPAS outputs are missing.',
    },
    {
      method: 'Native Fuzzy COPRAS',
      passed: nativeFuzzyCoprasResult.tables.some((table) => table.id === 'fuzzy-copras-normalized')
        && nativeFuzzyCoprasResult.tables.some((table) => table.id === 'fuzzy-copras-weighted')
        && nativeFuzzyCoprasResult.tables.some((table) => table.id === 'fuzzy-copras-components')
        && nativeFuzzyCoprasResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy COPRAS')
        && nativeFuzzyCoprasResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyCoprasResult.tables.some((table) => table.id === 'fuzzy-copras-components') ? 'Native fuzzy COPRAS tables and diagnostics generated.' : 'Native fuzzy COPRAS outputs are missing.',
    },
    {
      method: 'Native Fuzzy EDAS',
      passed: nativeFuzzyEdasResult.tables.some((table) => table.id === 'fuzzy-edas-average')
        && nativeFuzzyEdasResult.tables.some((table) => table.id === 'fuzzy-edas-pda')
        && nativeFuzzyEdasResult.tables.some((table) => table.id === 'fuzzy-edas-nda')
        && nativeFuzzyEdasResult.tables.some((table) => table.id === 'fuzzy-edas-appraisal')
        && nativeFuzzyEdasResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy EDAS')
        && nativeFuzzyEdasResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyEdasResult.tables.some((table) => table.id === 'fuzzy-edas-appraisal') ? 'Native fuzzy EDAS tables and diagnostics generated.' : 'Native fuzzy EDAS outputs are missing.',
    },
    {
      method: 'Native Fuzzy SAW',
      passed: nativeFuzzySawResult.tables.some((table) => table.id === 'fuzzy-saw-normalized')
        && nativeFuzzySawResult.tables.some((table) => table.id === 'fuzzy-saw-weighted')
        && nativeFuzzySawResult.tables.some((table) => table.id === 'fuzzy-saw-scores')
        && nativeFuzzySawResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy SAW')
        && nativeFuzzySawResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzySawResult.tables.some((table) => table.id === 'fuzzy-saw-scores') ? 'Native fuzzy SAW tables and diagnostics generated.' : 'Native fuzzy SAW outputs are missing.',
    },
    {
      method: 'Native Fuzzy WPM',
      passed: nativeFuzzyWpmResult.tables.some((table) => table.id === 'fuzzy-wpm-normalized')
        && nativeFuzzyWpmResult.tables.some((table) => table.id === 'fuzzy-wpm-components')
        && nativeFuzzyWpmResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy WPM')
        && nativeFuzzyWpmResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyWpmResult.tables.some((table) => table.id === 'fuzzy-wpm-components') ? 'Native fuzzy WPM tables and diagnostics generated.' : 'Native fuzzy WPM outputs are missing.',
    },
    {
      method: 'Native Fuzzy MOORA',
      passed: nativeFuzzyMooraResult.tables.some((table) => table.id === 'fuzzy-moora-ratio')
        && nativeFuzzyMooraResult.tables.some((table) => table.id === 'fuzzy-moora-weighted-ratio')
        && nativeFuzzyMooraResult.tables.some((table) => table.id === 'fuzzy-moora-net')
        && nativeFuzzyMooraResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy MOORA')
        && nativeFuzzyMooraResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyMooraResult.tables.some((table) => table.id === 'fuzzy-moora-net') ? 'Native fuzzy MOORA tables and diagnostics generated.' : 'Native fuzzy MOORA outputs are missing.',
    },
    {
      method: 'Native Fuzzy ARAS',
      passed: nativeFuzzyArasResult.tables.some((table) => table.id === 'fuzzy-aras-optimal')
        && nativeFuzzyArasResult.tables.some((table) => table.id === 'fuzzy-aras-normalized')
        && nativeFuzzyArasResult.tables.some((table) => table.id === 'fuzzy-aras-weighted')
        && nativeFuzzyArasResult.tables.some((table) => table.id === 'fuzzy-aras-utility')
        && nativeFuzzyArasResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy ARAS')
        && nativeFuzzyArasResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyArasResult.tables.some((table) => table.id === 'fuzzy-aras-utility') ? 'Native fuzzy ARAS tables and diagnostics generated.' : 'Native fuzzy ARAS outputs are missing.',
    },
    {
      method: 'Native Fuzzy MABAC',
      passed: nativeFuzzyMabacResult.tables.some((table) => table.id === 'fuzzy-mabac-normalized')
        && nativeFuzzyMabacResult.tables.some((table) => table.id === 'fuzzy-mabac-weighted')
        && nativeFuzzyMabacResult.tables.some((table) => table.id === 'fuzzy-mabac-border-area')
        && nativeFuzzyMabacResult.tables.some((table) => table.id === 'fuzzy-mabac-distance-border')
        && nativeFuzzyMabacResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy MABAC')
        && nativeFuzzyMabacResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyMabacResult.tables.some((table) => table.id === 'fuzzy-mabac-distance-border') ? 'Native fuzzy MABAC tables and diagnostics generated.' : 'Native fuzzy MABAC outputs are missing.',
    },
    {
      method: 'Native Fuzzy MARCOS',
      passed: nativeFuzzyMarcosResult.tables.some((table) => table.id === 'fuzzy-marcos-references')
        && nativeFuzzyMarcosResult.tables.some((table) => table.id === 'fuzzy-marcos-normalized')
        && nativeFuzzyMarcosResult.tables.some((table) => table.id === 'fuzzy-marcos-weighted')
        && nativeFuzzyMarcosResult.tables.some((table) => table.id === 'fuzzy-marcos-utility')
        && nativeFuzzyMarcosResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy MARCOS')
        && nativeFuzzyMarcosResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyMarcosResult.tables.some((table) => table.id === 'fuzzy-marcos-utility') ? 'Native fuzzy MARCOS tables and diagnostics generated.' : 'Native fuzzy MARCOS outputs are missing.',
    },
    {
      method: 'Native Fuzzy CoCoSo',
      passed: nativeFuzzyCocosoResult.tables.some((table) => table.id === 'fuzzy-cocoso-normalized')
        && nativeFuzzyCocosoResult.tables.some((table) => table.id === 'fuzzy-cocoso-weighted')
        && nativeFuzzyCocosoResult.tables.some((table) => table.id === 'fuzzy-cocoso-components')
        && nativeFuzzyCocosoResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy CoCoSo')
        && nativeFuzzyCocosoResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyCocosoResult.tables.some((table) => table.id === 'fuzzy-cocoso-components') ? 'Native fuzzy CoCoSo tables and diagnostics generated.' : 'Native fuzzy CoCoSo outputs are missing.',
    },
    {
      method: 'Native Fuzzy MAIRCA',
      passed: nativeFuzzyMaircaResult.tables.some((table) => table.id === 'fuzzy-mairca-normalized')
        && nativeFuzzyMaircaResult.tables.some((table) => table.id === 'fuzzy-mairca-theoretical-assessment')
        && nativeFuzzyMaircaResult.tables.some((table) => table.id === 'fuzzy-mairca-real-assessment')
        && nativeFuzzyMaircaResult.tables.some((table) => table.id === 'fuzzy-mairca-gap')
        && nativeFuzzyMaircaResult.tables.some((table) => table.id === 'fuzzy-mairca-total-gap')
        && nativeFuzzyMaircaResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy MAIRCA')
        && nativeFuzzyMaircaResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyMaircaResult.tables.some((table) => table.id === 'fuzzy-mairca-total-gap') ? 'Native fuzzy MAIRCA tables and diagnostics generated.' : 'Native fuzzy MAIRCA outputs are missing.',
    },
    {
      method: 'Native Fuzzy PROMETHEE',
      passed: nativeFuzzyPrometheeResult.tables.some((table) => table.id === 'fuzzy-promethee-preference-index')
        && nativeFuzzyPrometheeResult.tables.some((table) => table.id === 'fuzzy-promethee-flows')
        && nativeFuzzyPrometheeResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy PROMETHEE')
        && nativeFuzzyPrometheeResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyPrometheeResult.tables.some((table) => table.id === 'fuzzy-promethee-flows') ? 'Native fuzzy PROMETHEE tables and diagnostics generated.' : 'Native fuzzy PROMETHEE outputs are missing.',
    },
    {
      method: 'Native Fuzzy ELECTRE',
      passed: nativeFuzzyElectreResult.tables.some((table) => table.id === 'fuzzy-electre-concordance')
        && nativeFuzzyElectreResult.tables.some((table) => table.id === 'fuzzy-electre-discordance')
        && nativeFuzzyElectreResult.tables.some((table) => table.id === 'fuzzy-electre-outranking')
        && nativeFuzzyElectreResult.tables.some((table) => table.id === 'fuzzy-electre-score')
        && nativeFuzzyElectreResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy ELECTRE')
        && nativeFuzzyElectreResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyElectreResult.tables.some((table) => table.id === 'fuzzy-electre-score') ? 'Native fuzzy ELECTRE tables and diagnostics generated.' : 'Native fuzzy ELECTRE outputs are missing.',
    },
    {
      method: 'Native Fuzzy OCRA',
      passed: nativeFuzzyOcraResult.tables.some((table) => table.id === 'fuzzy-ocra-normalized')
        && nativeFuzzyOcraResult.tables.some((table) => table.id === 'fuzzy-ocra-weighted')
        && nativeFuzzyOcraResult.tables.some((table) => table.id === 'fuzzy-ocra-components')
        && nativeFuzzyOcraResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy OCRA')
        && nativeFuzzyOcraResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyOcraResult.tables.some((table) => table.id === 'fuzzy-ocra-components') ? 'Native fuzzy OCRA tables and diagnostics generated.' : 'Native fuzzy OCRA outputs are missing.',
    },
    {
      method: 'Native Fuzzy PIV',
      passed: nativeFuzzyPivResult.tables.some((table) => table.id === 'fuzzy-piv-normalized')
        && nativeFuzzyPivResult.tables.some((table) => table.id === 'fuzzy-piv-weighted')
        && nativeFuzzyPivResult.tables.some((table) => table.id === 'fuzzy-piv-best')
        && nativeFuzzyPivResult.tables.some((table) => table.id === 'fuzzy-piv-proximity')
        && nativeFuzzyPivResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy PIV')
        && nativeFuzzyPivResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyPivResult.tables.some((table) => table.id === 'fuzzy-piv-proximity') ? 'Native fuzzy PIV tables and diagnostics generated.' : 'Native fuzzy PIV outputs are missing.',
    },
    {
      method: 'Native Fuzzy ROV',
      passed: nativeFuzzyRovResult.tables.some((table) => table.id === 'fuzzy-rov-normalized')
        && nativeFuzzyRovResult.tables.some((table) => table.id === 'fuzzy-rov-weighted')
        && nativeFuzzyRovResult.tables.some((table) => table.id === 'fuzzy-rov-utilities')
        && nativeFuzzyRovResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy ROV')
        && nativeFuzzyRovResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyRovResult.tables.some((table) => table.id === 'fuzzy-rov-utilities') ? 'Native fuzzy ROV tables and diagnostics generated.' : 'Native fuzzy ROV outputs are missing.',
    },
    {
      method: 'Native Fuzzy WISP',
      passed: nativeFuzzyWispResult.tables.some((table) => table.id === 'fuzzy-wisp-normalized')
        && nativeFuzzyWispResult.tables.some((table) => table.id === 'fuzzy-wisp-weighted')
        && nativeFuzzyWispResult.tables.some((table) => table.id === 'fuzzy-wisp-components')
        && nativeFuzzyWispResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy WISP')
        && nativeFuzzyWispResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyWispResult.tables.some((table) => table.id === 'fuzzy-wisp-components') ? 'Native fuzzy WISP tables and diagnostics generated.' : 'Native fuzzy WISP outputs are missing.',
    },
    {
      method: 'Native Fuzzy TODIM',
      passed: nativeFuzzyTodimResult.tables.some((table) => table.id === 'fuzzy-todim-normalized')
        && nativeFuzzyTodimResult.tables.some((table) => table.id === 'fuzzy-todim-dominance-matrix')
        && nativeFuzzyTodimResult.tables.some((table) => table.id === 'fuzzy-todim-dominance-score')
        && nativeFuzzyTodimResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy TODIM')
        && nativeFuzzyTodimResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyTodimResult.tables.some((table) => table.id === 'fuzzy-todim-dominance-score') ? 'Native fuzzy TODIM tables and diagnostics generated.' : 'Native fuzzy TODIM outputs are missing.',
    },
    {
      method: 'Native Fuzzy CODAS',
      passed: nativeFuzzyCodasResult.tables.some((table) => table.id === 'fuzzy-codas-normalized')
        && nativeFuzzyCodasResult.tables.some((table) => table.id === 'fuzzy-codas-weighted')
        && nativeFuzzyCodasResult.tables.some((table) => table.id === 'fuzzy-codas-negative-ideal')
        && nativeFuzzyCodasResult.tables.some((table) => table.id === 'fuzzy-codas-distances')
        && nativeFuzzyCodasResult.tables.some((table) => table.id === 'fuzzy-codas-relative-assessment')
        && nativeFuzzyCodasResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy CODAS')
        && nativeFuzzyCodasResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyCodasResult.tables.some((table) => table.id === 'fuzzy-codas-relative-assessment') ? 'Native fuzzy CODAS tables and diagnostics generated.' : 'Native fuzzy CODAS outputs are missing.',
    },
    {
      method: 'Native Fuzzy GRA',
      passed: nativeFuzzyGraResult.tables.some((table) => table.id === 'fuzzy-gra-normalized')
        && nativeFuzzyGraResult.tables.some((table) => table.id === 'fuzzy-gra-ideal')
        && nativeFuzzyGraResult.tables.some((table) => table.id === 'fuzzy-gra-deviation')
        && nativeFuzzyGraResult.tables.some((table) => table.id === 'fuzzy-gra-coefficients')
        && nativeFuzzyGraResult.tables.some((table) => table.id === 'fuzzy-gra-grades')
        && nativeFuzzyGraResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy GRA')
        && nativeFuzzyGraResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyGraResult.tables.some((table) => table.id === 'fuzzy-gra-grades') ? 'Native fuzzy GRA tables and diagnostics generated.' : 'Native fuzzy GRA outputs are missing.',
    },
    {
      method: 'Native Fuzzy SPOTIS',
      passed: nativeFuzzySpotisResult.tables.some((table) => table.id === 'fuzzy-spotis-bounds')
        && nativeFuzzySpotisResult.tables.some((table) => table.id === 'fuzzy-spotis-normalized-distance')
        && nativeFuzzySpotisResult.tables.some((table) => table.id === 'fuzzy-spotis-weighted-distance')
        && nativeFuzzySpotisResult.tables.some((table) => table.id === 'fuzzy-spotis-score')
        && nativeFuzzySpotisResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy SPOTIS')
        && nativeFuzzySpotisResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzySpotisResult.tables.some((table) => table.id === 'fuzzy-spotis-score') ? 'Native fuzzy SPOTIS tables and diagnostics generated.' : 'Native fuzzy SPOTIS outputs are missing.',
    },
    {
      method: 'Native Fuzzy RAM',
      passed: nativeFuzzyRamResult.tables.some((table) => table.id === 'fuzzy-ram-normalized')
        && nativeFuzzyRamResult.tables.some((table) => table.id === 'fuzzy-ram-weighted')
        && nativeFuzzyRamResult.tables.some((table) => table.id === 'fuzzy-ram-components')
        && nativeFuzzyRamResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy RAM')
        && nativeFuzzyRamResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyRamResult.tables.some((table) => table.id === 'fuzzy-ram-components') ? 'Native fuzzy RAM tables and diagnostics generated.' : 'Native fuzzy RAM outputs are missing.',
    },
    {
      method: 'Native Fuzzy SMART',
      passed: nativeFuzzySmartResult.tables.some((table) => table.id === 'fuzzy-smart-utilities')
        && nativeFuzzySmartResult.tables.some((table) => table.id === 'fuzzy-smart-weighted-utilities')
        && nativeFuzzySmartResult.tables.some((table) => table.id === 'fuzzy-smart-scores')
        && nativeFuzzySmartResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy SMART')
        && nativeFuzzySmartResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzySmartResult.tables.some((table) => table.id === 'fuzzy-smart-scores') ? 'Native fuzzy SMART tables and diagnostics generated.' : 'Native fuzzy SMART outputs are missing.',
    },
    {
      method: 'Native Fuzzy MULTIMOORA',
      passed: nativeFuzzyMultimooraResult.tables.some((table) => table.id === 'fuzzy-multimoora-ratio')
        && nativeFuzzyMultimooraResult.tables.some((table) => table.id === 'fuzzy-multimoora-weighted-ratio')
        && nativeFuzzyMultimooraResult.tables.some((table) => table.id === 'fuzzy-multimoora-reference')
        && nativeFuzzyMultimooraResult.tables.some((table) => table.id === 'fuzzy-multimoora-components')
        && nativeFuzzyMultimooraResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy MULTIMOORA')
        && nativeFuzzyMultimooraResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyMultimooraResult.tables.some((table) => table.id === 'fuzzy-multimoora-components') ? 'Native fuzzy MULTIMOORA tables and diagnostics generated.' : 'Native fuzzy MULTIMOORA outputs are missing.',
    },
    {
      method: 'Native Fuzzy PSI',
      passed: nativeFuzzyPsiResult.tables.some((table) => table.id === 'fuzzy-psi-normalized')
        && nativeFuzzyPsiResult.tables.some((table) => table.id === 'fuzzy-psi-weights')
        && nativeFuzzyPsiResult.tables.some((table) => table.id === 'fuzzy-psi-weighted')
        && nativeFuzzyPsiResult.tables.some((table) => table.id === 'fuzzy-psi-scores')
        && nativeFuzzyPsiResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy PSI')
        && nativeFuzzyPsiResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyPsiResult.tables.some((table) => table.id === 'fuzzy-psi-scores') ? 'Native fuzzy PSI tables and diagnostics generated.' : 'Native fuzzy PSI outputs are missing.',
    },
    {
      method: 'Native Fuzzy MAUT',
      passed: nativeFuzzyMautResult.tables.some((table) => table.id === 'fuzzy-maut-utilities')
        && nativeFuzzyMautResult.tables.some((table) => table.id === 'fuzzy-maut-shaped-utilities')
        && nativeFuzzyMautResult.tables.some((table) => table.id === 'fuzzy-maut-weighted-utilities')
        && nativeFuzzyMautResult.tables.some((table) => table.id === 'fuzzy-maut-scores')
        && nativeFuzzyMautResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy MAUT')
        && nativeFuzzyMautResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyMautResult.tables.some((table) => table.id === 'fuzzy-maut-scores') ? 'Native fuzzy MAUT tables and diagnostics generated.' : 'Native fuzzy MAUT outputs are missing.',
    },
    {
      method: 'Native Fuzzy LMAW',
      passed: nativeFuzzyLmawResult.tables.some((table) => table.id === 'fuzzy-lmaw-standardized')
        && nativeFuzzyLmawResult.tables.some((table) => table.id === 'fuzzy-lmaw-log-normalized')
        && nativeFuzzyLmawResult.tables.some((table) => table.id === 'fuzzy-lmaw-weighted')
        && nativeFuzzyLmawResult.tables.some((table) => table.id === 'fuzzy-lmaw-index')
        && nativeFuzzyLmawResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy LMAW')
        && nativeFuzzyLmawResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyLmawResult.tables.some((table) => table.id === 'fuzzy-lmaw-index') ? 'Native fuzzy LMAW tables and diagnostics generated.' : 'Native fuzzy LMAW outputs are missing.',
    },
    {
      method: 'Native Fuzzy WEDBA',
      passed: nativeFuzzyWedbaResult.tables.some((table) => table.id === 'fuzzy-wedba-normalized')
        && nativeFuzzyWedbaResult.tables.some((table) => table.id === 'fuzzy-wedba-standardized')
        && nativeFuzzyWedbaResult.tables.some((table) => table.id === 'fuzzy-wedba-reference-points')
        && nativeFuzzyWedbaResult.tables.some((table) => table.id === 'fuzzy-wedba-distances')
        && nativeFuzzyWedbaResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy WEDBA')
        && nativeFuzzyWedbaResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyWedbaResult.tables.some((table) => table.id === 'fuzzy-wedba-distances') ? 'Native fuzzy WEDBA tables and diagnostics generated.' : 'Native fuzzy WEDBA outputs are missing.',
    },
    {
      method: 'Native Fuzzy DNMA',
      passed: nativeFuzzyDnmaResult.tables.some((table) => table.id === 'fuzzy-dnma-targets')
        && nativeFuzzyDnmaResult.tables.some((table) => table.id === 'fuzzy-dnma-linear-normalized')
        && nativeFuzzyDnmaResult.tables.some((table) => table.id === 'fuzzy-dnma-vector-normalized')
        && nativeFuzzyDnmaResult.tables.some((table) => table.id === 'fuzzy-dnma-subordinate-utilities')
        && nativeFuzzyDnmaResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy DNMA')
        && nativeFuzzyDnmaResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyDnmaResult.tables.some((table) => table.id === 'fuzzy-dnma-subordinate-utilities') ? 'Native fuzzy DNMA tables and diagnostics generated.' : 'Native fuzzy DNMA outputs are missing.',
    },
    {
      method: 'Native Fuzzy PROBID',
      passed: nativeFuzzyProbidResult.tables.some((table) => table.id === 'fuzzy-probid-normalized')
        && nativeFuzzyProbidResult.tables.some((table) => table.id === 'fuzzy-probid-weighted')
        && nativeFuzzyProbidResult.tables.some((table) => table.id === 'fuzzy-probid-reference-points')
        && nativeFuzzyProbidResult.tables.some((table) => table.id === 'fuzzy-probid-distances')
        && nativeFuzzyProbidResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy PROBID')
        && nativeFuzzyProbidResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyProbidResult.tables.some((table) => table.id === 'fuzzy-probid-distances') ? 'Native fuzzy PROBID tables and diagnostics generated.' : 'Native fuzzy PROBID outputs are missing.',
    },
    {
      method: 'Native Fuzzy RIM',
      passed: nativeFuzzyRimResult.tables.some((table) => table.id === 'fuzzy-rim-intervals')
        && nativeFuzzyRimResult.tables.some((table) => table.id === 'fuzzy-rim-closeness')
        && nativeFuzzyRimResult.tables.some((table) => table.id === 'fuzzy-rim-weighted-closeness')
        && nativeFuzzyRimResult.tables.some((table) => table.id === 'fuzzy-rim-distance-index')
        && nativeFuzzyRimResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy RIM')
        && nativeFuzzyRimResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyRimResult.tables.some((table) => table.id === 'fuzzy-rim-distance-index') ? 'Native fuzzy RIM tables and diagnostics generated.' : 'Native fuzzy RIM outputs are missing.',
    },
    {
      method: 'Native Fuzzy RAFSI',
      passed: nativeFuzzyRafsiResult.tables.some((table) => table.id === 'fuzzy-rafsi-reference-values')
        && nativeFuzzyRafsiResult.tables.some((table) => table.id === 'fuzzy-rafsi-mapped')
        && nativeFuzzyRafsiResult.tables.some((table) => table.id === 'fuzzy-rafsi-normalized')
        && nativeFuzzyRafsiResult.tables.some((table) => table.id === 'fuzzy-rafsi-weighted')
        && nativeFuzzyRafsiResult.tables.some((table) => table.id === 'fuzzy-rafsi-score')
        && nativeFuzzyRafsiResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy RAFSI')
        && nativeFuzzyRafsiResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyRafsiResult.tables.some((table) => table.id === 'fuzzy-rafsi-score') ? 'Native fuzzy RAFSI tables and diagnostics generated.' : 'Native fuzzy RAFSI outputs are missing.',
    },
    {
      method: 'Native Fuzzy LoPM',
      passed: nativeFuzzyLopmResult.tables.some((table) => table.id === 'fuzzy-lopm-property-limits')
        && nativeFuzzyLopmResult.tables.some((table) => table.id === 'fuzzy-lopm-merit-components')
        && nativeFuzzyLopmResult.tables.some((table) => table.id === 'fuzzy-lopm-weighted-merit')
        && nativeFuzzyLopmResult.tables.some((table) => table.id === 'fuzzy-lopm-score')
        && nativeFuzzyLopmResult.tables.some((table) => table.id === 'fuzzy-lopm-feasibility-screen')
        && nativeFuzzyLopmResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy LoPM')
        && nativeFuzzyLopmResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyLopmResult.tables.some((table) => table.id === 'fuzzy-lopm-score') ? 'Native fuzzy LoPM tables and diagnostics generated.' : 'Native fuzzy LoPM outputs are missing.',
    },
    {
      method: 'Native Fuzzy AROMAN',
      passed: nativeFuzzyAromanResult.tables.some((table) => table.id === 'fuzzy-aroman-linear-normalized')
        && nativeFuzzyAromanResult.tables.some((table) => table.id === 'fuzzy-aroman-vector-normalized')
        && nativeFuzzyAromanResult.tables.some((table) => table.id === 'fuzzy-aroman-blended-normalized')
        && nativeFuzzyAromanResult.tables.some((table) => table.id === 'fuzzy-aroman-weighted')
        && nativeFuzzyAromanResult.tables.some((table) => table.id === 'fuzzy-aroman-score')
        && nativeFuzzyAromanResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy AROMAN')
        && nativeFuzzyAromanResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyAromanResult.tables.some((table) => table.id === 'fuzzy-aroman-score') ? 'Native fuzzy AROMAN tables and diagnostics generated.' : 'Native fuzzy AROMAN outputs are missing.',
    },
    {
      method: 'Native Fuzzy COBRA',
      passed: nativeFuzzyCobraResult.tables.some((table) => table.id === 'fuzzy-cobra-normalized')
        && nativeFuzzyCobraResult.tables.some((table) => table.id === 'fuzzy-cobra-weighted')
        && nativeFuzzyCobraResult.tables.some((table) => table.id === 'fuzzy-cobra-reference-solutions')
        && nativeFuzzyCobraResult.tables.some((table) => table.id === 'fuzzy-cobra-distances')
        && nativeFuzzyCobraResult.tables.some((table) => table.id === 'fuzzy-cobra-final')
        && nativeFuzzyCobraResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy COBRA')
        && nativeFuzzyCobraResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyCobraResult.tables.some((table) => table.id === 'fuzzy-cobra-final') ? 'Native fuzzy COBRA tables and diagnostics generated.' : 'Native fuzzy COBRA outputs are missing.',
    },
    {
      method: 'Native Fuzzy ERVD',
      passed: nativeFuzzyErvdResult.tables.some((table) => table.id === 'fuzzy-ervd-reference-point')
        && nativeFuzzyErvdResult.tables.some((table) => table.id === 'fuzzy-ervd-utility')
        && nativeFuzzyErvdResult.tables.some((table) => table.id === 'fuzzy-ervd-relative-values')
        && nativeFuzzyErvdResult.tables.some((table) => table.id === 'fuzzy-ervd-weighted-relative-values')
        && nativeFuzzyErvdResult.tables.some((table) => table.id === 'fuzzy-ervd-score')
        && nativeFuzzyErvdResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy ERVD')
        && nativeFuzzyErvdResult.ranking.length === sampleMatrix.alternatives.length,
      message: nativeFuzzyErvdResult.tables.some((table) => table.id === 'fuzzy-ervd-score') ? 'Native fuzzy ERVD tables and diagnostics generated.' : 'Native fuzzy ERVD outputs are missing.',
    },
  ];
}

export function runAlgorithmSmokeChecks(): SmokeCheckResult[] {
  const expectedTop: Partial<Record<MethodId, string>> = {
    topsis: 'Epsilon',
    ahp: 'Gamma',
    dematel: 'CO2 Emissions',
    vikor: 'Epsilon',
    copras: 'Epsilon',
    saw: 'Epsilon',
    eamr: 'Epsilon',
    rawec: 'Epsilon',
    comet: 'Epsilon',
    wpm: 'Epsilon',
    waspas: 'Epsilon',
    moora: 'Epsilon',
    aras: 'Epsilon',
    edas: 'Epsilon',
    mabac: 'Epsilon',
    codas: 'Gamma',
    cocoso: 'Epsilon',
    lexicographic: 'Delta',
    marcos: 'Epsilon',
    mairca: 'Epsilon',
    promethee: 'Epsilon',
    electre: 'Beta',
    smart: 'Epsilon',
    maut: 'Epsilon',
    smarter: 'Gamma',
    macbeth: 'Epsilon',
    pugh: 'Gamma',
    ocra: 'Epsilon',
    multimoora: 'Epsilon',
    psi: 'Epsilon',
    piv: 'Epsilon',
    rov: 'Epsilon',
    wisp: 'Epsilon',
    todim: 'Epsilon',
    ram: 'Gamma',
    gra: 'Gamma',
    spotis: 'Epsilon',
    wedba: 'Epsilon',
    lmaw: 'Epsilon',
    dnma: 'Epsilon',
    probid: 'Epsilon',
    rim: 'Epsilon',
    rafsi: 'Epsilon',
    lopm: 'Epsilon',
    aroman: 'Gamma',
    cobra: 'Epsilon',
    ervd: 'Epsilon',
  };
  return methodRegistry.map((method) => {
    try {
      const input = methodInput(method.id);
      const result = method.runAnalysis(input, { ...sampleConfig, methodId: method.id });
      const hasRanking = result.ranking.length === input.alternatives.length;
      const hasTables = result.tables.length >= 2;
      const rankNumbers = result.ranking.map((row) => row.rank).join(',');
      const ranksAreSequential = rankNumbers === Array.from({ length: input.alternatives.length }, (_, index) => index + 1).join(',');
      const topMatchesBenchmark = expectedTop[method.id] ? result.ranking[0].alternative === expectedTop[method.id] : true;
      return {
        method: method.name,
        passed: hasRanking && hasTables && ranksAreSequential && topMatchesBenchmark,
        message: hasRanking && hasTables && ranksAreSequential && topMatchesBenchmark
          ? `Benchmark OK: ${result.ranking[0].alternative} is top-ranked with ${result.tables.length} output tables.`
          : 'Failed expected ranking/table structure.',
      };
    } catch (error) {
      return {
        method: method.name,
        passed: false,
        message: error instanceof Error ? error.message : 'Unknown algorithm error.',
      };
    }
  });
}

export function runNativeFuzzyCrispEquivalenceSmokeChecks(): SmokeCheckResult[] {
  return methodRegistry
    .filter((method) => method.fuzzySupport.mode === 'native-fuzzy' && method.fuzzySupport.nativeModeLabel)
    .map((method) => {
      const nativeModeLabel = method.fuzzySupport.nativeModeLabel ?? 'Native fuzzy';
      const input = methodInput(method.id);
      const crispFuzzyInput: DecisionMatrix = {
        ...input,
        fuzzyValues: input.values.map((row) => row.map((value) => crispFuzzy(value))),
        fuzzyCellCount: input.values.flat().length,
      };
      const config: StudyConfig = {
        ...sampleConfig,
        methodId: method.id,
        methodParams: {
          ...sampleConfig.methodParams,
          fuzzyInputMode: nativeModeLabel,
        },
      };
      const baseline = method.runAnalysis(input, config);
      const uploadedCrispFuzzy = method.runAnalysis(crispFuzzyInput, config);
      const baselineOrder = baseline.ranking.map((row) => row.alternativeId).join('|');
      const fuzzyOrder = uploadedCrispFuzzy.ranking.map((row) => row.alternativeId).join('|');
      const hasFiniteScores = uploadedCrispFuzzy.ranking.every((row) => Number.isFinite(row.score));
      const hasNativeDiagnostic = uploadedCrispFuzzy.diagnostics.some((diagnostic) => diagnostic.label === nativeModeLabel);
      const passed = baselineOrder === fuzzyOrder && hasFiniteScores && hasNativeDiagnostic;

      return {
        method: `${method.name} crisp fuzzy equivalence`,
        passed,
        message: passed
          ? `${method.name} preserves ranking when crisp values are uploaded as fuzzy cells.`
          : `${method.name} ranking changed or diagnostics were missing when crisp values were uploaded as fuzzy cells.`,
      };
    });
}

export function runZeroValueSmokeChecks(): SmokeCheckResult[] {
  const zeroInput: DecisionMatrix = {
    alternatives: sampleMatrix.alternatives.slice(0, 3),
    criteria: [
      { id: 'Z1', name: 'Zero-capable cost', direction: 'cost', weight: 0.4 },
      { id: 'Z2', name: 'Zero-capable benefit', direction: 'benefit', weight: 0.35 },
      { id: 'Z3', name: 'Mixed benefit', direction: 'benefit', weight: 0.25 },
    ],
    values: [
      [0, 0, -2],
      [4, 8, 0],
      [2, 3, 5],
    ],
  };
  const broadChecks = methodRegistry.filter((method) => method.id !== 'dematel').map((method) => {
    try {
      const result = method.runAnalysis(zeroInput, { ...sampleConfig, methodId: method.id, weightingId: method.id === 'ahp' ? 'ahp' : 'manual' });
      const finiteRanking = result.ranking.every((row) => Number.isFinite(row.score));
      const finiteTables = result.tables.every((table) => hasOnlyFiniteNumbers(table.rows));
      return {
        method: method.name,
        passed: finiteRanking && finiteTables,
        message: finiteRanking && finiteTables ? 'Zero-value robustness OK.' : 'Non-finite value produced for zero-containing input.',
      };
    } catch (error) {
      return {
        method: method.name,
        passed: false,
        message: error instanceof Error ? error.message : 'Unknown zero-value robustness error.',
      };
    }
  });

  const edasZeroAverageInput: DecisionMatrix = {
    alternatives: sampleMatrix.alternatives.slice(0, 3),
    criteria: [
      { id: 'Z1', name: 'All-zero benefit', direction: 'benefit', weight: 0.5 },
      { id: 'Z2', name: 'All-zero cost', direction: 'cost', weight: 0.5 },
    ],
    values: [
      [0, 0],
      [0, 0],
      [0, 0],
    ],
  };
  try {
    const edas = methodRegistry.find((method) => method.id === 'edas');
    if (!edas) {
      return [...broadChecks, {
        method: 'EDAS all-zero average guard',
        passed: false,
        message: 'EDAS method is missing.',
      }];
    }
    const result = edas.runAnalysis(edasZeroAverageInput, { ...sampleConfig, methodId: 'edas', weightingId: 'manual' });
    const passed = result.ranking.every((row) => Number.isFinite(row.score))
      && result.tables.every((table) => hasOnlyFiniteNumbers(table.rows))
      && result.diagnostics.some((diagnostic) => diagnostic.label === 'EDAS zero average guard');
    return [...broadChecks, {
      method: 'EDAS all-zero average guard',
      passed,
      message: passed ? 'EDAS handles all-zero average columns with finite appraisal scores.' : 'EDAS all-zero average handling is missing or non-finite.',
    }];
  } catch (error) {
    return [...broadChecks, {
      method: 'EDAS all-zero average guard',
      passed: false,
      message: error instanceof Error ? error.message : 'Unknown EDAS zero-average robustness error.',
    }];
  }
}

export function runTemplateSmokeChecks(): SmokeCheckResult[] {
  return methodRegistry.map((method) => {
    try {
      const input = methodInput(method.id);
      const sheets = method.getTemplateSchema({
        ...sampleConfig,
        methodId: method.id,
        alternatives: input.alternatives,
        criteria: input.criteria,
      });
      const sheetNames = sheets.map((sheet) => sheet.name);
      const duplicateNames = sheetNames.filter((name, index) => sheetNames.indexOf(name) !== index);
      const invalidSheetNames = sheetNames.filter((name) => /[\\/:?*[\]]/.test(name) || name.length > 31);
      const missingSheets = requiredTemplateSheets(method.id).filter((name) => !sheetNames.includes(name));
      if (method.id !== 'dematel' && sheetNames.includes('Respondent 1')) missingSheets.push('Unexpected Respondent 1 in single-dataset mode');
      if (method.id === 'ahp' && (sheetNames.includes('AHP Criteria Respondent 1') || sheetNames.includes('AHP Alternatives Respondent 1'))) missingSheets.push('Unexpected AHP respondent sheets in single-dataset mode');
      const groupSheets = method.id !== 'dematel'
        ? method.getTemplateSchema({
          ...sampleConfig,
          methodId: method.id,
          alternatives: input.alternatives,
          criteria: input.criteria,
          methodParams: { ...sampleConfig.methodParams, dataInputMode: 'Multiple respondents', respondentCount: 2, ahpRespondentCount: 2 },
        }).map((sheet) => sheet.name)
        : method.getTemplateSchema({
          ...sampleConfig,
          methodId: method.id,
          alternatives: input.alternatives,
          criteria: input.criteria,
          methodParams: { ...sampleConfig.methodParams, dataInputMode: 'Multiple experts', dematelExpertCount: 2 },
        }).map((sheet) => sheet.name);
      if (method.id === 'dematel') {
        if (!groupSheets.includes('Expert 1') || !groupSheets.includes('Expert 2')) missingSheets.push('Expert group sheets');
      } else {
        if (!groupSheets.includes('Respondent 1') || !groupSheets.includes('Respondent 2')) missingSheets.push('Respondent group sheets');
        if (method.id === 'ahp' && (!groupSheets.includes('AHP Criteria Respondent 1') || !groupSheets.includes('AHP Alternatives Respondent 1'))) missingSheets.push('AHP group pairwise sheets');
      }
      const emptySheets = sheets.filter((sheet) => !sheet.rows.length || !sheet.rows[0]?.length).map((sheet) => sheet.name);
      const missingParameters = missingTemplateParameters(sheets, method.id, method.parameters);
      const bwmSheets = method.supportsWeights && method.id !== 'ahp'
        ? method.getTemplateSchema({ ...sampleConfig, methodId: method.id, weightingId: 'bwm', alternatives: input.alternatives, criteria: input.criteria }).map((sheet) => sheet.name)
        : [];
      const dibrSheets = method.supportsWeights && method.id !== 'ahp'
        ? method.getTemplateSchema({ ...sampleConfig, methodId: method.id, weightingId: 'dibr', alternatives: input.alternatives, criteria: input.criteria }).map((sheet) => sheet.name)
        : [];
      const simosSheets = method.supportsWeights && method.id !== 'ahp'
        ? method.getTemplateSchema({ ...sampleConfig, methodId: method.id, weightingId: 'simos', alternatives: input.alternatives, criteria: input.criteria }).map((sheet) => sheet.name)
        : [];
      const swaraSheets = method.supportsWeights && method.id !== 'ahp'
        ? method.getTemplateSchema({ ...sampleConfig, methodId: method.id, weightingId: 'swara', alternatives: input.alternatives, criteria: input.criteria }).map((sheet) => sheet.name)
        : [];
      const stddevSheets = method.supportsWeights && method.id !== 'ahp'
        ? method.getTemplateSchema({ ...sampleConfig, methodId: method.id, weightingId: 'stddev', alternatives: input.alternatives, criteria: input.criteria }).map((sheet) => sheet.name)
        : [];
      const covSheets = method.supportsWeights && method.id !== 'ahp'
        ? method.getTemplateSchema({ ...sampleConfig, methodId: method.id, weightingId: 'cov', alternatives: input.alternatives, criteria: input.criteria }).map((sheet) => sheet.name)
        : [];
      const missingWeightingSheets = [
        method.supportsWeights && method.id !== 'ahp' && stddevSheets.includes('Weights') ? 'STDDEV should not expose editable Weights' : '',
        method.supportsWeights && method.id !== 'ahp' && covSheets.includes('Weights') ? 'COV should not expose editable Weights' : '',
        method.supportsWeights && method.id !== 'ahp' && !stddevSheets.includes('Calculated Weights Guide') ? 'STDDEV Calculated Weights Guide' : '',
        method.supportsWeights && method.id !== 'ahp' && !covSheets.includes('Calculated Weights Guide') ? 'COV Calculated Weights Guide' : '',
        method.supportsWeights && method.id !== 'ahp' && !bwmSheets.includes('BWM Parameters') ? 'BWM Parameters' : '',
        method.supportsWeights && method.id !== 'ahp' && !dibrSheets.includes('DIBR Parameters') ? 'DIBR Parameters' : '',
        method.supportsWeights && method.id !== 'ahp' && !simosSheets.includes('SRF Cards Parameters') ? 'SRF Cards Parameters' : '',
        method.supportsWeights && method.id !== 'ahp' && !swaraSheets.includes('SWARA Parameters') ? 'SWARA Parameters' : '',
        method.supportsWeights && method.id !== 'ahp' && !method.getTemplateSchema({ ...sampleConfig, methodId: method.id, weightingId: 'roc', alternatives: input.alternatives, criteria: input.criteria }).map((sheet) => sheet.name).includes('ROC Parameters') ? 'ROC Parameters' : '',
        method.supportsWeights && method.id !== 'ahp' && !method.getTemplateSchema({ ...sampleConfig, methodId: method.id, weightingId: 'fucom', alternatives: input.alternatives, criteria: input.criteria }).map((sheet) => sheet.name).includes('FUCOM Parameters') ? 'FUCOM Parameters' : '',
        method.supportsWeights && method.id !== 'ahp' && !method.getTemplateSchema({ ...sampleConfig, methodId: method.id, weightingId: 'lbwa', alternatives: input.alternatives, criteria: input.criteria }).map((sheet) => sheet.name).includes('LBWA Parameters') ? 'LBWA Parameters' : '',
        method.supportsWeights && method.id !== 'ahp' && !method.getTemplateSchema({ ...sampleConfig, methodId: method.id, weightingId: 'piprecia', alternatives: input.alternatives, criteria: input.criteria }).map((sheet) => sheet.name).includes('PIPRECIA Parameters') ? 'PIPRECIA Parameters' : '',
        method.supportsWeights && method.id !== 'ahp' && !method.getTemplateSchema({ ...sampleConfig, methodId: method.id, weightingId: 'rankSum', alternatives: input.alternatives, criteria: input.criteria }).map((sheet) => sheet.name).includes('Rank Sum Parameters') ? 'Rank Sum Parameters' : '',
        method.supportsWeights && method.id !== 'ahp' && !method.getTemplateSchema({ ...sampleConfig, methodId: method.id, weightingId: 'rankReciprocal', alternatives: input.alternatives, criteria: input.criteria }).map((sheet) => sheet.name).includes('Rank Reciprocal Parameters') ? 'Rank Reciprocal Parameters' : '',
        method.supportsWeights && method.id !== 'ahp' && !method.getTemplateSchema({ ...sampleConfig, methodId: method.id, weightingId: 'rancom', alternatives: input.alternatives, criteria: input.criteria }).map((sheet) => sheet.name).includes('RANCOM Parameters') ? 'RANCOM Parameters' : '',
        method.supportsWeights && method.id !== 'ahp' && !method.getTemplateSchema({ ...sampleConfig, methodId: method.id, weightingId: 'merecG', alternatives: input.alternatives, criteria: input.criteria }).map((sheet) => sheet.name).includes('MEREC-G Parameters') ? 'MEREC-G Parameters' : '',
        method.supportsWeights && method.id !== 'ahp' && !method.getTemplateSchema({ ...sampleConfig, methodId: method.id, weightingId: 'wenslo', alternatives: input.alternatives, criteria: input.criteria }).map((sheet) => sheet.name).includes('WENSLO Parameters') ? 'WENSLO Parameters' : '',
        method.supportsWeights && method.id !== 'ahp' && !method.getTemplateSchema({ ...sampleConfig, methodId: method.id, weightingId: 'angular', alternatives: input.alternatives, criteria: input.criteria }).map((sheet) => sheet.name).includes('Angular Parameters') ? 'Angular Parameters' : '',
        method.supportsWeights && method.id !== 'ahp' && !method.getTemplateSchema({ ...sampleConfig, methodId: method.id, weightingId: 'gini', alternatives: input.alternatives, criteria: input.criteria }).map((sheet) => sheet.name).includes('Gini Parameters') ? 'Gini Parameters' : '',
        method.supportsWeights && method.id !== 'ahp' && !method.getTemplateSchema({ ...sampleConfig, methodId: method.id, weightingId: 'mpsi', alternatives: input.alternatives, criteria: input.criteria }).map((sheet) => sheet.name).includes('MPSI Parameters') ? 'MPSI Parameters' : '',
        method.supportsWeights && method.id !== 'ahp' && !method.getTemplateSchema({ ...sampleConfig, methodId: method.id, weightingId: 'cimas', alternatives: input.alternatives, criteria: input.criteria }).map((sheet) => sheet.name).includes('CIMAS Parameters') ? 'CIMAS Parameters' : '',
      ].filter(Boolean);
      const hasMethodSettings = method.id === 'dematel'
        || ['ahp', 'topsis', 'vikor', 'promethee', 'waspas', 'comet', 'lexicographic', 'smarter', 'macbeth', 'pugh', 'aroman', 'cobra', 'ervd'].includes(method.id)
        || method.id === 'spotis'
        || method.id === 'espSpotis'
        || method.id === 'rim'
        || method.id === 'rafsi'
        || method.id === 'lopm'
        || sheetNames.includes(excelSafeSheetName(`${method.name} Settings`));
      const passed = !duplicateNames.length && !invalidSheetNames.length && !missingSheets.length && !emptySheets.length && !missingParameters.length && !missingWeightingSheets.length && hasMethodSettings;
      const problems = [
        missingSheets.length ? `missing ${missingSheets.join(', ')}` : '',
        duplicateNames.length ? `duplicate ${duplicateNames.join(', ')}` : '',
        invalidSheetNames.length ? `invalid Excel sheet names ${invalidSheetNames.join(', ')}` : '',
        emptySheets.length ? `empty ${emptySheets.join(', ')}` : '',
        missingParameters.length ? `missing parameter fields ${missingParameters.join(', ')}` : '',
        missingWeightingSheets.length ? `missing weighting sheets ${missingWeightingSheets.join(', ')}` : '',
        hasMethodSettings ? '' : 'missing method settings sheet',
      ].filter(Boolean).join('; ');
      return {
        method: method.name,
        passed,
        message: passed ? `Template OK: ${sheets.length} sheets generated.` : `Template issue: ${problems}`,
      };
    } catch (error) {
      return {
        method: method.name,
        passed: false,
        message: error instanceof Error ? error.message : 'Unknown template error.',
      };
    }
  });
}

export function runReportContentSmokeChecks(): SmokeCheckResult[] {
  return methodRegistry.map((method) => {
    try {
      const input = methodInput(method.id);
      const result = method.runAnalysis(input, { ...sampleConfig, methodId: method.id });
      const tableIds = result.tables.map((table) => table.id);
      const visualizationTypes = result.visualizations.map((visualization) => visualization.type);
      const missing: string[] = [];
      if (!result.narrative.trim()) missing.push('method narrative');
      if (!Object.keys(result.reproducibility).length) missing.push('reproducibility metadata');
      if (!result.diagnostics.length) missing.push('diagnostics');
      if (!result.visualizations.length || result.visualizations.some((visualization) => !visualization.data.length)) missing.push('visualization data');
      if (method.id === 'dematel') {
        if (!tableIds.includes('cause-effect')) missing.push('cause-effect table');
        if (!tableIds.includes('total-relation')) missing.push('total relation table');
        if (!tableIds.includes('thresholded-total-relation')) missing.push('thresholded relation table');
        if (!visualizationTypes.includes('dematel-cause-effect')) missing.push('DEMATEL cause-effect visualization');
        if (!visualizationTypes.includes('matrix-heatmap')) missing.push('DEMATEL matrix heatmap');
      } else {
        if (!tableIds.includes('ranking')) missing.push('final ranking table');
        if (!tableIds.includes('sensitivity')) missing.push('sensitivity table');
        if (!tableIds.includes('applied-criteria-weights')) missing.push('applied criteria weights table');
        if (method.id === 'edas') {
          ['edas-average-solution', 'edas-pda', 'edas-nda', 'edas'].forEach((id) => {
            if (!tableIds.includes(id)) missing.push(`EDAS ${id} table`);
          });
        }
        if (!visualizationTypes.includes('ranking-bar')) missing.push('ranking visualization');
        if (!visualizationTypes.includes('weight-bar')) missing.push('weight visualization');
        if (!visualizationTypes.includes('matrix-heatmap')) missing.push('matrix heatmap');
        if (!visualizationTypes.includes('sensitivity-band')) missing.push('sensitivity visualization');
      }
      return {
        method: method.name,
        passed: !missing.length,
        message: missing.length ? `Report content missing: ${missing.join(', ')}` : `Report content OK: ${result.tables.length} tables and ${result.visualizations.length} visualizations.`,
      };
    } catch (error) {
      return {
        method: method.name,
        passed: false,
        message: error instanceof Error ? error.message : 'Unknown report content error.',
      };
    }
  });
}

export function runGroupDecisionSmokeChecks(): SmokeCheckResult[] {
  const groupedInput: DecisionMatrix = {
    ...sampleMatrix,
    respondentMatrices: [
      sampleMatrix.values,
      sampleMatrix.values.map((row) => row.map((value) => value * 1.02)),
    ],
  };
  const method = methodRegistry.find((item) => item.id === 'topsis');
  const ahp = methodRegistry.find((item) => item.id === 'ahp');
  const dematel = methodRegistry.find((item) => item.id === 'dematel');
  if (!method) return [{ method: 'Group Decision', passed: false, message: 'TOPSIS method missing.' }];
  const result = method.runAnalysis(groupedInput, { ...sampleConfig, methodId: 'topsis', methodParams: { ...sampleConfig.methodParams, respondentAggregation: 'Arithmetic mean' } });
  const aggregationTable = result.tables.find((table) => table.id === 'respondent-aggregation');
  const hasAggregationTable = Boolean(aggregationTable)
    && Boolean(aggregationTable?.columns.includes('Mean absolute disagreement'))
    && Boolean(aggregationTable?.columns.includes('Max absolute disagreement'))
    && Boolean(aggregationTable?.columns.includes('Relative disagreement'))
    && Boolean(aggregationTable?.columns.includes('Consensus level'))
    && Number(aggregationTable?.rows[0]?.[3]) > 0
    && String(aggregationTable?.rows[0]?.[6]).includes('consensus');
  const hasAggregationDiagnostic = result.diagnostics.some((diagnostic) => diagnostic.label === 'Respondent aggregation' && diagnostic.value.includes('mean absolute disagreement') && diagnostic.value.includes('consensus'));
  const topRanked = result.ranking.length === sampleMatrix.alternatives.length;
  const checks: SmokeCheckResult[] = [{
    method: 'Group Decision',
    passed: hasAggregationTable && hasAggregationDiagnostic && topRanked,
    message: hasAggregationTable && hasAggregationDiagnostic && topRanked
      ? 'Group decision aggregation OK: respondent matrices are aggregated and reported.'
      : 'Group decision aggregation output is missing or incomplete.',
  }];
  const fuzzyGroupedInput: DecisionMatrix = {
    ...sampleMatrix,
    respondentMatrices: [sampleMatrix.values, sampleMatrix.values.map((row) => row.map((value) => value * 1.02))],
    respondentFuzzyMatrices: [
      sampleMatrix.values.map((row) => row.map((value) => crispFuzzy(value))),
      sampleMatrix.values.map((row) => row.map((value) => ({ values: [value, value * 1.02, value * 1.04], type: 'triangular' as const }))),
    ],
    fuzzyCellCount: sampleMatrix.values.length * sampleMatrix.criteria.length,
    fuzzyTypes: ['triangular'],
  };
  const fuzzyResult = method.runAnalysis(fuzzyGroupedInput, {
    ...sampleConfig,
    methodId: 'topsis',
    methodParams: { ...sampleConfig.methodParams, respondentAggregation: 'Geometric mean', fuzzyInputMode: 'Native fuzzy TOPSIS' },
  });
  const fuzzyAggregationTable = fuzzyResult.tables.find((table) => table.id === 'respondent-aggregation');
  const hasNativeFuzzyDiagnostic = fuzzyResult.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy TOPSIS');
  const hasFuzzyAggregationSummary = Boolean(fuzzyAggregationTable)
    && Boolean(fuzzyAggregationTable?.columns.includes('Fuzzy tuple handling'))
    && String(fuzzyAggregationTable?.rows[0]?.[7]).includes('Fuzzy tuples aggregated');
  checks.push({
    method: 'Fuzzy Group Decision',
    passed: hasNativeFuzzyDiagnostic && hasFuzzyAggregationSummary && fuzzyResult.ranking.length === sampleMatrix.alternatives.length,
    message: hasNativeFuzzyDiagnostic && hasFuzzyAggregationSummary
      ? 'Fuzzy respondent matrices aggregate and reach native fuzzy TOPSIS.'
      : 'Fuzzy respondent aggregation did not reach native fuzzy analysis.',
  });

  if (dematel) {
    const dematelInput = methodInput('dematel');
    const dematelResult = dematel.runAnalysis({
      ...dematelInput,
      expertMatrices: [
        dematelInput.values,
        dematelInput.values.map((row) => row.map((value) => value * 1.05)),
      ],
    }, { ...sampleConfig, methodId: 'dematel', methodParams: { ...sampleConfig.methodParams, dematelAggregation: 'Arithmetic mean' } });
    const expertTable = dematelResult.tables.find((table) => table.id === 'expert-aggregation');
    const hasExpertAggregation = Boolean(expertTable)
      && Boolean(expertTable?.columns.includes('Mean absolute disagreement'))
      && Boolean(expertTable?.columns.includes('Consensus level'))
      && String(expertTable?.rows[0]?.[5]).includes('consensus');
    const hasExpertDiagnostic = dematelResult.diagnostics.some((diagnostic) => diagnostic.label === 'Expert aggregation' && diagnostic.value.includes('mean absolute disagreement') && diagnostic.value.includes('consensus'));
    checks.push({
      method: 'DEMATEL Expert Aggregation',
      passed: hasExpertAggregation && hasExpertDiagnostic,
      message: hasExpertAggregation && hasExpertDiagnostic
        ? 'DEMATEL expert aggregation reports disagreement and consensus.'
        : 'DEMATEL expert aggregation summary is missing disagreement or consensus evidence.',
    });
  } else {
    checks.push({ method: 'DEMATEL Expert Aggregation', passed: false, message: 'DEMATEL method missing.' });
  }

  if (!ahp) {
    checks.push({ method: 'AHP Group Pairwise', passed: false, message: 'AHP method missing.' });
    return checks;
  }
  const ahpResult = ahp.runAnalysis(sampleMatrix, {
    ...sampleConfig,
    methodId: 'ahp',
    weightingId: 'ahp',
    ahpCriteriaRespondentPairwise: [sampleConfig.ahpCriteriaPairwise ?? [], sampleConfig.ahpCriteriaPairwise ?? []],
    methodParams: { ...sampleConfig.methodParams, ahpGroupAggregation: 'Geometric mean' },
  });
  const hasAhpGroupTable = ahpResult.tables.some((table) => table.id === 'ahp-group-aggregation');
  const hasAhpGroupDiagnostic = ahpResult.diagnostics.some((diagnostic) => diagnostic.label === 'AHP group aggregation');
  checks.push({
    method: 'AHP Group Pairwise',
    passed: hasAhpGroupTable && hasAhpGroupDiagnostic && ahpResult.ranking.length === sampleMatrix.alternatives.length,
    message: hasAhpGroupTable && hasAhpGroupDiagnostic
      ? 'AHP group pairwise aggregation OK: respondent judgments are aggregated by geometric mean and reported.'
      : 'AHP group pairwise aggregation output is missing.',
  });
  return checks;
}

export function runValidationSmokeChecks(): SmokeCheckResult[] {
  const cases: Array<{
    name: string;
    input: DecisionMatrix;
    config: StudyConfig;
    expectedSheets: string[];
    expectedMessages?: string[];
  }> = [
    {
      name: 'Manual weights reject negative values',
      input: { ...sampleMatrix, criteria: sampleMatrix.criteria.map((criterion, index) => index === 0 ? { ...criterion, weight: -0.2 } : criterion) },
      config: { ...sampleConfig, weightingId: 'manual' },
      expectedSheets: ['Criteria'],
    },
    {
      name: 'Decision matrix rejects nonnumeric cells',
      input: { ...sampleMatrix, values: sampleMatrix.values.map((row, rowIndex) => rowIndex === 0 ? row.map((value, columnIndex) => columnIndex === 0 ? Number.NaN : value) : row) },
      config: sampleConfig,
      expectedSheets: ['Decision Matrix'],
    },
    {
      name: 'Respondent matrices accept grouped crisp data',
      input: {
        ...sampleMatrix,
        respondentMatrices: [
          sampleMatrix.values,
          sampleMatrix.values.map((row) => row.map((value) => value * 1.02)),
        ],
      },
      config: { ...sampleConfig, methodId: 'topsis' },
      expectedSheets: [],
    },
    {
      name: 'Multiple respondent mode requires at least two respondents',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'topsis', methodParams: { ...sampleConfig.methodParams, dataInputMode: 'Multiple respondents', respondentCount: 1 } },
      expectedSheets: ['Study Settings'],
      expectedMessages: ['at least 2 respondents'],
    },
    {
      name: 'AHP group pairwise mode requires at least two pairwise respondents',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'ahp', weightingId: 'ahp', methodParams: { ...sampleConfig.methodParams, dataInputMode: 'Multiple respondents', respondentCount: 2, ahpRespondentCount: 1 } },
      expectedSheets: ['Study Settings'],
      expectedMessages: ['at least 2 pairwise respondent matrices'],
    },
    {
      name: 'Respondent matrices reject malformed grouped data',
      input: {
        ...sampleMatrix,
        respondentMatrices: [[[Number.NaN]]],
      },
      config: { ...sampleConfig, methodId: 'topsis' },
      expectedSheets: ['Respondent 1'],
    },
    {
      name: 'Native fuzzy validation explains preservation',
      input: {
        ...sampleMatrix,
        fuzzyCellCount: 2,
        fuzzyTypes: ['triangular'],
      },
      config: { ...sampleConfig, methodId: 'topsis', methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy TOPSIS' } },
      expectedSheets: [],
      expectedMessages: ['preserved for Native fuzzy TOPSIS'],
    },
    {
      name: 'Defuzzified validation explains centroid conversion',
      input: {
        ...sampleMatrix,
        fuzzyCellCount: 2,
        fuzzyTypes: ['trapezoidal'],
      },
      config: { ...sampleConfig, methodId: 'topsis', methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Defuzzify on upload' } },
      expectedSheets: [],
      expectedMessages: ['converted to crisp values by centroid'],
    },
    {
      name: 'AHP rejects nonpositive pairwise values',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'ahp', weightingId: 'ahp', ahpCriteriaPairwise: [[1, 0], [1, 1]] },
      expectedSheets: ['Criteria Pairwise Matrix'],
    },
    {
      name: 'AHP rejects malformed respondent pairwise values',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'ahp', weightingId: 'ahp', ahpCriteriaRespondentPairwise: [[[1, 0], [1, 1]]] },
      expectedSheets: ['AHP Criteria Respondent 1'],
    },
    {
      name: 'AHP rejects non-reciprocal pairwise values',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'ahp', weightingId: 'ahp', ahpCriteriaPairwise: [[1, 3], [2, 1]] },
      expectedSheets: ['Criteria Pairwise Matrix'],
    },
    {
      name: 'AHP rejects non-unit pairwise diagonal values',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'ahp', weightingId: 'ahp', ahpCriteriaPairwise: [[2, 3], [0.3333, 1]] },
      expectedSheets: ['Criteria Pairwise Matrix'],
    },
    {
      name: 'DEMATEL rejects nonsquare negative direct relation matrix',
      input: {
        alternatives: sampleMatrix.alternatives.slice(0, 3),
        criteria: sampleMatrix.criteria.slice(0, 4),
        values: [
          [0, -1, 2, 3],
          [1, 0, 2, 3],
          [1, 2, 0, 3],
        ],
      },
      config: { ...sampleConfig, methodId: 'dematel' },
      expectedSheets: ['Direct Relation Matrix'],
    },
    {
      name: 'DEMATEL rejects invalid manual threshold',
      input: {
        alternatives: sampleConfig.criteria.slice(0, 4).map((criterion) => ({ id: criterion.id, name: criterion.name })),
        criteria: sampleConfig.criteria.slice(0, 4),
        values: [
          [0, 2, 3, 1],
          [1, 0, 2, 3],
          [3, 1, 0, 2],
          [2, 3, 1, 0],
        ],
      },
      config: { ...sampleConfig, methodId: 'dematel', methodParams: { ...sampleConfig.methodParams, dematelThreshold: 'Manual threshold', dematelManualThreshold: -0.1 } },
      expectedSheets: ['Threshold Settings'],
    },
    {
      name: 'DEMATEL rejects missing configured expert matrices',
      input: {
        alternatives: sampleConfig.criteria.slice(0, 4).map((criterion) => ({ id: criterion.id, name: criterion.name })),
        criteria: sampleConfig.criteria.slice(0, 4),
        values: [
          [0, 2, 3, 1],
          [1, 0, 2, 3],
          [3, 1, 0, 2],
          [2, 3, 1, 0],
        ],
        expertMatrices: [
          [
            [0, 2, 3, 1],
            [1, 0, 2, 3],
            [3, 1, 0, 2],
            [2, 3, 1, 0],
          ],
        ],
      },
      config: { ...sampleConfig, methodId: 'dematel', methodParams: { ...sampleConfig.methodParams, dataInputMode: 'Multiple experts', dematelExpertCount: 2 } },
      expectedSheets: ['Study Settings'],
      expectedMessages: ['expected 2 expert matrix sheets, but found 1'],
    },
    {
      name: 'DEMATEL multiple expert mode requires at least two experts',
      input: {
        alternatives: sampleConfig.criteria.slice(0, 4).map((criterion) => ({ id: criterion.id, name: criterion.name })),
        criteria: sampleConfig.criteria.slice(0, 4),
        values: [
          [0, 2, 3, 1],
          [1, 0, 2, 3],
          [3, 1, 0, 2],
          [2, 3, 1, 0],
        ],
      },
      config: { ...sampleConfig, methodId: 'dematel', methodParams: { ...sampleConfig.methodParams, dataInputMode: 'Multiple experts', dematelExpertCount: 1 } },
      expectedSheets: ['Study Settings'],
      expectedMessages: ['at least 2 experts'],
    },
    {
      name: 'DEMATEL rejects malformed expert matrices',
      input: {
        alternatives: sampleConfig.criteria.slice(0, 4).map((criterion) => ({ id: criterion.id, name: criterion.name })),
        criteria: sampleConfig.criteria.slice(0, 4),
        values: [
          [0, 2, 3, 1],
          [1, 0, 2, 3],
          [3, 1, 0, 2],
          [2, 3, 1, 0],
        ],
        expertMatrices: [
          [
            [0, Number.NaN],
            [1, -2],
          ],
        ],
      },
      config: { ...sampleConfig, methodId: 'dematel', methodParams: { ...sampleConfig.methodParams, dataInputMode: 'Multiple experts', dematelExpertCount: 1 } },
      expectedSheets: ['Expert 1'],
    },
    {
      name: 'VIKOR rejects out-of-range v',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'vikor', methodParams: { ...sampleConfig.methodParams, vikorV: 1.5 } },
      expectedSheets: ['VIKOR Parameters'],
    },
    {
      name: 'VIKOR rejects unsupported acceptable advantage mode',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'vikor', methodParams: { ...sampleConfig.methodParams, vikorAcceptableAdvantageMode: 'Hidden default' } },
      expectedSheets: ['VIKOR Parameters'],
    },
    {
      name: 'VIKOR rejects invalid manual DQ',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'vikor', methodParams: { ...sampleConfig.methodParams, vikorAcceptableAdvantageMode: 'Manual DQ', vikorAcceptableAdvantageDQ: 1.4 } },
      expectedSheets: ['VIKOR Parameters'],
    },
    {
      name: 'TOPSIS rejects unsupported distance metric',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'topsis', methodParams: { ...sampleConfig.methodParams, distanceMetric: 'Manhattan' } },
      expectedSheets: ['Normalization Settings'],
    },
    {
      name: 'PROMETHEE rejects unsupported preference function',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'promethee', methodParams: { ...sampleConfig.methodParams, preferenceFunction: 'Hidden function' } },
      expectedSheets: ['PROMETHEE Settings'],
    },
    {
      name: 'PROMETHEE rejects invalid linear thresholds',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'promethee', methodParams: { ...sampleConfig.methodParams, preferenceFunction: 'Linear', prometheeIndifferenceThreshold: 2, prometheePreferenceThreshold: 1 } },
      expectedSheets: ['PROMETHEE Settings'],
    },
    {
      name: 'PROMETHEE rejects invalid gaussian sigma',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'promethee', methodParams: { ...sampleConfig.methodParams, preferenceFunction: 'Gaussian', prometheeGaussianSigma: 0 } },
      expectedSheets: ['PROMETHEE Settings'],
    },
    {
      name: 'WASPAS rejects out-of-range lambda',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'waspas', methodParams: { ...sampleConfig.methodParams, waspasLambda: -0.1 } },
      expectedSheets: ['Lambda Settings'],
    },
    {
      name: 'CODAS rejects negative tau',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'codas', methodParams: { ...sampleConfig.methodParams, codasTau: -0.1 } },
      expectedSheets: ['CODAS Settings'],
    },
    {
      name: 'CoCoSo rejects out-of-range lambda',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'cocoso', methodParams: { ...sampleConfig.methodParams, cocosoLambda: 1.2 } },
      expectedSheets: ['CoCoSo Settings'],
    },
    {
      name: 'MULTIMOORA rejects unsupported aggregation',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'multimoora', methodParams: { ...sampleConfig.methodParams, multimooraAggregation: 'Unclear vote' } },
      expectedSheets: ['Method Parameters'],
    },
    {
      name: 'EAMR rejects out-of-range beta',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'eamr', methodParams: { ...sampleConfig.methodParams, eamrBeta: 1.2 } },
      expectedSheets: ['EAMR Settings'],
    },
    {
      name: 'TODIM rejects nonpositive theta',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'todim', methodParams: { ...sampleConfig.methodParams, todimTheta: 0 } },
      expectedSheets: ['Method Parameters'],
    },
    {
      name: 'GRA rejects out-of-range zeta',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'gra', methodParams: { ...sampleConfig.methodParams, graZeta: 2 } },
      expectedSheets: ['Method Parameters'],
    },
    {
      name: 'GRP rejects out-of-range zeta',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'grp', methodParams: { ...sampleConfig.methodParams, graZeta: 2 } },
      expectedSheets: ['Method Parameters'],
    },
    {
      name: 'SPOTIS rejects unsupported bounds mode',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'spotis', methodParams: { ...sampleConfig.methodParams, spotisBounds: 'Outside observed range' } },
      expectedSheets: ['SPOTIS Bounds'],
    },
    {
      name: 'SPOTIS rejects invalid manual bounds',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'spotis', methodParams: { ...sampleConfig.methodParams, spotisBounds: 'Manual bounds', spotisLowerBounds: '90,70,95,80,60,65,25', spotisUpperBounds: '80,90,130,90,80,85,35' } },
      expectedSheets: ['SPOTIS Bounds'],
    },
    {
      name: 'ESP-SPOTIS rejects unsupported bounds mode',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'espSpotis', methodParams: { ...sampleConfig.methodParams, espSpotisBounds: 'Outside observed range', espSpotisPoint: '70,85,100,88,75,80,28' } },
      expectedSheets: ['ESP-SPOTIS Point'],
    },
    {
      name: 'RIM rejects unsupported reference mode',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'rim', methodParams: { ...sampleConfig.methodParams, rimReference: 'Hidden ideal' } },
      expectedSheets: ['RIM Ideal Intervals'],
    },
    {
      name: 'RIM rejects invalid manual ideal interval',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'rim', methodParams: { ...sampleConfig.methodParams, rimReference: 'Manual ideal interval', rimDomainLower: '50,70,80,70,60,65,15', rimDomainUpper: '90,100,140,100,90,95,40', rimIdealLower: '50,90,95,80,60,65,25', rimIdealUpper: '65,85,100,90,80,85,28' } },
      expectedSheets: ['RIM Ideal Intervals'],
    },
    {
      name: 'RAFSI rejects invalid interval',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'rafsi', methodParams: { ...sampleConfig.methodParams, rafsiIntervalLower: 6, rafsiIntervalUpper: 1 } },
      expectedSheets: ['RAFSI Interval'],
    },
    {
      name: 'LoPM rejects malformed manual limits',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'lopm', methodParams: { ...sampleConfig.methodParams, lopmLimitsMode: 'Manual property limits', lopmPropertyTypes: 'lower,upper,bad', lopmPropertyLimits: '1,2' } },
      expectedSheets: ['LoPM Property Limits'],
    },
    {
      name: 'LoPM rejects unsupported limits mode',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'lopm', methodParams: { ...sampleConfig.methodParams, lopmLimitsMode: 'Hidden limits' } },
      expectedSheets: ['LoPM Property Limits'],
    },
    {
      name: 'AROMAN rejects out-of-range beta',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'aroman', methodParams: { ...sampleConfig.methodParams, aromanBeta: -0.2 } },
      expectedSheets: ['AROMAN Settings'],
    },
    {
      name: 'AROMAN rejects out-of-range lambda',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'aroman', methodParams: { ...sampleConfig.methodParams, aromanLambda: 2 } },
      expectedSheets: ['AROMAN Settings'],
    },
    {
      name: 'ERVD rejects invalid parameters',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'ervd', methodParams: { ...sampleConfig.methodParams, ervdLambda: 0, ervdAlpha: -1 } },
      expectedSheets: ['ERVD Settings'],
    },
    {
      name: 'ERVD rejects unsupported reference mode',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'ervd', methodParams: { ...sampleConfig.methodParams, ervdReferenceMode: 'Hidden reference' } },
      expectedSheets: ['ERVD Settings'],
    },
    {
      name: 'ERVD rejects malformed manual reference point',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'ervd', methodParams: { ...sampleConfig.methodParams, ervdReferenceMode: 'Manual reference point', ervdReferencePoint: '1,2' } },
      expectedSheets: ['ERVD Reference Point'],
    },
    {
      name: 'Lexicographic rejects malformed criterion priority order',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'lexicographic', methodParams: { ...sampleConfig.methodParams, lexicographicOrder: 'C1,C2,C2' } },
      expectedSheets: ['Lexicographic Settings'],
    },
    {
      name: 'SMARTER rejects malformed ranked swing-weight order',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'smarter', methodParams: { ...sampleConfig.methodParams, smarterOrder: 'C1,C2,C2' } },
      expectedSheets: ['SMARTER Settings'],
    },
    {
      name: 'MACBETH-style rejects malformed category anchors',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'macbeth', methodParams: { ...sampleConfig.methodParams, macbethCategoryScale: '0,2,1' } },
      expectedSheets: ['MACBETH-style Settings'],
    },
    {
      name: 'Pugh rejects unknown baseline alternative',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'pugh', methodParams: { ...sampleConfig.methodParams, pughBaselineAlternative: 'missing' } },
      expectedSheets: ['Pugh Matrix Settings'],
    },
    {
      name: 'Pugh rejects unsupported scoring mode',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'pugh', methodParams: { ...sampleConfig.methodParams, pughScoringMode: 'Hidden score mode' } },
      expectedSheets: ['Pugh Matrix Settings'],
    },
    {
      name: 'BWM rejects malformed weighting vectors',
      input: sampleMatrix,
      config: { ...sampleConfig, weightingId: 'bwm', methodParams: { ...sampleConfig.methodParams, bwmBestCriterion: 'C2', bwmWorstCriterion: 'C7', bwmBestToOthers: '1,2', bwmOthersToWorst: '1,2,3,4,5,6,7' } },
      expectedSheets: ['BWM Parameters'],
    },
    {
      name: 'BWM rejects invalid self-comparison values',
      input: sampleMatrix,
      config: { ...sampleConfig, weightingId: 'bwm', methodParams: { ...sampleConfig.methodParams, bwmBestCriterion: 'C2', bwmWorstCriterion: 'C7', bwmBestToOthers: '3,2,2,2,2,2,4', bwmOthersToWorst: '3,4,3,3,2,2,2' } },
      expectedSheets: ['BWM Parameters'],
    },
    {
      name: 'DIBR rejects incomplete criterion order',
      input: sampleMatrix,
      config: { ...sampleConfig, weightingId: 'dibr', methodParams: { ...sampleConfig.methodParams, dibrOrder: 'C1,C2,C2', dibrAdjacentRatios: '1.2,1.1,1.1,1.1,1.1,1.1' } },
      expectedSheets: ['DIBR Parameters'],
    },
    {
      name: 'SRF cards reject duplicate criterion groups',
      input: sampleMatrix,
      config: { ...sampleConfig, weightingId: 'simos', methodParams: { ...sampleConfig.methodParams, simosGroups: 'C1 | C2,C2 | C3', simosBlankCards: '0,1', simosZRatio: 3 } },
      expectedSheets: ['SRF Cards Parameters'],
    },
    {
      name: 'COMET rejects unsupported characteristic values mode',
      input: sampleMatrix,
      config: { ...sampleConfig, methodId: 'comet', methodParams: { ...sampleConfig.methodParams, cometCharacteristicValues: 'dense-grid' } },
      expectedSheets: ['COMET Settings'],
    },
    {
      name: 'SWARA rejects incomplete criterion order',
      input: sampleMatrix,
      config: { ...sampleConfig, weightingId: 'swara', methodParams: { ...sampleConfig.methodParams, swaraOrder: 'C1,C2,C2', swaraComparativeImportance: '0,0.1,0.2' } },
      expectedSheets: ['SWARA Parameters'],
    },
    {
      name: 'ROC rejects incomplete criterion order',
      input: sampleMatrix,
      config: { ...sampleConfig, weightingId: 'roc', methodParams: { ...sampleConfig.methodParams, rocOrder: 'C1,C2,C2' } },
      expectedSheets: ['ROC Parameters'],
    },
    {
      name: 'FUCOM rejects malformed priorities',
      input: sampleMatrix,
      config: { ...sampleConfig, weightingId: 'fucom', methodParams: { ...sampleConfig.methodParams, fucomOrder: 'C1,C2,C2', fucomComparativePriorities: '1.2,0.8' } },
      expectedSheets: ['FUCOM Parameters'],
    },
    {
      name: 'LBWA rejects malformed levels and elasticity',
      input: sampleMatrix,
      config: { ...sampleConfig, weightingId: 'lbwa', methodParams: { ...sampleConfig.methodParams, lbwaLevels: '1,2,bad', lbwaImportance: '0,1,2,3,4,5,6', lbwaElasticity: 0 } },
      expectedSheets: ['LBWA Parameters'],
    },
    {
      name: 'PIPRECIA rejects malformed order and significance values',
      input: sampleMatrix,
      config: { ...sampleConfig, weightingId: 'piprecia', methodParams: { ...sampleConfig.methodParams, pipreciaOrder: 'C1,C2,C2', pipreciaRelativeSignificance: '1,0,2,0.9' } },
      expectedSheets: ['PIPRECIA Parameters'],
    },
    {
      name: 'Rank Sum rejects incomplete criterion order',
      input: sampleMatrix,
      config: { ...sampleConfig, weightingId: 'rankSum', methodParams: { ...sampleConfig.methodParams, rankSumOrder: 'C1,C2,C2' } },
      expectedSheets: ['Rank Sum Parameters'],
    },
    {
      name: 'Rank Reciprocal rejects incomplete criterion order',
      input: sampleMatrix,
      config: { ...sampleConfig, weightingId: 'rankReciprocal', methodParams: { ...sampleConfig.methodParams, rankReciprocalOrder: 'C1,C2,C2' } },
      expectedSheets: ['Rank Reciprocal Parameters'],
    },
    {
      name: 'RANCOM rejects malformed rank positions',
      input: sampleMatrix,
      config: { ...sampleConfig, weightingId: 'rancom', methodParams: { ...sampleConfig.methodParams, rancomRanks: '1,2,0' } },
      expectedSheets: ['RANCOM Parameters'],
    },
  ];
  return cases.map((item) => {
    const validation = validateDecisionInput(item.input, item.config);
    const errorSheets = validation.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.sheet);
    const hasExpectedErrors = item.expectedSheets.every((sheet) => errorSheets.includes(sheet));
    const expectsValid = item.expectedSheets.length === 0;
    const hasExpectedMessages = (item.expectedMessages ?? []).every((message) =>
      validation.issues.some((issue) => issue.message.includes(message)),
    );
    return {
      method: item.name,
      passed: expectsValid ? validation.ok && hasExpectedMessages : !validation.ok && hasExpectedErrors && hasExpectedMessages,
      message: expectsValid && validation.ok && hasExpectedMessages
        ? `Validation OK: accepted with ${validation.issues.length} informational/warning issue(s).`
        : !expectsValid && !validation.ok && hasExpectedErrors && hasExpectedMessages
        ? `Validation OK: rejected with ${validation.issues.length} issue(s).`
        : !hasExpectedMessages
          ? `Validation did not include expected message(s): ${(item.expectedMessages ?? []).join(', ')}`
        : expectsValid
          ? 'Validation incorrectly rejected grouped respondent input.'
          : `Validation failed to reject expected sheet(s): ${item.expectedSheets.join(', ')}`,
    };
  });
}
