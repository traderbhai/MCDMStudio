import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, '.tmp-demo-upload-smoke');
const compiledDir = resolve(outDir, 'compiled');
const demoWorkbookDir = resolve(outDir, 'demo-workbooks');
const exportDir = resolve(outDir, 'analysis-exports');
const tsc = resolve(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
const tsconfig = resolve(outDir, 'tsconfig.json');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(compiledDir, { recursive: true });
mkdirSync(demoWorkbookDir, { recursive: true });
mkdirSync(exportDir, { recursive: true });
writeFileSync(resolve(compiledDir, 'package.json'), '{"type":"commonjs"}\n');
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
    outDir: 'compiled',
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

execFileSync(
  process.platform === 'win32' ? 'cmd.exe' : tsc,
  process.platform === 'win32' ? ['/c', tsc, '-p', tsconfig] : ['-p', tsconfig],
  { cwd: root, stdio: 'pipe' },
);

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
const { methodRegistry } = require(resolve(compiledDir, 'core', 'methods.js'));
const { sampleConfig } = require(resolve(compiledDir, 'data', 'sampleStudy.js'));
const { parseWorkbook } = require(resolve(compiledDir, 'services', 'workbook.js'));
const { exportAnalysisWorkbook, exportDocx, exportPdf } = require(resolve(compiledDir, 'services', 'exports.js'));
const { exportProject } = require(resolve(compiledDir, 'services', 'project.js'));

function safeFileName(name) {
  return name
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .trim()
    .replace(/[. ]+$/g, '') || 'mcdm-studio-artifact';
}

function methodDefaultParams(method) {
  return Object.fromEntries((method.specificationFields ?? []).map((field) => [field.key, field.defaultValue]));
}

function demoConfig(method, overrides = {}) {
  const nativeFuzzyMode = method.fuzzySupport?.mode === 'native-fuzzy'
    ? method.fuzzySupport.nativeModeLabel
    : undefined;
  const methodParams = {
    ...sampleConfig.methodParams,
    ...methodDefaultParams(method),
    ...(nativeFuzzyMode ? { fuzzyInputMode: nativeFuzzyMode } : {}),
    ...(overrides.methodParams ?? {}),
  };

  if (method.id === 'ahp') {
    methodParams.ahpPairwiseMode = 'Criteria and alternatives';
  }
  if (method.id === 'dematel') {
    methodParams.dataInputMode = 'Multiple experts';
    methodParams.dematelExpertCount = 2;
    methodParams.fuzzyInputMode = nativeFuzzyMode ?? 'Defuzzify on upload';
  }
  if (method.id === 'spotis') methodParams.spotisBounds = 'Observed data range';
  if (method.id === 'rim') methodParams.rimReference = 'Observed ideal point';
  if (method.id === 'lopm') methodParams.lopmLimitsMode = 'Observed limits';
  if (method.id === 'ervd') methodParams.ervdReferenceMode = 'Observed mean';

  return {
    ...sampleConfig,
    ...overrides,
    title: `Demo upload QA - ${method.name}`,
    methodId: method.id,
    weightingId: method.id === 'ahp' ? 'ahp' : method.supportsWeights ? 'equal' : sampleConfig.weightingId,
    methodParams,
  };
}

function buildWorkbook(method, config) {
  const workbook = XLSX.utils.book_new();
  method.getTemplateSchema(config).forEach((sheet) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
  });
  return workbook;
}

function finiteRows(table) {
  return table.rows.every((row) => row.every((cell) => (
    typeof cell === 'number' ? Number.isFinite(cell) : String(cell ?? '').trim() !== ''
  )));
}

