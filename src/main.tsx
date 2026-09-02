import { Fragment, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, Check, Download, FileSpreadsheet, FileText, HelpCircle, Plus, Search, Settings2, Trash2, Upload } from 'lucide-react';
import { methodFamilies, methodFamilyById, methodPurpose, type MethodFamily } from './core/methodMetadata';
import { getMethod, methodRegistry } from './core/methods';
import { fuzzyCapability, groupDecisionCapability, validationBoundary } from './core/capabilityMatrix';
import { methodCoverageItems } from './core/coverage';
import { externalValidationCandidatesFor, externalValidationCoverageLabel, externalValidationFixturesFor, externalValidationStatusFor, externalValidationSummaryFor } from './core/validationEvidence';
import { weightingDisplayName } from './core/weightingMetadata';
import { sampleConfig, sampleMatrix } from './data/sampleStudy';
import { exportProject, importProject } from './services/project';
import type { AnalysisResult, DecisionMatrix, MethodDefinition, MethodId, OutputTable, StudyConfig, ValidationResult, WeightingId } from './types';
import './styles.css';

const steps = ['Select Method', 'Configure', 'Template', 'Upload', 'Results'];

type WizardStep = 1 | 2 | 3 | 4 | 5;
const defaultFuzzyMode = 'Defuzzify on upload';

function fuzzyModeOptions(methodId: MethodId) {
  const method = getMethod(methodId);
  return method.fuzzySupport.nativeModeLabel ? [defaultFuzzyMode, method.fuzzySupport.nativeModeLabel] : [defaultFuzzyMode];
}

function sanitizeMethodParams(methodId: MethodId, methodParams: StudyConfig['methodParams']) {
  const allowedFuzzyModes = fuzzyModeOptions(methodId);
  const fuzzyInputMode = String(methodParams.fuzzyInputMode ?? defaultFuzzyMode);
  const allowedDataModes = methodId === 'dematel' ? ['Single expert matrix', 'Multiple experts'] : ['Single aggregated dataset', 'Multiple respondents'];
  const requestedDataInputMode = String(methodParams.dataInputMode ?? allowedDataModes[0]);
  const dataInputMode = allowedDataModes.includes(requestedDataInputMode) ? requestedDataInputMode : allowedDataModes[0];
  const nextParams = {
    ...methodParams,
    dataInputMode,
    respondentCount: dataInputMode === 'Multiple respondents' ? Math.max(2, Number(methodParams.respondentCount) || 2) : 1,
    dematelExpertCount: dataInputMode === 'Multiple experts' ? Math.max(2, Number(methodParams.dematelExpertCount) || 2) : Math.max(1, Number(methodParams.dematelExpertCount) || 1),
  };
  return {
    ...nextParams,
    fuzzyInputMode: allowedFuzzyModes.includes(fuzzyInputMode) ? fuzzyInputMode : defaultFuzzyMode,
  };
}

function sanitizeStudyConfig(config: StudyConfig): StudyConfig {
  const method = getMethod(config.methodId);
  return {
    ...config,
    weightingId: method.id === 'ahp' ? 'ahp' : method.supportsWeights ? config.weightingId : 'manual',
    methodParams: sanitizeMethodParams(method.id, config.methodParams),
  };
}

function hasStandardDecisionMatrix(input: DecisionMatrix) {
  return input.alternatives.length > 1
    && input.criteria.length > 0
    && input.values.length === input.alternatives.length
    && input.values.every((row) => row.length === input.criteria.length && row.every((value) => Number.isFinite(value)));
}

function methodComparisonBlockReason(methodId: MethodId, config: StudyConfig, input: DecisionMatrix) {
  if (!hasStandardDecisionMatrix(input)) return 'This study does not have a standard alternatives-by-criteria decision matrix.';
  if (config.methodId === 'ahp') return 'AHP comparison is disabled because AHP uses pairwise priority data, not a normal decision matrix.';
  if (config.methodId === 'dematel') return 'DEMATEL comparison is disabled because DEMATEL is a cause-effect factor analysis, not an alternative ranking method.';
  if (methodId === 'ahp') return 'AHP uses pairwise comparison matrices and cannot reuse this uploaded decision matrix safely.';
  if (methodId === 'dematel') return 'DEMATEL uses direct-relation factor matrices and cannot reuse this uploaded decision matrix safely.';
  return '';
}

function comparableRankingMethods(config: StudyConfig, input: DecisionMatrix) {
  return methodRegistry.filter((method) => !methodComparisonBlockReason(method.id, config, input));
}

function isPreTemplateIssue(issue: ValidationResult['issues'][number]) {
  const uploadOnlyMessages = [
    'DEMATEL multiple-expert studies require at least one expert matrix sheet.',
    'DEMATEL expected',
  ];
  return issue.severity !== 'info' && !uploadOnlyMessages.some((message) => issue.message.includes(message));
}

function App() {
  const [config, setConfig] = useState<StudyConfig>(sampleConfig);
  const [input, setInput] = useState<DecisionMatrix>(sampleMatrix);
  const [step, setStep] = useState<WizardStep>(1);
  const [maxStep, setMaxStep] = useState<WizardStep>(1);
  const [query, setQuery] = useState('');
  const [methodFamily, setMethodFamily] = useState<MethodFamily>('all');
  const [loadingLabel, setLoadingLabel] = useState('');
  const [uploadAttempted, setUploadAttempted] = useState(false);
  const [validation, setValidation] = useState<ValidationResult>({ ok: true, issues: [] });
  const [resultTab, setResultTab] = useState('Final Result');
  const [compareIds, setCompareIds] = useState<MethodId[]>(['topsis', 'vikor', 'saw', 'waspas']);
  const [qualitySummary, setQualitySummary] = useState({ passed: 0, total: 0 });
  const [helpOpen, setHelpOpen] = useState(false);
  const method = getMethod(config.methodId);
  const analysis = useMemo(() => method.runAnalysis(input, config), [method, input, config]);
  const filteredMethods = methodRegistry.filter((item) => {
    const matchesQuery = `${item.name} ${item.fullName} ${methodPurpose[item.id]}`.toLowerCase().includes(query.toLowerCase());
    const matchesFamily = methodFamily === 'all' || methodFamilyById[item.id] === methodFamily;
    return matchesQuery && matchesFamily;
  });

  useEffect(() => {
    if (step !== 5 || qualitySummary.total) return;
    let cancelled = false;
    void import('./core/smokeChecks').then(({ runAlgorithmSmokeChecks }) => {
      if (cancelled) return;
      const checks = runAlgorithmSmokeChecks();
      setQualitySummary({ passed: checks.filter((check) => check.passed).length, total: checks.length });
    });
    return () => {
      cancelled = true;
    };
  }, [qualitySummary.total, step]);

  const transitionTo = (nextStep: WizardStep, label: string) => {
    setLoadingLabel(label);
    window.setTimeout(() => {
      setStep(nextStep);
      setMaxStep((current) => Math.max(current, nextStep) as WizardStep);
      setLoadingLabel('');
    }, 520);
  };

  const selectMethod = (methodId: MethodId) => {
    setConfig((current) => {
      const methodSupportsWeights = getMethod(methodId).supportsWeights;
      const methodParams = sanitizeMethodParams(methodId, current.methodParams);
      const nextConfig = {
        ...current,
        methodId,
        weightingId: methodId === 'ahp' ? 'ahp' as const : methodSupportsWeights ? current.weightingId : 'manual' as const,
        methodParams,
        alternatives: methodId === 'dematel' ? current.criteria.map((criterion) => ({ id: criterion.id, name: criterion.name })) : current.alternatives,
      };
      setInput((currentInput) => {
        const rows = methodId === 'dematel' ? nextConfig.criteria.length : nextConfig.alternatives.length;
        const columns = nextConfig.criteria.length;
        return {
          alternatives: nextConfig.alternatives,
          criteria: nextConfig.criteria,
          values: Array.from({ length: rows }, (_, rowIndex) =>
            Array.from({ length: columns }, (_, columnIndex) => methodId === 'dematel' && rowIndex === columnIndex ? 0 : currentInput.values[rowIndex]?.[columnIndex] ?? 1),
          ),
        };
      });
      return nextConfig;
    });
    setMaxStep(2);
    setUploadAttempted(false);
    setResultTab('Final Result');
    transitionTo(2, 'Preparing method specification...');
  };

  const handleStudyChange = (nextConfig: StudyConfig, nextInput: DecisionMatrix) => {
    const sanitizedConfig = sanitizeStudyConfig(nextConfig);
    setConfig(sanitizedConfig);
    setInput(nextInput);
    setValidation(getMethod(sanitizedConfig.methodId).validateWorkbook(nextInput, sanitizedConfig));
    setMaxStep((current) => Math.min(current, 3) as WizardStep);
  };

  const runConfiguredAnalysis = () => {
    const nextValidation = method.validateWorkbook(input, config);
    setUploadAttempted(true);
    setValidation(nextValidation);
    if (nextValidation.ok) {
      transitionTo(5, 'Running analysis on configured data...');
    } else {
      setStep(4);
      setMaxStep((current) => Math.max(current, 4) as WizardStep);
    }
  };

  const handleStepNavigation = (nextStep: WizardStep) => {
    if (nextStep === 5) {
      const nextValidation = method.validateWorkbook(input, config);
      setValidation(nextValidation);
      setUploadAttempted(true);
      if (!nextValidation.ok) {
        setStep(4);
        setMaxStep(4);
        return;
      }
    }
    setStep(nextStep);
  };

  const openTemplateStep = () => {
    transitionTo(3, 'Generating model-specific template...');
  };

  const downloadTemplateFile = async () => {
    setLoadingLabel('Preparing Excel template...');
    try {
      const { downloadTemplate } = await import('./services/workbook');
      await downloadTemplate(method.getTemplateSchema(config), `${method.name}-MCDM-template.xlsx`);
    } catch (error) {
      setValidation({ ok: false, issues: [{ severity: 'error', sheet: 'Template', location: method.name, message: error instanceof Error ? error.message : 'Unable to generate the template.' }] });
    } finally {
      setLoadingLabel('');
    }
  };

  const handleUpload = async (file: File) => {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setUploadAttempted(true);
      setValidation({ ok: false, issues: [{ severity: 'error', sheet: 'Upload', location: file.name, message: 'Unsupported file type. Upload .xlsx, .xls, or .csv.' }] });
      setStep(4);
      setMaxStep((current) => Math.max(current, 4) as WizardStep);
      return;
    }
    setLoadingLabel('Reading workbook and validating data...');
    setUploadAttempted(true);
    try {
      const { parseWorkbook } = await import('./services/workbook');
      const parsed = await parseWorkbook(file, config);
      if (parsed.config) setConfig(parsed.config);
      setInput(parsed.input);
      setValidation(parsed.validation);
      window.setTimeout(() => {
        setStep(parsed.validation.ok ? 5 : 4);
        setMaxStep((current) => Math.max(current, parsed.validation.ok ? 5 : 4) as WizardStep);
        setLoadingLabel('');
      }, 520);
    } catch (error) {
      setValidation({ ok: false, issues: [{ severity: 'error', sheet: 'Upload', location: file.name, message: error instanceof Error ? error.message : 'Unable to read workbook.' }] });
      setStep(4);
      setMaxStep((current) => Math.max(current, 4) as WizardStep);
      setLoadingLabel('');
    }
  };

  const handleImportProject = async (file: File) => {
    setLoadingLabel('Opening local project...');
    try {
      const project = await importProject(file);
      const sanitizedConfig = sanitizeStudyConfig(project.config);
      const projectValidation = getMethod(sanitizedConfig.methodId).validateWorkbook(project.input, sanitizedConfig);
      setConfig(sanitizedConfig);
      setInput(project.input);
      setValidation(projectValidation);
      setUploadAttempted(true);
      if (project.resultTab) setResultTab(project.resultTab);
      if (project.compareIds?.length) {
        setCompareIds(project.compareIds.filter((id): id is MethodId => methodRegistry.some((method) => method.id === id) && !methodComparisonBlockReason(id as MethodId, sanitizedConfig, project.input)));
      }
      window.setTimeout(() => {
        const requestedStep = project.step && project.step >= 1 && project.step <= 5 ? project.step as WizardStep : 5;
        const resumedStep = projectValidation.ok ? requestedStep : Math.min(requestedStep, 4) as WizardStep;
        setStep(resumedStep);
        setMaxStep((current) => Math.max(current, resumedStep) as WizardStep);
        setLoadingLabel('');
      }, 420);
    } catch (error) {
      setValidation({ ok: false, issues: [{ severity: 'error', sheet: 'Project', location: file.name, message: error instanceof Error ? error.message : 'Unable to open project file.' }] });
      setStep(4);
      setMaxStep((current) => Math.max(current, 4) as WizardStep);
      setLoadingLabel('');
    }
  };

  const saveProject = () => {
    exportProject(config, input, step, resultTab, compareIds, validation.issues.length);
  };

  const exportExcel = async () => {
    setLoadingLabel('Preparing Excel workbook...');
    try {
      const { exportAnalysisWorkbook } = await import('./services/exports');
      await exportAnalysisWorkbook(analysis);
    } finally {
      setLoadingLabel('');
    }
  };

  const exportDoc = async () => {
    setLoadingLabel('Preparing DOCX report...');
    try {
      const { exportDocx } = await import('./services/exports');
      await exportDocx(analysis);
    } finally {
      setLoadingLabel('');
    }
  };

  const exportPdfReport = async () => {
    setLoadingLabel('Preparing PDF report...');
    try {
      const { exportPdf } = await import('./services/exports');
      await exportPdf(analysis);
    } finally {
      setLoadingLabel('');
    }
  };

  const exportAll = async () => {
    setLoadingLabel('Preparing publication package...');
    try {
      const { exportAnalysisWorkbook, exportDocx, exportPdf } = await import('./services/exports');
      await exportAnalysisWorkbook(analysis);
      await exportDocx(analysis);
      await exportPdf(analysis);
      exportProject(config, input, step, resultTab, compareIds, validation.issues.length);
    } finally {
      setLoadingLabel('');
    }
  };

  return (
    <div className="studio">
      {loadingLabel ? <LoadingOverlay label={loadingLabel} /> : null}
      <header className="studioHeader">
        <div className="studioBrand">
          <div className="studioMark"><FileSpreadsheet size={20} /></div>
          <strong>MCDM Studio</strong>
        </div>
        <div className="localStatus"><span />Local browser analysis</div>
        <div className="headerActions">
          <button className="ghostButton" onClick={() => setHelpOpen((current) => !current)}><HelpCircle size={16} />Help</button>
          <button className="ghostButton" onClick={saveProject}><Download size={16} />Save project</button>
          <label className="ghostButton fileButton"><Upload size={16} />Import<input type="file" accept=".json" onChange={(event) => {
            const file = event.target.files?.[0];
            event.currentTarget.value = '';
            if (file) void handleImportProject(file);
          }} /></label>
        </div>
      </header>

      <main className="wizardShell">
        {helpOpen ? (
          <HelpPage onClose={() => setHelpOpen(false)} onStart={() => {
            setHelpOpen(false);
            setStep(1);
          }} />
        ) : (
          <>
            <Stepper activeStep={step} maxStep={maxStep} onStep={handleStepNavigation} />
            {step === 1 ? <MethodStep query={query} family={methodFamily} onQuery={setQuery} onFamily={setMethodFamily} methods={filteredMethods} onSelect={selectMethod} /> : null}
            {step === 2 ? <ConfigureStep config={config} input={input} method={method} onChange={handleStudyChange} onNext={openTemplateStep} /> : null}
            {step === 3 ? <TemplateStep config={config} methodName={method.name} onDownload={downloadTemplateFile} onBack={() => setStep(2)} onNext={() => transitionTo(4, 'Preparing upload workspace...')} /> : null}
            {step === 4 ? <UploadStep config={config} methodName={method.name} validation={validation} uploadAttempted={uploadAttempted} onUpload={handleUpload} onBack={() => setStep(3)} onSample={runConfiguredAnalysis} /> : null}
            {step === 5 ? <ResultsStep config={config} analysis={analysis} checksPassed={qualitySummary.passed} checksTotal={qualitySummary.total} activeTab={resultTab} compareIds={compareIds} onTab={setResultTab} onCompareIds={setCompareIds} onEdit={() => setStep(2)} onUpload={() => setStep(4)} onJson={saveProject} onExcel={exportExcel} onDocx={exportDoc} onPdf={exportPdfReport} onExport={exportAll} /> : null}
          </>
        )}
      </main>
    </div>
  );
}

