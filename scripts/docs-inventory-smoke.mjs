import { readFileSync } from 'node:fs';

const types = readFileSync('src/types.ts', 'utf8');
const readme = readFileSync('README.md', 'utf8');
const packageJson = readFileSync('package.json', 'utf8');
const blueprint = readFileSync('docs/PRODUCT_BLUEPRINT.md', 'utf8');
const roadmap = readFileSync('docs/VALIDATION_ROADMAP.md', 'utf8');
const researchInventory = readFileSync('docs/METHOD_RESEARCH_INVENTORY.md', 'utf8');
const validationMatrix = readFileSync('docs/EXTERNAL_VALIDATION_MATRIX.md', 'utf8');
const fixtureReadme = readFileSync('docs/external-fixtures/README.md', 'utf8');
const methodMetadata = readFileSync('src/core/methodMetadata.ts', 'utf8');
const methodsSource = readFileSync('src/core/methods.ts', 'utf8');
const validationEvidenceSource = readFileSync('src/core/validationEvidence.ts', 'utf8');
const capabilityMatrixSource = readFileSync('src/core/capabilityMatrix.ts', 'utf8');
const exportsSource = readFileSync('src/services/exports.ts', 'utf8');
const viteConfig = readFileSync('vite.config.mts', 'utf8');

function extractUnion(typeName) {
  const match = types.match(new RegExp(`export type ${typeName} =([\\s\\S]*?);`));
  if (!match) throw new Error(`Could not find ${typeName}.`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]);
}

const methodLabels = {
  topsis: 'TOPSIS',
  ahp: 'AHP',
  dematel: 'DEMATEL',
  vikor: 'VIKOR',
  copras: 'COPRAS',
  saw: 'SAW/WSM',
  srp: 'SRP',
  fuca: 'FUCA',
  seca: 'SECA',
  dear: 'DEAR',
  eamr: 'EAMR',
  rawec: 'RAWEC',
  comet: 'COMET',
  wpm: 'WPM',
  waspas: 'WASPAS',
  moora: 'MOORA',
  moosra: 'MOOSRA',
  arlon: 'ARLON',
  macont: 'MACONT',
  aras: 'ARAS',
  edas: 'EDAS',
  mabac: 'MABAC',
  codas: 'CODAS',
  cocoso: 'CoCoSo',
  cradis: 'CRADIS',
  mara: 'MARA',
  raps: 'RAPS',
  oreste: 'ORESTE',
  qualiflex: 'QUALIFLEX',
  regime: 'REGIME',
  evamix: 'EVAMIX',
  lexicographic: 'Lexicographic',
  marcos: 'MARCOS',
  mairca: 'MAIRCA',
  promethee: 'PROMETHEE II',
  electre: 'ELECTRE I',
  smart: 'SMART',
  maut: 'MAUT',
  smarter: 'SMARTER',
  macbeth: 'MACBETH-style',
  pugh: 'Pugh Matrix',
  ocra: 'OCRA',
  multimoora: 'MULTIMOORA',
  psi: 'PSI',
  piv: 'PIV',
  rov: 'ROV',
  wisp: 'WISP',
  todim: 'TODIM',
  ram: 'RAM',
  gra: 'GRA',
  grp: 'GRP',
  spotis: 'SPOTIS',
  espSpotis: 'ESP-SPOTIS',
  balancedSpotis: 'B-SPOTIS',
  wedba: 'WEDBA',
  lmaw: 'LMAW',
  dnma: 'DNMA',
  probid: 'PROBID',
  sprobid: 'SPROBID',
  rim: 'RIM',
  rafsi: 'RAFSI',
  lopm: 'LoPM',
  aroman: 'AROMAN',
  cobra: 'COBRA',
  ervd: 'ERVD',
};

