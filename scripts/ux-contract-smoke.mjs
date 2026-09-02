import { existsSync, readFileSync } from 'node:fs';

const source = readFileSync('src/main.tsx', 'utf8');
const styles = readFileSync('src/styles.css', 'utf8');
const validationEvidenceSource = readFileSync('src/core/validationEvidence.ts', 'utf8');
const methodsSource = readFileSync('src/core/methods.ts', 'utf8');
const validationSource = readFileSync('src/core/validation.ts', 'utf8');

function functionBlock(name) {
  const start = source.indexOf(`function ${name}`);
  if (start < 0) throw new Error(`${name} is missing.`);
  const next = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, next < 0 ? source.length : next);
}

function check(name, passed, detail = '') {
  if (!passed) {
    console.error(`${name}: failed${detail ? ` (${detail})` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`${name}: ok`);
}

const methodStep = functionBlock('MethodStep');
const configureStep = functionBlock('ConfigureStep');
const templateStep = functionBlock('TemplateStep');
const uploadStep = functionBlock('UploadStep');
const resultsStep = functionBlock('ResultsStep');
const compareMethods = functionBlock('CompareMethods');
const configurationSummary = functionBlock('ConfigurationSummary');

check(
  'Method selection is focused',
  methodStep.includes('methodChooser') && methodStep.includes('methodSelectLabel') && methodStep.includes('Continue with {selectedMethod.name}'),
);
check(
  'Method selection supports family filtering',
  source.includes('methodFamilies') && source.includes('methodFamilyById') && methodStep.includes('aria-label="Method family"'),
);
check(
  'Method family filter shows family counts',
  methodStep.includes('familyCounts') && methodStep.includes('{label} ({familyCounts[id as MethodFamily]})'),
);
check(
  'Method selection has an empty state',
  methodStep.includes('No methods match the current search, family, and validation filters'),
);
check(
  'First screen does not show template preview',
  !methodStep.includes('SamplePreview') && !methodStep.includes('filled template preview'),
);
check(
  'Legacy prototype components are removed',
  [
    'src/components/StudyEditor.tsx',
    'src/components/StudyConfiguration.tsx',
    'src/components/AppShell.tsx',
    'src/components/MethodSelector.tsx',
    'src/components/UploadValidator.tsx',
    'src/components/PublicationPanel.tsx',
  ].every((file) => !existsSync(file)),
);
check(
  'Catalog is optional instead of dominant',
  methodStep.includes('<details className="methodCatalog">') && methodStep.includes('Browse {filteredMethods.length} matching methods'),
);
check(
  'Method actions are accessible and specific',
  methodStep.includes('aria-label="MCDM method"') && methodStep.includes('Continue with {selectedMethod.name}'),
);
check(
  'Method selection exposes validation status',
  source.includes('externalValidationStatusFor') &&
  source.includes('externalValidationSummaryFor') &&
  methodStep.includes('evidenceCounts') &&
  methodStep.includes('External validation coverage summary') &&
  methodStep.includes('evidenceFilter') &&
  methodStep.includes('Validation evidence') &&
  methodStep.includes('methodWithCandidateCount') &&
  methodStep.includes('externalValidationCandidatesFor(method.id).length > 0') &&
  methodStep.includes('evidenceCounts.candidateFixtures') &&
  validationEvidenceSource.includes('Validated with discrepancies tracked') &&
  validationEvidenceSource.includes('tracked separately') &&
  methodStep.includes('filteredMethods') &&
  methodStep.includes('disabled={!filteredMethods.length}') &&
  methodStep.includes('validationBadge') &&
  methodStep.includes('validationSummary') &&
  methodStep.includes('catalogValidation') &&
  styles.includes('.validationBadge') &&
  styles.includes('.validationSummary') &&
  styles.includes('.catalogValidation'),
);
check(
  'Configure step supports add/remove criteria',
  configureStep.includes('addCriterion') && configureStep.includes('removeCriterion') && configureStep.includes('Add {isDematel ? \'factor\' : \'criterion\'}'),
);
check(
  'Added rows always use unused IDs after deletions',
  configureStep.includes('nextUnusedId') &&
  configureStep.includes("const next = nextUnusedId('A', config.alternatives)") &&
  configureStep.includes("const next = nextUnusedId('C', config.criteria)") &&
  !configureStep.includes('const nextIndex = config.alternatives.length + 1') &&
  !configureStep.includes('const nextIndex = config.criteria.length + 1'),
);

check(
  'Structure edits keep config/input IDs canonical',
  source.includes('function normalizeUniqueIds') &&
  source.includes("const criteria = normalizeUniqueIds('C', nextConfig.criteria") &&
  source.includes("normalizeUniqueIds('A', nextConfig.alternatives") &&
  configureStep.includes('criteria,') &&
  configureStep.includes('values: resizeValues(rows, columns, source)') &&
  configureStep.includes('resizeCriteriaPairwiseById') &&
  configureStep.includes('resizeAlternativePairwiseById') &&
  configureStep.includes('return nextGeneratedId(prefix, used, numericMax + 1)'),
);
check(
  'Icon remove buttons have accessible labels',
  configureStep.includes('aria-label={`Remove ${alternative.name}`}') &&
  configureStep.includes('aria-label={`Remove ${criterion.name}`}'),
);
check(
  'Configure step supports add/remove alternatives where relevant',
  configureStep.includes('addAlternative') && configureStep.includes('removeAlternative') && configureStep.includes('{!isDematel ? (') && configureStep.includes('Add {alternativeLabel.toLowerCase()}'),
);
check(
  'Configure step validates before template generation',
  source.includes('function isPreTemplateIssue') &&
  source.includes('DEMATEL multiple-expert studies require at least one expert matrix sheet.') &&
  configureStep.includes('const currentValidation = method.validateWorkbook(input, config)') &&
  configureStep.includes('const preTemplateIssues = currentValidation.issues.filter(isPreTemplateIssue)') &&
  configureStep.includes('const canGenerateTemplate = !preTemplateIssues.some') &&
  configureStep.includes('compactValidation') &&
  configureStep.includes('disabled={!canGenerateTemplate}') &&
  configureStep.includes('Specifications and current data pass the pre-template check'),
);
check(
  'Automatic weights are explained without editable weight cells',
  configureStep.includes('usesAutomaticWeights') &&
  configureStep.includes('weights are calculated during analysis') &&
  !configureStep.includes('Weight source') &&
  !configureStep.includes('readonlyCell'),
);
check(
  'Manual weights remain editable only for manual weighting',
  configureStep.includes("usesManualWeights ? <th>Manual weight</th> : null") &&
  configureStep.includes("{usesManualWeights ? <td><input type=\"number\"") &&
  !configureStep.includes("config.weightingId === 'equal' ? <input"),
);
check(
  'DEMATEL diagonal seed cells are locked',
  configureStep.includes('disabled={isDematel && rowIndex === columnIndex}') &&
  configureStep.includes('DEMATEL diagonal values are fixed at zero'),
);
check(
  'AROMAN exposes beta and lambda separately',
  methodsSource.includes("aromanBeta") &&
  methodsSource.includes("Normalization blend beta") &&
  methodsSource.includes("Benefit/cost balance lambda") &&
  validationSource.includes("AROMAN beta must be between 0 and 1."),
);
check(
  'Raw seed matrices are optional on the configure step',
  configureStep.includes('<details className="advancedSeedData">') &&
  configureStep.includes('Optional in-app seed data') &&
  configureStep.includes('The generated workbook is the main data-entry path') &&
  styles.includes('.advancedSeedData'),
);
check(
  'AHP pairwise controls are conditional',
  configureStep.includes('showAHPPairwise ?') && configureStep.includes('Criteria pairwise comparison'),
);
check(
  'PROMETHEE threshold controls are conditional',
  configureStep.includes('prometheePreferenceFunction') &&
  configureStep.includes("field.key === 'prometheeIndifferenceThreshold'") &&
  configureStep.includes("field.key === 'prometheePreferenceThreshold'") &&
  configureStep.includes("field.key === 'prometheeGaussianSigma'") &&
  configureStep.includes("prometheePreferenceFunction === 'Gaussian'"),
);
check(
  'Group/respondent settings are conditional',
  configureStep.includes('usesGroupData') && configureStep.includes('Multiple respondents') && configureStep.includes('Multiple experts'),
);
check(
  'Configure step explains group, weight, AHP, and fuzzy behavior',
  configureStep.includes('ConfigurationSummary') &&
  configurationSummary.includes('manual weight inputs are hidden') &&
  configurationSummary.includes('respondent decision-matrix sheets will be generated') &&
  configurationSummary.includes('expert sheets will be generated') &&
  configurationSummary.includes('combined by geometric mean') &&
  configurationSummary.includes('Triangular and trapezoidal entries') &&
  styles.includes('.configurationSummary') &&
  styles.includes('.capabilityStrip, .configurationSummary, .specSection'),
);
check(
  'Method switching sanitizes incompatible data collection modes',
  source.includes('allowedDataModes') && source.includes('allowedDataModes.includes(requestedDataInputMode)') && source.includes("methodId === 'dematel' ? ['Single expert matrix', 'Multiple experts']"),
);
check(
  'Self-weighted methods cannot keep external weighting labels',
  source.includes('sanitizeStudyConfig') && source.includes("method.supportsWeights ? config.weightingId : 'manual'") && source.includes("method.supportsWeights ? weightingDisplayName(config.weightingId) : 'Not used'"),
);
check(
  'Pugh baseline uses a safe contextual selector',
  configureStep.includes("field.key === 'pughBaselineAlternative'") && configureStep.includes('config.alternatives.map((alternative)') && configureStep.includes("key === 'pughIndifferenceTolerance'"),
);
check(
  'Rank-order method settings use contextual criterion selectors',
  source.includes('function CriterionOrderEditor') &&
  configureStep.includes('updateOrderParam') &&
  configureStep.includes("field.key === 'lexicographicOrder' || field.key === 'smarterOrder'") &&
  configureStep.includes('CriterionOrderEditor label="DIBR criterion order"') &&
  configureStep.includes('CriterionOrderEditor label="SWARA criterion order"') &&
  configureStep.includes('CriterionOrderEditor label="ROC criterion order"') &&
  configureStep.includes('CriterionOrderEditor label="FUCOM criterion order"') &&
  configureStep.includes('CriterionOrderEditor label="PIPRECIA criterion order"') &&
  configureStep.includes('CriterionOrderEditor label="Rank Sum criterion order"') &&
  configureStep.includes('CriterionOrderEditor label="Rank Reciprocal criterion order"'),
);
check(
  'Criterion-vector method settings use aligned editors',
  source.includes('function CriterionNumberVectorEditor') &&
  source.includes('function CriterionChoiceVectorEditor') &&
  source.includes('function AdjacentNumberVectorEditor') &&
  source.includes('function GroupGapNumberEditor') &&
  source.includes('function SimosGroupsEditor') &&
  configureStep.includes('CriterionNumberVectorEditor label="SPOTIS lower bounds"') &&
  configureStep.includes('CriterionNumberVectorEditor label="SPOTIS upper bounds"') &&
  configureStep.includes('CriterionNumberVectorEditor label="RIM domain lower bounds"') &&
  configureStep.includes('CriterionNumberVectorEditor label="RIM domain upper bounds"') &&
  configureStep.includes('CriterionNumberVectorEditor label="RIM ideal lower interval"') &&
  configureStep.includes('CriterionNumberVectorEditor label="RAFSI ideal values"') &&
  configureStep.includes('CriterionNumberVectorEditor label="RAFSI anti-ideal values"') &&
  configureStep.includes('CriterionChoiceVectorEditor label="LoPM property types"') &&
  configureStep.includes('CriterionNumberVectorEditor label="ERVD reference point"') &&
  configureStep.includes('CriterionNumberVectorEditor label="Best-to-others vector"') &&
  configureStep.includes('CriterionNumberVectorEditor label="Others-to-worst vector"') &&
  configureStep.includes('AdjacentNumberVectorEditor label="Adjacent importance ratios"') &&
  configureStep.includes('SimosGroupsEditor label="SRF card groups"') &&
  configureStep.includes('GroupGapNumberEditor label="Blank cards between groups"') &&
  configureStep.includes('CriterionNumberVectorEditor label="Comparative importance values"') &&
  configureStep.includes('AdjacentNumberVectorEditor label="Adjacent comparative priorities"') &&
  configureStep.includes('CriterionNumberVectorEditor label="LBWA criterion levels"') &&
  configureStep.includes('CriterionNumberVectorEditor label="Relative significance values"') &&
  configureStep.includes('CriterionNumberVectorEditor label="RANCOM rank positions"') &&
  !configureStep.includes('<label><span>SRF card groups</span><input'),
);
check(
  'Template preview appears only in template step',
  templateStep.includes('SamplePreview') && !uploadStep.includes('SamplePreview') && !resultsStep.includes('SamplePreview'),
);
check(
  'Configure step opens template screen before workbook download',
  source.includes('const openTemplateStep = () =>') &&
  source.includes("transitionTo(3, 'Generating model-specific template...')") &&
  source.includes('const downloadTemplateFile = async () =>') &&
  source.includes('onNext={openTemplateStep}') &&
  source.includes('onDownload={downloadTemplateFile}'),
);
check(
  'Upload step exposes validation state',
  uploadStep.includes('TemplateSpecSummary') && uploadStep.includes('validation.issues') && uploadStep.includes('Validation passed') && uploadStep.includes('Upload completed template'),
);
check(
  'Configured analysis cannot bypass validation',
  source.includes('const runConfiguredAnalysis = () =>') &&
  source.includes('const nextValidation = method.validateWorkbook(input, config)') &&
  source.includes('nextValidation.ok') &&
  source.includes('onSample={runConfiguredAnalysis}') &&
  uploadStep.includes('Analyze current screen data') &&
  !uploadStep.includes('Run sample analysis'),
);
check(
  'Stepper results navigation is validation gated',
  source.includes('const handleStepNavigation = (nextStep: WizardStep) =>') &&
  source.includes('if (nextStep === 5)') &&
  source.includes('const nextValidation = method.validateWorkbook(input, config)') &&
  source.includes('setStep(4)') &&
  source.includes('onStep={handleStepNavigation}'),
);
check(
  'Editing specifications invalidates later unlocked workflow steps',
  source.includes('const handleStudyChange = (nextConfig: StudyConfig, nextInput: DecisionMatrix) =>') &&
  source.includes('setMaxStep((current) => Math.min(current, 3) as WizardStep)'),
);
check(
  'Imported projects with validation errors cannot resume directly to results',
  source.includes('const projectValidation = getMethod(sanitizedConfig.methodId).validateWorkbook(project.input, sanitizedConfig)') &&
  source.includes('const resumedStep = projectValidation.ok ? requestedStep : Math.min(requestedStep, 4) as WizardStep'),
);
check(
  'File inputs allow selecting the same file again',
  source.includes("event.currentTarget.value = ''") && uploadStep.includes("event.currentTarget.value = ''"),
);
check(
  'Results step has recovery actions',
  resultsStep.includes('Edit specifications') && resultsStep.includes('Re-upload') && resultsStep.includes('Project JSON') && resultsStep.includes('Full package'),
);
check(
  'Results tabs avoid duplicate default table content',
  resultsStep.includes("'Cleaned Input'") &&
  source.includes('function inputMatrixTable') &&
  resultsStep.includes("activeTab === 'Cleaned Input'") &&
  resultsStep.includes("(activeTab === 'Transformed Matrix' || activeTab === 'Final Result')") &&
  resultsStep.includes("activeTab === 'Diagnostics'") &&
  resultsStep.includes("activeTab === 'Method Tables'"),
);
check(
  'Method comparison is limited to compatible ranking studies',
  source.includes('methodComparisonBlockReason') && source.includes('comparableRankingMethods') && resultsStep.includes('canCompareMethods') && !resultsStep.includes("...(!isDematel ? ['Compare Methods'] : [])"),
);
check(
  'Method comparison excludes special-structure methods with explanations',
  compareMethods.includes('unavailableMethods') && compareMethods.includes('comparisonNotes') && source.includes('AHP uses pairwise comparison matrices') && source.includes('DEMATEL uses direct-relation factor matrices'),
);
check(
  'Method comparison handles failed reruns gracefully',
  compareMethods.includes('try {') && compareMethods.includes("top: 'Unavailable'") && compareMethods.includes('Select at least one compatible ranking method'),
);
check(
  'Readiness panel shows selected-method external validation evidence',
  source.includes('externalValidationFixturesFor') &&
  source.includes('externalValidationCandidatesFor') &&
  source.includes("externalValidationStatusFor(method.id, 'readiness')") &&
  source.includes('externalValidationCoverageLabel(config.methodId)') &&
  source.includes('externalEvidencePanel') &&
  source.includes('No published fixture registered for') &&
  styles.includes('.externalEvidencePanel .validationBadge'),
);
check(
  'Readiness panel shows external validation candidates',
  source.includes('evidenceNotice') && source.includes('Validation candidate tracked'),
);
check(
  'Compact responsive method chooser styles exist',
  styles.includes('.methodChooser') && styles.includes('.methodCatalogGrid') && styles.includes('@media (max-width: 900px)'),
);
check(
  'Compact mobile action layouts are protected',
  styles.includes('.resultsHeader { align-items: stretch; flex-direction: column;') &&
  styles.includes('.exportActions button { flex: 1 1 128px;') &&
  styles.includes('.flowActions button { flex: 1 1 180px;') &&
  styles.includes('@media (max-width: 560px)'),
);
check(
  'Professional compact table controls exist',
  styles.includes('.advancedSeedData') && styles.includes('.miniAction') && styles.includes('.iconAction') && styles.includes('.comparisonNotes') && styles.includes('.compactValidation') && styles.includes('.primaryAction:disabled'),
);
check(
  'Rank-order selector styles exist',
  styles.includes('.orderEditor') && styles.includes('.orderEditorGrid') && styles.includes('.vectorEditor') && styles.includes('.vectorEditorGrid'),
);
check(
  'External validation evidence styles exist',
  styles.includes('.externalEvidencePanel') && styles.includes('.externalEvidencePanel a'),
);

if (process.exitCode) process.exit(1);
console.log('UX contract smoke OK.');
