import type { FuzzyNumber } from './core/fuzzy';

export type CriterionDirection = 'benefit' | 'cost';

export type MethodId =
  | 'topsis'
  | 'ahp'
  | 'dematel'
  | 'vikor'
  | 'copras'
  | 'saw'
  | 'srp'
  | 'fuca'
  | 'seca'
  | 'dear'
  | 'eamr'
  | 'rawec'
  | 'comet'
  | 'wpm'
  | 'waspas'
  | 'moora'
  | 'moosra'
  | 'arlon'
  | 'macont'
  | 'aras'
  | 'edas'
  | 'mabac'
  | 'codas'
  | 'cocoso'
  | 'cradis'
  | 'mara'
  | 'raps'
  | 'oreste'
  | 'qualiflex'
  | 'regime'
  | 'evamix'
  | 'lexicographic'
  | 'marcos'
  | 'mairca'
  | 'promethee'
  | 'electre'
  | 'smart'
  | 'maut'
  | 'smarter'
  | 'macbeth'
  | 'pugh'
  | 'ocra'
  | 'multimoora'
  | 'psi'
  | 'piv'
  | 'rov'
  | 'wisp'
  | 'todim'
  | 'ram'
  | 'gra'
  | 'grp'
  | 'spotis'
  | 'espSpotis'
  | 'balancedSpotis'
  | 'wedba'
  | 'lmaw'
  | 'dnma'
  | 'probid'
  | 'sprobid'
  | 'rim'
  | 'rafsi'
  | 'lopm'
  | 'aroman'
  | 'cobra'
  | 'ervd';

export type WeightingId = 'manual' | 'equal' | 'stddev' | 'cov' | 'entropy' | 'critic' | 'merec' | 'merecG' | 'lopcow' | 'wenslo' | 'angular' | 'gini' | 'mpsi' | 'cilos' | 'idocriw' | 'cimas' | 'ahp' | 'bwm' | 'dibr' | 'simos' | 'swara' | 'roc' | 'fucom' | 'lbwa' | 'piprecia' | 'rankSum' | 'rankReciprocal' | 'rancom';

export interface Criterion {
  id: string;
  name: string;
  direction: CriterionDirection;
  weight: number;
}

export interface Alternative {
  id: string;
  name: string;
}

export interface DecisionMatrix {
  alternatives: Alternative[];
  criteria: Criterion[];
  values: number[][];
  respondentMatrices?: number[][][];
  respondentFuzzyMatrices?: FuzzyNumber[][][];
  expertMatrices?: number[][][];
  expertFuzzyMatrices?: FuzzyNumber[][][];
  groupAggregation?: {
    sourceCount: number;
    aggregation: string;
    appliedData: string;
    meanAbsoluteDisagreement: number;
    maxAbsoluteDisagreement: number;
    relativeDisagreement: number;
    consensusLevel: string;
    fuzzyTupleAggregation?: string;
  };
  fuzzyCellCount?: number;
  fuzzyTypes?: Array<'triangular' | 'trapezoidal'>;
  fuzzyValues?: FuzzyNumber[][];
}

export interface StudyConfig {
  title: string;
  methodId: MethodId;
  weightingId: WeightingId;
  alternatives: Alternative[];
  criteria: Criterion[];
  vikorV: number;
  waspasLambda: number;
  methodParams: Record<string, string | number | boolean>;
  ahpCriteriaPairwise?: number[][];
  ahpCriteriaRespondentPairwise?: number[][][];
  ahpCriteriaFuzzyPairwise?: FuzzyNumber[][];
  ahpCriteriaRespondentFuzzyPairwise?: FuzzyNumber[][][];
  ahpAlternativePairwise?: Record<string, number[][]>;
  ahpAlternativeRespondentPairwise?: Record<string, number[][][]>;
  ahpAlternativeFuzzyPairwise?: Record<string, FuzzyNumber[][]>;
  ahpAlternativeRespondentFuzzyPairwise?: Record<string, FuzzyNumber[][][]>;
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  sheet: string;
  location: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

export interface OutputTable {
  id: string;
  title: string;
  columns: string[];
  rows: Array<Array<string | number>>;
}

export interface RankingRow {
  rank: number;
  alternativeId: string;
  alternative: string;
  score: number;
}

export interface Diagnostic {
  label: string;
  value: string;
  status: 'pass' | 'warn' | 'fail';
}

export interface AnalysisResult {
  methodId: MethodId;
  methodName: string;
  input: DecisionMatrix;
  tables: OutputTable[];
  ranking: RankingRow[];
  diagnostics: Diagnostic[];
  narrative: string;
  reproducibility: Record<string, unknown>;
  visualizations: Array<{
    id: string;
    title: string;
    type: 'ranking-bar' | 'weight-bar' | 'matrix-heatmap' | 'sensitivity-band' | 'dematel-cause-effect';
    data: Array<Record<string, string | number>>;
  }>;
}

export interface TemplateSheet {
  name: string;
  rows: Array<Array<string | number>>;
}

export interface MethodDefinition {
  id: MethodId;
  name: string;
  fullName: string;
  description: string;
  parameters: string[];
  specificationFields: Array<{
    key: string;
    label: string;
    type: 'number' | 'select' | 'text';
    defaultValue: string | number;
    options?: string[];
  }>;
  outputs: string[];
  supportsWeights: boolean;
  fuzzySupport: {
    enabled: boolean;
    mode: 'defuzzified-input' | 'native-fuzzy';
    nativeModeLabel?: string;
    note: string;
  };
  getTemplateSchema: (config: StudyConfig) => TemplateSheet[];
  validateWorkbook: (input: DecisionMatrix, config: StudyConfig) => ValidationResult;
  runAnalysis: (input: DecisionMatrix, config: StudyConfig) => AnalysisResult;
}
