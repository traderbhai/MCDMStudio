import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, '.tmp-algorithm-smoke');
const tsc = resolve(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
const smokeTsconfig = resolve(outDir, 'tsconfig.json');
const methodsSource = readFileSync(resolve(root, 'src', 'core', 'methods.ts'), 'utf8');
const benchmarkSource = readFileSync(resolve(root, 'scripts', 'benchmark-tests.mjs'), 'utf8');

if (/methodRegistry\[\d+\]/.test(methodsSource)) {
  console.error('Method registry source check failed: use ID-based getMethod lookups instead of positional methodRegistry[index] references.');
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'package.json'), '{"type":"commonjs"}\n');
writeFileSync(smokeTsconfig, JSON.stringify({
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
  files: ['../src/core/smokeChecks.ts', '../src/core/coverage.ts', '../src/core/validationEvidence.ts', '../src/core/benchmarkCoverage.ts'],
}, null, 2));

const tscArgs = [
  '-p', smokeTsconfig,
];
execFileSync(process.platform === 'win32' ? 'cmd.exe' : tsc, process.platform === 'win32' ? ['/c', tsc, ...tscArgs] : tscArgs, { cwd: root, stdio: 'pipe' });

const require = createRequire(import.meta.url);
const { methodRegistry } = require(resolve(outDir, 'core', 'methods.js'));
const { sampleConfig } = require(resolve(outDir, 'data', 'sampleStudy.js'));
const { methodCoverageItems } = require(resolve(outDir, 'core', 'coverage.js'));
const { bundledBenchmarkMethodIds, benchmarkCoverageLabel } = require(resolve(outDir, 'core', 'benchmarkCoverage.js'));
const { runAlgorithmSmokeChecks, runTemplateSmokeChecks, runReportContentSmokeChecks, runZeroValueSmokeChecks, runValidationSmokeChecks, runRegistryIntegritySmokeChecks, runGroupDecisionSmokeChecks, runFuzzyInputSmokeChecks, runNativeFuzzyCrispEquivalenceSmokeChecks } = require(resolve(outDir, 'core', 'smokeChecks.js'));
const registryChecks = runRegistryIntegritySmokeChecks();
const algorithmChecks = runAlgorithmSmokeChecks();
const groupDecisionChecks = runGroupDecisionSmokeChecks();
const fuzzyInputChecks = runFuzzyInputSmokeChecks();
const fuzzyEquivalenceChecks = runNativeFuzzyCrispEquivalenceSmokeChecks();
const zeroValueChecks = runZeroValueSmokeChecks();
const validationChecks = runValidationSmokeChecks();
const templateChecks = runTemplateSmokeChecks();
const reportChecks = runReportContentSmokeChecks();
const coverageChecks = methodRegistry.map((method) => {
  const config = { ...sampleConfig, methodId: method.id, weightingId: method.supportsWeights ? sampleConfig.weightingId : 'manual' };
  const items = methodCoverageItems(method, config, algorithmChecks.length, algorithmChecks.length);
  const labels = items.map((item) => item.label);
  const requiredLabels = ['Method family', 'Group data', 'Fuzzy data', 'Template validation', 'Automated QA', 'Numerical evidence', 'Evidence boundary'];
  const missing = requiredLabels.filter((label) => !labels.includes(label));
  return {
    method: method.name,
    passed: missing.length === 0 && items.every((item) => item.value && !String(item.value).includes('undefined')),
    message: missing.length ? `Coverage summary missing ${missing.join(', ')}` : 'Coverage summary is complete.',
  };
});
const benchmarkLabelToMethodId = {
  TOPSIS: 'topsis',
  AHP: 'ahp',
  SAW: 'saw',
  SRP: 'srp',
  FUCA: 'fuca',
  SECA: 'seca',
  DEAR: 'dear',
  EAMR: 'eamr',
  RAWEC: 'rawec',
  COMET: 'comet',
  WPM: 'wpm',
  MOOSRA: 'moosra',
  ARLON: 'arlon',
  MACONT: 'macont',
  WASPAS: 'waspas',
  VIKOR: 'vikor',
  COPRAS: 'copras',
  MOORA: 'moora',
  MULTIMOORA: 'multimoora',
  ARAS: 'aras',
  MABAC: 'mabac',
  CODAS: 'codas',
  CoCoSo: 'cocoso',
  MAIRCA: 'mairca',
  EDAS: 'edas',
  DEMATEL: 'dematel',
  GRA: 'gra',
  RAM: 'ram',
  CRADIS: 'cradis',
  MARA: 'mara',
  RAPS: 'raps',
  ORESTE: 'oreste',
  QUALIFLEX: 'qualiflex',
  REGIME: 'regime',
  EVAMIX: 'evamix',
  MARCOS: 'marcos',
  SMART: 'smart',
  MAUT: 'maut',
  OCRA: 'ocra',
  PSI: 'psi',
  PIV: 'piv',
  ROV: 'rov',
  WISP: 'wisp',
  TODIM: 'todim',
  GRP: 'grp',
  SPOTIS: 'spotis',
  'ESP-SPOTIS': 'espSpotis',
  'B-SPOTIS': 'balancedSpotis',
  WEDBA: 'wedba',
  LMAW: 'lmaw',
  DNMA: 'dnma',
  PROBID: 'probid',
  RIM: 'rim',
  RAFSI: 'rafsi',
  LoPM: 'lopm',
  AROMAN: 'aroman',
  COBRA: 'cobra',
  ERVD: 'ervd',
  PROMETHEE: 'promethee',
  ELECTRE: 'electre',
};
const benchmarkedMethodIds = Array.from(new Set(
  [...benchmarkSource.matchAll(/\['([^']+) (?:top alternative|compromise alternative|top prominence factor)'/g)]
    .map((match) => benchmarkLabelToMethodId[match[1]])
    .filter(Boolean),
));
const missingCoverageForBenchmarkedMethods = benchmarkedMethodIds.filter((id) => !bundledBenchmarkMethodIds.includes(id));
const benchmarkCoverageChecks = [
  {
    method: 'Benchmark coverage',
    passed: bundledBenchmarkMethodIds.every((id) => methodRegistry.some((method) => method.id === id)),
    message: 'All bundled benchmark method IDs exist in the registry.',
  },
  {
    method: 'Benchmark coverage labels',
    passed: methodRegistry.every((method) => benchmarkCoverageLabel(method.id).includes('Selected method')),
    message: 'Every method has a benchmark coverage label.',
  },
  {
    method: 'Benchmark coverage sync',
    passed: missingCoverageForBenchmarkedMethods.length === 0,
    message: missingCoverageForBenchmarkedMethods.length
      ? `Coverage metadata is missing benchmarked methods: ${missingCoverageForBenchmarkedMethods.join(', ')}.`
      : 'Coverage metadata includes every method with a named numerical benchmark.',
  },
];
const checks = [...registryChecks, ...algorithmChecks, ...groupDecisionChecks, ...fuzzyInputChecks, ...fuzzyEquivalenceChecks, ...zeroValueChecks, ...validationChecks, ...templateChecks, ...reportChecks, ...coverageChecks, ...benchmarkCoverageChecks];
const failures = checks.filter((check) => !check.passed);

if (failures.length) {
  failures.forEach((failure) => {
    console.error(`${failure.method}: ${failure.message}`);
  });
  process.exit(1);
}

console.log(`Registry smoke checks OK: ${registryChecks.length}/${registryChecks.length} registry integrity checks passed; ${algorithmChecks.length}/${algorithmChecks.length} methods run with valid output tables and rankings; ${groupDecisionChecks.length}/${groupDecisionChecks.length} group decision checks passed; ${fuzzyInputChecks.length}/${fuzzyInputChecks.length} fuzzy input checks passed; ${fuzzyEquivalenceChecks.length}/${fuzzyEquivalenceChecks.length} native fuzzy crisp-equivalence checks passed; ${zeroValueChecks.length}/${zeroValueChecks.length} non-DEMATEL methods handle zero-value inputs; ${validationChecks.length}/${validationChecks.length} validation cases passed; ${templateChecks.length}/${templateChecks.length} method templates are valid; ${reportChecks.length}/${reportChecks.length} report payloads are complete; ${coverageChecks.length}/${coverageChecks.length} coverage summaries are complete; ${bundledBenchmarkMethodIds.length}/${methodRegistry.length} methods have bundled numerical benchmark coverage.`);
