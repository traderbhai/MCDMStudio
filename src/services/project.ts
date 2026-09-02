import type { DecisionMatrix, StudyConfig } from '../types';
import { getMethod, methodRegistry } from '../core/methods';
import { weightingMetadata } from '../core/weightingMetadata';

const allowedResultTabs = new Set(['Input Summary', 'Cleaned Input', 'Transformed Matrix', 'Method Tables', 'Diagnostics', 'Final Result', 'Visualizations', 'Compare Methods']);

export interface ProjectFile {
  version: 1;
  config: StudyConfig;
  input: DecisionMatrix;
  step?: number;
  validationIssues?: number;
  resultTab?: string;
  compareIds?: string[];
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportProject(config: StudyConfig, input: DecisionMatrix, step?: number, resultTab?: string, compareIds?: string[], validationIssues?: number): void {
  saveBlob(
    new Blob([JSON.stringify({ version: 1, config, input, step, resultTab, compareIds, validationIssues }, null, 2)], { type: 'application/json' }),
    'mcdm-studio-project.json',
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function idsMatch(left: Array<{ id: unknown }>, right: Array<{ id: unknown }>): boolean {
  return left.length === right.length && left.every((item, index) => String(item.id ?? '') === String(right[index]?.id ?? ''));
}

function hasDuplicateIds(items: Array<{ id: unknown }>): boolean {
  const ids = items.map((item) => String(item.id ?? '').trim()).filter(Boolean);
  return ids.length !== items.length || new Set(ids).size !== ids.length;
}

function validateProjectFile(value: unknown): ProjectFile {
  if (!isObject(value) || value.version !== 1 || !isObject(value.config) || !isObject(value.input)) {
    throw new Error('This project file is not a valid MCDM Studio v1 project.');
  }

  const config = value.config as unknown as StudyConfig;
  const input = value.input as unknown as DecisionMatrix;
  if (!methodRegistry.some((method) => method.id === config.methodId)) {
    throw new Error('This project file references an unsupported MCDM method.');
  }
  if (!weightingMetadata[config.weightingId]) {
    throw new Error('This project file references an unsupported weighting method.');
  }
  if (!Array.isArray(config.alternatives) || !Array.isArray(config.criteria) || !Array.isArray(input.alternatives) || !Array.isArray(input.criteria) || !Array.isArray(input.values)) {
    throw new Error('This project file is missing alternatives, criteria, or matrix data.');
  }
  if (!isObject(config.methodParams)) {
    throw new Error('This project file is missing method-specific parameters.');
  }
  const method = getMethod(config.methodId);
  if (method.id === 'ahp' && config.weightingId !== 'ahp') {
    throw new Error('This AHP project file must use AHP pairwise weighting.');
  }
  if (!method.supportsWeights && config.weightingId !== 'manual') {
    throw new Error('This project file assigns an external weighting method to a self-weighted MCDM method.');
  }
  const dataInputMode = String(config.methodParams.dataInputMode ?? (method.id === 'dematel' ? 'Single expert matrix' : 'Single aggregated dataset'));
  const allowedDataModes = method.id === 'dematel'
    ? ['Single expert matrix', 'Multiple experts']
    : ['Single aggregated dataset', 'Multiple respondents'];
  if (!allowedDataModes.includes(dataInputMode)) {
    throw new Error('This project file contains a data collection mode that is not supported by the saved MCDM method.');
  }
  const fuzzyInputMode = String(config.methodParams.fuzzyInputMode ?? 'Defuzzify on upload');
  const allowedFuzzyModes = method.fuzzySupport.nativeModeLabel ? ['Defuzzify on upload', method.fuzzySupport.nativeModeLabel] : ['Defuzzify on upload'];
  if (!allowedFuzzyModes.includes(fuzzyInputMode)) {
    throw new Error('This project file contains a fuzzy input mode that is not supported by the saved MCDM method.');
  }
  if (method.id === 'dematel') {
    const fuzzyCalculation = String(config.methodParams.dematelFuzzyCalculation ?? 'Component-wise fuzzy total relation');
    if (!['Component-wise fuzzy total relation', 'Defuzzify before total relation'].includes(fuzzyCalculation)) {
      throw new Error('This project file contains a DEMATEL fuzzy calculation convention that is not supported.');
    }
  }
  if (method.id !== 'dematel' && dataInputMode === 'Multiple respondents') {
    const respondentCount = Number(config.methodParams.respondentCount);
    if (!Number.isInteger(respondentCount) || respondentCount < 2) {
      throw new Error('This project file uses multiple respondents but has an invalid respondent count.');
    }
  }
  if (method.id === 'dematel' && dataInputMode === 'Multiple experts') {
    const expertCount = Number(config.methodParams.dematelExpertCount);
    if (!Number.isInteger(expertCount) || expertCount < 2) {
      throw new Error('This project file uses multiple experts but has an invalid expert count.');
    }
  }
  if ((method.id === 'ahp' || config.weightingId === 'ahp') && dataInputMode === 'Multiple respondents') {
    const ahpRespondentCount = Number(config.methodParams.ahpRespondentCount ?? config.methodParams.respondentCount);
    if (!Number.isInteger(ahpRespondentCount) || ahpRespondentCount < 2) {
      throw new Error('This project file uses group AHP pairwise judgments but has an invalid AHP respondent count.');
    }
  }
  if (method.id !== 'dematel' && config.alternatives.length < 1) {
    throw new Error('This project file must include at least one alternative.');
  }
  if (config.criteria.length < 1) {
    throw new Error('This project file must include at least one criterion or factor.');
  }
  if (hasDuplicateIds(config.alternatives) || hasDuplicateIds(input.alternatives)) {
    throw new Error('This project file contains missing or duplicate alternative IDs.');
  }
  if (hasDuplicateIds(config.criteria) || hasDuplicateIds(input.criteria)) {
    throw new Error('This project file contains missing or duplicate criterion IDs.');
  }
  if (!idsMatch(config.alternatives, input.alternatives)) {
    throw new Error('This project file alternative IDs do not match the saved input matrix.');
  }
  if (!idsMatch(config.criteria, input.criteria)) {
    throw new Error('This project file criterion IDs do not match the saved input matrix.');
  }
  if (method.id === 'dematel' && !idsMatch(config.criteria, config.alternatives)) {
    throw new Error('This DEMATEL project file must use the same factor IDs for rows and columns.');
  }
  const expectedRows = method.id === 'dematel' ? config.criteria.length : config.alternatives.length;
  if (input.values.length !== expectedRows) {
    throw new Error('This project file matrix row count does not match the saved study shape.');
  }
  const invalidRow = input.values.find((row) => !Array.isArray(row) || row.length !== config.criteria.length || row.some((cell) => !Number.isFinite(Number(cell))));
  if (invalidRow) {
    throw new Error('This project file matrix contains missing or nonnumeric values.');
  }
  const savedStep = value.step;
  if (savedStep !== undefined && (typeof savedStep !== 'number' || !Number.isInteger(savedStep) || savedStep < 1 || savedStep > 5)) {
    throw new Error('This project file contains an invalid saved workflow step.');
  }
  if (value.resultTab !== undefined && (typeof value.resultTab !== 'string' || !allowedResultTabs.has(value.resultTab))) {
    throw new Error('This project file contains an invalid saved results tab.');
  }
  if (value.compareIds !== undefined) {
    if (!Array.isArray(value.compareIds) || value.compareIds.some((id) => typeof id !== 'string' || !methodRegistry.some((method) => method.id === id))) {
      throw new Error('This project file contains invalid comparison method IDs.');
    }
  }
  const validationIssues = value.validationIssues;
  if (validationIssues !== undefined && (typeof validationIssues !== 'number' || !Number.isInteger(validationIssues) || validationIssues < 0)) {
    throw new Error('This project file contains an invalid validation issue count.');
  }
  return value as unknown as ProjectFile;
}

export async function importProject(file: File): Promise<ProjectFile> {
  try {
    return validateProjectFile(JSON.parse(await file.text()));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('This project file is not valid JSON.');
    }
    throw error;
  }
}
