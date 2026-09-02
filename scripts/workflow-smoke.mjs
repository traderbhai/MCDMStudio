import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, '.tmp-workflow-smoke');
const tsc = resolve(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
const tsconfig = resolve(outDir, 'tsconfig.json');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'package.json'), '{"type":"commonjs"}\n');
writeFileSync(tsconfig, JSON.stringify({
  compilerOptions: {
    target: 'ES2020',
    module: 'Node16',
    moduleResolution: 'Node16',
    jsx: 'react-jsx',
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    skipLibCheck: true,
    strict: true,
    rootDir: '../src',
    outDir: '.',
    noEmit: false,
  },
  files: [
    '../src/services/workbook.ts',
    '../src/services/project.ts',
    '../src/services/exports.ts',
    '../src/core/methods.ts',
    '../src/data/sampleStudy.ts',
  ],
}, null, 2));

execFileSync(process.platform === 'win32' ? 'cmd.exe' : tsc, process.platform === 'win32' ? ['/c', tsc, '-p', tsconfig] : ['-p', tsconfig], { cwd: root, stdio: 'pipe' });

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
const { getMethod, methodRegistry } = require(resolve(outDir, 'core', 'methods.js'));
const { sampleConfig } = require(resolve(outDir, 'data', 'sampleStudy.js'));
const { parseWorkbook } = require(resolve(outDir, 'services', 'workbook.js'));
const { exportProject, importProject } = require(resolve(outDir, 'services', 'project.js'));
const { exportAnalysisWorkbook, exportDocx, exportPdf } = require(resolve(outDir, 'services', 'exports.js'));
if (!exportDocx.toString().includes('validationEvidenceRows') || !exportPdf.toString().includes('validationEvidenceRows')) {
  throw new Error('DOCX/PDF export paths must include the shared validation evidence rows.');
}

function safeFileName(name) {
  return name
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .trim()
    .replace(/[. ]+$/g, '') || 'mcdm-studio-export';
}

function methodDefaultParams(method) {
  return Object.fromEntries((method.specificationFields ?? []).map((field) => [field.key, field.defaultValue]));
}

