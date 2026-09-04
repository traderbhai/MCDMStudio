import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixturesDir = resolve(root, 'docs', 'external-fixtures');
const matrixPath = resolve(root, 'docs', 'EXTERNAL_VALIDATION_MATRIX.md');
const auditPath = resolve(root, 'docs', 'PUBLICATION_READINESS_AUDIT.md');
const outputPath = resolve(root, 'docs', 'PUBLICATION_READINESS_STATUS.json');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function fixtureFiles() {
  if (!existsSync(fixturesDir)) return [];
  return readdirSync(fixturesDir)
    .filter((file) => extname(file).toLowerCase() === '.json')
    .map((file) => resolve(fixturesDir, file));
}

function parseMatrixRows(markdown) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => line.startsWith('| ') && !line.includes('| ---'))
    .slice(1)
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 4)
    .map(([method, family, status, evidence]) => ({ method, family, status, evidence }));
}

const matrix = readFileSync(matrixPath, 'utf8');
const audit = readFileSync(auditPath, 'utf8');
const rows = parseMatrixRows(matrix);
const fixtures = fixtureFiles().map((file) => JSON.parse(readFileSync(file, 'utf8')));
const activeFixtures = fixtures.filter((fixture) => fixture.status !== 'candidate-discrepancy');
const candidateFixtures = fixtures.filter((fixture) => fixture.status === 'candidate-discrepancy');
const internalRows = rows.filter((row) => row.status === 'Internal coverage only');
const candidateRows = rows.filter((row) => row.status === 'Validation candidate');
const passingRows = rows.filter((row) => row.status === 'Passing external fixture');

if (rows.length !== 65) {
  fail(`External validation matrix should list 65 methods; found ${rows.length}.`);
}

const activeFixtureMethodCount = new Set(activeFixtures.map((fixture) => fixture.methodId)).size;
if (passingRows.length !== activeFixtureMethodCount) {
  fail(`Passing method mismatch: matrix has ${passingRows.length}, fixture folder covers ${activeFixtureMethodCount} methods.`);
}

if (!audit.includes(`Passing external fixtures: ${activeFixtures.length}`)) {
  fail(`Publication audit must state ${activeFixtures.length} passing external fixtures.`);
}

if (!audit.includes(`Internal coverage only: ${internalRows.length}`)) {
  fail(`Publication audit must state ${internalRows.length} internal-only methods.`);
}

if (!audit.includes(`Candidate records needing reconciliation: ${candidateFixtures.length}`)) {
  fail(`Publication audit must state ${candidateFixtures.length} candidate records needing reconciliation.`);
}

const status = {
  generatedFrom: 'docs/EXTERNAL_VALIDATION_MATRIX.md and docs/external-fixtures/*.json',
  methodsTracked: rows.length,
  passingExternalFixtures: activeFixtures.length,
  validationCandidateMethods: candidateRows.map((row) => row.method),
  candidateRecordsNeedingReconciliation: candidateFixtures.length,
  internalOnlyMethods: internalRows.map((row) => row.method),
  methodsWithMatchedFixtures: activeFixtureMethodCount,
  reviewDoiCandidates: candidateRows.length,
  documentedSourceDiscrepancies: candidateFixtures.length,
  launchReadyWithEvidenceBoundary: internalRows.length === 0 && passingRows.length === activeFixtureMethodCount && candidateRows.length + passingRows.length === rows.length,
  strictPublicationCertificationComplete: internalRows.length === 0 && candidateRows.length === 0 && candidateFixtures.length === 0,
};

const nextStatus = `${JSON.stringify(status, null, 2)}\n`;
if (!existsSync(outputPath) || readFileSync(outputPath, 'utf8') !== nextStatus) {
  writeFileSync(outputPath, nextStatus);
}

console.log(
  [
    'Publication readiness status OK',
    `Methods tracked: ${status.methodsTracked}`,
    `Passing external fixtures: ${status.passingExternalFixtures}`,
    `Methods with matched fixtures: ${status.methodsWithMatchedFixtures}`,
    `Methods needing first DOI match: ${status.reviewDoiCandidates}`,
    `Candidate records needing reconciliation: ${status.candidateRecordsNeedingReconciliation}`,
    `Internal-only methods: ${status.internalOnlyMethods.length}`,
    `Launch-ready with evidence boundary: ${status.launchReadyWithEvidenceBoundary ? 'yes' : 'no'}`,
    `Strict publication certification complete: ${status.strictPublicationCertificationComplete ? 'yes' : 'no'}`,
  ].join('\n'),
);