const weightingLabels = {
  manual: 'manual',
  equal: 'equal',
  stddev: 'standard deviation',
  cov: 'coefficient of variation',
  entropy: 'entropy',
  critic: 'CRITIC',
  merec: 'MEREC',
  merecG: 'MEREC-G',
  lopcow: 'LOPCOW',
  wenslo: 'WENSLO',
  angular: 'angular',
  gini: 'Gini',
  mpsi: 'MPSI',
  cilos: 'CILOS',
  idocriw: 'IDOCRIW',
  cimas: 'CIMAS',
  ahp: 'AHP',
  bwm: 'BWM',
  dibr: 'DIBR',
  simos: 'Revised Simos',
  swara: 'SWARA',
  roc: 'ROC',
  fucom: 'FUCOM',
  lbwa: 'LBWA',
  piprecia: 'PIPRECIA',
  rankSum: 'Rank Sum',
  rankReciprocal: 'Rank Reciprocal',
  rancom: 'RANCOM',
};

function includesLoose(text, label) {
  return text.toLowerCase().includes(label.toLowerCase());
}

function check(name, passed, detail = '') {
  if (!passed) {
    console.error(`${name}: failed${detail ? ` (${detail})` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`${name}: ok`);
}

const methodIds = extractUnion('MethodId');
const weightingIds = extractUnion('WeightingId');
const methodCount = methodIds.length;
const missingMethodLabels = methodIds.filter((id) => !methodLabels[id]);
const missingWeightingLabels = weightingIds.filter((id) => !weightingLabels[id]);
const activeFixtureBlock = validationEvidenceSource.match(/export const externalValidationFixtures = \[([\s\S]*?)\] as const;/)?.[1] ?? '';
const candidateFixtureBlock = validationEvidenceSource.match(/export const externalValidationCandidates = \[([\s\S]*?)\] as const;/)?.[1] ?? '';
const activeFixtureIds = [...activeFixtureBlock.matchAll(/methodId:\s*'([^']+)'/g)].map((match) => match[1]);
const activeFixtureMethodIds = new Set(activeFixtureIds);
const candidateFixtureMethodIds = new Set([...candidateFixtureBlock.matchAll(/methodId:\s*'([^']+)'/g)].map((match) => match[1]));
const candidateFixtureCount = [...candidateFixtureBlock.matchAll(/methodId:\s*'([^']+)'/g)].length;
const candidateMethodCount = [...candidateFixtureMethodIds].filter((id) => !activeFixtureMethodIds.has(id)).length;
const internalOnlyMethodCount = methodIds.length - activeFixtureMethodIds.size - candidateMethodCount;
const nativeFuzzyMethodCount = new Set(
  [
    ...[...methodsSource.matchAll(/definition\.id === '([^']+)' \? \{\s*enabled: true,\s*mode: 'native-fuzzy'/g)].map((match) => match[1]),
    ...[...methodsSource.matchAll(/^\s*([A-Za-z][A-Za-z0-9]*): \{ label: 'Native fuzzy /gm)].map((match) => match[1]),
  ],
).size;
const validationMatrixRows = validationMatrix
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('| ---') && !line.includes('| Method |'))
  .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
const validationMatrixStatusByMethod = new Map(validationMatrixRows.map(([method, , status]) => [method.toLowerCase(), status]));

function expectedValidationMatrixStatus(methodId) {
  if (activeFixtureMethodIds.has(methodId)) return 'Passing external fixture';
  if (candidateFixtureMethodIds.has(methodId)) return 'Validation candidate';
  return 'Internal coverage only';
}

check('Method label map is complete', missingMethodLabels.length === 0, missingMethodLabels.join(', '));
check('Weighting label map is complete', missingWeightingLabels.length === 0, missingWeightingLabels.join(', '));
check('README method count is current', readme.includes(`Built-in methods:`) && readme.includes(`${methodCount}/${methodCount} method execution smoke coverage`));
check('Blueprint method count is current', blueprint.includes(`${methodCount} methods`));
check(
  'Roadmap method count is current',
  [
    `${methodCount} built-in methods have execution smoke coverage`,
    `${methodCount} built-in methods have template generation and parsing coverage`,
    `${methodCount} built-in methods have report payload coverage`,
  ].every((text) => roadmap.includes(text)),
);
check('README lists every method label', methodIds.every((id) => includesLoose(readme, methodLabels[id])), methodIds.filter((id) => !includesLoose(readme, methodLabels[id])).join(', '));
check('Blueprint lists every method label', methodIds.every((id) => includesLoose(blueprint, methodLabels[id])), methodIds.filter((id) => !includesLoose(blueprint, methodLabels[id])).join(', '));
check('README lists every weighting label', weightingIds.every((id) => includesLoose(readme, weightingLabels[id])), weightingIds.filter((id) => !includesLoose(readme, weightingLabels[id])).join(', '));
check('Blueprint lists every weighting label', weightingIds.every((id) => includesLoose(blueprint, weightingLabels[id])), weightingIds.filter((id) => !includesLoose(blueprint, weightingLabels[id])).join(', '));
check('Roadmap states external validation boundary', roadmap.includes('External published-example validation is in progress') && roadmap.includes('not publication-certified proof for all methods and variants'));
check('Roadmap links fixture runner', roadmap.includes('scripts/external-validation-smoke.mjs') && roadmap.includes('docs/external-fixtures'));
check('Fixture inventory lists registered TOPSIS example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('topsis-crisp-hospital-supplier-pmc-2019.json') && roadmap.includes('TOPSIS crisp vector-normalization') && researchInventory.includes('TOPSIS crisp vector-normalization hospital supplier selection'));
check('Fixture inventory lists registered AHP example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('ahp-crisp-criteria-weights-energies-2026.json'));
check('Fixture inventory lists registered DEMATEL example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('dematel-crisp-collaborative-innovation-sageopen-2025.json') && roadmap.includes('DEMATEL crisp cause-effect analysis') && researchInventory.includes('DEMATEL crisp cause-effect analysis'));
check('Fixture inventory lists registered VIKOR example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('vikor-crisp-critic-power-quality-scirep-2023.json') && roadmap.includes('VIKOR crisp v=0.5') && researchInventory.includes('VIKOR crisp v=0.5 compromise ranking'));
check('Fixture inventory lists registered COPRAS example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('copras-crisp-clean-energy-mdpi-2022.json') && roadmap.includes('COPRAS crisp column-sum normalization') && researchInventory.includes('COPRAS crisp column-sum normalization clean energy'));
check('Fixture inventory lists registered SAW/WSM example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('saw-crisp-university-location-sageopen-2021.json') && roadmap.includes('SAW/WSM crisp linear-normalization') && researchInventory.includes('SAW/WSM crisp linear-normalization university location'));
check('Fixture inventory lists registered WPM example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('wpm-crisp-university-location-sageopen-2021.json') && roadmap.includes('WPM crisp linear-normalization') && researchInventory.includes('WPM crisp linear-normalization university location'));
check('Fixture inventory lists registered WASPAS example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('waspas-crisp-university-location-sageopen-2021.json') && roadmap.includes('WASPAS crisp alpha 0.5') && researchInventory.includes('WASPAS crisp alpha 0.5 university location'));
check('Fixture inventory lists registered MOORA example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('moora-crisp-laptop-selection-springer-2017.json') && roadmap.includes('MOORA crisp ratio-system') && researchInventory.includes('MOORA crisp ratio-system laptop selection'));
check('Fixture inventory lists registered MOOSRA example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('moosra-crisp-laptop-selection-springer-2017.json') && roadmap.includes('MOOSRA crisp benefit-cost ratio') && researchInventory.includes('MOOSRA crisp benefit-cost ratio laptop selection'));
check('Fixture inventory lists registered MULTIMOORA example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('multimoora-crisp-laptop-selection-springer-2017.json') && roadmap.includes('MULTIMOORA crisp dominance-theory') && researchInventory.includes('MULTIMOORA crisp dominance-theory laptop selection'));
check('Fixture inventory lists registered MABAC example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('mabac-crisp-cross-dock-mdpi-2024.json') && roadmap.includes('MABAC crisp linear-normalization') && researchInventory.includes('MABAC crisp linear-normalization cross-dock terminal location'));
check('Fixture inventory lists registered CODAS example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('codas-crisp-robot-selection-original-2016.json') && roadmap.includes('CODAS crisp linear-normalization') && researchInventory.includes('CODAS crisp linear-normalization robot selection'));
check('Fixture inventory lists registered CoCoSo example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('cocoso-crisp-road-mixtures-mdpi-2022.json') && roadmap.includes('CoCoSo crisp linear-normalization') && researchInventory.includes('CoCoSo crisp linear-normalization road mixture selection'));
check('Fixture inventory lists registered ARAS example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('aras-crisp-health-monitoring-frontiers-2023.json') && roadmap.includes('ARAS normalized-matrix') && researchInventory.includes('ARAS normalized-matrix health-monitoring application selection'));
check('Fixture inventory lists registered EDAS example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('edas-crisp-comparative-analysis-original-2015.json') && roadmap.includes('EDAS crisp average-solution') && researchInventory.includes('EDAS crisp average-solution comparative analysis'));
check('Fixture inventory lists registered SMART example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('smart-crisp-student-achievement-iop-2017.json') && roadmap.includes('SMART crisp positive-ratio utility') && researchInventory.includes('SMART crisp student-achievement selection'));
check('Fixture inventory lists registered MAUT example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('maut-crisp-seismic-retrofitting-wiley-2009.json') && roadmap.includes('MAUT crisp input-utilities') && researchInventory.includes('MAUT crisp seismic-retrofitting selection'));
check('Fixture inventory lists registered SMARTER example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('smarter-crisp-clinical-cdss-pmc-2011.json') && roadmap.includes('SMARTER crisp ROC utility-input') && researchInventory.includes('SMARTER crisp clinical decision-support selection'));
check('Fixture inventory lists registered Pugh example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('pugh-crisp-travel-selection-github-aiaa-1994.json') && roadmap.includes('Pugh crisp uploaded-score') && researchInventory.includes('Pugh crisp uploaded-score travel selection'));
check('Fixture inventory lists registered COMET example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('comet-crisp-pymcdm-topsis-expert-2026.json') && roadmap.includes('COMET crisp TOPSIS-expert') && researchInventory.includes('COMET crisp TOPSIS-expert audit case'));
check('Fixture inventory lists registered OCRA example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('ocra-crisp-tablet-selection-jmcdm-2017.json') && roadmap.includes('OCRA crisp relative-distance') && researchInventory.includes('OCRA crisp relative-distance tablet selection'));
check('Fixture inventory lists registered ROV example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('rov-crisp-fortune500-gujs-2021.json') && roadmap.includes('ROV crisp linear max-min') && researchInventory.includes('ROV crisp Fortune 500 financial-performance selection'));
check('Fixture inventory lists registered MARCOS example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('marcos-crisp-milling-scielo-2026.json') && roadmap.includes('MARCOS crisp utility-normalization') && researchInventory.includes('MARCOS crisp utility-normalization milling-process selection'));
check('Fixture inventory lists registered MAIRCA example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('mairca-crisp-rmcda-gap-example-2026.json') && roadmap.includes('MAIRCA crisp min-max gap') && researchInventory.includes('MAIRCA crisp min-max gap example'));
check('Fixture inventory lists registered PSI example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('psi-crisp-jmcdm-material-selection-2025.json') && roadmap.includes('PSI crisp alternative-preference-index') && researchInventory.includes('PSI crisp alternative-preference-index material selection'));
check('Fixture inventory lists registered PIV example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('piv-crisp-electric-vehicle-jaes-2025.json') && roadmap.includes('PIV crisp vector-normalization') && researchInventory.includes('PIV crisp vector-normalization electric-vehicle selection'));
check('Fixture inventory lists registered WISP example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('wisp-crisp-rmcda-material-selection-2025.json') && roadmap.includes('WISP crisp max-normalization') && researchInventory.includes('WISP crisp max-normalization material selection'));
check('Fixture inventory lists registered RIM example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('rim-crisp-rmcda-reference-formula-2025.json') && roadmap.includes('RIM crisp reference-ideal index') && researchInventory.includes('RIM crisp reference-ideal index'));
check('Fixture inventory lists registered LMAW example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('lmaw-crisp-jmcdm-logistics-2025.json') && roadmap.includes('LMAW crisp nonlinear-Q-utility') && researchInventory.includes('LMAW crisp nonlinear-Q-utility logistics selection'));
check('Fixture inventory lists registered SPOTIS example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('spotis-crisp-rank-reversal-original-2020.json') && roadmap.includes('SPOTIS crisp manual-bounds') && researchInventory.includes('SPOTIS crisp manual-bounds rank-reversal example'));
check('Fixture inventory lists registered B-SPOTIS example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('balanced-spotis-crisp-pymcdm-2026.json') && readFileSync('docs/external-fixtures/README.md', 'utf8').includes('balanced-spotis-crisp-used-car-icaart-2025.json') && roadmap.includes('B-SPOTIS crisp alpha-balanced') && researchInventory.includes('B-SPOTIS crisp used-car ISP/ESP case'));
check('Fixture inventory lists registered MARA example', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('mara-crisp-rmcda-area-ranking-2025.json') && roadmap.includes('MARA crisp area-gap') && researchInventory.includes('MARA crisp area-gap audit case'));
check('Fixture inventory lists discrepancy candidates', readFileSync('docs/external-fixtures/README.md', 'utf8').includes('cradis-crisp-electric-vehicle-jaes-2025.discrepancy.json') && readFileSync('docs/external-fixtures/README.md', 'utf8').includes('topsis-crisp-warehouse-storage-springer-2026.discrepancy.json') && readFileSync('docs/external-fixtures/README.md', 'utf8').includes('topsis-crisp-etl-software-springerplus-2016.discrepancy.json') && readFileSync('docs/external-fixtures/README.md', 'utf8').includes('topsis-crisp-barge-service-sciencedirect-2025.discrepancy.json') && roadmap.includes('TOPSIS and CRADIS discrepancy records') && researchInventory.includes('CRADIS crisp ratio-normalization electric-vehicle') && researchInventory.includes('TOPSIS crisp vector-normalization warehouse-storage') && researchInventory.includes('TOPSIS crisp vector-normalization ETL software-selection') && researchInventory.includes('TOPSIS crisp vector-normalization barge-service'));
check('Validation evidence exposes validation candidates', validationEvidenceSource.includes('externalValidationCandidates') && validationEvidenceSource.includes('candidateRecords'));
check('Fixture docs require traceable source metadata', roadmap.includes('"sourceUrl"') && roadmap.includes('"doi"') && readFileSync('docs/external-fixtures/README.md', 'utf8').includes('sourceUrl'));
check('README links method research inventory', readme.includes('docs/METHOD_RESEARCH_INVENTORY.md'));
check('Blueprint links method research inventory', blueprint.includes('docs/METHOD_RESEARCH_INVENTORY.md'));
check('README links external validation matrix', readme.includes('docs/EXTERNAL_VALIDATION_MATRIX.md') && researchInventory.includes('docs/EXTERNAL_VALIDATION_MATRIX.md'));
check('Research inventory lists every method label', methodIds.every((id) => includesLoose(researchInventory, methodLabels[id])), methodIds.filter((id) => !includesLoose(researchInventory, methodLabels[id])).join(', '));
check('External validation matrix lists every method label', methodIds.every((id) => includesLoose(validationMatrix, methodLabels[id])), methodIds.filter((id) => !includesLoose(validationMatrix, methodLabels[id])).join(', '));
check(
  'External validation matrix statuses match registry evidence',
  methodIds.every((id) => validationMatrixStatusByMethod.get(methodLabels[id].toLowerCase()) === expectedValidationMatrixStatus(id)),
  methodIds.filter((id) => validationMatrixStatusByMethod.get(methodLabels[id].toLowerCase()) !== expectedValidationMatrixStatus(id)).join(', '),
);
check(
  'External validation matrix states certification counts',
  validationMatrix.includes(`Passing external fixtures: ${activeFixtureIds.length} published examples across ${activeFixtureMethodIds.size} methods/variants`) &&
    validationMatrix.includes(`Validation candidates: ${candidateMethodCount} methods, ${candidateFixtureCount} registry candidates; 5 executable discrepancy records`) &&
    validationMatrix.includes(`Internal coverage only: ${internalOnlyMethodCount} methods`),
);
check('External validation matrix preserves certification boundary', validationMatrix.includes('Internal coverage only') && validationMatrix.includes('Needs published-example fixture') && validationMatrix.includes("do not yet reproduce the published result closely enough"));
check('Research inventory lists every weighting label', weightingIds.every((id) => includesLoose(researchInventory, weightingLabels[id])), weightingIds.filter((id) => !includesLoose(researchInventory, weightingLabels[id])).join(', '));
check('Research inventory includes literature sources', researchInventory.includes('https://www.mdpi.com/2071-1050/13/2/737') && researchInventory.includes('https://doi.org/10.3390/info14050285') && researchInventory.includes('https://doi.org/10.1016/j.ejor.2024.07.038') && researchInventory.includes('https://www.mdpi.com/2076-3417/16/14/7269'));
check('Research inventory includes deferred variant strategy', researchInventory.includes('Candidate Methods And Variants To Add Later') && researchInventory.includes('neutrosophic variants') && researchInventory.includes('DEA and fuzzy DEA') && researchInventory.includes('robust ordinal regression') && researchInventory.includes('Coding Rule'));
check('Method family metadata is strongly typed', methodMetadata.includes('Record<MethodId, Exclude<MethodFamily'));
check('README mentions method family filtering', readme.includes('family filtering'));
check('Package exposes one-command verification', packageJson.includes('"verify"') && readme.includes('npm run verify'));
check('README direct commands include documentation inventory check', readme.includes('node scripts\\docs-inventory-smoke.mjs'));
check('Benchmark count docs are current', readme.includes('94 bundled numerical benchmark checks') && blueprint.includes('94 bundled numerical benchmark checks') && roadmap.includes('94 bundled numerical benchmark checks'));
check('Native fuzzy count docs are current', readme.includes(`native fuzzy smoke/crisp-equivalence coverage for ${nativeFuzzyMethodCount} methods`) && blueprint.includes(`coverage currently exists for ${nativeFuzzyMethodCount} methods`));
check('Zero-value robustness docs are current', readme.includes('65/65 non-DEMATEL methods handle zero-containing inputs') && blueprint.includes('65/65 non-DEMATEL zero-value robustness checks') && roadmap.includes('65 non-DEMATEL methods have zero-value robustness coverage'));
check('Production bundle is intentionally chunked', viteConfig.includes('manualChunks') && viteConfig.includes('vendor-xlsx') && viteConfig.includes('vendor-pdf') && viteConfig.includes('mcdm-engine'));
check('PDF export includes complete publication tables', exportsSource.includes('result.tables.forEach((table)') && !exportsSource.includes('result.tables.slice(0, 4)') && exportsSource.includes('Figure data:'));
check('Publication package docs mention project JSON', readme.includes('full publication package') && readme.includes('reproducibility project JSON') && blueprint.includes('project JSON package download') && roadmap.includes('project JSON package download'));
check('Workflow docs mention wrong-method template rejection', readme.includes('wrong-method templates') && blueprint.includes('wrong-method template rejection') && roadmap.includes('wrong-method template rejection'));
check('Workflow docs mention malformed project import rejection', readme.includes('malformed project imports') && blueprint.includes('malformed project import rejection') && roadmap.includes('malformed project import rejection'));
check('Workflow docs mention duplicate/mismatched project ID rejection', readme.includes('duplicate or mismatched project IDs') && blueprint.includes('duplicate/mismatched project ID rejection') && roadmap.includes('duplicate/mismatched project ID rejection'));
check('Workflow docs mention invalid saved workflow metadata rejection', readme.includes('invalid saved workflow metadata') && blueprint.includes('invalid saved workflow metadata rejection') && roadmap.includes('invalid saved workflow metadata rejection'));
check('Workflow docs mention invalid method settings rejection', blueprint.includes('invalid method settings rejection') && roadmap.includes('invalid method settings rejection'));
check('Workflow docs mention TOPSIS normalization settings coverage', blueprint.includes('TOPSIS normalization settings coverage') && roadmap.includes('TOPSIS normalization settings coverage'));
check('Workflow docs mention automatic-weight regression coverage', blueprint.includes('automatic weighting ignoring edited workbook weight cells') && roadmap.includes('automatic weighting ignoring edited workbook weight cells'));
check('Workflow docs mention Pugh uploaded-score regression coverage', blueprint.includes('Pugh uploaded-score template round-tripping and global rescaling') && roadmap.includes('Pugh uploaded-score template round-tripping and global rescaling'));
check('Workflow docs mention multi-respondent workbook aggregation coverage', blueprint.includes('multiple-respondent workbook aggregation and reporting') && roadmap.includes('multiple-respondent workbook aggregation and reporting'));
check('Workflow docs mention DEMATEL expert workbook aggregation coverage', blueprint.includes('DEMATEL expert workbook aggregation and reporting') && roadmap.includes('DEMATEL expert workbook aggregation and reporting'));
check('Workflow docs mention AHP group pairwise workbook aggregation coverage', blueprint.includes('AHP group pairwise workbook aggregation/settings coverage') && roadmap.includes('AHP group pairwise workbook aggregation/settings coverage'));
check('Workflow docs mention PROMETHEE and COMET settings coverage', blueprint.includes('PROMETHEE and COMET settings coverage') && roadmap.includes('PROMETHEE and COMET settings coverage'));
check('Workflow docs mention MAUT/SMARTER utility-input workbook coverage', blueprint.includes('MAUT/SMARTER utility-input workbook round-trip coverage') && roadmap.includes('MAUT/SMARTER utility-input workbook round-trip coverage'));
check('Workflow docs mention editable method settings sheet coverage', blueprint.includes('editable method settings sheet round-trip coverage') && roadmap.includes('editable method settings sheet round-trip coverage'));
check('Workflow docs mention sheet-shaped reference settings coverage', blueprint.includes('sheet-shaped reference mode/vector round-trip coverage') && roadmap.includes('sheet-shaped reference mode/vector round-trip coverage'));
check('Workflow docs mention fuzzy workbook upload coverage', blueprint.includes('fuzzy tuple workbook upload through native and defuzzified paths') && roadmap.includes('fuzzy tuple workbook upload through native and defuzzified paths'));
check('External fixture docs mention strict active-fixture evidence bar', roadmap.includes('Active external fixtures must include an explicit DOI') && roadmap.includes("prove the method's final result form") && fixtureReadme.includes('Active fixtures are intentionally stricter than discrepancy candidates') && fixtureReadme.includes('at least two intermediate table cells') && fixtureReadme.includes('Each discrepancy file must also list audited variants'));
check('Fixture inventory lists registered RAM example', fixtureReadme.includes('ram-crisp-pymcdm-root-assessment-2026.json') && roadmap.includes('RAM crisp column-sum root assessment') && researchInventory.includes('RAM crisp column-sum root assessment'));
check('Fixture inventory lists registered PROBID example', fixtureReadme.includes('probid-crisp-pymcdm-ideal-average-distance-2026.json') && roadmap.includes('PROBID crisp ideal-average distance') && researchInventory.includes('PROBID crisp ideal-average distance'));
check('Fixture inventory lists registered SPROBID example', fixtureReadme.includes('sprobid-crisp-pymcdm-simplified-probid-2026.json') && roadmap.includes('SPROBID crisp simplified PROBID') && researchInventory.includes('SPROBID crisp simplified PROBID'));
check('Fixture inventory lists registered RAFSI example', fixtureReadme.includes('rafsi-crisp-r-package-example-2024.json') && roadmap.includes('RAFSI crisp manual-reference') && researchInventory.includes('RAFSI crisp manual-reference functional mapping'));
check('Group-study docs mention disagreement diagnostics', readme.includes('relative disagreement') && readme.includes('practical consensus level') && blueprint.includes('consensus-level diagnostic') && roadmap.includes('consensus-level classification'));
check('DEMATEL expert docs mention consensus reporting', readme.includes('DEMATEL supports multiple expert influence matrices with expert disagreement and consensus reporting') && blueprint.includes('DEMATEL group judgments') && blueprint.includes('expert disagreement and consensus reporting') && researchInventory.includes('DEMATEL expert matrices aggregate before total-relation analysis with expert disagreement and consensus reporting'));
check('Capability matrix explains group and fuzzy strategies', capabilityMatrixSource.includes('groupDecisionCapability') && capabilityMatrixSource.includes('fuzzyCapability') && capabilityMatrixSource.includes('validationBoundary') && capabilityMatrixSource.includes('reports agreement') && capabilityMatrixSource.includes('converts them to single values'));
check('Readiness UI displays capability profile', readFileSync('src/main.tsx', 'utf8').includes('capabilityProfile') && readFileSync('src/main.tsx', 'utf8').includes('Group data') && readFileSync('src/main.tsx', 'utf8').includes('Fuzzy values'));

if (process.exitCode) process.exit(1);
console.log(`Documentation inventory smoke OK: ${methodIds.length} methods and ${weightingIds.length} weighting modes documented.`);
