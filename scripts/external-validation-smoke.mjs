import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixturesDir = resolve(root, 'docs', 'external-fixtures');
const outDir = resolve(root, '.tmp-external-validation');
const tsc = resolve(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
const tsconfig = resolve(outDir, 'tsconfig.json');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function almostEqual(actual, expected, tolerance) {
  return Math.abs(Number(actual) - Number(expected)) <= tolerance;
}

function fixtureFiles() {
  if (!existsSync(fixturesDir)) return [];
  return readdirSync(fixturesDir)
    .filter((file) => extname(file).toLowerCase() === '.json')
    .map((file) => resolve(fixturesDir, file));
}

const files = fixtureFiles();
const fixturePayloads = files.map((file) => ({ file, fixture: JSON.parse(readFileSync(file, 'utf8')) }));
const activePayloads = fixturePayloads.filter(({ fixture }) => fixture.status !== 'candidate-discrepancy');
const candidatePayloads = fixturePayloads.filter(({ fixture }) => fixture.status === 'candidate-discrepancy');

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
    '../src/core/methods.ts',
    '../src/data/sampleStudy.ts',
    '../src/core/validationEvidence.ts',
  ],
}, null, 2));

execFileSync(process.platform === 'win32' ? 'cmd.exe' : tsc, process.platform === 'win32' ? ['/c', tsc, '-p', tsconfig] : ['-p', tsconfig], { cwd: root, stdio: 'pipe' });

const require = createRequire(import.meta.url);
const { getMethod } = require(resolve(outDir, 'core', 'methods.js'));
const { sampleConfig } = require(resolve(outDir, 'data', 'sampleStudy.js'));
const { externalValidationFixtures, validationEvidence } = require(resolve(outDir, 'core', 'validationEvidence.js'));

if (validationEvidence.externalBenchmarks.count !== activePayloads.length) {
  fail(`External validation evidence count mismatch: evidence says ${validationEvidence.externalBenchmarks.count}, active fixture folder has ${activePayloads.length}.`);
}

if (externalValidationFixtures.length !== activePayloads.length) {
  fail(`External validation fixture registry mismatch: registry has ${externalValidationFixtures.length}, active fixture folder has ${activePayloads.length}.`);
}