function HelpPage({ onClose, onStart }: { onClose: () => void; onStart: () => void }) {
  const workflow = [
    ['Select Method', 'Choose one MCDM model using search, method family, or validation evidence filters.'],
    ['Configure', 'Set alternatives, criteria or factors, benefit/cost directions, weights, fuzzy mode, respondent mode, and method-specific parameters.'],
    ['Template', 'Download the generated Excel template. The sheets and sample rows change according to the selected method and specifications.'],
    ['Upload', 'Fill the workbook, upload it back, and review validation messages before running the analysis.'],
    ['Results', 'Review intermediate tables, diagnostics, rankings or cause-effect results, visualizations, and export options.'],
  ];
  return (
    <section className="helpPage">
      <div className="helpHero">
        <div>
          <span className="eyebrow">User guide</span>
          <h1>How to use MCDM Studio</h1>
          <p>Use this guide when setting up a study, preparing Excel data, working with fuzzy or respondent data, and exporting publication material.</p>
        </div>
        <div className="helpActions">
          <button className="secondaryAction" onClick={onClose}>Back to app</button>
          <button className="primaryAction" onClick={onStart}>Start from method selection <ArrowRight size={16} /></button>
        </div>
      </div>

      <div className="helpGrid">
        <article className="helpCard wide">
          <h2>Standard Workflow</h2>
          <div className="helpTimeline">
            {workflow.map(([title, text], index) => (
              <div key={title}>
                <span>{index + 1}</span>
                <strong>{title}</strong>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="helpCard">
          <h2>Data Setup</h2>
          <ul>
            <li>Use one row per alternative and one column per criterion for ranking methods.</li>
            <li>For DEMATEL, use factors and direct-relation matrices instead of alternatives.</li>
            <li>Mark every criterion as benefit or cost before generating the template.</li>
            <li>Manual weights are editable; automatic/equal weights are calculated by the app.</li>
          </ul>
        </article>

        <article className="helpCard">
          <h2>Excel Templates</h2>
          <ul>
            <li>Download a fresh template after changing method, criteria, factors, fuzzy mode, or respondent count.</li>
            <li>Keep sheet names and header names unchanged.</li>
            <li>Use the sample rows on the Template screen as the expected data shape.</li>
            <li>Validation messages identify the sheet and location that need correction.</li>
          </ul>
        </article>

        <article className="helpCard">
          <h2>Fuzzy Data</h2>
          <ul>
            <li>Triangular values use `(l,m,u)`, for example `(2,3,5)`.</li>
            <li>Trapezoidal values use `(a,b,c,d)`, for example `(1,2,4,6)`.</li>
            <li>All 65 methods support native triangular/trapezoidal fuzzy workflows.</li>
            <li>Advanced fuzzy families are future variants, not hidden aliases.</li>
          </ul>
        </article>

        <article className="helpCard">
          <h2>Respondents And Experts</h2>
          <ul>
            <li>Ordinary ranking methods can aggregate multiple respondent decision matrices.</li>
            <li>AHP pairwise respondent judgments aggregate by geometric mean.</li>
            <li>DEMATEL supports multiple expert direct-relation matrices.</li>
            <li>Reports include disagreement and consensus diagnostics where group data is used.</li>
          </ul>
        </article>

        <article className="helpCard">
          <h2>Results And Exports</h2>
          <ul>
            <li>Use result tabs to inspect inputs, transformed matrices, diagnostics, final results, sensitivity, and visualizations.</li>
            <li>Export Excel for all calculation tables and validation evidence.</li>
            <li>Export DOCX or PDF for a report-style research appendix.</li>
            <li>Save Project JSON when you want to resume or share the local study state.</li>
          </ul>
        </article>

        <article className="helpCard">
          <h2>Common Fixes</h2>
          <ul>
            <li>If upload fails, check that you used the template for the selected method.</li>
            <li>If weights are not editable, the selected weighting mode is automatic or self-weighted.</li>
            <li>If results are blocked, correct validation errors before continuing.</li>
            <li>If study shape changes, re-download the template so workbook dimensions match.</li>
          </ul>
        </article>
      </div>
    </section>
  );
}

function Stepper({ activeStep, maxStep, onStep }: { activeStep: WizardStep; maxStep: WizardStep; onStep: (step: WizardStep) => void }) {
  return (
    <nav className="wizardStepper">
      {steps.map((label, index) => {
        const number = (index + 1) as WizardStep;
        const locked = number > maxStep;
        return (
          <button key={label} className={activeStep === number ? 'active' : activeStep > number ? 'done' : locked ? 'locked' : ''} onClick={() => !locked && onStep(number)} disabled={locked} title={locked ? 'Complete the previous step first' : label}>
            <span>{activeStep > number ? <Check size={14} /> : number}</span>
            <em>{label}</em>
          </button>
        );
      })}
    </nav>
  );
}

function MethodStep({ query, family, onQuery, onFamily, methods, onSelect }: { query: string; family: MethodFamily; onQuery: (value: string) => void; onFamily: (value: MethodFamily) => void; methods: typeof methodRegistry; onSelect: (id: MethodId) => void }) {
  const [selectedId, setSelectedId] = useState<MethodId>(methods[0]?.id ?? 'topsis');
  const [evidenceFilter, setEvidenceFilter] = useState<'all' | 'validated' | 'candidate' | 'internal'>('all');
  const familyCounts = methodRegistry.reduce<Record<MethodFamily, number>>((acc, method) => {
    acc.all += 1;
    acc[methodFamilyById[method.id]] += 1;
    return acc;
  }, Object.keys(methodFamilies).reduce((acc, id) => ({ ...acc, [id]: 0 }), {} as Record<MethodFamily, number>));
  useEffect(() => {
    if (!methods.some((method) => method.id === selectedId) && methods[0]) {
      setSelectedId(methods[0].id);
    }
  }, [methods, selectedId]);
  const inputSummary = (method: MethodDefinition) =>
    method.id === 'dematel' ? 'Factor influence matrix' : 'Decision matrix';
  const capabilityBadges = (method: MethodDefinition) => [
    method.id === 'dematel' ? 'Cause-effect' : 'Ranking',
    method.supportsWeights ? 'Weights' : 'Self-weighted',
    method.id === 'dematel' ? 'Expert sheets' : 'Respondent sheets',
    method.fuzzySupport.nativeModeLabel ? 'Native fuzzy' : 'Defuzzify fuzzy',
  ];
  const evidenceCounts = externalValidationSummaryFor(methodRegistry.map((method) => method.id));
  const methodWithCandidateCount = methods.filter((method) => externalValidationCandidatesFor(method.id).length > 0).length;
  const filteredMethods = methods.filter((method) => {
    if (evidenceFilter === 'all') return true;
    if (evidenceFilter === 'candidate') return externalValidationCandidatesFor(method.id).length > 0;
    return externalValidationStatusFor(method.id).tone === evidenceFilter;
  });
  const selectedMethod = filteredMethods.find((method) => method.id === selectedId) ?? filteredMethods[0] ?? methods[0] ?? methodRegistry[0];
  const selectedValidation = externalValidationStatusFor(selectedMethod.id);
  return (
    <section className="singlePanel">
        <div className="sectionTitle">
          <h1>Choose an MCDM method</h1>
          <p>Select the decision model. The app then shows only the specifications, template, upload, and results for that method.</p>
        </div>
        <div className="methodChooser">
          <div className="methodPickPanel">
            <label className="searchBox"><Search size={17} /><input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search methods..." /></label>
            <label className="methodSelectLabel">
              <span>Method family</span>
              <select aria-label="Method family" value={family} onChange={(event) => onFamily(event.target.value as MethodFamily)}>
                {Object.entries(methodFamilies).map(([id, label]) => <option key={id} value={id}>{label} ({familyCounts[id as MethodFamily]})</option>)}
              </select>
            </label>
            <label className="methodSelectLabel">
              <span>Validation evidence</span>
              <select aria-label="Validation evidence" value={evidenceFilter} onChange={(event) => setEvidenceFilter(event.target.value as typeof evidenceFilter)}>
                <option value="all">All evidence levels ({methods.length})</option>
                <option value="validated">External fixtures ({methods.filter((method) => externalValidationStatusFor(method.id).tone === 'validated').length})</option>
                <option value="candidate">Methods with candidates ({methodWithCandidateCount})</option>
                <option value="internal">Internal only ({methods.filter((method) => externalValidationStatusFor(method.id).tone === 'internal').length})</option>
              </select>
            </label>
            <label className="methodSelectLabel">
              <span>Method</span>
              <select aria-label="MCDM method" value={selectedMethod.id} onChange={(event) => setSelectedId(event.target.value as MethodId)} disabled={!filteredMethods.length}>
                {filteredMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
              </select>
            </label>
            <button className="primaryAction methodContinue" onClick={() => onSelect(selectedMethod.id)} disabled={!filteredMethods.length}>Continue with {selectedMethod.name}<ArrowRight size={16} /></button>
          </div>
          <div className="selectedMethodPanel">
            <span className="eyebrow">Selected model</span>
            {filteredMethods.length ? (
              <>
                <h2>{selectedMethod.name}</h2>
                <p>{methodPurpose[selectedMethod.id]}</p>
                <div className={`validationBadge ${selectedValidation.tone}`}>
                  <strong>{selectedValidation.label}</strong>
                  <span>{selectedValidation.text}</span>
                </div>
                <div className="validationSummary" aria-label="External validation coverage summary">
                  <span><strong>{evidenceCounts.validated}</strong> externally validated</span>
                  <span><strong>{evidenceCounts.candidateFixtures}</strong> validation candidates</span>
                  <span><strong>{evidenceCounts.internal}</strong> internal only</span>
                </div>
                <div className="methodSupport large">
                  <em>{inputSummary(selectedMethod)}</em>
                  <i>{methodFamilies[methodFamilyById[selectedMethod.id]]}</i>
                  {capabilityBadges(selectedMethod).map((badge) => <i key={badge}>{badge}</i>)}
                </div>
              </>
            ) : (
              <p>No methods match the current search, family, and validation filters.</p>
            )}
          </div>
        </div>
        {filteredMethods.length > 1 ? (
          <details className="methodCatalog">
            <summary>Browse {filteredMethods.length} matching methods</summary>
            <div className="methodCatalogGrid">
              {filteredMethods.map((method) => (
                <button key={method.id} className={method.id === selectedMethod.id ? 'active' : ''} onClick={() => setSelectedId(method.id)}>
                  <strong>{method.name}</strong>
                  <em className={`catalogValidation ${externalValidationStatusFor(method.id).tone}`}>{externalValidationStatusFor(method.id).label}</em>
                  <span>{methodPurpose[method.id]}</span>
                </button>
              ))}
            </div>
          </details>
        ) : null}
    </section>
  );
}

function ConfigureStep({ config, input, method, onChange, onNext }: { config: StudyConfig; input: DecisionMatrix; method: ReturnType<typeof getMethod>; onChange: (config: StudyConfig, input: DecisionMatrix) => void; onNext: () => void }) {
  const isDematel = config.methodId === 'dematel';
  const isAHP = config.methodId === 'ahp';
  const showAHPPairwise = isAHP || config.weightingId === 'ahp';
  const usesManualWeights = method.supportsWeights && config.weightingId === 'manual';
  const usesAHPWeights = method.supportsWeights && config.weightingId === 'ahp';
  const usesAutomaticWeights = method.supportsWeights && !usesManualWeights && !usesAHPWeights;
  const usesBwmWeights = method.supportsWeights && config.weightingId === 'bwm';
  const usesDibrWeights = method.supportsWeights && config.weightingId === 'dibr';
  const usesSimosWeights = method.supportsWeights && config.weightingId === 'simos';
  const usesSwaraWeights = method.supportsWeights && config.weightingId === 'swara';
  const usesRocWeights = method.supportsWeights && config.weightingId === 'roc';
  const usesFucomWeights = method.supportsWeights && config.weightingId === 'fucom';
  const usesLbwaWeights = method.supportsWeights && config.weightingId === 'lbwa';
  const usesPipreciaWeights = method.supportsWeights && config.weightingId === 'piprecia';
  const usesRankSumWeights = method.supportsWeights && config.weightingId === 'rankSum';
  const usesRankReciprocalWeights = method.supportsWeights && config.weightingId === 'rankReciprocal';
  const usesRancomWeights = method.supportsWeights && config.weightingId === 'rancom';
  const usesManualSpotisBounds = method.id === 'spotis' && config.methodParams.spotisBounds === 'Manual bounds';
  const usesManualEspSpotisBounds = method.id === 'espSpotis' && config.methodParams.espSpotisBounds === 'Manual bounds';
  const usesManualBalancedSpotisBounds = method.id === 'balancedSpotis' && config.methodParams.balancedSpotisBounds === 'Manual bounds';
  const usesManualRimInterval = method.id === 'rim' && config.methodParams.rimReference === 'Manual ideal interval';
  const usesManualRafsiReference = method.id === 'rafsi' && config.methodParams.rafsiReferenceMode === 'Manual reference values';
  const usesManualLopmLimits = method.id === 'lopm' && config.methodParams.lopmLimitsMode === 'Manual property limits';
  const usesManualErvdReference = method.id === 'ervd' && config.methodParams.ervdReferenceMode === 'Manual reference point';
  const weightingLabel = weightingDisplayName(config.weightingId);
  const calculatedWeightLabel = `${weightingLabel} weights calculated`;
  const dataInputMode = String(config.methodParams.dataInputMode ?? (isDematel ? 'Single expert matrix' : 'Single aggregated dataset'));
  const usesGroupData = isDematel ? dataInputMode === 'Multiple experts' : dataInputMode === 'Multiple respondents';
  const prometheePreferenceFunction = String(config.methodParams.preferenceFunction ?? 'Usual');
  const pughScoringMode = String(config.methodParams.pughScoringMode ?? 'Compare performance to baseline');
  const currentValidation = method.validateWorkbook(input, config);
  const preTemplateIssues = currentValidation.issues.filter(isPreTemplateIssue);
  const canGenerateTemplate = !preTemplateIssues.some((issue) => issue.severity === 'error');
  const visibleSpecificationFields = method.specificationFields.filter((field) => {
    if (field.key === 'dematelExpertCount') return usesGroupData;
    if (field.key === 'dematelManualThreshold') return config.methodParams.dematelThreshold === 'Manual threshold';
    if (field.key === 'vikorAcceptableAdvantageDQ') return config.methodParams.vikorAcceptableAdvantageMode === 'Manual DQ';
    if (field.key === 'prometheeIndifferenceThreshold') return ['U-shape', 'Level', 'Linear'].includes(prometheePreferenceFunction);
    if (field.key === 'prometheePreferenceThreshold') return ['V-shape', 'Level', 'Linear'].includes(prometheePreferenceFunction);
    if (field.key === 'prometheeGaussianSigma') return prometheePreferenceFunction === 'Gaussian';
    if (field.key === 'pughBaselineAlternative' || field.key === 'pughIndifferenceTolerance') return pughScoringMode === 'Compare performance to baseline';
    if (field.key === 'pughScoreTransform') return pughScoringMode === 'Use uploaded Pugh scores';
    if (field.key === 'espSpotisPoint') return method.id !== 'balancedSpotis';
    if (['spotisLowerBounds', 'spotisUpperBounds', 'rimDomainLower', 'rimDomainUpper', 'rimIdealLower', 'rimIdealUpper', 'rafsiIdealValues', 'rafsiAntiIdealValues', 'lopmPropertyTypes', 'lopmPropertyLimits', 'ervdReferencePoint'].includes(field.key)) return false;
    return true;
  });
  const alternativeLabel = isDematel ? 'Factor' : 'Alternative';
  const criteriaLabel = isDematel ? 'Factor details' : 'Criteria';
  const matrixLabel = isDematel ? 'Direct relation matrix' : method.id === 'ahp' ? 'Alternative performance matrix' : 'Decision matrix';
  const resizeValues = (rows: number, columns: number, source = input.values) =>
    Array.from({ length: rows }, (_, rowIndex) =>
      Array.from({ length: columns }, (_, columnIndex) => source[rowIndex]?.[columnIndex] ?? (isDematel && rowIndex === columnIndex ? 0 : 1)),
    );
  const resizePairwise = (size: number, source = config.ahpCriteriaPairwise ?? []) =>
    Array.from({ length: size }, (_, rowIndex) =>
      Array.from({ length: size }, (_, columnIndex) => {
        if (rowIndex === columnIndex) return 1;
        const direct = Number(source[rowIndex]?.[columnIndex]);
        const reciprocal = Number(source[columnIndex]?.[rowIndex]);
        if (Number.isFinite(direct) && direct > 0) return direct;
        if (Number.isFinite(reciprocal) && reciprocal > 0) return Number((1 / reciprocal).toFixed(4));
        return 1;
      }),
    );
  const resizeAlternativePairwise = (criterionId: string, size: number, source = config.ahpAlternativePairwise?.[criterionId] ?? []) =>
    Array.from({ length: size }, (_, rowIndex) =>
      Array.from({ length: size }, (_, columnIndex) => {
        if (rowIndex === columnIndex) return 1;
        const direct = Number(source[rowIndex]?.[columnIndex]);
        const reciprocal = Number(source[columnIndex]?.[rowIndex]);
        if (Number.isFinite(direct) && direct > 0) return direct;
        if (Number.isFinite(reciprocal) && reciprocal > 0) return Number((1 / reciprocal).toFixed(4));
        return 1;
      }),
    );
  const parseList = (value: unknown) => String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
  const reconcileList = (value: unknown, size: number, fallback: string) => {
    const parsed = parseList(value);
    return [...parsed, ...Array.from({ length: size }, () => fallback)].slice(0, size);
  };
  const reconcileOrder = (value: unknown, criteria: StudyConfig['criteria']) => {
    const ids = criteria.map((criterion) => criterion.id);
    const parsed = parseList(value).filter((id, index, list) => ids.includes(id) && list.indexOf(id) === index);
    return [...parsed, ...ids.filter((id) => !parsed.includes(id))].join(',');
  };
  const reconcileSimosGroups = (value: unknown, criteria: StudyConfig['criteria']) => {
    const ids = criteria.map((criterion) => criterion.id);
    const groups = String(value ?? '')
      .split('|')
      .map((group) => group.split(',').map((item) => item.trim()).filter((id, index, list) => ids.includes(id) && list.indexOf(id) === index))
      .filter((group) => group.length);
    const used = new Set(groups.flat());
    const missing = ids.filter((id) => !used.has(id));
    return [...groups, ...missing.map((id) => [id])].map((group) => group.join(',')).join(' | ');
  };
  const reconcileNumberVector = (value: unknown, size: number, fallback = 1) => {
    const parsed = parseList(value).map((item) => Number(item)).filter((item) => Number.isFinite(item) && item >= 0);
    return [...parsed, ...Array.from({ length: size }, () => fallback)].slice(0, size);
  };
  const reconcileWeightingParams = (nextConfig: StudyConfig): StudyConfig['methodParams'] => {
    const params = { ...nextConfig.methodParams };
    if (nextConfig.weightingId === 'bwm') {
      const criterionIds = nextConfig.criteria.map((criterion) => criterion.id);
      const bestCriterion = criterionIds.includes(String(params.bwmBestCriterion)) ? String(params.bwmBestCriterion) : criterionIds[0] ?? '';
      const worstCriterion = criterionIds.includes(String(params.bwmWorstCriterion)) && String(params.bwmWorstCriterion) !== bestCriterion
        ? String(params.bwmWorstCriterion)
        : criterionIds.find((id) => id !== bestCriterion) ?? bestCriterion;
      const bestToOthers = reconcileNumberVector(params.bwmBestToOthers, nextConfig.criteria.length, 1).map((value) => Math.max(1, value));
      const othersToWorst = reconcileNumberVector(params.bwmOthersToWorst, nextConfig.criteria.length, 1).map((value) => Math.max(1, value));
      const bestIndex = criterionIds.indexOf(bestCriterion);
      const worstIndex = criterionIds.indexOf(worstCriterion);
      if (bestIndex >= 0) bestToOthers[bestIndex] = 1;
      if (worstIndex >= 0) othersToWorst[worstIndex] = 1;
      params.bwmBestCriterion = bestCriterion;
      params.bwmWorstCriterion = worstCriterion;
      params.bwmBestToOthers = bestToOthers.join(',');
      params.bwmOthersToWorst = othersToWorst.join(',');
    }
    if (nextConfig.weightingId === 'dibr') {
      params.dibrOrder = reconcileOrder(params.dibrOrder, nextConfig.criteria);
      params.dibrAdjacentRatios = reconcileNumberVector(params.dibrAdjacentRatios, Math.max(nextConfig.criteria.length - 1, 0), 1).map((value) => Math.max(1, value)).join(',');
      const product = String(params.dibrAdjacentRatios).split(',').map((value) => Number(value)).filter(Number.isFinite).reduce((acc, value) => acc * Math.max(1, value), 1);
      params.dibrFirstLastRatio = Math.max(1, Number(params.dibrFirstLastRatio) || product);
    }
    if (nextConfig.weightingId === 'simos') {
      params.simosGroups = reconcileSimosGroups(params.simosGroups, nextConfig.criteria);
      const groupCount = String(params.simosGroups).split('|').map((group) => group.trim()).filter(Boolean).length;
      params.simosBlankCards = reconcileNumberVector(params.simosBlankCards, Math.max(groupCount - 1, 0), 0).map((value) => Math.max(0, Math.round(value))).join(',');
      params.simosZRatio = Math.max(1, Number(params.simosZRatio) || 1);
    }
    if (nextConfig.weightingId === 'swara') {
      params.swaraOrder = reconcileOrder(params.swaraOrder, nextConfig.criteria);
      params.swaraComparativeImportance = reconcileNumberVector(params.swaraComparativeImportance, nextConfig.criteria.length, 0).join(',');
    }
    if (nextConfig.weightingId === 'roc') {
      params.rocOrder = reconcileOrder(params.rocOrder, nextConfig.criteria);
    }
    if (nextConfig.weightingId === 'fucom') {
      params.fucomOrder = reconcileOrder(params.fucomOrder, nextConfig.criteria);
      params.fucomComparativePriorities = reconcileNumberVector(params.fucomComparativePriorities, Math.max(nextConfig.criteria.length - 1, 0), 1).map((value) => Math.max(1, value)).join(',');
    }
    if (nextConfig.weightingId === 'lbwa') {
      params.lbwaLevels = reconcileNumberVector(params.lbwaLevels, nextConfig.criteria.length, 1).map((value) => Math.max(1, Math.round(value))).join(',');
      params.lbwaImportance = reconcileNumberVector(params.lbwaImportance, nextConfig.criteria.length, 0).map((value) => Math.max(0, value)).join(',');
      params.lbwaElasticity = Math.max(Number(params.lbwaElasticity) || 5, Math.max(...String(params.lbwaLevels).split(',').map((value) => Number(value)).filter(Number.isFinite), 1));
    }
    if (nextConfig.weightingId === 'piprecia') {
      params.pipreciaOrder = reconcileOrder(params.pipreciaOrder, nextConfig.criteria);
      params.pipreciaRelativeSignificance = reconcileNumberVector(params.pipreciaRelativeSignificance, nextConfig.criteria.length, 1).map((value) => Math.min(1.9999, Math.max(0.0001, value))).join(',');
    }
    if (nextConfig.weightingId === 'rankSum') {
      params.rankSumOrder = reconcileOrder(params.rankSumOrder, nextConfig.criteria);
    }
    if (nextConfig.weightingId === 'rankReciprocal') {
      params.rankReciprocalOrder = reconcileOrder(params.rankReciprocalOrder, nextConfig.criteria);
    }
    if (nextConfig.weightingId === 'rancom') {
      params.rancomRanks = reconcileNumberVector(params.rancomRanks, nextConfig.criteria.length, 1).map((value) => Math.max(1, value)).join(',');
    }
    if (nextConfig.methodId === 'spotis' || nextConfig.methodId === 'espSpotis' || nextConfig.methodId === 'balancedSpotis') {
      params.spotisLowerBounds = reconcileNumberVector(params.spotisLowerBounds, nextConfig.criteria.length, 0).join(',');
      params.spotisUpperBounds = reconcileNumberVector(params.spotisUpperBounds, nextConfig.criteria.length, 1).join(',');
      params.espSpotisPoint = reconcileNumberVector(params.espSpotisPoint, nextConfig.criteria.length, 0).join(',');
    }
    if (nextConfig.methodId === 'rim') {
      params.rimDomainLower = reconcileNumberVector(params.rimDomainLower, nextConfig.criteria.length, 0).join(',');
      params.rimDomainUpper = reconcileNumberVector(params.rimDomainUpper, nextConfig.criteria.length, 1).join(',');
      params.rimIdealLower = reconcileNumberVector(params.rimIdealLower, nextConfig.criteria.length, 0).join(',');
      params.rimIdealUpper = reconcileNumberVector(params.rimIdealUpper, nextConfig.criteria.length, 1).join(',');
    }
    if (nextConfig.methodId === 'rafsi') {
      params.rafsiIdealValues = reconcileNumberVector(params.rafsiIdealValues, nextConfig.criteria.length, 1).join(',');
      params.rafsiAntiIdealValues = reconcileNumberVector(params.rafsiAntiIdealValues, nextConfig.criteria.length, 0).join(',');
    }
    if (nextConfig.methodId === 'lopm') {
      params.lopmPropertyTypes = reconcileList(params.lopmPropertyTypes, nextConfig.criteria.length, 'lower').join(',');
      params.lopmPropertyLimits = reconcileNumberVector(params.lopmPropertyLimits, nextConfig.criteria.length, 1).join(',');
    }
    if (nextConfig.methodId === 'ervd') {
      params.ervdReferencePoint = reconcileNumberVector(params.ervdReferencePoint, nextConfig.criteria.length, 1).join(',');
    }
    if (nextConfig.methodId === 'pugh') {
      const alternativeIds = nextConfig.alternatives.map((alternative) => alternative.id);
      params.pughBaselineAlternative = alternativeIds.includes(String(params.pughBaselineAlternative)) ? String(params.pughBaselineAlternative) : alternativeIds[0] ?? '';
      params.pughIndifferenceTolerance = Math.max(0, Number(params.pughIndifferenceTolerance) || 0);
    }
    if (nextConfig.methodId === 'lexicographic') {
      params.lexicographicOrder = reconcileOrder(params.lexicographicOrder, nextConfig.criteria);
    }
    if (nextConfig.methodId === 'smarter') {
      params.smarterOrder = reconcileOrder(params.smarterOrder, nextConfig.criteria);
    }
    return params;
  };
  const applyStructure = (nextConfig: StudyConfig, source = input.values) => {
    const rows = isDematel ? nextConfig.criteria.length : nextConfig.alternatives.length;
    const columns = nextConfig.criteria.length;
    const alternatives = isDematel ? nextConfig.criteria.map((criterion) => ({ id: criterion.id, name: criterion.name })) : nextConfig.alternatives;
    const sizedConfig = { ...nextConfig, alternatives, methodParams: reconcileWeightingParams(nextConfig), ahpCriteriaPairwise: resizePairwise(nextConfig.criteria.length, nextConfig.ahpCriteriaPairwise) };
    sizedConfig.ahpAlternativePairwise = nextConfig.criteria.reduce<Record<string, number[][]>>((acc, criterion) => {
      acc[criterion.id] = resizeAlternativePairwise(criterion.id, alternatives.length, nextConfig.ahpAlternativePairwise?.[criterion.id]);
      return acc;
    }, {});
    onChange(sizedConfig, {
      ...input,
      alternatives,
      criteria: nextConfig.criteria,
      values: resizeValues(rows, columns, source),
    });
  };
  const updateConfig = (nextConfig: StudyConfig) => applyStructure(nextConfig);
  const addAlternative = () => {
    const nextIndex = config.alternatives.length + 1;
    applyStructure({
      ...config,
      alternatives: [...config.alternatives, { id: `A${nextIndex}`, name: `Alternative ${nextIndex}` }],
    });
  };
  const removeAlternative = (index: number) => {
    if (config.alternatives.length <= 1) return;
    const alternatives = config.alternatives.filter((_, current) => current !== index);
    const values = input.values.filter((_, current) => current !== index);
    applyStructure({ ...config, alternatives }, values);
  };
  const updateAlternative = (index: number, name: string) => {
    const alternatives = config.alternatives.map((alternative, current) => current === index ? { ...alternative, name } : alternative);
    applyStructure({ ...config, alternatives });
  };
  const addCriterion = () => {
    const nextIndex = config.criteria.length + 1;
    const criteria = [
      ...config.criteria,
      { id: `C${nextIndex}`, name: isDematel ? `Factor ${nextIndex}` : `Criterion ${nextIndex}`, direction: 'benefit' as const, weight: 0 },
    ];
    applyStructure({ ...config, criteria });
  };
  const removeCriterion = (index: number) => {
    if (config.criteria.length <= 1) return;
    const criteria = config.criteria.filter((_, current) => current !== index);
    const values = isDematel
      ? input.values.filter((_, row) => row !== index).map((row) => row.filter((_, column) => column !== index))
      : input.values.map((row) => row.filter((_, column) => column !== index));
    applyStructure({ ...config, criteria }, values);
  };
  const updateCriterion = (index: number, field: 'name' | 'direction' | 'weight', value: string) => {
    const criteria = config.criteria.map((criterion, current) => {
      if (current !== index) return criterion;
      if (field === 'weight') return { ...criterion, weight: Number(value) || 0 };
      if (field === 'direction') return { ...criterion, direction: value === 'cost' ? 'cost' as const : 'benefit' as const };
      return { ...criterion, name: value };
    });
    applyStructure({ ...config, criteria });
  };
  const updateValue = (rowIndex: number, columnIndex: number, value: string) => {
    const values = input.values.map((row, r) => r === rowIndex ? row.map((cell, c) => c === columnIndex ? Number(value) : cell) : row);
    onChange(config, { ...input, values });
  };
  const updatePairwise = (rowIndex: number, columnIndex: number, value: string) => {
    if (rowIndex === columnIndex) return;
    const numeric = Math.max(Number(value) || 1, 0.0001);
    const matrix = resizePairwise(config.criteria.length).map((row) => [...row]);
    matrix[rowIndex][columnIndex] = numeric;
    matrix[columnIndex][rowIndex] = Number((1 / numeric).toFixed(4));
    onChange({ ...config, ahpCriteriaPairwise: matrix }, input);
  };
  const updateAlternativePairwise = (criterionId: string, rowIndex: number, columnIndex: number, value: string) => {
    if (rowIndex === columnIndex) return;
    const numeric = Math.max(Number(value) || 1, 0.0001);
    const matrix = resizeAlternativePairwise(criterionId, config.alternatives.length).map((row) => [...row]);
    matrix[rowIndex][columnIndex] = numeric;
    matrix[columnIndex][rowIndex] = Number((1 / numeric).toFixed(4));
    onChange({ ...config, ahpAlternativePairwise: { ...(config.ahpAlternativePairwise ?? {}), [criterionId]: matrix } }, input);
  };
  const updateParam = (key: string, value: string) => {
    const field = method.specificationFields.find((item) => item.key === key);
    let nextValue: string | number = field?.type === 'number' ? Number(value) : value;
    if (key === 'respondentCount' && dataInputMode === 'Multiple respondents') nextValue = Math.max(2, Number(value) || 2);
    if (key === 'ahpRespondentCount' && dataInputMode === 'Multiple respondents') nextValue = Math.max(2, Number(value) || 2);
    if (key === 'dematelExpertCount' && dataInputMode === 'Multiple experts') nextValue = Math.max(2, Number(value) || 2);
    updateConfig({ ...config, methodParams: { ...config.methodParams, [key]: nextValue } });
  };
  const updateOrderParam = (key: string, values: string[]) => {
    updateConfig({ ...config, methodParams: { ...config.methodParams, [key]: values.join(',') } });
  };
  const updateVectorParam = (key: string, values: number[]) => {
    updateConfig({ ...config, methodParams: { ...config.methodParams, [key]: values.join(',') } });
  };
  const updateListParam = (key: string, values: string[]) => {
    updateConfig({ ...config, methodParams: { ...config.methodParams, [key]: values.join(',') } });
  };
  const updateDataInputMode = (value: string) => {
    const nextParams: StudyConfig['methodParams'] = { ...config.methodParams, dataInputMode: value };
    if (isDematel) {
      nextParams.dematelExpertCount = value === 'Multiple experts' ? Math.max(2, Number(nextParams.dematelExpertCount) || 2) : 1;
    } else {
      nextParams.respondentCount = value === 'Multiple respondents' ? Math.max(2, Number(nextParams.respondentCount) || 2) : 1;
      if (showAHPPairwise) nextParams.ahpRespondentCount = value === 'Multiple respondents' ? Math.max(2, Number(nextParams.ahpRespondentCount ?? nextParams.respondentCount) || 2) : 1;
    }
    updateConfig({ ...config, methodParams: nextParams });
  };
  const numericBounds = (key: string) => {
    if (key === 'vikorV' || key === 'waspasLambda' || key === 'ahpConsistencyThreshold' || key === 'electreConcordance' || key === 'electreDiscordance' || key === 'graZeta' || key === 'aromanBeta' || key === 'aromanLambda' || key === 'balancedSpotisAlpha' || key === 'arlonGamma' || key === 'secaReferenceBalance' || key === 'eamrBeta' || key === 'eamrLambda' || key === 'macontLambda' || key === 'macontMu' || key === 'macontDelta' || key === 'macontTheta') return { min: 0, max: 1, step: 0.01 };
    if (key === 'vikorAcceptableAdvantageDQ') return { min: 0, max: 1, step: 0.001 };
    if (key === 'prometheeIndifferenceThreshold') return { min: 0, step: 0.01 };
    if (key === 'prometheePreferenceThreshold' || key === 'prometheeGaussianSigma') return { min: 0.0001, step: 0.01 };
    if (key === 'secaEpsilon') return { min: 0, max: 0.1, step: 0.001 };
    if (key === 'pughIndifferenceTolerance') return { min: 0, step: 0.01 };
    if (key === 'todimTheta' || key === 'rafsiIntervalLower' || key === 'rafsiIntervalUpper' || key === 'ervdLambda' || key === 'ervdAlpha') return { min: 0.01, step: 0.01 };
    if (key === 'dematelExpertCount') return { min: usesGroupData ? 2 : 1, step: 1 };
    return { step: 0.1 };
  };

  return (
    <section className="singlePanel">
      <div className="sectionTitle">
        <h1>Configure {method.name}</h1>
        <p>Set the specifications for this method. These values control the generated template and the analysis run.</p>
      </div>
      <CapabilityStrip method={method} config={config} />
      <div className="specSection">
        <div>
          <h2>Data collection</h2>
          <p>{isDematel ? 'Use one final influence matrix, or collect separate matrices from multiple experts.' : 'Use one final decision matrix, or collect separate decision matrices from multiple respondents.'}</p>
        </div>
        <div className="segmentedControl">
          {(isDematel ? ['Single expert matrix', 'Multiple experts'] : ['Single aggregated dataset', 'Multiple respondents']).map((option) => (
            <button key={option} className={dataInputMode === option ? 'active' : ''} onClick={() => updateDataInputMode(option)}>{option}</button>
          ))}
        </div>
      </div>
      <ConfigurationSummary method={method} config={config} usesGroupData={usesGroupData} usesManualWeights={usesManualWeights} usesAutomaticWeights={usesAutomaticWeights} showAHPPairwise={showAHPPairwise} />
      <div className="configGrid">
        <label><span>Study title</span><input aria-label="Study title" value={config.title} onChange={(event) => updateConfig({ ...config, title: event.target.value })} /></label>
        {method.supportsWeights ? <label><span>Weighting method</span><select aria-label="Weighting method" value={config.weightingId} onChange={(event) => updateConfig({ ...config, weightingId: event.target.value as WeightingId })}>
          {isAHP ? <option value="ahp">AHP pairwise priorities</option> : null}
          {!isAHP ? <option value="manual">Manual weights</option> : null}
          {!isAHP ? <option value="equal">Equal weights</option> : null}
          {!isAHP ? <option value="stddev">Standard deviation weights</option> : null}
          {!isAHP ? <option value="cov">Coefficient of variation weights</option> : null}
          {!isAHP ? <option value="entropy">Entropy weights</option> : null}
          {!isAHP ? <option value="critic">CRITIC weights</option> : null}
          {!isAHP ? <option value="merec">MEREC weights</option> : null}
          {!isAHP ? <option value="merecG">MEREC-G weights</option> : null}
          {!isAHP ? <option value="lopcow">LOPCOW weights</option> : null}
          {!isAHP ? <option value="wenslo">WENSLO weights</option> : null}
          {!isAHP ? <option value="angular">Angular weights</option> : null}
          {!isAHP ? <option value="gini">Gini coefficient weights</option> : null}
          {!isAHP ? <option value="mpsi">MPSI weights</option> : null}
          {!isAHP ? <option value="cilos">CILOS weights</option> : null}
          {!isAHP ? <option value="idocriw">IDOCRIW weights</option> : null}
          {!isAHP ? <option value="cimas">CIMAS weights</option> : null}
          {!isAHP ? <option value="ahp">AHP weights</option> : null}
          {!isAHP ? <option value="bwm">BWM weights</option> : null}
          {!isAHP ? <option value="dibr">DIBR weights</option> : null}
          {!isAHP ? <option value="simos">Revised Simos / SRF cards</option> : null}
          {!isAHP ? <option value="swara">SWARA weights</option> : null}
          {!isAHP ? <option value="roc">ROC rank-order weights</option> : null}
          {!isAHP ? <option value="fucom">FUCOM weights</option> : null}
          {!isAHP ? <option value="lbwa">LBWA weights</option> : null}
          {!isAHP ? <option value="piprecia">PIPRECIA weights</option> : null}
          {!isAHP ? <option value="rankSum">Rank Sum weights</option> : null}
          {!isAHP ? <option value="rankReciprocal">Rank Reciprocal weights</option> : null}
          {!isAHP ? <option value="rancom">RANCOM weights</option> : null}
        </select></label> : null}
        {visibleSpecificationFields.map((field) => (
          field.key === 'lexicographicOrder' || field.key === 'smarterOrder' ? (
            <CriterionOrderEditor key={field.key} label={field.label} criteria={config.criteria} value={String(config.methodParams[field.key] ?? config.criteria.map((criterion) => criterion.id).join(','))} onChange={(values) => updateOrderParam(field.key, values)} />
          ) : (
            <label key={field.key}>
              <span>{field.label}</span>
              {field.key === 'pughBaselineAlternative' ? (
              <select aria-label={field.label} value={String(config.methodParams.pughBaselineAlternative ?? config.alternatives[0]?.id ?? '')} onChange={(event) => updateParam(field.key, event.target.value)}>
                {config.alternatives.map((alternative) => <option key={alternative.id} value={alternative.id}>{alternative.id} - {alternative.name}</option>)}
              </select>
            ) : field.type === 'select' ? (
              <select aria-label={field.label} value={String(config.methodParams[field.key] ?? field.defaultValue)} onChange={(event) => updateParam(field.key, event.target.value)}>
                {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            ) : (
              <input aria-label={field.label} type={field.type} {...(field.type === 'number' ? numericBounds(field.key) : {})} value={String(config.methodParams[field.key] ?? field.defaultValue)} onChange={(event) => updateParam(field.key, event.target.value)} />
            )}
            </label>
          )
        ))}
        {!isDematel && usesGroupData ? (
          <>
            <label><span>Respondent count</span><input aria-label="Respondent count" type="number" min="2" step="1" value={String(config.methodParams.respondentCount ?? 2)} onChange={(event) => updateParam('respondentCount', event.target.value)} /></label>
            <label><span>Respondent aggregation</span><select aria-label="Respondent aggregation" value={String(config.methodParams.respondentAggregation ?? 'Arithmetic mean')} onChange={(event) => updateParam('respondentAggregation', event.target.value)}>
              <option>Arithmetic mean</option>
              <option>Geometric mean</option>
            </select></label>
          </>
        ) : null}
        {isDematel && usesGroupData ? (
          <label><span>Expert count</span><input aria-label="Expert count" type="number" min="2" step="1" value={String(config.methodParams.dematelExpertCount ?? 2)} onChange={(event) => updateParam('dematelExpertCount', event.target.value)} /></label>
        ) : null}
        {showAHPPairwise && usesGroupData ? (
          <label><span>AHP pairwise respondent count</span><input aria-label="AHP pairwise respondent count" type="number" min="2" step="1" value={String(config.methodParams.ahpRespondentCount ?? config.methodParams.respondentCount ?? 2)} onChange={(event) => updateParam('ahpRespondentCount', event.target.value)} /></label>
        ) : null}
        <label><span>Fuzzy input mode</span><select aria-label="Fuzzy input mode" value={String(config.methodParams.fuzzyInputMode ?? defaultFuzzyMode)} onChange={(event) => updateParam('fuzzyInputMode', event.target.value)}>
          {fuzzyModeOptions(method.id).map((option) => <option key={option}>{option}</option>)}
        </select></label>
        {usesManualSpotisBounds ? (
          <>
            <CriterionNumberVectorEditor label="SPOTIS lower bounds" criteria={config.criteria} value={String(config.methodParams.spotisLowerBounds ?? config.criteria.map(() => 0).join(','))} fallback={0} onChange={(values) => updateVectorParam('spotisLowerBounds', values)} />
            <CriterionNumberVectorEditor label="SPOTIS upper bounds" criteria={config.criteria} value={String(config.methodParams.spotisUpperBounds ?? config.criteria.map(() => 1).join(','))} fallback={1} onChange={(values) => updateVectorParam('spotisUpperBounds', values)} />
          </>
        ) : null}
        {usesManualEspSpotisBounds ? (
          <>
            <CriterionNumberVectorEditor label="ESP-SPOTIS lower bounds" criteria={config.criteria} value={String(config.methodParams.spotisLowerBounds ?? config.criteria.map(() => 0).join(','))} fallback={0} onChange={(values) => updateVectorParam('spotisLowerBounds', values)} />
            <CriterionNumberVectorEditor label="ESP-SPOTIS upper bounds" criteria={config.criteria} value={String(config.methodParams.spotisUpperBounds ?? config.criteria.map(() => 1).join(','))} fallback={1} onChange={(values) => updateVectorParam('spotisUpperBounds', values)} />
          </>
        ) : null}
        {method.id === 'balancedSpotis' ? (
          <>
            <CriterionNumberVectorEditor label="B-SPOTIS expected solution point" criteria={config.criteria} value={String(config.methodParams.espSpotisPoint ?? config.criteria.map(() => 0).join(','))} fallback={0} onChange={(values) => updateVectorParam('espSpotisPoint', values)} />
            {usesManualBalancedSpotisBounds ? (
              <>
                <CriterionNumberVectorEditor label="B-SPOTIS lower bounds" criteria={config.criteria} value={String(config.methodParams.spotisLowerBounds ?? config.criteria.map(() => 0).join(','))} fallback={0} onChange={(values) => updateVectorParam('spotisLowerBounds', values)} />
                <CriterionNumberVectorEditor label="B-SPOTIS upper bounds" criteria={config.criteria} value={String(config.methodParams.spotisUpperBounds ?? config.criteria.map(() => 1).join(','))} fallback={1} onChange={(values) => updateVectorParam('spotisUpperBounds', values)} />
              </>
            ) : null}
          </>
        ) : null}
        {usesManualRimInterval ? (
          <>
            <CriterionNumberVectorEditor label="RIM domain lower bounds" criteria={config.criteria} value={String(config.methodParams.rimDomainLower ?? config.criteria.map(() => 0).join(','))} fallback={0} onChange={(values) => updateVectorParam('rimDomainLower', values)} />
            <CriterionNumberVectorEditor label="RIM domain upper bounds" criteria={config.criteria} value={String(config.methodParams.rimDomainUpper ?? config.criteria.map(() => 1).join(','))} fallback={1} onChange={(values) => updateVectorParam('rimDomainUpper', values)} />
            <CriterionNumberVectorEditor label="RIM ideal lower interval" criteria={config.criteria} value={String(config.methodParams.rimIdealLower ?? config.criteria.map(() => 0).join(','))} fallback={0} onChange={(values) => updateVectorParam('rimIdealLower', values)} />
            <CriterionNumberVectorEditor label="RIM ideal upper interval" criteria={config.criteria} value={String(config.methodParams.rimIdealUpper ?? config.criteria.map(() => 1).join(','))} fallback={1} onChange={(values) => updateVectorParam('rimIdealUpper', values)} />
          </>
        ) : null}
        {usesManualRafsiReference ? (
          <>
            <CriterionNumberVectorEditor label="RAFSI ideal values" criteria={config.criteria} value={String(config.methodParams.rafsiIdealValues ?? config.criteria.map(() => 1).join(','))} fallback={1} onChange={(values) => updateVectorParam('rafsiIdealValues', values)} />
            <CriterionNumberVectorEditor label="RAFSI anti-ideal values" criteria={config.criteria} value={String(config.methodParams.rafsiAntiIdealValues ?? config.criteria.map(() => 0).join(','))} fallback={0} onChange={(values) => updateVectorParam('rafsiAntiIdealValues', values)} />
          </>
        ) : null}
        {usesManualLopmLimits ? (
          <>
            <CriterionChoiceVectorEditor label="LoPM property types" criteria={config.criteria} value={String(config.methodParams.lopmPropertyTypes ?? config.criteria.map((criterion) => criterion.direction === 'benefit' ? 'lower' : 'upper').join(','))} options={['lower', 'upper', 'target']} fallback="lower" onChange={(values) => updateListParam('lopmPropertyTypes', values)} />
            <CriterionNumberVectorEditor label="LoPM property limits" criteria={config.criteria} value={String(config.methodParams.lopmPropertyLimits ?? config.criteria.map(() => 1).join(','))} fallback={1} onChange={(values) => updateVectorParam('lopmPropertyLimits', values)} />
          </>
        ) : null}
        {usesManualErvdReference ? (
          <CriterionNumberVectorEditor label="ERVD reference point" criteria={config.criteria} value={String(config.methodParams.ervdReferencePoint ?? config.criteria.map(() => 1).join(','))} fallback={1} onChange={(values) => updateVectorParam('ervdReferencePoint', values)} />
        ) : null}
        {usesBwmWeights ? (
          <>
            <label><span>BWM best criterion</span><select value={String(config.methodParams.bwmBestCriterion ?? config.criteria[0]?.id ?? '')} onChange={(event) => updateParam('bwmBestCriterion', event.target.value)}>{config.criteria.map((criterion) => <option key={criterion.id} value={criterion.id}>{criterion.id} - {criterion.name}</option>)}</select></label>
            <label><span>BWM worst criterion</span><select value={String(config.methodParams.bwmWorstCriterion ?? config.criteria[config.criteria.length - 1]?.id ?? '')} onChange={(event) => updateParam('bwmWorstCriterion', event.target.value)}>{config.criteria.map((criterion) => <option key={criterion.id} value={criterion.id}>{criterion.id} - {criterion.name}</option>)}</select></label>
            <CriterionNumberVectorEditor label="Best-to-others vector" criteria={config.criteria} value={String(config.methodParams.bwmBestToOthers ?? config.criteria.map(() => 1).join(','))} fallback={1} min={1} onChange={(values) => updateVectorParam('bwmBestToOthers', values)} />
            <CriterionNumberVectorEditor label="Others-to-worst vector" criteria={config.criteria} value={String(config.methodParams.bwmOthersToWorst ?? config.criteria.map(() => 1).join(','))} fallback={1} min={1} onChange={(values) => updateVectorParam('bwmOthersToWorst', values)} />
          </>
        ) : null}
        {usesDibrWeights ? (
          <>
            <CriterionOrderEditor label="DIBR criterion order" criteria={config.criteria} value={String(config.methodParams.dibrOrder ?? config.criteria.map((criterion) => criterion.id).join(','))} onChange={(values) => updateOrderParam('dibrOrder', values)} />
            <AdjacentNumberVectorEditor label="Adjacent importance ratios" criteria={config.criteria} orderValue={String(config.methodParams.dibrOrder ?? config.criteria.map((criterion) => criterion.id).join(','))} value={String(config.methodParams.dibrAdjacentRatios ?? Array.from({ length: Math.max(config.criteria.length - 1, 0) }, () => 1).join(','))} fallback={1} min={1} onChange={(values) => updateVectorParam('dibrAdjacentRatios', values)} />
            <label><span>First-to-last control ratio</span><input type="number" min="1" step="0.01" value={String(config.methodParams.dibrFirstLastRatio ?? 1)} onChange={(event) => updateParam('dibrFirstLastRatio', event.target.value)} /></label>
          </>
        ) : null}
        {usesSimosWeights ? (
          <>
            <SimosGroupsEditor label="SRF card groups" criteria={config.criteria} value={String(config.methodParams.simosGroups ?? config.criteria.map((criterion) => criterion.id).join(' | '))} onChange={(value) => updateParam('simosGroups', value)} />
            <GroupGapNumberEditor label="Blank cards between groups" groupsValue={String(config.methodParams.simosGroups ?? config.criteria.map((criterion) => criterion.id).join(' | '))} value={String(config.methodParams.simosBlankCards ?? Array.from({ length: Math.max(config.criteria.length - 1, 0) }, () => 0).join(','))} fallback={0} min={0} integer onChange={(values) => updateVectorParam('simosBlankCards', values)} />
            <label><span>Z ratio</span><input type="number" min="1" step="0.01" value={String(config.methodParams.simosZRatio ?? 1)} onChange={(event) => updateParam('simosZRatio', event.target.value)} /></label>
          </>
        ) : null}
        {usesSwaraWeights ? (
          <>
            <CriterionOrderEditor label="SWARA criterion order" criteria={config.criteria} value={String(config.methodParams.swaraOrder ?? config.criteria.map((criterion) => criterion.id).join(','))} onChange={(values) => updateOrderParam('swaraOrder', values)} />
            <CriterionNumberVectorEditor label="Comparative importance values" criteria={config.criteria} value={String(config.methodParams.swaraComparativeImportance ?? config.criteria.map((_, index) => index === 0 ? 0 : 0.1).join(','))} fallback={0} min={0} onChange={(values) => updateVectorParam('swaraComparativeImportance', values)} />
          </>
        ) : null}
        {usesRocWeights ? (
          <CriterionOrderEditor label="ROC criterion order" criteria={config.criteria} value={String(config.methodParams.rocOrder ?? config.criteria.map((criterion) => criterion.id).join(','))} onChange={(values) => updateOrderParam('rocOrder', values)} />
        ) : null}
        {usesFucomWeights ? (
          <>
            <CriterionOrderEditor label="FUCOM criterion order" criteria={config.criteria} value={String(config.methodParams.fucomOrder ?? config.criteria.map((criterion) => criterion.id).join(','))} onChange={(values) => updateOrderParam('fucomOrder', values)} />
            <AdjacentNumberVectorEditor label="Adjacent comparative priorities" criteria={config.criteria} orderValue={String(config.methodParams.fucomOrder ?? config.criteria.map((criterion) => criterion.id).join(','))} value={String(config.methodParams.fucomComparativePriorities ?? Array.from({ length: Math.max(config.criteria.length - 1, 0) }, () => 1).join(','))} fallback={1} min={1} onChange={(values) => updateVectorParam('fucomComparativePriorities', values)} />
          </>
        ) : null}
        {usesLbwaWeights ? (
          <>
            <CriterionNumberVectorEditor label="LBWA criterion levels" criteria={config.criteria} value={String(config.methodParams.lbwaLevels ?? config.criteria.map((_, index) => index + 1).join(','))} fallback={1} min={1} integer onChange={(values) => updateVectorParam('lbwaLevels', values)} />
            <CriterionNumberVectorEditor label="LBWA importance values" criteria={config.criteria} value={String(config.methodParams.lbwaImportance ?? config.criteria.map((_, index) => index).join(','))} fallback={0} min={0} onChange={(values) => updateVectorParam('lbwaImportance', values)} />
            <label><span>LBWA elasticity coefficient</span><input type="number" min="1" step="1" value={String(config.methodParams.lbwaElasticity ?? 5)} onChange={(event) => updateParam('lbwaElasticity', event.target.value)} /></label>
          </>
        ) : null}
        {usesPipreciaWeights ? (
          <>
            <CriterionOrderEditor label="PIPRECIA criterion order" criteria={config.criteria} value={String(config.methodParams.pipreciaOrder ?? config.criteria.map((criterion) => criterion.id).join(','))} onChange={(values) => updateOrderParam('pipreciaOrder', values)} />
            <CriterionNumberVectorEditor label="Relative significance values" criteria={config.criteria} value={String(config.methodParams.pipreciaRelativeSignificance ?? config.criteria.map((_, index) => index === 0 ? 1 : 0.9).join(','))} fallback={1} min={0.0001} max={1.9999} onChange={(values) => updateVectorParam('pipreciaRelativeSignificance', values)} />
          </>
        ) : null}
        {usesRankSumWeights ? (
          <CriterionOrderEditor label="Rank Sum criterion order" criteria={config.criteria} value={String(config.methodParams.rankSumOrder ?? config.criteria.map((criterion) => criterion.id).join(','))} onChange={(values) => updateOrderParam('rankSumOrder', values)} />
        ) : null}
        {usesRankReciprocalWeights ? (
          <CriterionOrderEditor label="Rank Reciprocal criterion order" criteria={config.criteria} value={String(config.methodParams.rankReciprocalOrder ?? config.criteria.map((criterion) => criterion.id).join(','))} onChange={(values) => updateOrderParam('rankReciprocalOrder', values)} />
        ) : null}
        {usesRancomWeights ? (
          <CriterionNumberVectorEditor label="RANCOM rank positions" criteria={config.criteria} value={String(config.methodParams.rancomRanks ?? config.criteria.map((_, index) => index + 1).join(','))} fallback={1} min={1} integer onChange={(values) => updateVectorParam('rancomRanks', values)} />
        ) : null}
      </div>
      <div className="workflowNote">
        <strong>{usesGroupData ? 'Group study template' : 'Single dataset template'}</strong>
        <span>{isDematel
          ? usesGroupData ? 'The workbook will include one expert influence-matrix sheet per expert and aggregate them before DEMATEL.' : 'The workbook will use one direct-relation matrix as the final expert or committee matrix.'
          : usesGroupData ? 'The workbook will include one respondent decision-matrix sheet per respondent and aggregate them before analysis.' : 'The workbook will use the main decision matrix only; respondent sheets will not be added.'}</span>
      </div>
      {method.supportsWeights && !usesManualWeights ? (
        <div className="workflowNote calculatedWeightNotice">
          <strong>{weightingLabel} weighting</strong>
          <span>{usesAHPWeights
            ? 'Weights come from reciprocal pairwise judgments. The criteria table is only for names and benefit/cost directions.'
            : `${weightingLabel} weights are calculated during analysis, so manual weight inputs are hidden and ignored in uploaded files.`}</span>
        </div>
      ) : null}
      {!isDematel ? (
        <div className="cleanTableWrap">
          <div className="tableToolbar">
            <h2>{alternativeLabel}s</h2>
            <button className="miniAction" onClick={addAlternative}><Plus size={14} />Add {alternativeLabel.toLowerCase()}</button>
          </div>
          <table>
            <thead><tr><th>ID</th><th>Name</th><th>Action</th></tr></thead>
            <tbody>{config.alternatives.map((alternative, index) => (
              <tr key={alternative.id}>
                <td>{alternative.id}</td>
                <td><input value={alternative.name} onChange={(event) => updateAlternative(index, event.target.value)} /></td>
                <td><button className="iconAction" onClick={() => removeAlternative(index)} disabled={config.alternatives.length <= 1} title={`Remove ${alternative.name}`}><Trash2 size={14} /></button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : null}
      <div className="cleanTableWrap">
        <div className="tableToolbar">
          <h2>{criteriaLabel}</h2>
          <div className="toolbarActions">
            {usesAutomaticWeights ? <span>No manual weight cells for {weightingLabel}</span> : null}
            {usesAHPWeights && !isAHP ? <span>AHP weighting uses the pairwise matrix below</span> : null}
            <button className="miniAction" onClick={addCriterion}><Plus size={14} />Add {isDematel ? 'factor' : 'criterion'}</button>
          </div>
        </div>
        <table>
          <thead><tr><th>ID</th><th>Name</th>{!isDematel ? <th>Type</th> : null}{usesManualWeights ? <th>Manual weight</th> : null}<th>Action</th></tr></thead>
          <tbody>{config.criteria.map((criterion, index) => (
            <tr key={criterion.id}>
              <td>{criterion.id}</td>
              <td><input value={criterion.name} onChange={(event) => updateCriterion(index, 'name', event.target.value)} /></td>
              {!isDematel ? <td><select value={criterion.direction} onChange={(event) => updateCriterion(index, 'direction', event.target.value)}><option value="benefit">Benefit</option><option value="cost">Cost</option></select></td> : null}
              {usesManualWeights ? <td><input type="number" step="0.01" value={criterion.weight} onChange={(event) => updateCriterion(index, 'weight', event.target.value)} /></td> : null}
              <td><button className="iconAction" onClick={() => removeCriterion(index)} disabled={config.criteria.length <= 1} title={`Remove ${criterion.name}`}><Trash2 size={14} /></button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <details className="advancedSeedData">
        <summary>Optional in-app seed data</summary>
        <p>The generated workbook is the main data-entry path. Edit these values only when you want the downloaded template to start from custom example numbers.</p>
        <div className="cleanTableWrap compactMatrix">
          <div className="tableToolbar"><h2>{matrixLabel}</h2><span>{input.values.length} x {config.criteria.length}</span></div>
          <table>
            <thead><tr><th>{isDematel ? 'Source factor' : 'Alternative'}</th>{config.criteria.map((criterion) => <th key={criterion.id}>{criterion.id}</th>)}</tr></thead>
            <tbody>{(isDematel ? config.criteria.map((criterion) => ({ id: criterion.id, name: criterion.name })) : config.alternatives).map((alternative, rowIndex) => (
              <tr key={alternative.id}>
                <td>{alternative.name}</td>
                {config.criteria.map((criterion, columnIndex) => (
                  <td key={criterion.id}>
                    <input
                      type="number"
                      value={input.values[rowIndex]?.[columnIndex] ?? 0}
                      disabled={isDematel && rowIndex === columnIndex}
                      title={isDematel && rowIndex === columnIndex ? 'DEMATEL diagonal values are fixed at zero' : undefined}
                      onChange={(event) => updateValue(rowIndex, columnIndex, event.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}</tbody>
          </table>
        </div>
        {showAHPPairwise ? (
          <div className="cleanTableWrap compactMatrix">
            <div className="tableToolbar"><h2>Criteria pairwise comparison</h2><span>Use Saaty scale: 1 equal, 3 moderate, 5 strong, 7 very strong, 9 extreme</span></div>
            <table>
              <thead><tr><th>Criterion</th>{config.criteria.map((criterion) => <th key={criterion.id}>{criterion.id}</th>)}</tr></thead>
              <tbody>{config.criteria.map((rowCriterion, rowIndex) => (
                <tr key={rowCriterion.id}>
                  <td>{rowCriterion.id}</td>
                  {config.criteria.map((criterion, columnIndex) => (
                    <td key={criterion.id}>
                      <input
                        type="number"
                        step="0.25"
                        min="0.1111"
                        max="9"
                        value={resizePairwise(config.criteria.length)[rowIndex]?.[columnIndex] ?? 1}
                        disabled={rowIndex === columnIndex}
                        onChange={(event) => updatePairwise(rowIndex, columnIndex, event.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : null}
        {isAHP && config.methodParams.ahpPairwiseMode === 'Criteria and alternatives' ? (
          <div className="cleanTableWrap compactMatrix">
            <div className="tableToolbar"><h2>Alternative pairwise comparisons</h2><span>One matrix per criterion</span></div>
            {config.criteria.map((criterion) => (
              <div className="subMatrix" key={criterion.id}>
                <h3>{criterion.id} - {criterion.name}</h3>
                <table>
                  <thead><tr><th>Alternative</th>{config.alternatives.map((alternative) => <th key={alternative.id}>{alternative.id}</th>)}</tr></thead>
                  <tbody>{config.alternatives.map((rowAlternative, rowIndex) => (
                    <tr key={rowAlternative.id}>
                      <td>{rowAlternative.id}</td>
                      {config.alternatives.map((alternative, columnIndex) => (
                        <td key={alternative.id}>
                          <input
                            type="number"
                            step="0.25"
                            min="0.1111"
                            max="9"
                            value={resizeAlternativePairwise(criterion.id, config.alternatives.length)[rowIndex]?.[columnIndex] ?? 1}
                            disabled={rowIndex === columnIndex}
                            onChange={(event) => updateAlternativePairwise(criterion.id, rowIndex, columnIndex, event.target.value)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ))}
          </div>
        ) : null}
      </details>
      {preTemplateIssues.length ? (
        <div className="validationList compactValidation">
          {preTemplateIssues.slice(0, 5).map((issue) => <div className={`validationItem ${issue.severity}`} key={`${issue.sheet}-${issue.location}-${issue.message}`}><strong>{issue.severity}</strong><span>{issue.sheet} {issue.location}: {issue.message}</span></div>)}
          {preTemplateIssues.length > 5 ? <div className="readyNote">{preTemplateIssues.length - 5} more issue{preTemplateIssues.length - 5 === 1 ? '' : 's'} will be checked again after upload.</div> : null}
        </div>
      ) : <div className="readyNote">Specifications and current data pass the pre-template check.</div>}
      <div className="flowActions"><button className="primaryAction" onClick={onNext} disabled={!canGenerateTemplate}>Generate template <ArrowRight size={16} /></button></div>
    </section>
  );
}

function CriterionOrderEditor({
  label,
  criteria,
  value,
  onChange,
}: {
  label: string;
  criteria: StudyConfig['criteria'];
  value: string;
  onChange: (values: string[]) => void;
}) {
  const ids = criteria.map((criterion) => criterion.id);
  const parsed = value
    .split(',')
    .map((item) => item.trim())
    .filter((criterionId, index, list) => ids.includes(criterionId) && list.indexOf(criterionId) === index);
  const ordered = [...parsed, ...ids.filter((criterionId) => !parsed.includes(criterionId))];
  const choose = (rankIndex: number, nextId: string) => {
    const next = [...ordered];
    const existingIndex = next.indexOf(nextId);
    if (existingIndex >= 0) {
      [next[rankIndex], next[existingIndex]] = [next[existingIndex], next[rankIndex]];
    } else {
      next[rankIndex] = nextId;
    }
    onChange(next);
  };

  return (
    <div className="orderEditor">
      <span>{label}</span>
      <div className="orderEditorGrid">
        {ordered.map((criterionId, index) => (
          <label key={`${label}-${index}`}>
            <em>{index + 1}</em>
            <select aria-label={`${label} rank ${index + 1}`} value={criterionId} onChange={(event) => choose(index, event.target.value)}>
              {criteria.map((criterion) => <option key={criterion.id} value={criterion.id}>{criterion.id} - {criterion.name}</option>)}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}

function criterionVector(value: string, count: number, fallback: number) {
  const parsed = value.split(',').map((item) => Number(item.trim()));
  return Array.from({ length: count }, (_, index) => Number.isFinite(parsed[index]) ? parsed[index] : fallback);
}

function criterionChoiceVector(value: string, count: number, options: string[], fallback: string) {
  const parsed = value.split(',').map((item) => item.trim());
  return Array.from({ length: count }, (_, index) => options.includes(parsed[index]) ? parsed[index] : fallback);
}

function CriterionNumberVectorEditor({
  label,
  criteria,
  value,
  fallback,
  min,
  max,
  integer,
  onChange,
}: {
  label: string;
  criteria: StudyConfig['criteria'];
  value: string;
  fallback: number;
  min?: number;
  max?: number;
  integer?: boolean;
  onChange: (values: number[]) => void;
}) {
  const values = criterionVector(value, criteria.length, fallback);
  const update = (index: number, nextValue: string) => {
    const numeric = Number(nextValue);
    const cleaned = Number.isFinite(numeric) ? (integer ? Math.round(numeric) : numeric) : fallback;
    const next = values.map((item, current) => current === index ? cleaned : item);
    onChange(next);
  };

  return (
    <div className="vectorEditor">
      <span>{label}</span>
      <div className="vectorEditorGrid">
        {criteria.map((criterion, index) => (
          <label key={`${label}-${criterion.id}`}>
            <em>{criterion.id}</em>
            <input aria-label={`${label} for ${criterion.id}`} type="number" step={integer ? '1' : '0.01'} min={min} max={max} value={String(values[index])} onChange={(event) => update(index, event.target.value)} />
          </label>
        ))}
      </div>
    </div>
  );
}

function orderedCriterionIds(value: string, criteria: StudyConfig['criteria']) {
  const ids = criteria.map((criterion) => criterion.id);
  const parsed = value
    .split(',')
    .map((item) => item.trim())
    .filter((criterionId, index, list) => ids.includes(criterionId) && list.indexOf(criterionId) === index);
  return [...parsed, ...ids.filter((criterionId) => !parsed.includes(criterionId))];
}

function AdjacentNumberVectorEditor({
  label,
  criteria,
  orderValue,
  value,
  fallback,
  min,
  onChange,
}: {
  label: string;
  criteria: StudyConfig['criteria'];
  orderValue: string;
  value: string;
  fallback: number;
  min?: number;
  onChange: (values: number[]) => void;
}) {
  const order = orderedCriterionIds(orderValue, criteria);
  const values = criterionVector(value, Math.max(order.length - 1, 0), fallback);
  const update = (index: number, nextValue: string) => {
    const numeric = Number(nextValue);
    onChange(values.map((item, current) => current === index ? (Number.isFinite(numeric) ? numeric : fallback) : item));
  };

  return (
    <div className="vectorEditor">
      <span>{label}</span>
      <div className="vectorEditorGrid">
        {values.map((item, index) => (
          <label key={`${label}-${order[index]}-${order[index + 1]}`}>
            <em>{index + 1}</em>
            <input aria-label={`${label} ${order[index]} to ${order[index + 1]}`} type="number" step="0.01" min={min} value={String(item)} onChange={(event) => update(index, event.target.value)} />
          </label>
        ))}
      </div>
    </div>
  );
}

function GroupGapNumberEditor({
  label,
  groupsValue,
  value,
  fallback,
  min,
  integer,
  onChange,
}: {
  label: string;
  groupsValue: string;
  value: string;
  fallback: number;
  min?: number;
  integer?: boolean;
  onChange: (values: number[]) => void;
}) {
  const groups = groupsValue.split('|').map((group) => group.trim()).filter(Boolean);
  const values = criterionVector(value, Math.max(groups.length - 1, 0), fallback);
  const update = (index: number, nextValue: string) => {
    const numeric = Number(nextValue);
    const cleaned = Number.isFinite(numeric) ? (integer ? Math.round(numeric) : numeric) : fallback;
    onChange(values.map((item, current) => current === index ? cleaned : item));
  };

  return (
    <div className="vectorEditor">
      <span>{label}</span>
      <div className="vectorEditorGrid">
        {values.map((item, index) => (
          <label key={`${label}-${index}`}>
            <em>{index + 1}</em>
            <input aria-label={`${label} ${index + 1}`} type="number" step={integer ? '1' : '0.01'} min={min} value={String(item)} onChange={(event) => update(index, event.target.value)} />
          </label>
        ))}
      </div>
    </div>
  );
}

function simosGroupAssignments(value: string, criteria: StudyConfig['criteria']) {
  const criterionIds = criteria.map((criterion) => criterion.id);
  const groups = value
    .split('|')
    .map((group) => group.split(',').map((item) => item.trim()).filter((id) => criterionIds.includes(id)))
    .filter((group) => group.length);
  const assignments = new Map<string, number>();
  groups.forEach((group, groupIndex) => {
    group.forEach((criterionId) => {
      if (!assignments.has(criterionId)) assignments.set(criterionId, groupIndex + 1);
    });
  });
  criterionIds.forEach((criterionId, index) => {
    if (!assignments.has(criterionId)) assignments.set(criterionId, Math.min(index + 1, Math.max(groups.length, 1)));
  });
  return criterionIds.map((criterionId) => assignments.get(criterionId) ?? 1);
}

function simosGroupsFromAssignments(criteria: StudyConfig['criteria'], assignments: number[]) {
  const grouped = new Map<number, string[]>();
  criteria.forEach((criterion, index) => {
    const groupIndex = Math.max(1, Math.round(assignments[index] ?? index + 1));
    grouped.set(groupIndex, [...(grouped.get(groupIndex) ?? []), criterion.id]);
  });
  return Array.from(grouped.entries())
    .sort(([left], [right]) => left - right)
    .map(([, ids]) => ids.join(','))
    .join(' | ');
}

function SimosGroupsEditor({
  label,
  criteria,
  value,
  onChange,
}: {
  label: string;
  criteria: StudyConfig['criteria'];
  value: string;
  onChange: (value: string) => void;
}) {
  const assignments = simosGroupAssignments(value, criteria);
  const groupCount = Math.max(criteria.length, 1);
  const update = (index: number, nextValue: string) => {
    const nextGroup = Math.max(1, Math.round(Number(nextValue) || 1));
    const nextAssignments = assignments.map((item, current) => current === index ? nextGroup : item);
    onChange(simosGroupsFromAssignments(criteria, nextAssignments));
  };

  return (
    <div className="vectorEditor">
      <span>{label}</span>
      <div className="vectorEditorGrid">
        {criteria.map((criterion, index) => (
          <label key={`${label}-${criterion.id}`}>
            <em>{criterion.id}</em>
            <select aria-label={`${label} for ${criterion.id}`} value={String(assignments[index])} onChange={(event) => update(index, event.target.value)}>
              {Array.from({ length: groupCount }, (_, groupIndex) => <option key={groupIndex + 1} value={groupIndex + 1}>Group {groupIndex + 1}</option>)}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}

function CriterionChoiceVectorEditor({
  label,
  criteria,
  value,
  options,
  fallback,
  onChange,
}: {
  label: string;
  criteria: StudyConfig['criteria'];
  value: string;
  options: string[];
  fallback: string;
  onChange: (values: string[]) => void;
}) {
  const values = criterionChoiceVector(value, criteria.length, options, fallback);
  const update = (index: number, nextValue: string) => {
    onChange(values.map((item, current) => current === index ? nextValue : item));
  };

  return (
    <div className="vectorEditor">
      <span>{label}</span>
      <div className="vectorEditorGrid">
        {criteria.map((criterion, index) => (
          <label key={`${label}-${criterion.id}`}>
            <em>{criterion.id}</em>
            <select aria-label={`${label} for ${criterion.id}`} value={values[index]} onChange={(event) => update(index, event.target.value)}>
              {options.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}

function TemplateStep({ config, methodName, onDownload, onBack, onNext }: { config: StudyConfig; methodName: string; onDownload: () => void; onBack: () => void; onNext: () => void }) {
  const templateSheets = getMethod(config.methodId).getTemplateSchema(config);
  const method = getMethod(config.methodId);
  return (
    <section className="singlePanel">
      <div className="templateHero">
        <FileSpreadsheet size={32} />
        <h1>{methodName} template is ready</h1>
        <p>Download the model-specific Excel workbook, replace the sample values with your study data, then upload the completed file.</p>
        <button className="primaryAction" onClick={onDownload}><Download size={16} />Download template</button>
      </div>
      <TemplateSpecSummary config={config} methodName={methodName} />
      <CapabilityStrip method={method} config={config} />
      <SamplePreview title={`${methodName} filled template preview`} config={config} templateSheets={templateSheets} />
      <div className="flowActions"><button className="secondaryAction" onClick={onBack}>Back to specifications</button><button className="secondaryAction" onClick={onNext}>Continue to upload <ArrowRight size={16} /></button></div>
    </section>
  );
}

function ConfigurationSummary({ method, config, usesGroupData, usesManualWeights, usesAutomaticWeights, showAHPPairwise }: { method: MethodDefinition; config: StudyConfig; usesGroupData: boolean; usesManualWeights: boolean; usesAutomaticWeights: boolean; showAHPPairwise: boolean }) {
  const isDematel = config.methodId === 'dematel';
  const fuzzyMode = String(config.methodParams.fuzzyInputMode ?? defaultFuzzyMode);
  const respondentCount = Number(config.methodParams.respondentCount ?? 1);
  const expertCount = Number(config.methodParams.dematelExpertCount ?? 1);
  const ahpRespondents = Number(config.methodParams.ahpRespondentCount ?? respondentCount);
  const weightText = isDematel
    ? 'DEMATEL does not use criteria weights in this workflow.'
    : usesManualWeights
      ? 'Manual weights remain editable in the criteria table and workbook.'
      : usesAutomaticWeights
        ? `${weightingDisplayName(config.weightingId)} weights are calculated from uploaded data; manual weight inputs are hidden.`
        : showAHPPairwise
          ? 'AHP weights are derived from reciprocal pairwise comparisons, not typed into the criteria table.'
          : 'The selected method controls its own scoring structure.';
  const groupText = isDematel
    ? usesGroupData
      ? `${expertCount} expert sheets will be generated and averaged before DEMATEL cause-effect analysis.`
      : 'One direct-relation matrix will be treated as the final expert or committee input.'
    : usesGroupData
      ? `${respondentCount} respondent decision-matrix sheets will be generated and aggregated before analysis.`
      : 'One aggregated decision matrix will be generated. No respondent sheets are added.';
  const ahpText = showAHPPairwise
    ? usesGroupData
      ? `${ahpRespondents} AHP respondent pairwise sheet set${ahpRespondents === 1 ? '' : 's'} will be combined by geometric mean.`
      : 'One reciprocal AHP pairwise matrix will be validated and used.'
    : 'No AHP pairwise sheet is needed for the selected setup.';
  const fuzzyText = fuzzyMode.startsWith('Native fuzzy')
    ? 'Triangular and trapezoidal entries stay fuzzy through the supported fuzzy calculation path.'
    : 'Triangular and trapezoidal entries are accepted and converted by centroid before the crisp calculation.';
  return (
    <div className="configurationSummary" aria-label="Configured workflow summary">
      <div><span>Data</span><strong>{groupText}</strong></div>
      <div><span>Weights</span><strong>{weightText}</strong></div>
      <div><span>AHP</span><strong>{ahpText}</strong></div>
      <div><span>Fuzzy</span><strong>{method.fuzzySupport.enabled ? fuzzyText : 'Fuzzy upload is accepted through defuzzified crisp analysis for this method.'}</strong></div>
    </div>
  );
}

function CapabilityStrip({ method, config }: { method: MethodDefinition; config: StudyConfig }) {
  const isDematel = config.methodId === 'dematel';
  const dataInputMode = String(config.methodParams.dataInputMode ?? (isDematel ? 'Single expert matrix' : 'Single aggregated dataset'));
  const usesGroupData = isDematel ? dataInputMode === 'Multiple experts' : dataInputMode === 'Multiple respondents';
  const respondentCount = usesGroupData ? Number(config.methodParams.respondentCount ?? 1) : 1;
  const ahpRespondents = Number(config.methodParams.ahpRespondentCount ?? respondentCount);
  const expertCount = usesGroupData ? Number(config.methodParams.dematelExpertCount ?? 1) : 1;
  const fuzzyMode = String(config.methodParams.fuzzyInputMode ?? defaultFuzzyMode);
  const respondentLabel = isDematel
    ? usesGroupData ? `${expertCount} expert influence matrices` : 'One aggregated influence matrix'
    : usesGroupData ? `${respondentCount} respondent decision matrices` : 'One aggregated decision matrix';
  const respondentRule = isDematel
    ? usesGroupData ? String(config.methodParams.dematelAggregation ?? 'Arithmetic mean') : 'No expert aggregation'
    : usesGroupData ? String(config.methodParams.respondentAggregation ?? 'Arithmetic mean') : 'No respondent aggregation';
  const pairwiseRule = usesGroupData && (config.methodId === 'ahp' || config.weightingId === 'ahp')
    ? `${ahpRespondents} AHP pairwise respondent matrix${ahpRespondents === 1 ? '' : 'es'} combined by geometric mean`
    : config.methodId === 'ahp' || config.weightingId === 'ahp' ? 'Single pairwise matrix' : 'Not used for selected setup';
  const fuzzyRule = fuzzyMode.startsWith('Native fuzzy')
    ? 'Triangular/trapezoidal values stay fuzzy through supported method tables'
    : 'Triangular/trapezoidal values are converted by centroid before the crisp run';
  return (
    <div className="capabilityStrip" aria-label="Selected method capabilities">
      <div><span>Group input</span><strong>{respondentLabel}</strong><em>{respondentRule}</em></div>
      <div><span>AHP judgments</span><strong>{pairwiseRule}</strong><em>Reciprocal pairwise checks are enforced</em></div>
      <div><span>Fuzzy handling</span><strong>{method.fuzzySupport.nativeModeLabel ? fuzzyMode : 'Defuzzify on upload'}</strong><em>{fuzzyRule}</em></div>
      <div><span>Output type</span><strong>{isDematel ? 'Cause-effect model' : 'Ranked alternatives'}</strong><em>{method.outputs.slice(0, 2).join(', ')}</em></div>
    </div>
  );
}

function TemplateSpecSummary({ config, methodName }: { config: StudyConfig; methodName: string }) {
  const isDematel = config.methodId === 'dematel';
  const dataInputMode = String(config.methodParams.dataInputMode ?? (isDematel ? 'Single expert matrix' : 'Single aggregated dataset'));
  const usesGroupData = isDematel ? dataInputMode === 'Multiple experts' : dataInputMode === 'Multiple respondents';
  const respondentCount = usesGroupData ? Number(config.methodParams.respondentCount ?? 1) : 1;
  const ahpRespondents = Number(config.methodParams.ahpRespondentCount ?? respondentCount);
  const dematelExperts = usesGroupData ? Number(config.methodParams.dematelExpertCount ?? 1) : 1;
  const fuzzyMode = String(config.methodParams.fuzzyInputMode ?? defaultFuzzyMode);
  return (
    <div className="templateSpecs">
      <div><span>Selected model</span><strong>{methodName}</strong></div>
      <div><span>{isDematel ? 'Factors' : 'Alternatives'}</span><strong>{isDematel ? config.criteria.length : config.alternatives.length}</strong></div>
      <div><span>{isDematel ? 'Matrix shape' : 'Criteria'}</span><strong>{isDematel ? `${config.criteria.length} x ${config.criteria.length}` : config.criteria.length}</strong></div>
      <div><span>Weighting</span><strong>{isDematel ? 'Not used' : weightingDisplayName(config.weightingId)}</strong></div>
      <div><span>Data collection</span><strong>{dataInputMode}</strong></div>
      <div><span>{isDematel ? 'Experts' : 'Respondents'}</span><strong>{usesGroupData ? isDematel ? dematelExperts : respondentCount : 'Not used'}</strong></div>
      <div><span>AHP pairwise respondents</span><strong>{usesGroupData && (config.methodId === 'ahp' || config.weightingId === 'ahp') ? ahpRespondents : 'Not used'}</strong></div>
      <div><span>Fuzzy mode</span><strong>{fuzzyMode}</strong></div>
      <div><span>Template source</span><strong>Selected specifications</strong></div>
    </div>
  );
}

function UploadStep({ config, methodName, validation, uploadAttempted, onUpload, onBack, onSample }: { config: StudyConfig; methodName: string; validation: ValidationResult; uploadAttempted: boolean; onUpload: (file: File) => void; onBack: () => void; onSample: () => void }) {
  return (
    <section className="singlePanel">
      <div className="sectionTitle">
        <h1>Upload completed template</h1>
        <p>The app validates workbook structure, criterion types, weights, and matrix values before running the selected method.</p>
      </div>
      <TemplateSpecSummary config={config} methodName={methodName} />
      <label className="uploadZone">
        <Upload size={26} /><strong>Drop or choose an Excel template</strong><span>.xlsx or .xls files generated by MCDM Studio</span>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = '';
          if (file) onUpload(file);
        }} />
      </label>
      <div className="validationList">
        {validation.issues.length ? validation.issues.map((issue) => <div className={`validationItem ${issue.severity}`} key={`${issue.sheet}-${issue.location}-${issue.message}`}><strong>{issue.severity}</strong><span>{issue.sheet} {issue.location}: {issue.message}</span></div>) : <div className="readyNote">{uploadAttempted ? 'Validation passed. The completed workbook is ready for analysis.' : 'Upload the completed template to run validation and analysis.'}</div>}
      </div>
      <div className="flowActions uploadActions">
        <button className="secondaryAction" onClick={onBack}>Back to template</button>
        <button className="textAction" onClick={onSample}>Analyze current screen data <ArrowRight size={16} /></button>
      </div>
    </section>
  );
}

function ResultsStep({ config, analysis, checksPassed, checksTotal, activeTab, compareIds, onTab, onCompareIds, onEdit, onUpload, onJson, onExcel, onDocx, onPdf, onExport }: { config: StudyConfig; analysis: AnalysisResult; checksPassed: number; checksTotal: number; activeTab: string; compareIds: MethodId[]; onTab: (tab: string) => void; onCompareIds: (ids: MethodId[]) => void; onEdit: () => void; onUpload: () => void; onJson: () => void; onExcel: () => void | Promise<void>; onDocx: () => void | Promise<void>; onPdf: () => void | Promise<void>; onExport: () => void | Promise<void> }) {
  const isDematel = analysis.methodId === 'dematel';
  const comparisonUnavailable = methodComparisonBlockReason(config.methodId, config, analysis.input);
  const canCompareMethods = !comparisonUnavailable;
  const qualityText = checksTotal ? `${checksPassed}/${checksTotal} built-in method checks passed.` : 'Built-in method checks are loading.';
  const externalEvidenceText = externalValidationCoverageLabel(config.methodId);
  const tabs = ['Input Summary', 'Cleaned Input', 'Transformed Matrix', 'Method Tables', 'Diagnostics', 'Final Result', 'Visualizations', ...(canCompareMethods ? ['Compare Methods'] : [])];
  const inputTable = inputMatrixTable(analysis);
  const activeTable = activeTab === 'Final Result'
    ? analysis.tables.find((table) => table.id === 'ranking' || table.id === 'cause-effect') ?? analysis.tables[0]
    : activeTab === 'Transformed Matrix'
      ? analysis.tables.find((table) => table.id.includes('normalized') || table.id.includes('total')) ?? analysis.tables[0]
      : analysis.tables[0];
  const rankingTable = analysis.tables.find((table) => table.id === 'ranking');
  return (
    <section className="resultsPanel">
      <div className="resultsHeader">
        <div><h1>{analysis.methodName} results</h1><p>{config.title}. {qualityText} {externalEvidenceText}</p></div>
        <div className="exportActions">
          <button className="secondaryAction" onClick={onEdit}>Edit specifications</button>
          <button className="secondaryAction" onClick={onUpload}>Re-upload</button>
          <button className="secondaryAction" onClick={() => void onExcel()}>Excel</button>
          <button className="secondaryAction" onClick={() => void onDocx()}>DOCX</button>
          <button className="secondaryAction" onClick={() => void onPdf()}>PDF</button>
          <button className="secondaryAction" onClick={onJson}>Project JSON</button>
          <button className="primaryAction" onClick={() => void onExport()}><FileText size={16} />Full package</button>
        </div>
      </div>
      <div className="resultTabs">{tabs.map((tab) => <button className={activeTab === tab ? 'active' : ''} key={tab} onClick={() => onTab(tab)}>{tab}</button>)}</div>
      <div className="resultCards">
        <Metric label={isDematel ? 'Top factor' : 'Top alternative'} value={analysis.ranking[0]?.alternative ?? 'N/A'} />
        <Metric label="Top score" value={analysis.ranking[0]?.score?.toFixed(4) ?? 'N/A'} />
        <Metric label="Output tables" value={String(analysis.tables.length)} />
      </div>
      {activeTab === 'Input Summary' ? <InputSummary analysis={analysis} config={config} checksPassed={checksPassed} checksTotal={checksTotal} /> : null}
      {activeTab === 'Cleaned Input' ? <TableBlock table={inputTable} /> : null}
      {activeTab === 'Visualizations' ? <VisualizationPanel analysis={analysis} rankingTitle={rankingTable?.title ?? 'Ranking visualization'} /> : null}
      {activeTab === 'Compare Methods' && canCompareMethods ? <CompareMethods config={config} analysis={analysis} compareIds={compareIds} onChange={onCompareIds} /> : null}
      {activeTab === 'Compare Methods' && !canCompareMethods ? <div className="readyNote">{comparisonUnavailable}</div> : null}
      {(activeTab === 'Transformed Matrix' || activeTab === 'Final Result') ? (
        <div className="resultsGridSimple">
          <TableBlock table={activeTable} />
          <VisualizationPanel analysis={analysis} rankingTitle={rankingTable?.title ?? 'Ranking visualization'} compact />
        </div>
      ) : null}
      {activeTab === 'Diagnostics' ? <Diagnostics diagnostics={analysis.diagnostics} /> : null}
      {activeTab === 'Method Tables' ? analysis.tables.map((table) => <TableBlock key={table.id} table={table} />) : null}
    </section>
  );
}

function inputMatrixTable(analysis: AnalysisResult): OutputTable {
  const isDematel = analysis.methodId === 'dematel';
  return {
    id: 'cleaned-input',
    title: isDematel ? 'Analyzed Direct Relation Matrix' : 'Analyzed Decision Matrix',
    columns: [isDematel ? 'Source factor' : 'Alternative', ...analysis.input.criteria.map((criterion) => criterion.id)],
    rows: analysis.input.values.map((row, index) => [
      isDematel ? (analysis.input.criteria[index]?.name ?? analysis.input.criteria[index]?.id ?? `F${index + 1}`) : (analysis.input.alternatives[index]?.name ?? analysis.input.alternatives[index]?.id ?? `A${index + 1}`),
      ...row.map((value) => Number.isFinite(value) ? Number(value.toFixed(6)) : 'Invalid'),
    ]),
  };
}

function CompareMethods({ config, analysis, compareIds, onChange }: { config: StudyConfig; analysis: AnalysisResult; compareIds: MethodId[]; onChange: (ids: MethodId[]) => void }) {
  const comparableMethods = comparableRankingMethods(config, analysis.input);
  const selected = (compareIds.length ? compareIds : [config.methodId]).filter((id) => comparableMethods.some((method) => method.id === id));
  const unavailableMethods = methodRegistry
    .map((method) => ({ method, reason: methodComparisonBlockReason(method.id, config, analysis.input) }))
    .filter((item) => item.reason);
  const rows = selected
    .map((id) => getMethod(id))
    .map((method) => {
      try {
        const result = method.id === analysis.methodId ? analysis : method.runAnalysis(analysis.input, { ...config, methodId: method.id });
        return {
          method: method.name,
          top: result.ranking[0]?.alternative ?? 'N/A',
          score: result.ranking[0]?.score ?? 0,
          ranking: result.ranking.map((row) => `${row.rank}. ${row.alternative}`).join(' | '),
        };
      } catch (error) {
        return {
          method: method.name,
          top: 'Unavailable',
          score: 0,
          ranking: error instanceof Error ? error.message : 'This method could not run with the uploaded data.',
        };
      }
    });
  const toggle = (id: MethodId) => {
    const nextIds = compareIds.includes(id) ? compareIds.filter((item) => item !== id) : [...compareIds, id];
    onChange(nextIds.filter((item) => comparableMethods.some((method) => method.id === item)));
  };
  return (
    <div className="comparePanel">
      <div className="compareControls">
        {comparableMethods.map((method) => (
          <label key={method.id}>
            <input type="checkbox" checked={selected.includes(method.id)} onChange={() => toggle(method.id)} />
            <span>{method.name}</span>
          </label>
        ))}
      </div>
      {unavailableMethods.length ? (
        <details className="comparisonNotes">
          <summary>Methods not available for this comparison</summary>
          <div>
            {unavailableMethods.map(({ method, reason }) => <p key={method.id}><strong>{method.name}</strong>: {reason}</p>)}
          </div>
        </details>
      ) : null}
      <div className="cleanTableWrap">
        <h2>Method comparison</h2>
        <table>
          <thead><tr><th>Method</th><th>Top result</th><th>Top score</th><th>Ranking order</th></tr></thead>
          <tbody>{rows.length ? rows.map((row) => <tr key={row.method}><td>{row.method}</td><td>{row.top}</td><td>{row.top === 'Unavailable' ? 'N/A' : row.score.toFixed(4)}</td><td>{row.ranking}</td></tr>) : <tr><td colSpan={4}>Select at least one compatible ranking method.</td></tr>}</tbody>
        </table>
      </div>
    </div>
  );
}

function InputSummary({ analysis, config, checksPassed, checksTotal }: { analysis: AnalysisResult; config: StudyConfig; checksPassed: number; checksTotal: number }) {
  const method = getMethod(config.methodId);
  return (
    <>
      <div className="summaryGrid">
        <Metric label="Study" value={config.title} />
        <Metric label="Method" value={analysis.methodName} />
        <Metric label="Weighting" value={method.supportsWeights ? weightingDisplayName(config.weightingId) : 'Not used'} />
        <Metric label="Alternatives/factors" value={String(analysis.input.alternatives.length)} />
        <Metric label="Criteria/factors" value={String(analysis.input.criteria.length)} />
        <Metric label="Diagnostics" value={`${analysis.diagnostics.filter((item) => item.status === 'pass').length}/${analysis.diagnostics.length} passed`} />
      </div>
      <ReadinessPanel method={method} config={config} checksPassed={checksPassed} checksTotal={checksTotal} />
    </>
  );
}

function ReadinessPanel({ method, config, checksPassed, checksTotal }: { method: MethodDefinition; config: StudyConfig; checksPassed: number; checksTotal: number }) {
  const items = methodCoverageItems(method, config, checksPassed, checksTotal);
  const externalFixtures = externalValidationFixturesFor(method.id);
  const externalCandidates = externalValidationCandidatesFor(method.id);
  const validationStatus = externalValidationStatusFor(method.id, 'readiness');
  return (
    <section className="readinessPanel">
      <div className="tableToolbar">
        <h2>Research readiness</h2>
        <span>Selected workflow</span>
      </div>
      <div className="readinessGrid">
        {items.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
      <div className="externalEvidencePanel">
        <div className={`validationBadge ${validationStatus.tone}`}>
          <strong>{validationStatus.label}</strong>
          <span>{validationStatus.text}</span>
        </div>
        <div>
          <span>External published validation</span>
          <strong>{externalFixtures.length ? `${externalFixtures.length} fixture${externalFixtures.length === 1 ? '' : 's'} registered for ${method.name}` : `No published fixture registered for ${method.name} yet`}</strong>
        </div>
        {externalFixtures.length ? externalFixtures.map((fixture) => (
          <a key={`${fixture.methodId}-${fixture.variant}`} href={fixture.sourceUrl} target="_blank" rel="noreferrer">
            <strong>{fixture.variant}</strong>
            <span>{fixture.source}; DOI {fixture.doi}</span>
          </a>
        )) : (
          <p>Bundled numerical checks still run for this method, but external paper-by-paper validation is pending for this selected method.</p>
        )}
        {externalCandidates.length ? (
          <div className="evidenceNotice">
            <strong>Validation candidate tracked</strong>
            {externalCandidates.map((candidate) => (
              <a key={`${candidate.methodId}-${candidate.variant}`} href={candidate.sourceUrl} target="_blank" rel="noreferrer">
                <span>{candidate.variant}</span>
                <em>{candidate.scope} DOI {candidate.doi}</em>
              </a>
            ))}
          </div>
        ) : null}
      </div>
      <div className="capabilityProfile">
        <div>
          <span>Respondent strategy</span>
          <strong>{groupDecisionCapability(method, config)}</strong>
        </div>
        <div>
          <span>Fuzzy strategy</span>
          <strong>{fuzzyCapability(method, config)}</strong>
        </div>
        <div>
          <span>Validation boundary</span>
          <strong>{validationBoundary(method)}</strong>
        </div>
      </div>
    </section>
  );
}

function Diagnostics({ diagnostics }: { diagnostics: AnalysisResult['diagnostics'] }) {
  return <div className="diagnostics">{diagnostics.map((item) => <div key={item.label} className={item.status}><strong>{item.label}</strong><span>{item.value}</span></div>)}</div>;
}

function VisualizationPanel({ analysis, rankingTitle, compact = false }: { analysis: AnalysisResult; rankingTitle: string; compact?: boolean }) {
  return (
    <div className={compact ? 'visualPanel compact' : 'visualPanel'}>
      {analysis.methodId === 'dematel' ? <DematelPlot analysis={analysis} /> : <RankingBars analysis={analysis} title={rankingTitle} />}
      {!compact ? <WeightBars analysis={analysis} /> : null}
      {!compact && analysis.methodId !== 'dematel' ? <SensitivityBand analysis={analysis} /> : null}
      {!compact ? <MatrixHeatmap analysis={analysis} /> : null}
    </div>
  );
}

function RankingBars({ analysis, title }: { analysis: AnalysisResult; title: string }) {
  const maxScore = Math.max(...analysis.ranking.map((row) => row.score), 1);
  return (
    <div className="rankingBars">
      <h2>{title}</h2>
      {analysis.ranking.map((row) => (
        <div className="simpleBar" key={row.alternativeId}>
          <span>{row.rank}</span><label>{row.alternative}</label><div><i style={{ width: `${Math.max(8, (row.score / maxScore) * 100)}%` }} /></div><strong>{row.score.toFixed(4)}</strong>
        </div>
      ))}
    </div>
  );
}

function WeightBars({ analysis }: { analysis: AnalysisResult }) {
  return (
    <div className="rankingBars">
      <h2>Criteria weights</h2>
      {analysis.input.criteria.map((criterion) => (
        <div className="simpleBar weightBar" key={criterion.id}>
          <span>{criterion.id}</span><label>{criterion.name}</label><div><i style={{ width: `${Math.max(4, criterion.weight * 100)}%` }} /></div><strong>{criterion.weight.toFixed(3)}</strong>
        </div>
      ))}
    </div>
  );
}

function MatrixHeatmap({ analysis }: { analysis: AnalysisResult }) {
  const visualization = analysis.visualizations.find((item) => item.type === 'matrix-heatmap');
  const data = visualization?.data ?? [];
  const rowKey = analysis.methodId === 'dematel' ? 'source' : 'alternative';
  const columnKey = analysis.methodId === 'dematel' ? 'target' : 'criterion';
  const rows = Array.from(new Set(data.map((item) => String(item[rowKey] ?? '')))).filter(Boolean).slice(0, 12);
  const columns = Array.from(new Set(data.map((item) => String(item[columnKey] ?? '')))).filter(Boolean).slice(0, 12);
  const values = data.map((item) => Number(item.value)).filter(Number.isFinite);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const colorFor = (value: number) => {
    const ratio = max === min ? 0.5 : Math.max(0, Math.min(1, (value - min) / (max - min)));
    const alpha = 0.12 + ratio * 0.72;
    return `rgba(0, 118, 111, ${alpha})`;
  };
  const valueFor = (row: string, column: string) => Number(data.find((item) => String(item[rowKey]) === row && String(item[columnKey]) === column)?.value ?? Number.NaN);
  if (!data.length) return null;
  return (
    <div className="rankingBars heatmapCard">
      <h2>{visualization?.title ?? 'Matrix heatmap'}</h2>
      <div className="heatmapGrid" style={{ gridTemplateColumns: `92px repeat(${columns.length}, minmax(34px, 1fr))` }}>
        <span />
        {columns.map((column) => <strong key={column}>{column}</strong>)}
        {rows.map((row) => (
          <Fragment key={row}>
            <label>{row}</label>
            {columns.map((column) => {
              const value = valueFor(row, column);
              return <i key={`${row}-${column}`} style={{ background: Number.isFinite(value) ? colorFor(value) : '#f3f6f7' }} title={`${row} / ${column}: ${Number.isFinite(value) ? value.toFixed(4) : 'N/A'}`}>{Number.isFinite(value) ? value.toFixed(2) : '-'}</i>;
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function SensitivityBand({ analysis }: { analysis: AnalysisResult }) {
  const visualization = analysis.visualizations.find((item) => item.type === 'sensitivity-band');
  const data = visualization?.data ?? [];
  if (!data.length) return null;
  return (
    <div className="rankingBars sensitivityCard">
      <h2>{visualization?.title ?? 'Weight perturbation band'}</h2>
      <p>Shows the configured +/-10% criterion-weight review range; use it as a publication check before deeper scenario reruns.</p>
      {data.map((item) => {
        const high = Math.max(Number(item.highScenario), 0.0001);
        const lowWidth = Math.max(2, (Number(item.lowScenario) / high) * 100);
        const basePosition = Math.max(2, Math.min(100, (Number(item.baseWeight) / high) * 100));
        return (
          <div className="sensitivityRow" key={String(item.criterion)}>
            <span>{String(item.criterion)}</span>
            <label>{String(item.name)}</label>
            <div>
              <i style={{ width: `${lowWidth}%` }} />
              <b style={{ left: `${basePosition}%` }} />
            </div>
            <strong>{Number(item.baseWeight).toFixed(3)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function DematelPlot({ analysis }: { analysis: AnalysisResult }) {
  const data = analysis.visualizations.find((item) => item.type === 'dematel-cause-effect')?.data ?? [];
  return (
    <div className="rankingBars">
      <h2>Cause-effect visualization</h2>
      {data.map((point) => (
        <div className="causeRow" key={String(point.factor)}>
          <strong>{String(point.factor)}</strong>
          <span>Prominence {Number(point.prominence).toFixed(4)}</span>
          <em className={Number(point.relation) >= 0 ? 'cause' : 'effect'}>{String(point.group)}</em>
        </div>
      ))}
    </div>
  );
}

function TableBlock({ table }: { table: AnalysisResult['tables'][number] }) {
  return (
    <div className="cleanTableWrap">
      <h2>{table.title}</h2>
      <table>
        <thead><tr>{table.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>{table.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function NextPanel() {
  return (
    <aside className="nextPanel">
      <h2>What happens next</h2>
      <div><Settings2 size={18} /><strong>Configure study</strong><span>Set criteria, weights, and analysis options.</span></div>
      <div><FileSpreadsheet size={18} /><strong>Download template</strong><span>Get the Excel template for your data.</span></div>
      <div><Upload size={18} /><strong>Upload completed file</strong><span>Run validation, calculations, and reports.</span></div>
    </aside>
  );
}

function SamplePreview({ title, config = sampleConfig, templateSheets = [] }: { title: string; config?: StudyConfig; templateSheets?: ReturnType<MethodDefinition['getTemplateSchema']> }) {
  const isDematel = config.methodId === 'dematel';
  const visibleSheets = templateSheets.filter((sheet) => sheet.name !== 'Instructions');
  const prioritySheet = (sheetName: string) => {
    if (/Parameters|Settings|Threshold|Lambda|Pairwise|Expert/i.test(sheetName)) return 0;
    if (/Decision Matrix|Direct Relation Matrix|Factors|Criteria/i.test(sheetName)) return 1;
    if (/Weights/i.test(sheetName)) return 2;
    return 3;
  };
  const previewSheets = visibleSheets.length
    ? [...visibleSheets].sort((a, b) => prioritySheet(a.name) - prioritySheet(b.name)).slice(0, 4)
    : templateSheets.slice(0, 4);
  const hiddenCount = Math.max(templateSheets.length - previewSheets.length, 0);
  const fuzzyMode = String(config.methodParams.fuzzyInputMode ?? defaultFuzzyMode);
  const dataInputMode = String(config.methodParams.dataInputMode ?? (isDematel ? 'Single expert matrix' : 'Single aggregated dataset'));
  const usesGroupData = isDematel ? dataInputMode === 'Multiple experts' : dataInputMode === 'Multiple respondents';
  const weightingNote = isDematel
    ? 'No criteria weights'
    : config.weightingId === 'manual' ? 'Manual weights required' : `${weightingDisplayName(config.weightingId)} weights calculated`;
  const nativeFuzzyPreviewNote = config.methodId === 'grp'
    ? 'Fuzzy cells use triangular `(l,m,u)` or trapezoidal `(a,b,c,d)` values and are processed through fuzzy positive/negative grey projection closeness.'
    : 'Fuzzy cells use triangular `(l,m,u)` or trapezoidal `(a,b,c,d)` values and are processed in native fuzzy mode for this method.';
  const calculatedWeightPreviewNote = `${weightingDisplayName(config.weightingId)} weighting is selected. The workbook intentionally has no editable manual-weight sheet; applied weights are calculated during analysis and shown in results and exports.`;
  const compactRows = (rows: Array<Array<string | number>>, maxRows = 5, maxColumns = 7) =>
    rows.slice(0, maxRows).map((row) => row.slice(0, maxColumns));
  const matrixSheet = templateSheets.find((sheet) => sheet.name === (isDematel ? 'Direct Relation Matrix' : 'Decision Matrix'));
  const matrixPreview = matrixSheet ? compactRows(matrixSheet.rows, 5, 7) : [];
  return (
    <section className="samplePanel">
      <h2>{title}</h2>
      <p className="sampleNote">These sheets are generated from the selected method, current criteria/factors, respondent settings, weighting method, and fuzzy mode.</p>
      <div className="templatePreviewMeta">
        <span>{templateSheets.length} workbook sheets</span>
        <span>{usesGroupData ? isDematel ? `${Number(config.methodParams.dematelExpertCount ?? 1)} expert sheets` : `${Number(config.methodParams.respondentCount ?? 1)} respondent sheets` : 'Single matrix input'}</span>
        <span>{weightingNote}</span>
        <span>{fuzzyMode}</span>
      </div>
      {!isDematel && config.weightingId !== 'manual' ? (
        <p className="sampleNote">{calculatedWeightPreviewNote}</p>
      ) : null}
      {fuzzyMode.startsWith('Native fuzzy') ? (
        <p className="sampleNote">{nativeFuzzyPreviewNote}</p>
      ) : null}
      <div className="sheetInventory" aria-label="Workbook sheets">
        {templateSheets.map((sheet) => <span key={sheet.name}>{sheet.name}</span>)}
      </div>
      <div className="templateSheetGrid">
        {previewSheets.map((sheet) => (
          <div className="templateSheetCard" key={sheet.name}>
            <div className="tableToolbar"><h2>{sheet.name}</h2><span>{sheet.rows.length} rows</span></div>
            <table>
              <tbody>{compactRows(sheet.rows).map((row, rowIndex) => (
                <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
              ))}</tbody>
            </table>
          </div>
        ))}
      </div>
      {hiddenCount ? <p className="sampleNote">{hiddenCount} more sheet{hiddenCount === 1 ? '' : 's'} will be included in the downloaded workbook.</p> : null}
      <div className="cleanTableWrap previewMatrix">
        <div className="tableToolbar"><h2>{isDematel ? 'Filled direct-relation example' : 'Filled decision-matrix example'}</h2><span>{isDematel ? `${config.criteria.length} x ${config.criteria.length}` : `${config.alternatives.length} x ${config.criteria.length}`}</span></div>
        <table>
          <tbody>{matrixPreview.map((row, rowIndex) => (
            <tr key={rowIndex}>{row.map((cell, cellIndex) => rowIndex === 0 ? <th key={cellIndex}>{cell}</th> : <td key={cellIndex}>{cell}</td>)}</tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

function LoadingOverlay({ label }: { label: string }) {
  return <div className="loadingOverlay"><div><span className="spinner" /><p>{label}</p></div></div>;
}

createRoot(document.getElementById('root')!).render(<App />);