async function uploadedAnalysisFor(method) {
  const config = demoConfig(method);
  const workbook = buildWorkbook(method, config);
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  const workbookPath = resolve(demoWorkbookDir, safeFileName(`${method.name}-native-demo-upload.xlsx`));
  writeFileSync(workbookPath, buffer);

  const file = new File([buffer], `${method.name}-native-demo-upload.xlsx`, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const parsed = await parseWorkbook(file, config);
  if (!parsed.validation.ok) {
    throw new Error(`${method.name} demo upload failed validation: ${parsed.validation.issues.map((issue) => `${issue.sheet} ${issue.location}: ${issue.message}`).join('; ')}`);
  }

  const analysis = method.runAnalysis(parsed.input, parsed.config ?? config);
  if (!analysis.tables.length) throw new Error(`${method.name} produced no intermediate/output tables.`);
  if (!analysis.ranking.length) throw new Error(`${method.name} produced no final result rows.`);
  if (!analysis.visualizations.length) throw new Error(`${method.name} produced no visualization data.`);
  if (!analysis.diagnostics.length) throw new Error(`${method.name} produced no diagnostics.`);
  if (!analysis.tables.every(finiteRows)) throw new Error(`${method.name} has empty or non-finite values in output tables.`);
  if (!analysis.ranking.every((row) => Number.isFinite(row.score) && Number.isFinite(row.rank))) {
    throw new Error(`${method.name} has invalid ranking scores.`);
  }
  const expectedFuzzyMode = method.fuzzySupport?.nativeModeLabel;
  if (expectedFuzzyMode && !String(analysis.reproducibility.fuzzyMode ?? '').includes(expectedFuzzyMode)) {
    throw new Error(`${method.name} did not record the expected native fuzzy mode: ${expectedFuzzyMode}.`);
  }

  return {
    method,
    config: parsed.config ?? config,
    input: parsed.input,
    validationIssueCount: parsed.validation.issues.length,
    analysis,
    workbookPath,
  };
}

const originalCwd = process.cwd();
const originalDocument = globalThis.document;
const originalUrl = globalThis.URL;
const clickedDownloads = [];
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
  createObjectURL: () => 'blob:demo-upload-smoke',
  revokeObjectURL: () => undefined,
};

const results = [];
try {
  process.chdir(exportDir);
  for (const method of methodRegistry) {
    const result = await uploadedAnalysisFor(method);
    results.push(result);
    await exportAnalysisWorkbook(result.analysis);
  }

  for (const requiredMethodId of ['topsis', 'ahp', 'dematel']) {
    const result = results.find((item) => item.method.id === requiredMethodId);
    if (!result) throw new Error(`Missing ${requiredMethodId} result for publication export smoke.`);
    await exportDocx(result.analysis);
    await exportPdf(result.analysis);
  }
  const projectResult = results.find((item) => item.method.id === 'topsis') ?? results[0];
  exportProject(projectResult.config, projectResult.input, 5, 'Final Result', ['topsis'], 0);
} finally {
  process.chdir(originalCwd);
  globalThis.document = originalDocument;
  globalThis.URL = originalUrl;
}

for (const result of results) {
  const exportPath = resolve(exportDir, safeFileName(`${result.analysis.methodName}-analysis-package.xlsx`));
  if (!existsSync(exportPath)) {
    throw new Error(`${result.method.name} analysis workbook export was not created.`);
  }
  const exportedWorkbook = XLSX.read(readFileSync(exportPath));
  for (const sheetName of ['Method Summary', 'Parameters', 'Calculation Steps', 'Validation Summary', 'Reproducibility', 'Validation Evidence']) {
    if (!exportedWorkbook.Sheets[sheetName]) {
      throw new Error(`${result.method.name} exported workbook is missing ${sheetName}.`);
    }
  }
}

for (const methodName of ['TOPSIS', 'AHP', 'DEMATEL']) {
  if (!clickedDownloads.includes(safeFileName(`${methodName}-research-report.docx`))) {
    throw new Error(`${methodName} DOCX download hook did not fire.`);
  }
  const pdfPath = resolve(exportDir, safeFileName(`${methodName}-publication-report.pdf`));
  if (!existsSync(pdfPath)) {
    throw new Error(`${methodName} PDF export was not created.`);
  }
}
if (!clickedDownloads.includes('mcdm-studio-project.json')) {
  throw new Error('Project JSON export hook did not fire.');
}

const summaryRows = results.map((item) => ({
  method: item.method.name,
  workbook: item.workbookPath,
  topResult: item.analysis.ranking[0]?.alternative ?? 'N/A',
  topScore: item.analysis.ranking[0]?.score ?? 'N/A',
  tables: item.analysis.tables.length,
  diagnostics: item.analysis.diagnostics.length,
  visualizations: item.analysis.visualizations.length,
  validationIssues: item.validationIssueCount,
  fuzzyMode: item.analysis.reproducibility.fuzzyMode ?? 'Not reported',
}));
writeFileSync(resolve(outDir, 'demo-upload-summary.json'), JSON.stringify(summaryRows, null, 2));

console.log(`Demo upload smoke OK: ${results.length}/${methodRegistry.length} realistic demo workbooks uploaded, validated, analyzed, and Excel-exported. Native fuzzy mode recorded for all native-fuzzy methods. TOPSIS, AHP, and DEMATEL DOCX/PDF exports plus project JSON were exercised. Artifacts: ${outDir}`);