function validateFixtureShape(fixture, file) {
  const required = ['methodId', 'variant', 'source', 'sourceUrl', 'config', 'input', 'expected'];
  const missing = required.filter((key) => fixture[key] == null);
  if (missing.length) fail(`${file}: missing required field(s): ${missing.join(', ')}`);
  if (!/^https?:\/\//i.test(String(fixture.sourceUrl))) fail(`${file}: sourceUrl must be an http(s) URL.`);
  if (!fixture.doi && !/doi/i.test(String(fixture.source))) fail(`${file}: fixture should include a DOI field or DOI text in source.`);
  if (fixture.doi && !/^\d{2}\.\S+\/\S+$/i.test(String(fixture.doi))) fail(`${file}: doi must look like a DOI, for example 10.xxxx/yyyy.`);
  if (String(fixture.source).trim().length < 40) fail(`${file}: source must identify the publication/example with enough detail to audit it.`);
  if (!Array.isArray(fixture.input.alternatives)) fail(`${file}: input.alternatives must be an array.`);
  if (!Array.isArray(fixture.input.criteria)) fail(`${file}: input.criteria must be an array.`);
  if (!Array.isArray(fixture.input.values)) fail(`${file}: input.values must be an array.`);
  if (!fixture.expected.ranking?.length && !fixture.expected.scores?.length && !fixture.expected.tables?.length && !fixture.expected.diagnostics?.length) {
    fail(`${file}: expected must include ranking, scores, tables, or diagnostics.`);
  }
}

function validateActiveFixtureStrength(fixture, file) {
  if (!fixture.doi) fail(`${file}: active external fixtures must include an explicit DOI field.`);
  const checksAhpPriorities = fixture.methodId === 'ahp' && (fixture.expected.tables ?? []).some((table) => table.id === 'criteria-priority');
  const checksOutrankingRelation = (fixture.expected.tables ?? []).some((table) => table.id === 'outranking');
  if (!fixture.expected.ranking?.length && !fixture.expected.scores?.length && !checksAhpPriorities && !checksOutrankingRelation) {
    fail(`${file}: active external fixtures must check final ranking, final scores, AHP criteria priorities, or an outranking relation.`);
  }
  if (!fixture.expected.tables?.length && !fixture.expected.diagnostics?.length) {
    fail(`${file}: active external fixtures must check at least one intermediate table or diagnostic.`);
  }
  const checkedCellCount = (fixture.expected.tables ?? []).reduce((sum, table) => sum + (table.cells?.length ?? 0), 0);
  if (!fixture.expected.diagnostics?.length && checkedCellCount < 2) {
    fail(`${file}: active external fixtures without diagnostics must check at least two intermediate table cells.`);
  }
}

function runFixture(file) {
  const fixture = JSON.parse(readFileSync(file, 'utf8'));
  validateFixtureShape(fixture, file);
  validateActiveFixtureStrength(fixture, file);
  const registryEntry = externalValidationFixtures.find((item) => item.methodId === fixture.methodId && item.variant === fixture.variant);
  if (!registryEntry) fail(`${file}: no matching externalValidationFixtures registry entry.`);
  if (registryEntry.sourceUrl !== fixture.sourceUrl) fail(`${file}: registry sourceUrl does not match fixture sourceUrl.`);
  if (fixture.doi && registryEntry.doi !== fixture.doi) fail(`${file}: registry DOI does not match fixture DOI.`);
  const method = getMethod(fixture.methodId);
  const config = {
    ...sampleConfig,
    ...fixture.config,
    methodId: fixture.methodId,
    methodParams: {
      ...sampleConfig.methodParams,
      ...(fixture.config.methodParams ?? {}),
    },
  };
  const input = {
    alternatives: fixture.input.alternatives,
    criteria: fixture.input.criteria,
    values: fixture.input.values,
    respondentMatrices: fixture.input.respondentMatrices,
    respondentFuzzyMatrices: fixture.input.respondentFuzzyMatrices,
    expertMatrices: fixture.input.expertMatrices,
    expertFuzzyMatrices: fixture.input.expertFuzzyMatrices,
    fuzzyValues: fixture.input.fuzzyValues,
    fuzzyCellCount: fixture.input.fuzzyCellCount,
    fuzzyTypes: fixture.input.fuzzyTypes,
  };
  const tolerance = Number(fixture.tolerance ?? 0.0001);
  const result = method.runAnalysis(input, config);

  if (fixture.expected.ranking?.length) {
    fixture.expected.ranking.forEach((expected, index) => {
      const actual = result.ranking[index];
      if (!actual) fail(`${file}: expected ranking row ${index + 1}, but result is missing it.`);
      if (expected.alternative && actual.alternative !== expected.alternative) {
        fail(`${file}: rank ${index + 1} expected ${expected.alternative}, received ${actual.alternative}.`);
      }
      if (expected.score != null && !almostEqual(actual.score, expected.score, tolerance)) {
        fail(`${file}: ${actual.alternative} score expected ${expected.score}, received ${actual.score}.`);
      }
    });
  }

  if (fixture.expected.scores?.length) {
    fixture.expected.scores.forEach((expected) => {
      const actual = result.ranking.find((row) => row.alternativeId === expected.alternativeId || row.alternative === expected.alternative);
      if (!actual) fail(`${file}: expected score target ${expected.alternativeId ?? expected.alternative} was not found.`);
      if (!almostEqual(actual.score, expected.score, tolerance)) {
        fail(`${file}: score for ${actual.alternative} expected ${expected.score}, received ${actual.score}.`);
      }
    });
  }

  if (fixture.expected.tables?.length) {
    fixture.expected.tables.forEach((expectedTable) => {
      const table = result.tables.find((item) => item.id === expectedTable.id || item.title === expectedTable.title);
      if (!table) fail(`${file}: expected table ${expectedTable.id ?? expectedTable.title} was not produced.`);
      (expectedTable.cells ?? []).forEach((cell) => {
        const actual = table.rows[cell.row]?.[cell.column];
        if (actual == null) fail(`${file}: table ${table.title} missing cell ${cell.row},${cell.column}.`);
        if (typeof cell.value === 'number' && !almostEqual(actual, cell.value, tolerance)) {
          fail(`${file}: table ${table.title} cell ${cell.row},${cell.column} expected ${cell.value}, received ${actual}.`);
        }
        if (typeof cell.value !== 'number' && String(actual) !== String(cell.value)) {
          fail(`${file}: table ${table.title} cell ${cell.row},${cell.column} expected ${cell.value}, received ${actual}.`);
        }
      });
    });
  }

  if (fixture.expected.diagnostics?.length) {
    fixture.expected.diagnostics.forEach((expected) => {
      const diagnostic = result.diagnostics.find((item) => item.label === expected.label);
      if (!diagnostic) fail(`${file}: expected diagnostic ${expected.label} was not produced.`);
      if (expected.status && diagnostic.status !== expected.status) {
        fail(`${file}: diagnostic ${expected.label} expected status ${expected.status}, received ${diagnostic.status}.`);
      }
    });
  }

  return `${fixture.methodId} ${fixture.variant} (${fixture.source})`;
}

function runCandidate({ file, fixture }) {
  validateFixtureShape(fixture, file);
  if (!fixture.discrepancy) fail(`${file}: candidate-discrepancy fixtures must explain the observed discrepancy.`);
  if (!fixture.appObserved?.ranking?.length && !fixture.appObserved?.scores?.length) {
    fail(`${file}: candidate-discrepancy fixtures must preserve observed app ranking or scores.`);
  }
  if (!Array.isArray(fixture.auditedVariants) || fixture.auditedVariants.length < 3) {
    fail(`${file}: candidate-discrepancy fixtures must list audited TOPSIS/MCDM variants that were checked before retaining the discrepancy.`);
  }
  const method = getMethod(fixture.methodId);
  const config = {
    ...sampleConfig,
    ...fixture.config,
    methodId: fixture.methodId,
    methodParams: {
      ...sampleConfig.methodParams,
      ...(fixture.config.methodParams ?? {}),
    },
  };
  const input = {
    alternatives: fixture.input.alternatives,
    criteria: fixture.input.criteria,
    values: fixture.input.values,
    respondentMatrices: fixture.input.respondentMatrices,
    respondentFuzzyMatrices: fixture.input.respondentFuzzyMatrices,
    expertMatrices: fixture.input.expertMatrices,
    expertFuzzyMatrices: fixture.input.expertFuzzyMatrices,
    fuzzyValues: fixture.input.fuzzyValues,
    fuzzyCellCount: fixture.input.fuzzyCellCount,
    fuzzyTypes: fixture.input.fuzzyTypes,
  };
  const tolerance = Number(fixture.tolerance ?? 0.0001);
  const result = method.runAnalysis(input, config);
  const publishedRankingMatches = !fixture.expected?.ranking?.length || fixture.expected.ranking.every((expected, index) => {
    const actual = result.ranking[index];
    return actual && (!expected.alternative || actual.alternative === expected.alternative)
      && (expected.score == null || almostEqual(actual.score, expected.score, tolerance));
  });
  const publishedScoresMatch = !fixture.expected?.scores?.length || fixture.expected.scores.every((expected) => {
    const actual = result.ranking.find((row) => row.alternativeId === expected.alternativeId || row.alternative === expected.alternative);
    return actual && almostEqual(actual.score, expected.score, tolerance);
  });
  if (publishedRankingMatches && publishedScoresMatch) {
    fail(`${file}: candidate-discrepancy now matches the published expected result; promote it to an active external fixture instead of keeping it as a candidate.`);
  }
  (fixture.appObserved?.scores ?? []).forEach((expected) => {
    const actual = result.ranking.find((row) => row.alternativeId === expected.alternativeId || row.alternative === expected.alternative);
    if (!actual) fail(`${file}: observed candidate score target ${expected.alternativeId ?? expected.alternative} was not found.`);
    if (!almostEqual(actual.score, expected.score, tolerance)) {
      fail(`${file}: observed candidate score for ${actual.alternative} expected ${expected.score}, received ${actual.score}.`);
    }
  });
  (fixture.appObserved?.ranking ?? []).forEach((expected, index) => {
    const actual = result.ranking[index];
    if (!actual) fail(`${file}: observed candidate ranking row ${index + 1}, but result is missing it.`);
    if (expected.alternative && actual.alternative !== expected.alternative) {
      fail(`${file}: observed candidate rank ${index + 1} expected ${expected.alternative}, received ${actual.alternative}.`);
    }
  });
  (fixture.appObserved?.tables ?? []).forEach((expectedTable) => {
    const table = result.tables.find((item) => item.id === expectedTable.id || item.title === expectedTable.title);
    if (!table) fail(`${file}: observed candidate table ${expectedTable.id ?? expectedTable.title} was not produced.`);
    (expectedTable.cells ?? []).forEach((cell) => {
      const actual = table.rows[cell.row]?.[cell.column];
      if (actual == null) fail(`${file}: observed candidate table ${table.title} missing cell ${cell.row},${cell.column}.`);
      if (typeof cell.value === 'number' && !almostEqual(actual, cell.value, tolerance)) {
        fail(`${file}: observed candidate table ${table.title} cell ${cell.row},${cell.column} expected ${cell.value}, received ${actual}.`);
      }
      if (typeof cell.value !== 'number' && String(actual) !== String(cell.value)) {
        fail(`${file}: observed candidate table ${table.title} cell ${cell.row},${cell.column} expected ${cell.value}, received ${actual}.`);
      }
    });
  });
  return `${fixture.methodId} ${fixture.variant}`;
}

const passed = activePayloads.map(({ file }) => runFixture(file));
const candidates = candidatePayloads.map(runCandidate);
console.log(`External validation fixtures OK: ${passed.length} active fixture${passed.length === 1 ? '' : 's'}${passed.length ? `; ${passed.join('; ')}` : ' currently registered'}${candidates.length ? `. ${candidates.length} discrepancy candidate${candidates.length === 1 ? '' : 's'} tracked: ${candidates.join('; ')}` : ''}.`);