async function runTemplateUploadAnalysis(methodId, configOverrides = {}) {
  const method = getMethod(methodId);
  const config = {
    ...sampleConfig,
    ...configOverrides,
    methodId,
    methodParams: {
      ...sampleConfig.methodParams,
      ...methodDefaultParams(method),
      ...(configOverrides.methodParams ?? {}),
    },
  };
  const templateWorkbook = XLSX.utils.book_new();
  method.getTemplateSchema(config).forEach((sheet) => {
    XLSX.utils.book_append_sheet(templateWorkbook, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
  });
  const templateBuffer = XLSX.write(templateWorkbook, { bookType: 'xlsx', type: 'buffer' });
  const templateFile = new File([templateBuffer], `${method.name}-template.xlsx`, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const parsed = await parseWorkbook(templateFile, config);
  if (!parsed.validation.ok) {
    throw new Error(`${method.name} template upload validation failed: ${parsed.validation.issues.map((issue) => `${issue.sheet} ${issue.location}: ${issue.message}`).join('; ')}`);
  }

  const analysis = method.runAnalysis(parsed.input, parsed.config ?? config);
  if (!analysis.tables.length || !analysis.ranking.length || !analysis.visualizations.length) {
    throw new Error(`${method.name} analysis did not produce expected tables, ranking, and visualizations.`);
  }
  return { method, config, parsed, analysis };
}

function nextGeneratedId(prefix, used, startAt = 1) {
  let index = Math.max(1, startAt);
  while (used.has(`${prefix}${index}`)) index += 1;
  return { id: `${prefix}${index}`, index };
}

function normalizeUniqueIds(prefix, items, label) {
  const used = new Set();
  let nextIndex = 1;
  return items.map((item) => {
    const proposed = String(item.id ?? '').trim();
    if (proposed && !used.has(proposed)) {
      used.add(proposed);
      const match = proposed.match(new RegExp(`^${prefix}(\\d+)$`, 'i'));
      if (match) nextIndex = Math.max(nextIndex, Number(match[1]) + 1);
      return { ...item, id: proposed };
    }
    const next = nextGeneratedId(prefix, used, nextIndex);
    used.add(next.id);
    nextIndex = next.index + 1;
    return { ...item, id: next.id, name: item.name?.trim() ? item.name : `${label} ${next.index}` };
  });
}

function nextUnusedId(prefix, items) {
  const used = new Set(items.map((item) => String(item.id ?? '').trim()).filter(Boolean));
  const numericMax = [...used].reduce((max, id) => {
    const match = id.match(new RegExp(`^${prefix}(\\d+)$`, 'i'));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return nextGeneratedId(prefix, used, numericMax + 1);
}

function resizeValuesForStructureSmoke(rows, columns, source, isDematel) {
  return Array.from({ length: rows }, (_, rowIndex) =>
    Array.from({ length: columns }, (_, columnIndex) => source[rowIndex]?.[columnIndex] ?? (isDematel && rowIndex === columnIndex ? 0 : 1)),
  );
}

function simulateStructureEdit(method, config, input) {
  const isDematel = method.id === 'dematel';
  let criteria = config.criteria.slice(0, Math.max(1, config.criteria.length - 2));
  const firstNew = nextUnusedId('C', criteria);
  criteria = [...criteria, { id: firstNew.id, name: isDematel ? `Factor ${firstNew.index}` : `Criterion ${firstNew.index}`, direction: 'benefit', weight: 0 }];
  const secondNew = nextUnusedId('C', criteria);
  criteria = [...criteria, { id: secondNew.id, name: isDematel ? `Factor ${secondNew.index}` : `Criterion ${secondNew.index}`, direction: 'benefit', weight: 0 }];
  const normalizedCriteria = normalizeUniqueIds('C', criteria, isDematel ? 'Factor' : 'Criterion');
  const alternatives = isDematel ? normalizedCriteria.map((criterion) => ({ id: criterion.id, name: criterion.name })) : normalizeUniqueIds('A', config.alternatives, 'Alternative');
  const values = resizeValuesForStructureSmoke(isDematel ? normalizedCriteria.length : alternatives.length, normalizedCriteria.length, input.values, isDematel);
  const editedConfig = { ...config, alternatives, criteria: normalizedCriteria };
  const editedInput = { ...input, alternatives, criteria: normalizedCriteria, values };
  return { config: editedConfig, input: editedInput };
}

function simulateMiddleCriteriaDeleteThenAdd(method, config, input) {
  const isDematel = method.id === 'dematel';
  const deletedIndexes = new Set(config.criteria.length >= 4 ? [1, 2] : [config.criteria.length - 1]);
  let criteria = config.criteria.filter((_, index) => !deletedIndexes.has(index));
  const firstNew = nextUnusedId('C', criteria);
  criteria = [...criteria, { id: firstNew.id, name: isDematel ? `Factor ${firstNew.index}` : `Criterion ${firstNew.index}`, direction: 'benefit', weight: 0 }];
  const secondNew = nextUnusedId('C', criteria);
  criteria = [...criteria, { id: secondNew.id, name: isDematel ? `Factor ${secondNew.index}` : `Criterion ${secondNew.index}`, direction: 'benefit', weight: 0 }];
  const normalizedCriteria = normalizeUniqueIds('C', criteria, isDematel ? 'Factor' : 'Criterion');
  const alternatives = isDematel ? normalizedCriteria.map((criterion) => ({ id: criterion.id, name: criterion.name })) : normalizeUniqueIds('A', config.alternatives, 'Alternative');
  const values = resizeValuesForStructureSmoke(isDematel ? normalizedCriteria.length : alternatives.length, normalizedCriteria.length, input.values, isDematel);
  const editedConfig = {
    ...config,
    methodParams: {
      ...config.methodParams,
      dataInputMode: 'Multiple respondents',
      respondentCount: 2,
    },
    alternatives,
    criteria: normalizedCriteria,
  };
  const editedInput = { ...input, alternatives, criteria: normalizedCriteria, values };
  return { config: editedConfig, input: editedInput };
}

function assertStructureEditsStayCanonical(workflowResults) {
  const failures = [];
  for (const { method, config, parsed } of workflowResults) {
    const edited = simulateStructureEdit(method, parsed.config ?? config, parsed.input);
    const ids = edited.input.criteria.map((criterion) => criterion.id);
    const unique = new Set(ids);
    const validation = method.validateWorkbook(edited.input, edited.config);
    const duplicateMessages = validation.issues.filter((issue) => /Duplicate criterion ID/i.test(issue.message));
    if (unique.size !== ids.length || duplicateMessages.length) {
      failures.push(`${method.name}: ids=${ids.join(', ')}; duplicateMessages=${duplicateMessages.map((issue) => issue.message).join(' | ')}`);
    }
  }
  if (failures.length) throw new Error(`Structure edit canonicalization failed: ${failures.join('; ')}`);

  const promethee = workflowResults.find((result) => result.method.id === 'promethee');
  if (!promethee) throw new Error('PROMETHEE II workflow result is missing from structure edit coverage.');
  const editedPromethee = simulateMiddleCriteriaDeleteThenAdd(promethee.method, promethee.parsed.config ?? promethee.config, promethee.parsed.input);
  const prometheeIds = editedPromethee.input.criteria.map((criterion) => criterion.id);
  const expectedAddedIds = ['C8', 'C9'];
  const prometheeUnique = new Set(prometheeIds);
  const validation = promethee.method.validateWorkbook(editedPromethee.input, editedPromethee.config);
  const duplicateMessages = validation.issues.filter((issue) => /Duplicate criterion ID/i.test(issue.message));
  const addedIdsMissing = expectedAddedIds.some((id) => !prometheeIds.includes(id));
  if (prometheeUnique.size !== prometheeIds.length || duplicateMessages.length || addedIdsMissing) {
    throw new Error(`PROMETHEE II multiple-respondent middle-delete/add criteria IDs are not canonical: ids=${prometheeIds.join(', ')}; expected new IDs C8,C9; duplicateMessages=${duplicateMessages.map((issue) => issue.message).join(' | ')}`);
  }
}
async function assertMissingSheetRejected(methodId, sheetName, configOverrides = {}) {
  const method = getMethod(methodId);
  const config = {
    ...sampleConfig,
    ...configOverrides,
    methodId,
    methodParams: {
      ...sampleConfig.methodParams,
      ...methodDefaultParams(method),
      ...(configOverrides.methodParams ?? {}),
    },
  };
  const workbook = XLSX.utils.book_new();
  method.getTemplateSchema(config)
    .filter((sheet) => sheet.name !== sheetName)
    .forEach((sheet) => {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
    });
  const templateBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  const templateFile = new File([templateBuffer], `${method.name}-missing-${sheetName}.xlsx`, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const parsed = await parseWorkbook(templateFile, config);
  const rejected = !parsed.validation.ok && parsed.validation.issues.some((issue) => issue.sheet === sheetName && issue.message.includes('missing'));
  if (!rejected) {
    throw new Error(`${method.name} upload did not reject missing required sheet: ${sheetName}`);
  }
}

async function assertWrongMethodTemplateRejected(selectedMethodId, uploadedTemplateMethodId, configOverrides = {}) {
  const selectedMethod = getMethod(selectedMethodId);
  const uploadedMethod = getMethod(uploadedTemplateMethodId);
  const config = {
    ...sampleConfig,
    ...configOverrides,
    methodId: selectedMethodId,
    methodParams: {
      ...sampleConfig.methodParams,
      ...methodDefaultParams(selectedMethod),
      ...(configOverrides.methodParams ?? {}),
    },
  };
  const uploadedConfig = {
    ...config,
    methodId: uploadedTemplateMethodId,
    methodParams: {
      ...config.methodParams,
      ...methodDefaultParams(uploadedMethod),
    },
  };
  const workbook = XLSX.utils.book_new();
  uploadedMethod.getTemplateSchema(uploadedConfig).forEach((sheet) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
  });
  const templateBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  const templateFile = new File([templateBuffer], `${uploadedMethod.name}-wrong-template.xlsx`, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const parsed = await parseWorkbook(templateFile, config);
  const rejected = !parsed.validation.ok && parsed.validation.issues.some((issue) =>
    issue.sheet === 'Study Settings'
      && issue.message.includes(`This workbook is for ${uploadedMethod.name}`)
      && issue.message.includes(`selected method is ${selectedMethod.name}`),
  );
  if (!rejected) {
    throw new Error(`${selectedMethod.name} upload did not reject a ${uploadedMethod.name} template: ${parsed.validation.issues.map((issue) => `${issue.sheet} ${issue.location}: ${issue.message}`).join('; ')}`);
  }
}

async function assertProjectImportRejected(payload, filename, expectedMessage) {
  const content = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const file = new File([content], filename, { type: 'application/json' });
  try {
    await importProject(file);
  } catch (error) {
    if (error instanceof Error && error.message.includes(expectedMessage)) return;
    throw new Error(`Project import rejected with the wrong message: expected "${expectedMessage}", received "${error instanceof Error ? error.message : String(error)}".`);
  }
  throw new Error(`Project import accepted invalid file: ${filename}`);
}

function setSheetValue(workbook, sheetName, key, value) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Cannot update missing sheet: ${sheetName}`);
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const rowIndex = rows.findIndex((row) => String(row[0] ?? '').trim() === key);
  if (rowIndex < 0) {
    rows.push([key, value]);
    workbook.Sheets[sheetName] = XLSX.utils.aoa_to_sheet(rows);
    return;
  }
  rows[rowIndex][1] = value;
  workbook.Sheets[sheetName] = XLSX.utils.aoa_to_sheet(rows);
}

function setTableCell(workbook, sheetName, rowKeyColumn, rowKey, columnKey, value) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Cannot update missing sheet: ${sheetName}`);
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const header = rows[0] ?? [];
  const rowKeyIndex = header.findIndex((item) => String(item ?? '').trim() === rowKeyColumn);
  const columnIndex = header.findIndex((item) => String(item ?? '').trim() === columnKey);
  const rowIndex = rows.findIndex((row, index) => index > 0 && String(row[rowKeyIndex] ?? '').trim() === rowKey);
  if (rowKeyIndex < 0 || columnIndex < 0 || rowIndex < 0) {
    throw new Error(`Cannot find ${rowKey}/${columnKey} in ${sheetName}`);
  }
  rows[rowIndex][columnIndex] = value;
  workbook.Sheets[sheetName] = XLSX.utils.aoa_to_sheet(rows);
}

async function assertWorkbookParamRoundTrip(methodId, sheetName, key, value, paramKey, configOverrides = {}) {
  const method = getMethod(methodId);
  const config = {
    ...sampleConfig,
    ...configOverrides,
    methodId,
    methodParams: {
      ...sampleConfig.methodParams,
      ...methodDefaultParams(method),
      ...(configOverrides.methodParams ?? {}),
    },
  };
  const workbook = XLSX.utils.book_new();
  const sheets = method.getTemplateSchema(config);
  sheets.forEach((sheet) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
  });
  setSheetValue(workbook, sheetName, key, value);
  const templateBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  const templateFile = new File([templateBuffer], `${method.name}-param-round-trip.xlsx`, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const parsed = await parseWorkbook(templateFile, config);
  if (!parsed.validation.ok) {
    throw new Error(`${method.name} parameter round-trip validation failed: ${parsed.validation.issues.map((issue) => `${issue.sheet} ${issue.location}: ${issue.message}`).join('; ')}`);
  }
  const actual = parsed.config?.methodParams?.[paramKey];
  if (actual !== value) {
    throw new Error(`${method.name} upload did not preserve ${paramKey}: expected ${value}, received ${actual}`);
  }
}

async function assertWorkbookTableParamRoundTrip(methodId, sheetName, rowKeyColumn, rowKey, columnKey, value, expectedParams, configOverrides = {}) {
  const method = getMethod(methodId);
  const config = {
    ...sampleConfig,
    ...configOverrides,
    methodId,
    methodParams: {
      ...sampleConfig.methodParams,
      ...methodDefaultParams(method),
      ...(configOverrides.methodParams ?? {}),
    },
  };
  const workbook = XLSX.utils.book_new();
  const sheets = method.getTemplateSchema(config);
  if (sheets.some((sheet) => sheet.name === 'Weights')) {
    throw new Error('Equal-weight template should not include an editable-looking standalone Weights sheet.');
  }
  sheets.forEach((sheet) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
  });
  setTableCell(workbook, sheetName, rowKeyColumn, rowKey, columnKey, value);
  const templateBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  const templateFile = new File([templateBuffer], `${method.name}-table-param-round-trip.xlsx`, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const parsed = await parseWorkbook(templateFile, config);
  if (!parsed.validation.ok) {
    throw new Error(`${method.name} table parameter round-trip validation failed: ${parsed.validation.issues.map((issue) => `${issue.sheet} ${issue.location}: ${issue.message}`).join('; ')}`);
  }
  Object.entries(expectedParams).forEach(([paramKey, expectedValue]) => {
    const actual = parsed.config?.methodParams?.[paramKey];
    if (actual !== expectedValue) {
      throw new Error(`${method.name} upload did not preserve ${paramKey}: expected ${expectedValue}, received ${actual}`);
    }
  });
}

async function assertAutomaticWeightsIgnoreUploadedWeights() {
  const method = getMethod('vikor');
  const config = {
    ...sampleConfig,
    methodId: 'vikor',
    weightingId: 'equal',
    methodParams: {
      ...sampleConfig.methodParams,
      ...methodDefaultParams(method),
    },
  };
  const workbook = XLSX.utils.book_new();
  method.getTemplateSchema(config).forEach((sheet) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
  });
  const criteriaRows = XLSX.utils.sheet_to_json(workbook.Sheets.Criteria, { header: 1, defval: '' });
  criteriaRows[0].push('Weight Source');
  criteriaRows.find((row) => row[0] === 'C1')?.push(0.9);
  criteriaRows.find((row) => row[0] === 'C2')?.push(0.1);
  workbook.Sheets.Criteria = XLSX.utils.aoa_to_sheet(criteriaRows);
  const templateBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  const templateFile = new File([templateBuffer], 'vikor-equal-weights-with-edited-weight-cells.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const parsed = await parseWorkbook(templateFile, config);
  if (!parsed.validation.ok) {
    throw new Error(`Equal-weight VIKOR template failed validation: ${parsed.validation.issues.map((issue) => `${issue.sheet} ${issue.location}: ${issue.message}`).join('; ')}`);
  }
  if (parsed.config?.weightingId !== 'equal') {
    throw new Error(`Equal-weight VIKOR upload did not preserve equal weighting mode; received ${parsed.config?.weightingId}.`);
  }
  const analysis = method.runAnalysis(parsed.input, parsed.config ?? config);
  const weightTable = analysis.tables.find((table) => table.id === 'applied-criteria-weights');
  const expected = 1 / parsed.input.criteria.length;
  const appliedWeights = weightTable?.rows.map((row) => Number(row[3])) ?? [];
  if (appliedWeights.length !== parsed.input.criteria.length || appliedWeights.some((weight) => Math.abs(weight - expected) > 0.0001)) {
    throw new Error(`Equal-weight VIKOR did not ignore edited workbook weight cells. Expected all ${expected}, received ${appliedWeights.join(', ')}.`);
  }
}

async function assertPughUploadedScoresWorkflow() {
  const method = getMethod('pugh');
  const config = {
    ...sampleConfig,
    methodId: 'pugh',
    weightingId: 'manual',
    methodParams: {
      ...sampleConfig.methodParams,
      ...methodDefaultParams(method),
      pughScoringMode: 'Use uploaded Pugh scores',
      pughScoreTransform: 'Global 0-1 rescale',
    },
  };
  const workbook = XLSX.utils.book_new();
  method.getTemplateSchema(config).forEach((sheet) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
  });
  setTableCell(workbook, 'Decision Matrix', 'Alternative ID', 'S1', 'C1', 3);
  setTableCell(workbook, 'Decision Matrix', 'Alternative ID', 'S2', 'C1', 0);
  setTableCell(workbook, 'Decision Matrix', 'Alternative ID', 'S3', 'C1', -3);
  const templateBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  const templateFile = new File([templateBuffer], 'pugh-uploaded-score-template.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const parsed = await parseWorkbook(templateFile, config);
  if (!parsed.validation.ok) {
    throw new Error(`Pugh uploaded-score template failed validation: ${parsed.validation.issues.map((issue) => `${issue.sheet} ${issue.location}: ${issue.message}`).join('; ')}`);
  }
  const analysis = method.runAnalysis(parsed.input, parsed.config ?? config);
  if (!analysis.tables.some((table) => table.id === 'pugh-transformed-scores')) {
    throw new Error('Pugh uploaded-score workflow did not produce the global rescaled score table.');
  }
  const scoreTable = analysis.tables.find((table) => table.id === 'pugh-transformed-scores');
  const flatValues = parsed.input.values.flat();
  const minValue = Math.min(...flatValues);
  const maxValue = Math.max(...flatValues);
  const expectedFirst = (3 - minValue) / (maxValue - minValue);
  const firstScore = Number(scoreTable?.rows[0]?.[1]);
  const thirdScore = Number(scoreTable?.rows[2]?.[1]);
  if (Math.abs(firstScore - expectedFirst) > 0.0001 || Math.abs(thirdScore - 0) > 0.0001) {
    throw new Error(`Pugh uploaded-score rescale expected S1/C1=${expectedFirst} and S3/C1=0, received ${firstScore} and ${thirdScore}.`);
  }
}

async function assertMultiRespondentWorkbookAggregates() {
  const method = getMethod('topsis');
  const config = {
    ...sampleConfig,
    methodId: 'topsis',
    weightingId: 'manual',
    methodParams: {
      ...sampleConfig.methodParams,
      ...methodDefaultParams(method),
      dataInputMode: 'Multiple respondents',
      respondentCount: 2,
      respondentAggregation: 'Arithmetic mean',
      fuzzyInputMode: 'Defuzzify on upload',
    },
  };
  const workbook = XLSX.utils.book_new();
  method.getTemplateSchema(config).forEach((sheet) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
  });
  if (!workbook.Sheets['Respondent 1'] || !workbook.Sheets['Respondent 2']) {
    throw new Error('TOPSIS multiple-respondent template did not include respondent sheets.');
  }
  setTableCell(workbook, 'Respondent 1', 'Alternative ID', 'S1', 'C1', 100);
  setTableCell(workbook, 'Respondent 2', 'Alternative ID', 'S1', 'C1', 200);
  const templateBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  const templateFile = new File([templateBuffer], 'topsis-two-respondent-template.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const parsed = await parseWorkbook(templateFile, config);
  if (!parsed.validation.ok) {
    throw new Error(`TOPSIS multiple-respondent upload failed validation: ${parsed.validation.issues.map((issue) => `${issue.sheet} ${issue.location}: ${issue.message}`).join('; ')}`);
  }
  if (parsed.input.respondentMatrices?.length !== 2) {
    throw new Error(`TOPSIS multiple-respondent upload parsed ${parsed.input.respondentMatrices?.length ?? 0} respondent matrices instead of 2.`);
  }
  const analysis = method.runAnalysis(parsed.input, parsed.config ?? config);
  const aggregationTable = analysis.tables.find((table) => table.id === 'respondent-aggregation');
  const aggregatedCell = analysis.input.values[0]?.[0];
  if (Math.abs(aggregatedCell - 150) > 0.0001) {
    throw new Error(`TOPSIS multiple-respondent aggregation expected S1/C1 to average to 150, received ${aggregatedCell}.`);
  }
  if (!aggregationTable || aggregationTable.rows[0]?.[0] !== 2 || aggregationTable.rows[0]?.[1] !== 'Arithmetic mean') {
    throw new Error('TOPSIS multiple-respondent result did not include a correct respondent aggregation summary table.');
  }
}

async function assertFuzzyWorkbookUploadPaths() {
  const method = getMethod('topsis');
  const nativeConfig = {
    ...sampleConfig,
    methodId: 'topsis',
    weightingId: 'manual',
    methodParams: {
      ...sampleConfig.methodParams,
      ...methodDefaultParams(method),
      fuzzyInputMode: 'Native fuzzy TOPSIS',
    },
  };
  const nativeWorkbook = XLSX.utils.book_new();
  method.getTemplateSchema(nativeConfig).forEach((sheet) => {
    XLSX.utils.book_append_sheet(nativeWorkbook, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
  });
  setTableCell(nativeWorkbook, 'Decision Matrix', 'Alternative ID', 'S1', 'C1', '(60, 72, 84)');
  setTableCell(nativeWorkbook, 'Decision Matrix', 'Alternative ID', 'S2', 'C2', '(70, 74, 78, 82)');
  const nativeBuffer = XLSX.write(nativeWorkbook, { bookType: 'xlsx', type: 'buffer' });
  const nativeFile = new File([nativeBuffer], 'topsis-native-fuzzy-template.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const nativeParsed = await parseWorkbook(nativeFile, nativeConfig);
  if (!nativeParsed.validation.ok) {
    throw new Error(`Native fuzzy TOPSIS workbook failed validation: ${nativeParsed.validation.issues.map((issue) => `${issue.sheet} ${issue.location}: ${issue.message}`).join('; ')}`);
  }
  if ((nativeParsed.input.fuzzyCellCount ?? 0) < 2 || !nativeParsed.input.fuzzyTypes?.includes('triangular') || !nativeParsed.input.fuzzyTypes?.includes('trapezoidal')) {
    throw new Error(`Native fuzzy TOPSIS upload did not preserve triangular/trapezoidal metadata: ${nativeParsed.input.fuzzyCellCount}, ${nativeParsed.input.fuzzyTypes?.join(', ')}`);
  }
  const nativeAnalysis = method.runAnalysis(nativeParsed.input, nativeParsed.config ?? nativeConfig);
  if (!nativeAnalysis.diagnostics.some((diagnostic) => diagnostic.label === 'Native fuzzy TOPSIS') || !nativeAnalysis.tables.some((table) => table.id.startsWith('fuzzy-topsis'))) {
    throw new Error('Native fuzzy TOPSIS workbook upload did not reach native fuzzy result tables and diagnostics.');
  }

  const crispConfig = {
    ...nativeConfig,
    methodParams: {
      ...nativeConfig.methodParams,
      fuzzyInputMode: 'Defuzzify on upload',
    },
  };
  const crispWorkbook = XLSX.utils.book_new();
  method.getTemplateSchema(crispConfig).forEach((sheet) => {
    XLSX.utils.book_append_sheet(crispWorkbook, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
  });
  setTableCell(crispWorkbook, 'Decision Matrix', 'Alternative ID', 'S1', 'C1', '(60, 72, 84)');
  setTableCell(crispWorkbook, 'Decision Matrix', 'Alternative ID', 'S2', 'C2', '(70, 74, 78, 82)');
  const crispBuffer = XLSX.write(crispWorkbook, { bookType: 'xlsx', type: 'buffer' });
  const crispFile = new File([crispBuffer], 'topsis-defuzzified-template.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const crispParsed = await parseWorkbook(crispFile, crispConfig);
  if (!crispParsed.validation.ok) {
    throw new Error(`Defuzzified TOPSIS workbook failed validation: ${crispParsed.validation.issues.map((issue) => `${issue.sheet} ${issue.location}: ${issue.message}`).join('; ')}`);
  }
  if (Math.abs(crispParsed.input.values[0][0] - 72) > 0.0001 || Math.abs(crispParsed.input.values[1][1] - 76) > 0.0001) {
    throw new Error(`Defuzzified TOPSIS upload produced wrong centroid values: ${crispParsed.input.values[0][0]}, ${crispParsed.input.values[1][1]}.`);
  }
  const crispAnalysis = method.runAnalysis(crispParsed.input, crispParsed.config ?? crispConfig);
  if (!crispAnalysis.diagnostics.some((diagnostic) => diagnostic.label === 'Fuzzy input handling')) {
    throw new Error('Defuzzified fuzzy workbook upload did not report fuzzy input handling.');
  }
}

async function assertDematelExpertWorkbookAggregates() {
  const method = getMethod('dematel');
  const factors = sampleConfig.criteria.slice(0, 4);
  const config = {
    ...sampleConfig,
    methodId: 'dematel',
    weightingId: 'manual',
    alternatives: factors.map((criterion) => ({ id: criterion.id, name: criterion.name })),
    criteria: factors,
    methodParams: {
      ...sampleConfig.methodParams,
      ...methodDefaultParams(method),
      dataInputMode: 'Multiple experts',
      dematelExpertCount: 2,
      dematelAggregation: 'Arithmetic mean',
      dematelThreshold: 'Mean threshold',
      fuzzyInputMode: 'Defuzzify on upload',
    },
  };
  const workbook = XLSX.utils.book_new();
  method.getTemplateSchema(config).forEach((sheet) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
  });
  if (!workbook.Sheets['Expert 1'] || !workbook.Sheets['Expert 2']) {
    throw new Error('DEMATEL multiple-expert template did not include expert sheets.');
  }
  setTableCell(workbook, 'Direct Relation Matrix', 'Factor', 'C1', 'C2', 4);
  setTableCell(workbook, 'Expert 1', 'Factor', 'C1', 'C2', 1);
  setTableCell(workbook, 'Expert 2', 'Factor', 'C1', 'C2', 3);
  const templateBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  const templateFile = new File([templateBuffer], 'dematel-two-expert-template.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const parsed = await parseWorkbook(templateFile, config);
  if (!parsed.validation.ok) {
    throw new Error(`DEMATEL multiple-expert upload failed validation: ${parsed.validation.issues.map((issue) => `${issue.sheet} ${issue.location}: ${issue.message}`).join('; ')}`);
  }
  if (parsed.input.expertMatrices?.length !== 2) {
    throw new Error(`DEMATEL multiple-expert upload parsed ${parsed.input.expertMatrices?.length ?? 0} expert matrices instead of 2.`);
  }
  const analysis = method.runAnalysis(parsed.input, parsed.config ?? config);
  const directTable = analysis.tables.find((table) => table.id === 'direct');
  const expertTable = analysis.tables.find((table) => table.id === 'expert-aggregation');
  if (Number(directTable?.rows[0]?.[2]) !== 2) {
    throw new Error(`DEMATEL expert aggregation should average Expert 1/2 C1->C2 to 2, received ${directTable?.rows[0]?.[2]}.`);
  }
  if (!expertTable || expertTable.rows[0]?.[0] !== 2 || expertTable.rows[0]?.[1] !== 'Arithmetic mean') {
    throw new Error('DEMATEL multiple-expert result did not include a correct expert aggregation summary table.');
  }
  if (!analysis.visualizations.some((visualization) => visualization.type === 'dematel-cause-effect')) {
    throw new Error('DEMATEL multiple-expert result did not include cause-effect visualization data.');
  }

  const fuzzyConfig = {
    ...config,
    methodParams: {
      ...config.methodParams,
      fuzzyInputMode: 'Native fuzzy DEMATEL',
      dematelFuzzyCalculation: 'Defuzzify before total relation',
    },
  };
  const fuzzyWorkbook = XLSX.utils.book_new();
  method.getTemplateSchema(fuzzyConfig).forEach((sheet) => {
    XLSX.utils.book_append_sheet(fuzzyWorkbook, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
  });
  setTableCell(fuzzyWorkbook, 'Expert 1', 'Factor', 'C1', 'C2', '(1,2,3)');
  setTableCell(fuzzyWorkbook, 'Expert 2', 'Factor', 'C1', 'C2', '(3,4,5)');
  const fuzzyBuffer = XLSX.write(fuzzyWorkbook, { bookType: 'xlsx', type: 'buffer' });
  const fuzzyFile = new File([fuzzyBuffer], 'dematel-fuzzy-convention-template.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const fuzzyParsed = await parseWorkbook(fuzzyFile, fuzzyConfig);
  if (!fuzzyParsed.validation.ok) {
    throw new Error(`DEMATEL fuzzy convention upload failed validation: ${fuzzyParsed.validation.issues.map((issue) => `${issue.sheet} ${issue.location}: ${issue.message}`).join('; ')}`);
  }
  if (fuzzyParsed.config?.methodParams.dematelFuzzyCalculation !== 'Defuzzify before total relation') {
    throw new Error('DEMATEL fuzzy calculation convention did not round-trip through the workbook.');
  }
  const fuzzyAnalysis = method.runAnalysis(fuzzyParsed.input, fuzzyParsed.config ?? fuzzyConfig);
  if (!fuzzyAnalysis.tables.some((table) => table.id === 'fuzzy-dematel-defuzzification')) {
    throw new Error('DEMATEL fuzzy defuzzify-before-total convention did not produce the expected convention table.');
  }
  if (fuzzyAnalysis.reproducibility.dematelFuzzyCalculation !== 'Defuzzify before total relation') {
    throw new Error('DEMATEL fuzzy convention was not recorded in reproducibility metadata.');
  }
}

async function assertAhpGroupPairwiseWorkbookAggregates() {
  const method = getMethod('ahp');
  const config = {
    ...sampleConfig,
    methodId: 'ahp',
    weightingId: 'ahp',
    methodParams: {
      ...sampleConfig.methodParams,
      ...methodDefaultParams(method),
      dataInputMode: 'Multiple respondents',
      respondentCount: 2,
      ahpRespondentCount: 2,
      ahpPairwiseMode: 'Criteria and alternatives',
      ahpConsistencyThreshold: 0.1,
      ahpGroupAggregation: 'Geometric mean',
      fuzzyInputMode: 'Defuzzify on upload',
    },
  };
  const workbook = XLSX.utils.book_new();
  method.getTemplateSchema(config).forEach((sheet) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
  });
  if (!workbook.Sheets['AHP Criteria Respondent 1'] || !workbook.Sheets['AHP Criteria Respondent 2']) {
    throw new Error('AHP group template did not include criteria respondent sheets.');
  }
  if (!workbook.Sheets['AHP Alternatives Respondent 1'] || !workbook.Sheets['AHP Alternatives Respondent 2']) {
    throw new Error('AHP group template did not include alternative respondent sheets.');
  }

  setTableCell(workbook, 'Criteria Pairwise Matrix', 'Criterion', 'C1', 'C2', 9);
  setTableCell(workbook, 'Criteria Pairwise Matrix', 'Criterion', 'C2', 'C1', 1 / 9);
  setTableCell(workbook, 'AHP Criteria Respondent 1', 'Criterion', 'C1', 'C2', 2);
  setTableCell(workbook, 'AHP Criteria Respondent 1', 'Criterion', 'C2', 'C1', 1 / 2);
  setTableCell(workbook, 'AHP Criteria Respondent 2', 'Criterion', 'C1', 'C2', 8);
  setTableCell(workbook, 'AHP Criteria Respondent 2', 'Criterion', 'C2', 'C1', 1 / 8);
  setTableCell(workbook, 'AHP Alternatives Respondent 1', 'Alternative', 'S1', 'S2', 3);
  setTableCell(workbook, 'AHP Alternatives Respondent 1', 'Alternative', 'S2', 'S1', 1 / 3);
  setTableCell(workbook, 'AHP Alternatives Respondent 2', 'Alternative', 'S1', 'S2', 3);
  setTableCell(workbook, 'AHP Alternatives Respondent 2', 'Alternative', 'S2', 'S1', 1 / 3);

  const templateBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  const templateFile = new File([templateBuffer], 'ahp-two-respondent-pairwise-template.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const parsed = await parseWorkbook(templateFile, config);
  if (!parsed.validation.ok) {
    throw new Error(`AHP group pairwise upload failed validation: ${parsed.validation.issues.map((issue) => `${issue.sheet} ${issue.location}: ${issue.message}`).join('; ')}`);
  }
  if (parsed.config?.ahpCriteriaRespondentPairwise?.length !== 2) {
    throw new Error(`AHP upload parsed ${parsed.config?.ahpCriteriaRespondentPairwise?.length ?? 0} criteria respondent matrices instead of 2.`);
  }
  if (parsed.config?.ahpAlternativeRespondentPairwise?.C1?.length !== 2) {
    throw new Error(`AHP upload parsed ${parsed.config?.ahpAlternativeRespondentPairwise?.C1?.length ?? 0} alternative respondent matrices for C1 instead of 2.`);
  }
  const analysis = method.runAnalysis(parsed.input, parsed.config ?? config);
  const pairwiseTable = analysis.tables.find((table) => table.id === 'criteria-pairwise');
  const aggregationTable = analysis.tables.find((table) => table.id === 'ahp-group-aggregation');
  const alternativeTable = analysis.tables.find((table) => table.id === 'alternative-priorities');
  if (Math.abs(Number(pairwiseTable?.rows[0]?.[2]) - 4) > 0.0001) {
    throw new Error(`AHP criteria respondent aggregation should geometric-mean C1/C2 to 4, received ${pairwiseTable?.rows[0]?.[2]}.`);
  }
  if (!aggregationTable || aggregationTable.rows[0]?.[1] !== 2 || aggregationTable.rows[0]?.[2] !== 'Geometric mean') {
    throw new Error('AHP group result did not include a correct pairwise aggregation summary table.');
  }
  if (!alternativeTable || Number(alternativeTable.rows[0]?.[1]) <= Number(alternativeTable.rows[1]?.[1])) {
    throw new Error('AHP group alternative pairwise sheets did not influence alternative priorities for C1.');
  }
  if (!analysis.diagnostics.some((diagnostic) => diagnostic.label === 'AHP group aggregation')) {
    throw new Error('AHP group analysis did not report geometric-mean aggregation in diagnostics.');
  }
}

async function assertCorruptWorkbookRejected(methodId, corrupt, expectedSheet, expectedMessage, configOverrides = {}) {
  const method = getMethod(methodId);
  const config = {
    ...sampleConfig,
    ...configOverrides,
    methodId,
    methodParams: {
      ...sampleConfig.methodParams,
      ...methodDefaultParams(method),
      ...(configOverrides.methodParams ?? {}),
    },
  };
  const workbook = XLSX.utils.book_new();
  method.getTemplateSchema(config).forEach((sheet) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
  });
  corrupt(workbook);
  const templateBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  const templateFile = new File([templateBuffer], `${method.name}-corrupt.xlsx`, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const parsed = await parseWorkbook(templateFile, config);
  const rejected = !parsed.validation.ok && parsed.validation.issues.some((issue) =>
    issue.sheet.includes(expectedSheet) && issue.message.includes(expectedMessage),
  );
  if (!rejected) {
    throw new Error(`${method.name} corrupt workbook was not rejected for ${expectedSheet}: ${parsed.validation.issues.map((issue) => `${issue.sheet} ${issue.location}: ${issue.message}`).join('; ')}`);
  }
}

function workflowOverrides(method) {
  const nativeFuzzyMode = method.fuzzySupport?.mode === 'native-fuzzy'
    ? method.fuzzySupport.nativeModeLabel
    : undefined;
  const methodParams = nativeFuzzyMode ? { fuzzyInputMode: nativeFuzzyMode } : {};

  if (method.id === 'ahp') {
    return {
      weightingId: 'ahp',
      methodParams: {
        ...methodParams,
        ahpPairwiseMode: 'Criteria and alternatives',
      },
    };
  }

  if (method.id === 'dematel') {
    return {
      methodParams: {
        dematelExpertCount: 1,
        fuzzyInputMode: 'Defuzzify on upload',
      },
    };
  }

  if (method.id === 'spotis') {
    return {
      weightingId: 'equal',
      methodParams: {
        ...methodParams,
        spotisBounds: 'Observed data range',
      },
    };
  }

  if (method.id === 'rim') {
    return {
      weightingId: 'equal',
      methodParams: {
        ...methodParams,
        rimReference: 'Observed ideal point',
      },
    };
  }

  if (method.id === 'lopm') {
    return {
      weightingId: 'equal',
      methodParams: {
        ...methodParams,
        lopmLimitsMode: 'Observed limits',
      },
    };
  }

  if (method.id === 'ervd') {
    return {
      weightingId: 'equal',
      methodParams: {
        ...methodParams,
        ervdReferenceMode: 'Observed mean',
      },
    };
  }

  return {
    weightingId: method.supportsWeights ? 'equal' : sampleConfig.weightingId,
    methodParams,
  };
}

const workflowResults = [];
for (const method of methodRegistry) {
  workflowResults.push(await runTemplateUploadAnalysis(method.id, workflowOverrides(method)));
}
assertStructureEditsStayCanonical(workflowResults);
await assertMissingSheetRejected('ahp', 'Criteria Pairwise Matrix', workflowOverrides(getMethod('ahp')));
await assertMissingSheetRejected('vikor', 'VIKOR Parameters', workflowOverrides(getMethod('vikor')));
await assertWrongMethodTemplateRejected('vikor', 'topsis', workflowOverrides(getMethod('vikor')));
await assertAutomaticWeightsIgnoreUploadedWeights();
await assertPughUploadedScoresWorkflow();
await assertMultiRespondentWorkbookAggregates();
await assertFuzzyWorkbookUploadPaths();
await assertDematelExpertWorkbookAggregates();
await assertAhpGroupPairwiseWorkbookAggregates();
await assertProjectImportRejected('{bad json', 'bad-project.json', 'not valid JSON');
await assertProjectImportRejected({ version: 1, config: { ...sampleConfig, methodId: 'unknown' }, input: workflowResults[0].parsed.input }, 'unknown-method.json', 'unsupported MCDM method');
await assertProjectImportRejected({ version: 1, config: { ...sampleConfig, weightingId: 'unknown' }, input: workflowResults[0].parsed.input }, 'unknown-weighting.json', 'unsupported weighting method');
await assertProjectImportRejected({
  version: 1,
  config: { ...sampleConfig, methodId: 'dematel', weightingId: 'equal', alternatives: sampleConfig.criteria.map((criterion) => ({ id: criterion.id, name: criterion.name })) },
  input: workflowResults.find((item) => item.method.id === 'dematel')?.parsed.input ?? workflowResults[0].parsed.input,
}, 'self-weighted-method-with-external-weighting.json', 'external weighting method to a self-weighted MCDM method');
await assertProjectImportRejected({
  version: 1,
  config: { ...sampleConfig, methodId: 'ahp', weightingId: 'equal' },
  input: workflowResults.find((item) => item.method.id === 'ahp')?.parsed.input ?? workflowResults[0].parsed.input,
}, 'ahp-project-with-non-ahp-weighting.json', 'AHP pairwise weighting');
await assertProjectImportRejected({ version: 1, config: sampleConfig, input: { ...workflowResults[0].parsed.input, values: [] } }, 'bad-matrix.json', 'matrix row count');
await assertProjectImportRejected({
  version: 1,
  config: { ...sampleConfig, criteria: [{ ...sampleConfig.criteria[0], id: 'C1' }, { ...sampleConfig.criteria[1], id: 'C1' }, ...sampleConfig.criteria.slice(2)] },
  input: workflowResults[0].parsed.input,
}, 'duplicate-criteria-project.json', 'duplicate criterion IDs');
await assertProjectImportRejected({
  version: 1,
  config: sampleConfig,
  input: { ...workflowResults[0].parsed.input, criteria: workflowResults[0].parsed.input.criteria.map((criterion, index) => index === 0 ? { ...criterion, id: 'CX' } : criterion) },
}, 'mismatched-criteria-project.json', 'criterion IDs do not match');
await assertProjectImportRejected({
  version: 1,
  config: sampleConfig,
  input: { ...workflowResults[0].parsed.input, alternatives: workflowResults[0].parsed.input.alternatives.map((alternative, index) => index === 0 ? { ...alternative, id: 'AX' } : alternative) },
}, 'mismatched-alternatives-project.json', 'alternative IDs do not match');
await assertProjectImportRejected({ version: 1, config: sampleConfig, input: workflowResults[0].parsed.input, step: 9 }, 'invalid-step-project.json', 'invalid saved workflow step');
await assertProjectImportRejected({ version: 1, config: sampleConfig, input: workflowResults[0].parsed.input, resultTab: 'Hidden Debug Tab' }, 'invalid-tab-project.json', 'invalid saved results tab');
await assertProjectImportRejected({ version: 1, config: sampleConfig, input: workflowResults[0].parsed.input, compareIds: ['topsis', 'unknown'] }, 'invalid-compare-project.json', 'invalid comparison method IDs');
await assertProjectImportRejected({ version: 1, config: sampleConfig, input: workflowResults[0].parsed.input, validationIssues: -1 }, 'invalid-validation-count-project.json', 'invalid validation issue count');
await assertProjectImportRejected({
  version: 1,
  config: { ...sampleConfig, methodParams: { ...sampleConfig.methodParams, dataInputMode: 'Multiple experts' } },
  input: workflowResults[0].parsed.input,
}, 'invalid-project-data-mode.json', 'data collection mode that is not supported');
await assertProjectImportRejected({
  version: 1,
  config: { ...sampleConfig, methodParams: { ...sampleConfig.methodParams, fuzzyInputMode: 'Native fuzzy DEMATEL' } },
  input: workflowResults[0].parsed.input,
}, 'invalid-project-fuzzy-mode.json', 'fuzzy input mode that is not supported');
await assertProjectImportRejected({
  version: 1,
  config: { ...sampleConfig, methodId: 'dematel', alternatives: sampleConfig.criteria.map((criterion) => ({ id: criterion.id, name: criterion.name })), methodParams: { ...sampleConfig.methodParams, dataInputMode: 'Single expert matrix', dematelFuzzyCalculation: 'Unpublished shortcut' } },
  input: { ...workflowResults[0].parsed.input, alternatives: workflowResults[0].parsed.input.criteria },
}, 'invalid-project-dematel-fuzzy-convention.json', 'DEMATEL fuzzy calculation convention');
await assertProjectImportRejected({
  version: 1,
  config: { ...sampleConfig, methodParams: { ...sampleConfig.methodParams, dataInputMode: 'Multiple respondents', respondentCount: 1 } },
  input: workflowResults[0].parsed.input,
}, 'invalid-project-respondent-count.json', 'invalid respondent count');
await assertCorruptWorkbookRejected('topsis', (workbook) => {
  setSheetValue(workbook, 'Study Settings', 'Weighting', 'Not a weighting method');
}, 'Study Settings', 'Unsupported weighting method', workflowOverrides(getMethod('topsis')));
await assertCorruptWorkbookRejected('topsis', (workbook) => {
  setSheetValue(workbook, 'Study Settings', 'Fuzzy input mode', 'Native fuzzy DEMATEL');
}, 'Study Settings', 'Unsupported fuzzy input mode', workflowOverrides(getMethod('topsis')));
await assertCorruptWorkbookRejected('topsis', (workbook) => {
  setSheetValue(workbook, 'Study Settings', 'Data input mode', 'Multiple experts');
}, 'Study Settings', 'Unsupported data input mode', workflowOverrides(getMethod('topsis')));
await assertCorruptWorkbookRejected('topsis', (workbook) => {
  setSheetValue(workbook, 'Normalization Settings', 'Distance metric', 'Manhattan');
}, 'Normalization Settings', 'TOPSIS currently supports Euclidean distance', workflowOverrides(getMethod('topsis')));
await assertCorruptWorkbookRejected('dematel', (workbook) => {
  setSheetValue(workbook, 'Study Settings', 'Weighting', 'equal');
}, 'Study Settings', 'self-weighted', workflowOverrides(getMethod('dematel')));
await assertCorruptWorkbookRejected('ahp', (workbook) => {
  setSheetValue(workbook, 'Consistency Settings', 'Threshold', -0.1);
}, 'Consistency Settings', 'AHP consistency threshold', workflowOverrides(getMethod('ahp')));
await assertCorruptWorkbookRejected('ahp', (workbook) => {
  setSheetValue(workbook, 'Consistency Settings', 'Pairwise mode', 'Criteria only plus partial alternatives');
}, 'Consistency Settings', 'AHP pairwise mode', workflowOverrides(getMethod('ahp')));
await assertCorruptWorkbookRejected('dematel', (workbook) => {
  setSheetValue(workbook, 'Study Settings', 'Aggregation', 'Weighted median');
}, 'Study Settings', 'DEMATEL currently supports Arithmetic mean', {
  methodParams: {
    ...workflowOverrides(getMethod('dematel')).methodParams,
    dataInputMode: 'Multiple experts',
    dematelExpertCount: 2,
  },
});
await assertCorruptWorkbookRejected('dematel', (workbook) => {
  setSheetValue(workbook, 'Threshold Settings', 'Fuzzy DEMATEL calculation', 'Unpublished shortcut');
}, 'Threshold Settings', 'DEMATEL fuzzy calculation', workflowOverrides(getMethod('dematel')));
await assertCorruptWorkbookRejected('grp', (workbook) => {
  setSheetValue(workbook, 'Method Parameters', 'graZeta', 2);
}, 'Method Parameters', 'Grey distinguishing coefficient zeta', workflowOverrides(getMethod('grp')));
await assertCorruptWorkbookRejected('spotis', (workbook) => {
  setTableCell(workbook, 'SPOTIS Bounds', 'Criterion ID', 'C1', 'Mode', 'Outside observed range');
}, 'SPOTIS Bounds', 'SPOTIS criterion bounds', workflowOverrides(getMethod('spotis')));
await assertCorruptWorkbookRejected('seca', (workbook) => {
  setSheetValue(workbook, 'SECA Settings', 'reference balance', 1.2);
}, 'SECA Settings', 'SECA reference balance', workflowOverrides(getMethod('seca')));
await assertCorruptWorkbookRejected('eamr', (workbook) => {
  setSheetValue(workbook, 'EAMR Settings', 'beta', -0.1);
}, 'EAMR Settings', 'EAMR beta', workflowOverrides(getMethod('eamr')));
await assertCorruptWorkbookRejected('macont', (workbook) => {
  setSheetValue(workbook, 'MACONT Settings', 'mu', 0.9);
}, 'MACONT Settings', 'MACONT lambda plus mu', {
  ...workflowOverrides(getMethod('macont')),
  methodParams: {
    ...workflowOverrides(getMethod('macont')).methodParams,
    macontLambda: 0.25,
  },
});
await assertCorruptWorkbookRejected('rafsi', (workbook) => {
  setSheetValue(workbook, 'RAFSI Interval', 'Interval upper bound', 1);
}, 'RAFSI Interval', 'RAFSI interval upper bound', workflowOverrides(getMethod('rafsi')));
await assertCorruptWorkbookRejected('promethee', (workbook) => {
  setSheetValue(workbook, 'PROMETHEE Settings', 'Preference function', 'Linear');
  setSheetValue(workbook, 'PROMETHEE Settings', 'Indifference threshold q', 0.5);
  setSheetValue(workbook, 'PROMETHEE Settings', 'Preference threshold p', 0.2);
}, 'PROMETHEE Settings', 'PROMETHEE preference threshold p', workflowOverrides(getMethod('promethee')));
await assertCorruptWorkbookRejected('comet', (workbook) => {
  setSheetValue(workbook, 'COMET Settings', 'Characteristic values', 'deciles');
}, 'COMET Settings', 'COMET characteristic values', workflowOverrides(getMethod('comet')));
await assertCorruptWorkbookRejected('smarter', (workbook) => {
  setSheetValue(workbook, 'Method Parameters', 'smarterUtilityMode', 'Ordinal vibes');
}, 'SMARTER Settings', 'SMARTER utility input', workflowOverrides(getMethod('smarter')));
await assertCorruptWorkbookRejected('pugh', (workbook) => {
  setSheetValue(workbook, 'Method Parameters', 'pughScoringMode', 'Unsupported Pugh scoring');
}, 'Pugh Matrix Settings', 'Pugh scoring mode', workflowOverrides(getMethod('pugh')));
await assertWorkbookParamRoundTrip('topsis', 'Normalization Settings', 'Normalization', 'Linear normalization', 'normalization', workflowOverrides(getMethod('topsis')));
await assertWorkbookParamRoundTrip('vikor', 'VIKOR Parameters', 'v', 0.35, 'vikorV', workflowOverrides(getMethod('vikor')));
await assertWorkbookParamRoundTrip('ahp', 'Consistency Settings', 'Pairwise mode', 'Criteria only', 'ahpPairwiseMode', workflowOverrides(getMethod('ahp')));
await assertWorkbookParamRoundTrip('promethee', 'PROMETHEE Settings', 'Preference function', 'Gaussian', 'preferenceFunction', workflowOverrides(getMethod('promethee')));
await assertWorkbookParamRoundTrip('promethee', 'PROMETHEE Settings', 'Gaussian sigma', 2, 'prometheeGaussianSigma', {
  ...workflowOverrides(getMethod('promethee')),
  methodParams: {
    ...workflowOverrides(getMethod('promethee')).methodParams,
    preferenceFunction: 'Gaussian',
  },
});
await assertWorkbookParamRoundTrip('comet', 'COMET Settings', 'Characteristic values', 'min,max', 'cometCharacteristicValues', workflowOverrides(getMethod('comet')));
await assertWorkbookParamRoundTrip('comet', 'COMET Settings', 'Preference model', 'TOPSIS expert', 'cometPreferenceModel', workflowOverrides(getMethod('comet')));
await assertWorkbookParamRoundTrip('cradis', 'CRADIS Settings', 'Normalization', 'Ratio normalization', 'normalization', workflowOverrides(getMethod('cradis')));
await assertWorkbookParamRoundTrip('maut', 'Method Parameters', 'normalization', 'Input values are utilities', 'normalization', workflowOverrides(getMethod('maut')));
await assertWorkbookParamRoundTrip('smarter', 'Method Parameters', 'smarterUtilityMode', 'Input values are utilities', 'smarterUtilityMode', workflowOverrides(getMethod('smarter')));
await assertWorkbookParamRoundTrip('smarter', 'Method Parameters', 'smarterScoreMode', 'Normalize total scores', 'smarterScoreMode', workflowOverrides(getMethod('smarter')));
await assertWorkbookParamRoundTrip('pugh', 'Method Parameters', 'pughScoringMode', 'Use uploaded Pugh scores', 'pughScoringMode', workflowOverrides(getMethod('pugh')));
await assertWorkbookParamRoundTrip('pugh', 'Method Parameters', 'pughScoreTransform', 'Global 0-1 rescale', 'pughScoreTransform', {
  ...workflowOverrides(getMethod('pugh')),
  methodParams: {
    ...workflowOverrides(getMethod('pugh')).methodParams,
    pughScoringMode: 'Use uploaded Pugh scores',
  },
});
await assertWorkbookParamRoundTrip('seca', 'SECA Settings', 'epsilon', 0.01, 'secaEpsilon', workflowOverrides(getMethod('seca')));
await assertWorkbookParamRoundTrip('seca', 'SECA Settings', 'reference balance', 0.6, 'secaReferenceBalance', workflowOverrides(getMethod('seca')));
await assertWorkbookParamRoundTrip('eamr', 'EAMR Settings', 'beta', 0.4, 'eamrBeta', workflowOverrides(getMethod('eamr')));
await assertWorkbookParamRoundTrip('eamr', 'EAMR Settings', 'lambda', 0.6, 'eamrLambda', workflowOverrides(getMethod('eamr')));
await assertWorkbookParamRoundTrip('arlon', 'ARLON Settings', 'Gamma', 0.45, 'arlonGamma', workflowOverrides(getMethod('arlon')));
await assertWorkbookParamRoundTrip('macont', 'MACONT Settings', 'lambda', 0.25, 'macontLambda', workflowOverrides(getMethod('macont')));
await assertWorkbookParamRoundTrip('macont', 'MACONT Settings', 'mu', 0.35, 'macontMu', workflowOverrides(getMethod('macont')));
await assertWorkbookParamRoundTrip('rafsi', 'RAFSI Interval', 'Interval lower bound', 2, 'rafsiIntervalLower', workflowOverrides(getMethod('rafsi')));
await assertWorkbookParamRoundTrip('rafsi', 'RAFSI Interval', 'Interval upper bound', 7, 'rafsiIntervalUpper', workflowOverrides(getMethod('rafsi')));
await assertWorkbookTableParamRoundTrip('rafsi', 'RAFSI Reference Values', 'Criterion ID', 'C1', 'Ideal Value', 20, {
  rafsiReferenceMode: 'Manual reference values',
  rafsiIdealValues: '20,26,9,38,44,50,17',
  rafsiAntiIdealValues: '50,7,32,11,13,15,56',
}, {
  ...workflowOverrides(getMethod('rafsi')),
  methodParams: {
    ...workflowOverrides(getMethod('rafsi')).methodParams,
    rafsiReferenceMode: 'Manual reference values',
    rafsiIdealValues: '20,26,9,38,44,50,17',
    rafsiAntiIdealValues: '50,7,32,11,13,15,56',
  },
});
await assertWorkbookTableParamRoundTrip('spotis', 'SPOTIS Bounds', 'Criterion ID', 'C1', 'Mode', 'Manual bounds', {
  spotisBounds: 'Manual bounds',
  spotisLowerBounds: '6,8,10,12,14,16,18',
  spotisUpperBounds: '18,24,30,36,42,48,54',
}, {
  ...workflowOverrides(getMethod('spotis')),
  methodParams: {
    ...workflowOverrides(getMethod('spotis')).methodParams,
    fuzzyInputMode: 'Defuzzify on upload',
    spotisBounds: 'Manual bounds',
    spotisLowerBounds: '6,8,10,12,14,16,18',
    spotisUpperBounds: '18,24,30,36,42,48,54',
  },
});
await assertWorkbookTableParamRoundTrip('espSpotis', 'ESP-SPOTIS Point', 'Criterion ID', 'C1', 'Bounds Mode', 'Manual bounds', {
  espSpotisBounds: 'Manual bounds',
  espSpotisPoint: '7,9,11,13,15,17,19',
  spotisLowerBounds: '6,8,10,12,14,16,18',
  spotisUpperBounds: '18,24,30,36,42,48,54',
}, {
  ...workflowOverrides(getMethod('espSpotis')),
  methodParams: {
    ...workflowOverrides(getMethod('espSpotis')).methodParams,
    fuzzyInputMode: 'Defuzzify on upload',
    espSpotisBounds: 'Manual bounds',
    espSpotisPoint: '7,9,11,13,15,17,19',
    spotisLowerBounds: '6,8,10,12,14,16,18',
    spotisUpperBounds: '18,24,30,36,42,48,54',
  },
});
await assertWorkbookTableParamRoundTrip('rim', 'RIM Ideal Intervals', 'Criterion ID', 'C1', 'Mode', 'Manual ideal interval', {
  rimReference: 'Manual ideal interval',
  rimDomainLower: '5,7,9,11,13,15,17',
  rimDomainUpper: '20,26,32,38,44,50,56',
  rimIdealLower: '6,8,10,12,14,16,18',
  rimIdealUpper: '18,24,30,36,42,48,54',
}, {
  ...workflowOverrides(getMethod('rim')),
  methodParams: {
    ...workflowOverrides(getMethod('rim')).methodParams,
    fuzzyInputMode: 'Defuzzify on upload',
    rimReference: 'Manual ideal interval',
    rimDomainLower: '5,7,9,11,13,15,17',
    rimDomainUpper: '20,26,32,38,44,50,56',
    rimIdealLower: '6,8,10,12,14,16,18',
    rimIdealUpper: '18,24,30,36,42,48,54',
  },
});
await assertWorkbookTableParamRoundTrip('lopm', 'LoPM Property Limits', 'Criterion ID', 'C1', 'Mode', 'Manual property limits', {
  lopmLimitsMode: 'Manual property limits',
  lopmPropertyTypes: 'lower,lower,lower,lower,lower,lower,lower',
  lopmPropertyLimits: '6,8,10,12,14,16,18',
}, {
  ...workflowOverrides(getMethod('lopm')),
  methodParams: {
    ...workflowOverrides(getMethod('lopm')).methodParams,
    fuzzyInputMode: 'Defuzzify on upload',
    lopmLimitsMode: 'Manual property limits',
    lopmPropertyTypes: 'lower,lower,lower,lower,lower,lower,lower',
    lopmPropertyLimits: '6,8,10,12,14,16,18',
  },
});
await assertWorkbookTableParamRoundTrip('ervd', 'ERVD Reference Point', 'Criterion ID', 'C1', 'Mode', 'Manual reference point', {
  ervdReferenceMode: 'Manual reference point',
  ervdReferencePoint: '6,8,10,12,14,16,18',
}, {
  ...workflowOverrides(getMethod('ervd')),
  methodParams: {
    ...workflowOverrides(getMethod('ervd')).methodParams,
    fuzzyInputMode: 'Defuzzify on upload',
    ervdReferenceMode: 'Manual reference point',
    ervdReferencePoint: '6,8,10,12,14,16,18',
  },
});
await assertWorkbookParamRoundTrip('vikor', 'SRF Cards Parameters', 'Card groups', 'C7 | C1,C5 | C3,C6 | C4 | C2', 'simosGroups', {
  ...workflowOverrides(getMethod('vikor')),
  weightingId: 'simos',
});
await assertWorkbookParamRoundTrip('vikor', 'SRF Cards Parameters', 'Blank cards between groups', '0,1,0,2', 'simosBlankCards', {
  ...workflowOverrides(getMethod('vikor')),
  weightingId: 'simos',
});
await assertWorkbookParamRoundTrip('vikor', 'SRF Cards Parameters', 'Z ratio', 3, 'simosZRatio', {
  ...workflowOverrides(getMethod('vikor')),
  weightingId: 'simos',
});
await assertWorkbookParamRoundTrip('dematel', 'Threshold Settings', 'Manual threshold value', 0.2, 'dematelManualThreshold', {
  methodParams: {
    ...workflowOverrides(getMethod('dematel')).methodParams,
    dematelThreshold: 'Manual threshold',
  },
});
await assertCorruptWorkbookRejected('ahp', (workbook) => {
  setTableCell(workbook, 'Criteria Pairwise Matrix', 'Criterion', 'C1', 'C2', '');
}, 'Criteria Pairwise Matrix', 'Pairwise values must be positive numbers', workflowOverrides(getMethod('ahp')));
await assertCorruptWorkbookRejected('topsis', (workbook) => {
  setTableCell(workbook, 'Decision Matrix', 'Alternative ID', 'S1', 'C1', 'not numeric');
}, 'Decision Matrix', 'Decision matrix values must be numeric', workflowOverrides(getMethod('topsis')));
await assertCorruptWorkbookRejected('vikor', (workbook) => {
  setSheetValue(workbook, 'SRF Cards Parameters', 'Card groups', 'C1 | C2,C2 | C3');
}, 'SRF Cards Parameters', 'must list every criterion ID exactly once', {
  ...workflowOverrides(getMethod('vikor')),
  weightingId: 'simos',
});
const { analysis } = workflowResults.find((item) => item.method.id === 'topsis') ?? workflowResults[0];
const ahpAnalysis = workflowResults.find((item) => item.method.id === 'ahp')?.analysis;
const dematelAnalysis = workflowResults.find((item) => item.method.id === 'dematel')?.analysis;
if (!ahpAnalysis) {
  throw new Error('AHP analysis was not produced for export evidence verification.');
}
if (!dematelAnalysis) {
  throw new Error('DEMATEL analysis was not produced for export evidence verification.');
}

const originalCwd = process.cwd();
const exportDir = resolve(outDir, 'exports');
mkdirSync(exportDir, { recursive: true });
process.chdir(exportDir);

const clickedDownloads = [];
const originalDocument = globalThis.document;
const originalUrl = globalThis.URL;
globalThis.document = {
  createElement: () => ({
    href: '',
    download: '',
    click() {
      clickedDownloads.push(this.download);
    },
  }),
};
globalThis.URL = {
  ...URL,
  createObjectURL: () => 'blob:workflow-smoke',
  revokeObjectURL: () => undefined,
};

try {
  for (const result of workflowResults) {
    await exportAnalysisWorkbook(result.analysis);
  }
  await exportDocx(analysis);
  await exportPdf(analysis);
  exportProject(sampleConfig, analysis.input, 5, 'Final Result', ['topsis'], 0);
} finally {
  process.chdir(originalCwd);
  globalThis.document = originalDocument;
  globalThis.URL = originalUrl;
}

for (const result of workflowResults) {
  const expectedWorkbook = resolve(exportDir, safeFileName(`${result.analysis.methodName}-analysis-package.xlsx`));
  if (!existsSync(expectedWorkbook)) {
    throw new Error(`${result.analysis.methodName} Excel analysis package was not written.`);
  }
}
const expectedWorkbook = resolve(exportDir, safeFileName(`${ahpAnalysis.methodName}-analysis-package.xlsx`));
const exportedWorkbook = XLSX.read(readFileSync(expectedWorkbook));
['Method Summary', 'Parameters', 'Calculation Steps', 'Analyzed Decision Matrix', 'Validation Summary', 'Reproducibility', 'Validation Evidence'].forEach((sheetName) => {
  if (!exportedWorkbook.Sheets[sheetName]) {
    throw new Error(`Exported workbook is missing ${sheetName}.`);
  }
});
const dematelWorkbook = XLSX.read(readFileSync(resolve(exportDir, safeFileName(`${dematelAnalysis.methodName}-analysis-package.xlsx`))));
if (!dematelWorkbook.Sheets['Analyzed Direct Relation Matrix']) {
  throw new Error('Exported DEMATEL workbook is missing Analyzed Direct Relation Matrix.');
}
const evidenceRows = XLSX.utils.sheet_to_json(exportedWorkbook.Sheets['Validation Evidence'], { header: 1, defval: '' });
const evidenceText = evidenceRows.flat().join(' ');
if (!evidenceText.includes('10.3390/en19092214') || !evidenceText.includes('https://www.mdpi.com/1996-1073/19/9/2214')) {
  throw new Error('Exported workbook Validation Evidence sheet is missing external fixture DOI or source URL.');
}
if (!evidenceText.includes('Certification status') || !evidenceText.includes('Not publication-certified for every variant')) {
  throw new Error('Exported workbook Validation Evidence sheet is missing certification boundary text.');
}
if (!evidenceText.includes('Selected method validation status') || !evidenceText.includes('Externally validated') || !evidenceText.includes('passing published-example fixture')) {
  throw new Error('Exported workbook Validation Evidence sheet is missing selected-method validation status.');
}
['Input type', 'Respondent/group aggregation', 'Expert aggregation', 'Fuzzy calculation convention'].forEach((label) => {
  if (!evidenceText.includes(label)) {
    throw new Error(`Exported workbook Validation Evidence sheet is missing study mode evidence row: ${label}.`);
  }
});

const expectedDocxDownload = safeFileName(`${analysis.methodName}-research-report.docx`);
if (!clickedDownloads.includes(expectedDocxDownload)) {
  throw new Error(`Export download hook did not fire for: ${expectedDocxDownload}`);
}
if (!clickedDownloads.includes('mcdm-studio-project.json')) {
  throw new Error('Export download hook did not fire for the project JSON reproducibility file.');
}
const expectedPdf = resolve(exportDir, safeFileName(`${analysis.methodName}-publication-report.pdf`));
if (!existsSync(expectedPdf)) {
  throw new Error('PDF publication report was not written.');
}

console.log(`Workflow smoke OK: ${workflowResults.length}/${methodRegistry.length} method templates parsed and analyzed; criteria/factor structure edits stay canonical across all methods; wrong-method templates, malformed project imports, corrupted metadata/AHP/VIKOR/SRF uploads, invalid method settings, and invalid matrix cells rejected; automatic weights ignore edited workbook weight cells; Pugh uploaded-score templates round-trip and rescale correctly; multiple-respondent workbook sheets aggregate and report correctly; DEMATEL expert workbook sheets aggregate and report correctly; DEMATEL fuzzy calculation convention round-trips and records reproducibility metadata; TOPSIS normalization settings are covered; AHP group pairwise workbook aggregation/settings are covered; PROMETHEE and COMET settings are covered; fuzzy workbook tuples reach native and defuzzified paths; uploaded method, MAUT/SMARTER utility-input modes, editable method settings sheets, sheet-shaped reference modes/vectors, and SRF parameters round-tripped; ${workflowResults.length}/${methodRegistry.length} Excel packages written; validation evidence is included in Excel/DOCX/PDF paths; ${analysis.methodName} DOCX/PDF export paths and project JSON package download completed.`);
