import { Fragment, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, Check, Download, FileSpreadsheet, FileText, HelpCircle, Plus, Save, Search, Trash2, Upload } from 'lucide-react';
import { methodFamilies, methodFamilyById, methodPurpose, type MethodFamily } from './core/methodMetadata';
import { getMethod, methodRegistry } from './core/methods';
import { fuzzyCapability, groupDecisionCapability, validationBoundary } from './core/capabilityMatrix';
import { methodCoverageItems } from './core/coverage';
import { externalFixtureSampleFor } from './core/externalFixtureSamples';
import { externalValidationCandidatesFor, externalValidationCoverageLabel, externalValidationFixturesFor, externalValidationStatusFor, externalValidationSummaryFor, validationEvidence } from './core/validationEvidence';
import { weightingDisplayName } from './core/weightingMetadata';
import { sampleConfig, sampleMatrix } from './data/sampleStudy';
import { exportProject, importProject } from './services/project';
import type { AnalysisResult, DecisionMatrix, MethodDefinition, MethodId, OutputTable, StudyConfig, TemplateSheet, ValidationResult, WeightingId } from './types';
import './styles.css';

const steps = ['Choose', 'Setup', 'Template', 'Upload', 'Results'];

type WizardStep = 1 | 2 | 3 | 4 | 5;
const defaultFuzzyMode = 'Defuzzify on upload';
const formatGuideNumber = (value: number) => Number(value.toFixed(4));

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

function definedMethodParams(params: Record<string, string | number | boolean | undefined> = {}): StudyConfig['methodParams'] {
  return Object.entries(params).reduce<StudyConfig['methodParams']>((clean, [key, value]) => {
    if (value !== undefined) clean[key] = value;
    return clean;
  }, {});
}

function guideSampleForMethod(methodId: MethodId) {
  const fixtureSample = externalFixtureSampleFor(methodId);
  if (fixtureSample) {
    const guideConfig = sanitizeStudyConfig({
      ...sampleConfig,
      ...fixtureSample.config,
      title: fixtureSample.config.title ?? `${getMethod(methodId).name} published example`,
      methodId,
      methodParams: sanitizeMethodParams(methodId, {
        ...sampleConfig.methodParams,
        ...definedMethodParams(fixtureSample.config.methodParams),
      }),
      alternatives: fixtureSample.input.alternatives,
      criteria: fixtureSample.input.criteria,
    });
    return {
      config: guideConfig,
      input: fixtureSample.input,
      fixture: fixtureSample,
    };
  }
  const guideMethod = getMethod(methodId);
  const guideCriteria = sampleConfig.criteria;
  const guideAlternatives = methodId === 'dematel'
    ? guideCriteria.map((criterion) => ({ id: criterion.id, name: criterion.name }))
    : sampleConfig.alternatives;
  const guideConfig = sanitizeStudyConfig({
    ...sampleConfig,
    methodId,
    weightingId: methodId === 'ahp' ? 'ahp' as const : guideMethod.supportsWeights ? sampleConfig.weightingId : 'manual' as const,
    methodParams: sanitizeMethodParams(methodId, sampleConfig.methodParams),
    alternatives: guideAlternatives,
    criteria: guideCriteria,
  });
  const values = methodId === 'dematel'
    ? guideCriteria.map((_, row) => guideCriteria.map((__, column) => row === column ? 0 : ((row + column) % 4) + 1))
    : sampleMatrix.values.slice(0, guideAlternatives.length).map((row) => row.slice(0, guideCriteria.length));
  return {
    config: guideConfig,
    input: {
      alternatives: guideAlternatives,
      criteria: guideCriteria,
      values,
    },
  };
}

function sheetsWithGuideSampleData(sheets: TemplateSheet[], input: DecisionMatrix, methodId: MethodId): TemplateSheet[] {
  return sheets.map((sheet) => {
    if (sheet.name === 'Decision Matrix') {
      return {
        ...sheet,
        rows: [
          ['Alternative ID', ...input.criteria.map((criterion) => criterion.id)],
          ...input.alternatives.map((alternative, rowIndex) => [alternative.id, ...(input.values[rowIndex] ?? [])]),
        ],
      };
    }
    if (methodId === 'dematel' && sheet.name === 'Direct Relation Matrix') {
      return {
        ...sheet,
        rows: [
          ['Factor', ...input.criteria.map((criterion) => criterion.id)],
          ...input.criteria.map((criterion, rowIndex) => [criterion.id, ...(input.values[rowIndex] ?? [])]),
        ],
      };
    }
    return sheet;
  });
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
function dataInputModeLabel(option: string) {
  if (option === 'Single expert matrix') return 'One expert matrix';
  if (option === 'Multiple experts') return 'One matrix per expert';
  if (option === 'Single aggregated dataset') return 'One decision table';
  if (option === 'Multiple respondents') return 'One table per respondent';
  return option;
}

function fuzzyModeLabel(option: string) {
  if (option === 'Defuzzify on upload') return 'Convert fuzzy ranges to numbers';
  return option;
}

function friendlyFieldLabel(label: string) {
  return label;
}

function friendlyOptionLabel(option: string) {
  return option;
}

function compactUiText(text: string, maxLength = 96) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  const sentence = clean.match(/^(.+?[.!?])\s/)?.[1];
  if (sentence && sentence.length <= maxLength) return sentence;
  return `${clean.slice(0, maxLength - 1).trim()}...`;
}

function isPreTemplateIssue(issue: ValidationResult['issues'][number]) {
  const uploadOnlyMessages = [
    'DEMATEL multiple-expert studies require at least one expert matrix sheet.',
    'DEMATEL expected',
  ];
  return issue.severity !== 'info' && !uploadOnlyMessages.some((message) => issue.message.includes(message));
}

function nextGeneratedId(prefix: string, used: Set<string>, startAt = 1) {
  let index = Math.max(1, startAt);
  while (used.has(`${prefix}${index}`)) index += 1;
  return { id: `${prefix}${index}`, index };
}

function normalizeUniqueIds<T extends { id: string; name: string }>(
  prefix: string,
  items: T[],
  label: string,
): T[] {
  const used = new Set<string>();
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
    return {
      ...item,
      id: next.id,
      name: item.name?.trim() ? item.name : `${label} ${next.index}`,
    };
  });
}

function methodIdFromHash(hash = window.location.hash): MethodId | null {
  const match = hash.match(/^#\/methods\/([^/?#]+)/);
  if (!match) return null;
  const decoded = decodeURIComponent(match[1]);
  return methodRegistry.some((method) => method.id === decoded) ? decoded as MethodId : null;
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
  const [guideMethodId, setGuideMethodId] = useState<MethodId | null>(() => methodIdFromHash());
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

  useEffect(() => {
    const syncGuidePage = () => setGuideMethodId(methodIdFromHash());
    window.addEventListener('hashchange', syncGuidePage);
    window.addEventListener('popstate', syncGuidePage);
    syncGuidePage();
    return () => {
      window.removeEventListener('hashchange', syncGuidePage);
      window.removeEventListener('popstate', syncGuidePage);
    };
  }, []);

  const openMethodGuide = (methodId: MethodId) => {
    setHelpOpen(false);
    setGuideMethodId(methodId);
    window.history.pushState(null, '', `#/methods/${methodId}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeMethodGuide = () => {
    setGuideMethodId(null);
    if (window.location.hash.startsWith('#/methods/')) {
      window.history.pushState(null, '', `${window.location.pathname}${window.location.search}`);
    }
  };
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
    transitionTo(2, 'Preparing this method...');
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
      transitionTo(5, 'Running your analysis...');
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
    transitionTo(3, 'Creating your Excel file...');
  };

  const downloadTemplateFile = async () => {
    setLoadingLabel('Preparing Excel file...');
    try {
      const { downloadTemplate } = await import('./services/workbook');
      await downloadTemplate(method.getTemplateSchema(config), `${method.name}-MCDM-template.xlsx`);
    } catch (error) {
      setValidation({ ok: false, issues: [{ severity: 'error', sheet: 'Template', location: method.name, message: error instanceof Error ? error.message : 'Unable to create the Excel file.' }] });
    } finally {
      setLoadingLabel('');
    }
  };

  const downloadMethodSampleFile = async (methodId: MethodId) => {
    const guideMethod = getMethod(methodId);
    const { config: guideConfig, input: guideInput } = guideSampleForMethod(methodId);
    setLoadingLabel(`Preparing ${guideMethod.name} sample file...`);
    try {
      const { downloadSampleWorkbook } = await import('./services/workbook');
      await downloadSampleWorkbook(guideMethod.getTemplateSchema(guideConfig), `${guideMethod.name}-sample-data.xlsx`, guideInput, guideConfig);
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
          <div className="brandText"><strong>MCDM Studio</strong><span>Decision analysis workspace</span></div>
        </div>
        <div className="headerActions">
          <button className="ghostButton" onClick={() => setHelpOpen((current) => !current)} title="Open workflow help"><HelpCircle size={16} />Help</button>
          <button className="ghostButton" onClick={saveProject} title="Save this study as a project file"><Save size={16} />Save project</button>
          <label className="ghostButton fileButton" title="Open a saved MCDM Studio project"><Upload size={16} />Open project<input type="file" accept=".json" onChange={(event) => {
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
            setGuideMethodId(null);
            setStep(1);
          }} />
        ) : guideMethodId ? (
          <MethodGuidePage methodId={guideMethodId} onBack={closeMethodGuide} onUse={(methodId) => { closeMethodGuide(); selectMethod(methodId); }} onDownloadSample={downloadMethodSampleFile} />
        ) : (
          <div className="appWorkspace">
            <Stepper activeStep={step} maxStep={maxStep} onStep={handleStepNavigation} />
            <div className="workflowCanvas">
              {step === 1 ? <MethodStep query={query} family={methodFamily} onQuery={setQuery} onFamily={setMethodFamily} methods={filteredMethods} onSelect={selectMethod} onGuide={openMethodGuide} /> : null}
              {step === 2 ? <ConfigureStep config={config} input={input} method={method} onChange={handleStudyChange} onNext={openTemplateStep} /> : null}
              {step === 3 ? <TemplateStep config={config} methodName={method.name} onDownload={downloadTemplateFile} onBack={() => setStep(2)} onNext={() => transitionTo(4, 'Opening upload step...')} /> : null}
              {step === 4 ? <UploadStep config={config} methodName={method.name} validation={validation} uploadAttempted={uploadAttempted} onUpload={handleUpload} onBack={() => setStep(3)} onSample={runConfiguredAnalysis} /> : null}
              {step === 5 ? <ResultsStep config={config} analysis={analysis} checksPassed={qualitySummary.passed} checksTotal={qualitySummary.total} activeTab={resultTab} compareIds={compareIds} onTab={setResultTab} onCompareIds={setCompareIds} onEdit={() => setStep(2)} onUpload={() => setStep(4)} onJson={saveProject} onExcel={exportExcel} onDocx={exportDoc} onPdf={exportPdfReport} onExport={exportAll} /> : null}
            </div>
          </div>
        )}
      </main>
      <footer className="studioFooter">
        <span>© 2026 MCDM Studio. All rights reserved.</span>
        <span>Citation: Naved, M. (2026). <em>MCDM Studio: Multi-Criteria Decision-Making Analysis Tool</em> (Version 1.0) [Computer software]. MCDM Studio.</span>
      </footer>
    </div>
  );
}

function HelpPage({ onClose, onStart }: { onClose: () => void; onStart: () => void }) {
  const workflow = [
    ['Choose', 'Pick the method.'],
    ['Setup', 'Set criteria and weights.'],
    ['Template', 'Get the Excel file.'],
    ['Upload', 'Upload completed data.'],
    ['Results', 'Export results.'],
  ];
  return (
    <section className="helpPage">
      <div className="helpHero">
        <div>

          <h1>Use MCDM Studio</h1>
          <p>Pick a method, prepare the file, upload, export.</p>
        </div>
        <div className="helpActions">
          <button className="secondaryAction" onClick={onClose}>Back to app</button>
          <button className="primaryAction" onClick={onStart}>Start <ArrowRight size={16} /></button>
        </div>
      </div>

      <div className="helpGrid">
        <article className="helpCard wide">
          <h2>Main flow</h2>
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
          <h2>Data</h2>
          <ul>
            <li>Rows are alternatives; columns are criteria.</li>
            <li>DEMATEL uses factor influence values.</li>
            <li>Benefit means higher is better; Cost means lower is better.</li>
            <li>Automatic weights hide manual weight cells.</li>
          </ul>
        </article>

        <article className="helpCard">
          <h2>Excel</h2>
          <ul>
            <li>After setup changes, download a fresh file.</li>
            <li>Keep sheet and header names unchanged.</li>
            <li>Template preview shows where data goes.</li>
            <li>Upload messages point to the sheet and cell area.</li>
          </ul>
        </article>

        <article className="helpCard">
          <h2>Fuzzy</h2>
          <ul>
            <li>Triangular fuzzy values use `(l,m,u)`, for example `(2,3,5)`.</li>
            <li>Trapezoidal fuzzy values use `(a,b,c,d)`, for example `(1,2,4,6)`.</li>
            <li>Use fuzzy values for ranges.</li>
            <li>Each method shows fuzzy handling.</li>
          </ul>
        </article>

        <article className="helpCard">
          <h2>Groups</h2>
          <ul>
            <li>Multiple respondents can score the same options.</li>
            <li>AHP combines pairwise judgments.</li>
            <li>DEMATEL can use multiple experts.</li>
            <li>Group sheets are combined before analysis.</li>
          </ul>
        </article>

        <article className="helpCard">
          <h2>Results</h2>
          <ul>
            <li>Start with Final Result.</li>
            <li>Excel exports calculation tables.</li>
            <li>DOCX/PDF exports a report appendix.</li>
            <li>Save a project file when you need to pause.</li>
          </ul>
        </article>

        <article className="helpCard">
          <h2>Fixes</h2>
          <ul>
            <li>Use the Excel file for the selected method.</li>
            <li>Locked weights are calculated automatically.</li>
            <li>Fix upload messages before results.</li>
            <li>After structure changes, download a fresh file.</li>
          </ul>
        </article>
      </div>
    </section>
  );
}

function methodFormulaFor(method: MethodDefinition) {
  const notes: Partial<Record<MethodId, { transform: string; score: string; rule: string }>> = {
    topsis: { transform: 'r_ij = x_ij / sqrt(sum_i x_ij^2); v_ij = w_j r_ij', score: 'C_i = d_i^- / (d_i^+ + d_i^-)', rule: 'Higher closeness coefficient C_i receives the better rank.' },
    ahp: { transform: 'a_jk = pairwise importance of C_j over C_k', score: 'w_j = GM_j / sum_j GM_j; CR = CI / RI', rule: 'Priorities are accepted when the consistency ratio is inside the selected threshold.' },
    dematel: { transform: 'X = Z / max_i sum_j z_ij; T = X(I - X)^-1', score: 'D_i = sum_j t_ij; R_i = sum_j t_ji', rule: 'D+R gives prominence; D-R separates cause factors from effect factors.' },
    vikor: { transform: 'S_i = sum_j w_j (f_j* - x_ij)/(f_j* - f_j-); R_i = max_j[...]', score: 'Q_i = v(S_i-S*)/(S--S*) + (1-v)(R_i-R*)/(R--R*)', rule: 'Lower Q_i is preferred, with acceptable advantage and stability checks.' },
    copras: { transform: 'q_ij = x_ij / sum_i x_ij; d_ij = w_j q_ij', score: 'Q_i = S_i+ + min(S-) sum(S-) / (S_i- sum(min(S-)/S_i-))', rule: 'Higher relative significance and utility percent receive the better rank.' },
    saw: { transform: 'r_ij = benefit x_ij/max(x_j), cost min(x_j)/x_ij', score: 'S_i = sum_j w_j r_ij', rule: 'Higher additive utility S_i receives the better rank.' },
    srp: { transform: 'p_ij = rank of A_i on C_j after direction handling', score: 'S_i = sum_j w_j p_ij', rule: 'Lower weighted rank score is preferred.' },
    fuca: { transform: 'p_ij = criterion-wise ordinal position of A_i', score: 'S_i = sum_j w_j p_ij', rule: 'Lower FUCA score indicates stronger overall priority.' },
    seca: { transform: 'sigma_j and pi_j estimate dispersion and correlation reference weights', score: 'min lambda_b + lambda_c subject to sum_j w_j = 1 and w_j >= epsilon', rule: 'Derived objective weights are applied to the normalized decision matrix.' },
    dear: { transform: 'Normalize each response according to benefit/cost direction', score: 'MRPI_i = sum_j w_j r_ij', rule: 'Higher multi-response performance index is preferred.' },
    eamr: { transform: 'Separate benefit and cost-control normalized terms', score: 'E_i = benefit_i - beta * cost_i / lambda', rule: 'Higher appraisal score receives the better rank.' },
    rawec: { transform: 'Measure alternative deviation from the criterion-wise reference pattern', score: 'Q_i = v_i - v_i_prime after weighted correction', rule: 'Higher RAWEC index is preferred.' },
    comet: { transform: 'Characteristic values define characteristic objects in the criteria space', score: 'P(A_i) is interpolated from the preference function over characteristic objects', rule: 'Higher COMET preference value receives the better rank.' },
    wpm: { transform: 'r_ij = direction-adjusted comparable ratio', score: 'P_i = product_j r_ij ^ w_j', rule: 'Higher multiplicative utility P_i receives the better rank.' },
    waspas: { transform: 'Compute WSM_i and WPM_i from the same normalized matrix', score: 'Q_i = lambda WSM_i + (1-lambda) WPM_i', rule: 'Higher blended WASPAS utility receives the better rank.' },
    moora: { transform: 'r_ij = x_ij / sqrt(sum_i x_ij^2)', score: 'Y_i = sum benefit w_j r_ij - sum cost w_j r_ij', rule: 'Higher MOORA net assessment receives the better rank.' },
    moosra: { transform: 'r_ij = x_ij / sqrt(sum_i x_ij^2)', score: 'U_i = sum benefit w_j r_ij / sum cost w_j r_ij', rule: 'Higher MOOSRA ratio receives the better rank.' },
    arlon: { transform: 'Separate weighted benefit and cost components after normalization', score: 'R_i = G_i adjusted by kappa benefit/cost balance', rule: 'Higher ARLON final value is preferred.' },
    macont: { transform: 'Create the virtual reference alternative from criterion averages', score: 'S_i combines rho, Q, S1, and S2 mixed aggregation terms', rule: 'Higher MACONT final aggregation score receives the better rank.' },
    aras: { transform: 'Add the optimal row, normalize, then weight each criterion', score: 'K_i = S_i / S_0', rule: 'Higher utility degree K_i receives the better rank.' },
    edas: { transform: 'AV_j = mean_i x_ij; PDA/NDA measure distance from average solution', score: 'AS_i = 0.5(NSP_i + NSN_i)', rule: 'Higher EDAS appraisal score receives the better rank.' },
    mabac: { transform: 'v_ij = w_j(r_ij + 1); G_j = product_i v_ij^(1/m)', score: 'S_i = sum_j (v_ij - G_j)', rule: 'Higher distance from the border approximation area is preferred.' },
    codas: { transform: 'Normalize and weight, then find distance from the negative ideal', score: 'H_ik = (E_i-E_k) + psi(E_i-E_k)(T_i-T_k)', rule: 'Higher CODAS assessment score receives the better rank.' },
    cocoso: { transform: 'Compute weighted sum S_i and weighted product P_i', score: 'K_i combines arithmetic, relative, and compromise appraisal terms', rule: 'Higher CoCoSo compromise score receives the better rank.' },
    cradis: { transform: 'Normalize, weight, and compare to ideal and anti-ideal reference solutions', score: 'Q_i is derived from S0+ and S0- appraisal measures', rule: 'Higher CRADIS appraisal receives the better rank under the selected convention.' },
    mara: { transform: 'Construct the optimal alternative and map benefit/cost intensities', score: 'gap_i = area(optimal) - area(A_i)', rule: 'Lower MARA area gap is preferred.' },
    raps: { transform: 'Build optimal benefit and cost components for the perimeter model', score: 'PS_i = perimeter(A_i) / perimeter(optimal)', rule: 'Higher perimeter similarity is preferred.' },
    oreste: { transform: 'Convert criterion importance and alternative performance into ordinal ranks', score: 'B_i = mean_j global_rank_ij', rule: 'Lower ORESTE projection rank receives the better final rank.' },
    qualiflex: { transform: 'Enumerate feasible permutations of alternatives', score: 'I(P) = sum weighted concordance-discordance over all ordered pairs', rule: 'The permutation with maximum comprehensive index determines the final order.' },
    regime: { transform: 'Compare alternatives pairwise on each criterion using direction-aware signs', score: 'phi_i = outgoing dominance - incoming dominance', rule: 'Higher net regime flow receives the better rank.' },
    evamix: { transform: 'Separate ordinal dominance and cardinal dominance matrices', score: 'E_i = standardized ordinal dominance + standardized cardinal dominance', rule: 'Higher EVAMIX appraisal score receives the better rank.' },
    lexicographic: { transform: 'Sort criteria by priority before comparing alternatives', score: 'A_i beats A_k at the first criterion where their values differ', rule: 'The earliest decisive criterion determines each pairwise order.' },
    marcos: { transform: 'Append ideal and anti-ideal rows, then normalize and weight', score: 'f(K_i-, K_i+) combines utility relative to both reference rows', rule: 'Higher MARCOS utility receives the better rank.' },
    mairca: { transform: 'T_pij is theoretical preference; T_rij is real preference', score: 'Q_i = sum_j |T_pij - T_rij|', rule: 'Lower total gap from theoretical preference is preferred.' },
    promethee: { transform: 'Apply preference functions P_j(A_i,A_k) to every pair', score: 'phi_i = phi_i+ - phi_i-', rule: 'Higher PROMETHEE net flow receives the better rank.' },
    electre: { transform: 'Build concordance and discordance matrices for pairwise outranking', score: 'outranking_i = concordance dominance filtered by discordance veto', rule: 'Alternatives with stronger outranking credibility are preferred.' },
    smart: { transform: 'Map each criterion to a single-attribute utility scale', score: 'U_i = sum_j w_j u_j(x_ij)', rule: 'Higher SMART utility receives the better rank.' },
    maut: { transform: 'Define utility functions u_j(x_ij) for each criterion', score: 'U_i = sum_j w_j u_j(x_ij)', rule: 'Higher multi-attribute utility receives the better rank.' },
    smarter: { transform: 'Convert criterion ranks into ROC or selected rank-based weights', score: 'U_i = sum_j w_j u_j(x_ij)', rule: 'Higher SMARTER utility receives the better rank.' },
    macbeth: { transform: 'Convert qualitative attractiveness judgments into a numerical value scale', score: 'V_i = sum_j w_j v_j(x_ij)', rule: 'Higher MACBETH value receives the better rank.' },
    pugh: { transform: 'Compare each concept with the baseline using plus, same, and minus scores', score: 'S_i = sum_j w_j p_ij after optional score transform', rule: 'Higher Pugh weighted score receives the better rank.' },
    ocra: { transform: 'Calculate separate input and output preference ratings', score: 'O_i = benefit_competitiveness_i - cost_competitiveness_i', rule: 'Higher OCRA competitiveness rating receives the better rank.' },
    multimoora: { transform: 'Compute ratio system, reference point, and full multiplicative form', score: 'rank_i combines the three MULTIMOORA subordinate rankings', rule: 'Dominance theory or rank-sum aggregation sets the final order.' },
    psi: { transform: 'Normalize data and estimate criterion variation without subjective weights', score: 'PSI_i = sum_j omega_j r_ij', rule: 'Higher preference selection index receives the better rank.' },
    piv: { transform: 'Normalize and weight values, then locate the best weighted value per criterion', score: 'P_i = sum_j |best_j - v_ij|', rule: 'Lower proximity indexed value is preferred.' },
    rov: { transform: 'Normalize each criterion into best and worst utility views', score: 'U_i = (U_i+ + U_i-) / 2', rule: 'Higher range-of-value utility receives the better rank.' },
    wisp: { transform: 'Compute integrated weighted sum and weighted product terms', score: 'Q_i combines sum/product difference and ratio utility components', rule: 'Higher WISP integrated utility receives the better rank.' },
    todim: { transform: 'Measure pairwise gains and losses against each criterion with loss attenuation theta', score: 'delta_i = normalized sum_k dominance(A_i,A_k)', rule: 'Higher TODIM dominance score receives the better rank.' },
    ram: { transform: 'Normalize benefit and cost criteria using root assessment terms', score: 'R_i = benefit_root_i - cost_root_i', rule: 'Higher RAM assessment receives the better rank.' },
    gra: { transform: 'Normalize sequences and calculate grey relational coefficients', score: 'gamma_i = sum_j w_j xi_ij', rule: 'Higher grey relational grade receives the better rank.' },
    grp: { transform: 'Calculate positive and negative grey relational coefficients', score: 'C_i = projection_i+ / (projection_i+ + projection_i-)', rule: 'Higher grey relational projection closeness receives the better rank.' },
    spotis: { transform: 'Set criterion bounds and the ideal solution point', score: 'D_i = sum_j w_j |x_ij - s_j*| / |upper_j - lower_j|', rule: 'Lower SPOTIS distance receives the better rank.' },
    espSpotis: { transform: 'Set criterion bounds and the expected solution point', score: 'D_i = sum_j w_j |x_ij - e_j| / |upper_j - lower_j|', rule: 'Lower expected-solution distance receives the better rank.' },
    balancedSpotis: { transform: 'Calculate both ideal-solution and expected-solution distances', score: 'BD_i = alpha D_i(ESP) + (1-alpha) D_i(ISP)', rule: 'Lower balanced SPOTIS distance receives the better rank.' },
    wedba: { transform: 'Normalize, standardize, and identify ideal and anti-ideal points', score: 'D_i = weighted Euclidean distance balance from reference points', rule: 'Lower distance index receives the better rank.' },
    lmaw: { transform: 'Apply logarithmic additive scaling to normalized values', score: 'Q_i = product or sum of weighted logarithmic utility terms', rule: 'Higher LMAW utility receives the better rank.' },
    dnma: { transform: 'Build linear and vector normalized matrices against target values', score: 'DNMA_i = phi utility_i + (1-phi) rank_i using CCM/UCM/ICM weights', rule: 'Higher integrated DNMA score receives the better rank.' },
    probid: { transform: 'Build weighted normalized matrix and ideal-average reference solutions', score: 'P_i = distance closeness across ideal, average, and worst references', rule: 'Higher PROBID preference receives the better rank.' },
    sprobid: { transform: 'Use simplified first/last-quarter ideal reference distances', score: 'P_i = grouped ideal-distance preference score', rule: 'Higher SPROBID preference receives the better rank.' },
    rim: { transform: 'Define domain bounds and ideal reference intervals', score: 'C_i = sum_j w_j closeness(x_ij, ideal_interval_j)', rule: 'Higher interval closeness receives the better rank.' },
    rafsi: { transform: 'Map criterion values into a common functional interval', score: 'Q_i = sum_j w_j n_ij after functional mapping', rule: 'Higher RAFSI utility receives the better rank.' },
    lopm: { transform: 'Check each value against lower, upper, or target property limits', score: 'M_i = sum_j w_j merit_ij', rule: 'Higher weighted merit receives the better rank.' },
    aroman: { transform: 'Blend linear and vector normalized matrices with beta', score: 'A_i = lambda benefit_i - (1-lambda) cost_i', rule: 'Higher AROMAN aggregate receives the better rank.' },
    cobra: { transform: 'Normalize, weight, and calculate ideal, anti-ideal, and average references', score: 'C_i combines Euclidean and taxicab distance components', rule: 'Higher COBRA comprehensive score receives the better rank.' },
    ervd: { transform: 'Compare each value to an observed or manual reference point', score: 'V_i = sum_j w_j relative_gain_loss_ij(lambda, alpha)', rule: 'Higher ERVD relative value receives the better rank.' },
  };
  return notes[method.id] ?? {
    transform: method.outputs.slice(0, 2).join(' -> '),
    score: method.outputs.slice(-2).join(' -> '),
    rule: 'The final ranking follows the scoring direction reported in the method output tables.',
  };
}

function methodMathSections(method: MethodDefinition, guideInput: DecisionMatrix, guideAnalysis: AnalysisResult | null) {
  const matrixText = method.id === 'dematel' ? 'direct-relation matrix' : 'decision matrix';
  const formula = methodFormulaFor(method);
  const firstAlternative = guideInput.alternatives[0];
  const firstRow = guideInput.values[0]?.slice(0, Math.min(3, guideInput.criteria.length)).join(', ') ?? '';
  const weights = guideInput.criteria.map((criterion) => criterion.weight).slice(0, Math.min(3, guideInput.criteria.length)).join(', ');
  const directions = guideInput.criteria.map((criterion) => `${criterion.id} ${criterion.direction}`).slice(0, Math.min(3, guideInput.criteria.length)).join('; ');
  const firstCriterion = guideInput.criteria[0];
  const firstValue = guideInput.values[0]?.[0] ?? 0;
  const firstWeight = firstCriterion?.weight ?? 0;
  const topResult = guideAnalysis?.ranking[0];
  const tableTitles = guideAnalysis?.tables.slice(0, 4).map((table) => table.title).join(' -> ') || method.outputs.join(' -> ');
  return [
    {
      title: '1. Define the reproducible study data',
      equation: method.id === 'dematel' ? 'Z = [z_ij], z_ii = 0' : 'X = [x_ij], w = [w_j], direction_j in {benefit,cost}',
      text: `${firstAlternative?.id ?? 'A1'} row [${firstRow}]; w [${weights}]; ${directions}.`,
    },
    {
      title: '2. Prepare the method values',
      equation: formula.transform,
      text: `${firstCriterion?.id ?? 'C1'}: x=${formatGuideNumber(firstValue)}, w=${formatGuideNumber(firstWeight)}; repeat across X before scoring.`,
    },
    {
      title: '3. Compute the score used for ranking',
      equation: formula.score,
      text: `${formula.rule}${topResult ? ` In this sample, ${topResult.alternative} ranks first with ${formatGuideNumber(topResult.score)}.` : ''}`,
    },
    {
      title: '4. Audit the calculation tables',
      equation: tableTitles,
      text: 'Intermediate tables stay visible for paper matching and reruns.',
    },
  ];
}
function MethodGuidePage({ methodId, onBack, onUse, onDownloadSample }: { methodId: MethodId; onBack: () => void; onUse: (id: MethodId) => void; onDownloadSample: (id: MethodId) => void | Promise<void> }) {
  const method = getMethod(methodId);
  const fixtures = externalValidationFixturesFor(method.id);
  const candidates = externalValidationCandidatesFor(method.id);
  const status = externalValidationStatusFor(method.id, 'readiness');
  const { config: guideConfig, input: guideInput, fixture: guideFixture } = guideSampleForMethod(method.id);
  let guideAnalysis: AnalysisResult | null = null;
  try {
    guideAnalysis = method.runAnalysis(guideInput, guideConfig);
  } catch {
    guideAnalysis = null;
  }
  const previewTable = guideAnalysis?.tables.find((table) => table.id === 'ranking' || table.id === 'cause-effect') ?? guideAnalysis?.tables[0];
  const sampleRows = guideInput.alternatives.slice(0, 3).map((alternative, index) => ({
    option: alternative.name,
    values: guideInput.values[index]?.slice(0, 4) ?? [],
  }));
  const sampleCriteria = guideInput.criteria.slice(0, 4);
  return (
    <section className="methodGuidePage">
      <div className="guideHero">
        <button className="textAction" onClick={onBack}>Back to methods</button>
        <div>
          <h1>{method.name}</h1>
          <p><strong>{method.fullName}</strong></p>
        </div>
        <div className="guideActions">
          <button className="secondaryAction" onClick={() => void onDownloadSample(method.id)}><Download size={16} />Download sample</button>
          <button className="primaryAction" onClick={() => onUse(method.id)}>Use {method.name}<ArrowRight size={16} /></button>
        </div>
      </div>
      <div className="guideBrief" aria-label="Method brief">
        <div><span>Best for</span><strong>{compactUiText(methodPurpose[method.id], 82)}</strong></div>
        <div><span>Evidence</span><strong>{fixtures.length ? `${fixtures.length} matched DOI source${fixtures.length === 1 ? '' : 's'}` : candidates.length ? 'First DOI match in review' : 'Awaiting DOI example'}</strong></div>
        <div><span>Sample</span><strong>{guideFixture?.doi ? `DOI ${guideFixture.doi}` : guideFixture ? 'Published fixture' : 'Built-in demo data'}</strong></div>
      </div>
      <div className="guideReproLine" aria-label="Reproducibility path">
        <span>Download sample</span>
        <i />
        <span>Upload in app</span>
        <i />
        <span>Match paper result</span>
      </div>
      <div className="guideGrid">
        <section className="guideSection guideEvidence">
          <h2>Paper trail</h2>
          <div className={`validationBadge ${status.tone}`}>
            <strong>{status.label}</strong>
            <span>{status.text}</span>
          </div>
          {fixtures.length ? fixtures.map((fixture) => (
            <a key={fixture.variant} href={fixture.sourceUrl} target="_blank" rel="noreferrer">
              <strong>DOI {fixture.doi}</strong>
              <span>{fixture.source}</span>
            </a>
          )) : candidates.length ? candidates.map((candidate) => (
            <a key={candidate.variant} href={candidate.sourceUrl} target="_blank" rel="noreferrer">
              <strong>Review DOI {candidate.doi}</strong>
              <span>{candidate.source}</span>
            </a>
          )) : <p>No published example is matched for this method yet.</p>}
        </section>
        <section className="guideSection">
          <h2>Purpose</h2>
          <p>{compactUiText(method.description, 140)}</p>
          <dl className="guideFacts">
            <div><dt>Family</dt><dd>{methodFamilies[methodFamilyById[method.id]]}</dd></div>
            <div><dt>Weights</dt><dd>{method.supportsWeights ? 'Used when the method requires criterion importance' : 'Not required for this method'}</dd></div>
            <div><dt>Fuzzy values</dt><dd>{method.fuzzySupport.nativeModeLabel ? method.fuzzySupport.nativeModeLabel : 'Converted to crisp values before calculation'}</dd></div>
          </dl>
        </section>
        <section className="guideSection guideMath">
          <h2>Calculation</h2>
          {methodMathSections(method, guideInput, guideAnalysis).map((section) => (
            <article key={section.title}>
              <h3>{section.title}</h3>
              <code>{section.equation}</code>
              <p>{section.text}</p>
            </article>
          ))}
        </section>
        <section className="guideSection guideRunPreview">
          <h2>Expected result</h2>
          {guideAnalysis && previewTable ? (
            <>
              <p>{guideFixture ? <>DOI <strong>{guideFixture.doi}</strong>. Top result: <strong>{guideAnalysis.ranking[0]?.alternative ?? 'N/A'}</strong>, score <strong>{guideAnalysis.ranking[0]?.score.toFixed(4) ?? 'N/A'}</strong>.</> : <>Demo sample. Top result: <strong>{guideAnalysis.ranking[0]?.alternative ?? 'N/A'}</strong>, score <strong>{guideAnalysis.ranking[0]?.score.toFixed(4) ?? 'N/A'}</strong>.</>}</p>
              <div className="guideResultList">
                {guideAnalysis.ranking.slice(0, 5).map((row) => <span key={row.alternativeId}>{row.rank}. {row.alternative} ({row.score.toFixed(4)})</span>)}
              </div>
              <p className="guideTableNote">First table: {previewTable.title}.</p>
            </>
          ) : <p>This method needs a special input shape for preview.</p>}
        </section>
        <section className="guideSection sampleDataSection">
          <h2>Data preview</h2>
          <p>{guideFixture ? 'Matched DOI data.' : 'Demo data.'}</p>
          <div className="sampleDataGrid" style={{ gridTemplateColumns: `minmax(120px, 1.2fr) repeat(${sampleCriteria.length}, minmax(58px, .7fr))` }}>
            <strong>Option</strong>
            {sampleCriteria.map((criterion) => <strong key={criterion.id}>{criterion.id}</strong>)}
            {sampleRows.map((row) => (
              <Fragment key={row.option}>
                <span>{row.option}</span>
                {row.values.map((value, index) => <span key={`${row.option}-${sampleCriteria[index]?.id ?? index}`}>{value}</span>)}
              </Fragment>
            ))}
          </div>
        </section>
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

function MethodStep({ query, family, onQuery, onFamily, methods, onSelect, onGuide }: { query: string; family: MethodFamily; onQuery: (value: string) => void; onFamily: (value: MethodFamily) => void; methods: typeof methodRegistry; onSelect: (id: MethodId) => void; onGuide: (id: MethodId) => void }) {
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
  const evidenceCounts = externalValidationSummaryFor(methodRegistry.map((method) => method.id));
  const reviewMethodCount = evidenceCounts.candidates;
  const filteredMethods = methods.filter((method) => {
    if (evidenceFilter === 'all') return true;
    if (evidenceFilter === 'candidate') return externalValidationStatusFor(method.id).tone === 'candidate';
    return externalValidationStatusFor(method.id).tone === evidenceFilter;
  });
  const selectedMethod = filteredMethods.find((method) => method.id === selectedId) ?? filteredMethods[0] ?? methods[0] ?? methodRegistry[0];
  const selectedFamilyLabel = methodFamilies[methodFamilyById[selectedMethod.id]];
  const selectedValidation = externalValidationStatusFor(selectedMethod.id);
  const selectedFixtures = externalValidationFixturesFor(selectedMethod.id);
  const selectedCandidates = externalValidationCandidatesFor(selectedMethod.id);
  const selectedFixtureSample = externalFixtureSampleFor(selectedMethod.id);
  const selectedInputSummary = selectedMethod.id === 'dematel'
    ? 'Direct-relation matrix; expert count'
    : selectedMethod.id === 'ahp'
      ? 'Pairwise matrix; consistency threshold'
      : selectedMethod.supportsWeights
        ? 'Decision matrix; weights; criterion directions'
        : 'Decision matrix; criterion directions';
  const evidenceLead = selectedFixtures[0]?.doi
    ? `DOI ${selectedFixtures[0].doi}`
    : selectedCandidates[0]?.doi
      ? `Review DOI ${selectedCandidates[0].doi}`
      : 'Internal check';
  const evidenceDetail = selectedFixtures.length
    ? `${selectedFixtures.length} matched source${selectedFixtures.length > 1 ? 's' : ''}`
    : selectedCandidates.length
      ? 'First DOI match in review'
      : 'Awaiting DOI example';
  return (
    <section className="singlePanel methodWorkbench">
      <div className="sectionTitle compactTitle">
        <div>
          <h1>Method library</h1>
          <p>Choose the method, review its evidence, and build the Excel template.</p>
        </div>
        <div className="titleEvidence" aria-label={`${evidenceCounts.validated} methods have matched DOI examples; ${evidenceCounts.candidates} methods need a first DOI match; ${validationEvidence.externalBenchmarks.count} DOI examples reproduced`}>
          <span><strong>{evidenceCounts.validated}</strong> methods matched</span>
          <span><strong>{evidenceCounts.candidates}</strong> need DOI match</span>
        </div>
      </div>
      <div className="methodChooser proChooser">
        <div className="methodPickPanel methodIndexPanel">
          <div className="methodFilters">
            <label className="searchBox"><Search size={17} /><input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search methods" /></label>
            <label className="methodSelectLabel">
              <span>Family</span>
              <select aria-label="Decision type" value={family} onChange={(event) => onFamily(event.target.value as MethodFamily)}>
                {Object.entries(methodFamilies).map(([id, label]) => <option key={id} value={id}>{label} ({familyCounts[id as MethodFamily]})</option>)}
              </select>
            </label>
            <label className="methodSelectLabel">
              <span>Evidence</span>
              <select aria-label="Published evidence status" value={evidenceFilter} onChange={(event) => setEvidenceFilter(event.target.value as typeof evidenceFilter)}>
                <option value="all">All methods ({methods.length})</option>
                <option value="validated">Published match ({methods.filter((method) => externalValidationStatusFor(method.id).tone === 'validated').length})</option>
                <option value="candidate">Needs match ({reviewMethodCount})</option>
              </select>
            </label>
          </div>
          <div className="methodListHeader">
            <span>Method</span>
            <span>Family</span>
            <span>Evidence</span>
          </div>
          <div className="methodList" role="listbox" aria-label="Matching MCDM methods">
            {filteredMethods.length ? filteredMethods.map((method) => {
              const status = externalValidationStatusFor(method.id);
              const shortStatus = status.tone === 'validated' ? 'Matched' : status.tone === 'candidate' ? 'Needs match' : 'Awaiting';
              return (
                <button key={method.id} role="option" aria-selected={method.id === selectedMethod.id} className={method.id === selectedMethod.id ? 'active' : ''} onClick={() => setSelectedId(method.id)} title={`${method.name}: ${method.fullName}`} aria-label={`${method.name}, ${method.fullName}, ${status.label}`}>
                  <span className="methodRadio" aria-hidden="true" />
                  <span className="methodListName"><strong>{method.name}</strong></span>
                  <span className="methodListFamily">{methodFamilies[methodFamilyById[method.id]]}</span>
                  <span className={`catalogValidation ${status.tone}`} title={status.label}>{shortStatus}</span>
                </button>
              );
            }) : <p className="emptyMethodState">No methods match these filters.</p>}
          </div>
        </div>
        <aside className="selectedMethodPanel evidencePane">
          {filteredMethods.length ? (
            <>
              <div className="methodDetailHeader">
                <span>{selectedFamilyLabel}</span>
                <h2>{selectedMethod.name}</h2>
                <p>{selectedMethod.fullName}</p>
              </div>
              <div className="inspectorFacts">
                <div><span>Best for</span><strong>{compactUiText(methodPurpose[selectedMethod.id], 88)}</strong></div>
                <div><span>Inputs</span><strong>{selectedInputSummary}</strong></div>
                <div><span>Sample</span><strong>{selectedFixtureSample ? 'Matched data' : 'Demo data'}</strong></div>
              </div>
              <div className={`validationBadge compactEvidence ${selectedValidation.tone}`}>
                <strong>{selectedValidation.label}</strong>
                <span>{evidenceDetail}</span>
                {selectedFixtures.length ? (
                  <div className="evidenceLinks">
                    {selectedFixtures.slice(0, 2).map((fixture) => (
                      <a key={`${fixture.methodId}-${fixture.variant}`} href={fixture.sourceUrl} target="_blank" rel="noreferrer">DOI {fixture.doi}</a>
                    ))}
                    {selectedFixtures.length > 2 ? <em>+{selectedFixtures.length - 2}</em> : null}
                  </div>
                ) : selectedCandidates.length ? (
                  <div className="evidenceLinks">
                    {selectedCandidates.slice(0, 1).map((candidate) => (
                      <a key={`${candidate.methodId}-${candidate.variant}`} href={candidate.sourceUrl} target="_blank" rel="noreferrer">Review DOI {candidate.doi}</a>
                    ))}
                  </div>
                ) : null}
              </div>
              <MethodProcessGraphic method={selectedMethod} evidenceLead={evidenceLead} hasMatchedSample={Boolean(selectedFixtureSample)} />
              <div className="methodPrimaryActions">
                <button className="primaryAction methodContinue" onClick={() => onSelect(selectedMethod.id)}>Use {selectedMethod.name}<ArrowRight size={16} /></button>
                <button className="textAction methodGuideAction" onClick={() => onGuide(selectedMethod.id)}>Math and sample <ArrowRight size={16} /></button>
              </div>
            </>
          ) : (
            <p>No methods match these filters.</p>
          )}
        </aside>
      </div>
    </section>
  );
}

function MethodProcessGraphic({ method, evidenceLead, hasMatchedSample }: { method: MethodDefinition; evidenceLead: string; hasMatchedSample: boolean }) {
  const nodes = [
    { code: '01', title: 'Source', note: evidenceLead },
    { code: '02', title: 'Data', note: hasMatchedSample ? 'Matched sample' : 'Demo sample' },
    { code: '03', title: method.name, note: 'Calculation' },
    { code: '04', title: 'Result', note: 'Ranked output' },
  ];
  return (
    <div className="methodPath methodSignal" aria-label="Reproducible method path">
      {nodes.map((node) => (
        <div key={node.title} aria-label={`${node.title}: ${node.note}`}>
          <i className="signalGlyph" aria-hidden="true">{node.code}</i>
          <strong>{node.title}</strong>
          <em>{node.note}</em>
        </div>
      ))}
    </div>
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
  const resizeCriteriaPairwiseById = (criteria: StudyConfig['criteria'], source = config.ahpCriteriaPairwise ?? [], sourceCriteria = config.criteria) =>
    Array.from({ length: criteria.length }, (_, rowIndex) =>
      Array.from({ length: criteria.length }, (_, columnIndex) => {
        if (rowIndex === columnIndex) return 1;
        const sourceRow = sourceCriteria.findIndex((criterion) => criterion.id === criteria[rowIndex].id);
        const sourceColumn = sourceCriteria.findIndex((criterion) => criterion.id === criteria[columnIndex].id);
        const direct = sourceRow >= 0 && sourceColumn >= 0 ? Number(source[sourceRow]?.[sourceColumn]) : NaN;
        const reciprocal = sourceRow >= 0 && sourceColumn >= 0 ? Number(source[sourceColumn]?.[sourceRow]) : NaN;
        if (Number.isFinite(direct) && direct > 0) return direct;
        if (Number.isFinite(reciprocal) && reciprocal > 0) return Number((1 / reciprocal).toFixed(4));
        return 1;
      }),
    );
  const resizeAlternativePairwiseById = (criterionId: string, alternatives: StudyConfig['alternatives'], source = config.ahpAlternativePairwise?.[criterionId] ?? [], sourceAlternatives = config.alternatives) =>
    Array.from({ length: alternatives.length }, (_, rowIndex) =>
      Array.from({ length: alternatives.length }, (_, columnIndex) => {
        if (rowIndex === columnIndex) return 1;
        const sourceRow = sourceAlternatives.findIndex((alternative) => alternative.id === alternatives[rowIndex].id);
        const sourceColumn = sourceAlternatives.findIndex((alternative) => alternative.id === alternatives[columnIndex].id);
        const direct = sourceRow >= 0 && sourceColumn >= 0 ? Number(source[sourceRow]?.[sourceColumn]) : NaN;
        const reciprocal = sourceRow >= 0 && sourceColumn >= 0 ? Number(source[sourceColumn]?.[sourceRow]) : NaN;
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
    const criteria = normalizeUniqueIds('C', nextConfig.criteria, isDematel ? 'Factor' : 'Criterion');
    const baseAlternatives = isDematel
      ? criteria.map((criterion) => ({ id: criterion.id, name: criterion.name }))
      : normalizeUniqueIds('A', nextConfig.alternatives, 'Alternative');
    const normalizedConfig = { ...nextConfig, criteria, alternatives: baseAlternatives };
    const rows = isDematel ? criteria.length : baseAlternatives.length;
    const columns = criteria.length;
    const alternatives = isDematel ? criteria.map((criterion) => ({ id: criterion.id, name: criterion.name })) : baseAlternatives;
    const sizedConfig = { ...normalizedConfig, alternatives, methodParams: reconcileWeightingParams(normalizedConfig), ahpCriteriaPairwise: resizeCriteriaPairwiseById(criteria, normalizedConfig.ahpCriteriaPairwise) };
    sizedConfig.ahpAlternativePairwise = criteria.reduce<Record<string, number[][]>>((acc, criterion) => {
      acc[criterion.id] = resizeAlternativePairwiseById(criterion.id, alternatives, normalizedConfig.ahpAlternativePairwise?.[criterion.id]);
      return acc;
    }, {});
    onChange(sizedConfig, {
      ...input,
      alternatives,
      criteria,
      values: resizeValues(rows, columns, source),
    });
  };
  const updateConfig = (nextConfig: StudyConfig) => applyStructure(nextConfig);
  const nextUnusedId = (prefix: string, items: Array<{ id: string }>) => {
    const used = new Set(items.map((item) => String(item.id ?? '').trim()).filter(Boolean));
    const numericMax = [...used].reduce((max, id) => {
      const match = id.match(new RegExp(`^${prefix}(\\d+)$`, 'i'));
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return nextGeneratedId(prefix, used, numericMax + 1);
  };
  const addAlternative = () => {
    const next = nextUnusedId('A', config.alternatives);
    applyStructure({
      ...config,
      alternatives: [...config.alternatives, { id: next.id, name: `Alternative ${next.index}` }],
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
    const next = nextUnusedId('C', config.criteria);
    const criteria = [
      ...config.criteria,
      { id: next.id, name: isDematel ? `Factor ${next.index}` : `Criterion ${next.index}`, direction: 'benefit' as const, weight: 0 },
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
    <section className="singlePanel methodWorkbench">
      <div className="sectionTitle">
        <h1>Set up {method.name}</h1>
        <p>Set the data shape. Keep method terms unchanged.</p>
      </div>
      <SetupReadinessLine config={config} method={method} canGenerateTemplate={canGenerateTemplate} issueCount={preTemplateIssues.length} />
      <div className="specSection">
        <div>
          <h2>Your input</h2>
          
        </div>
        <div className="segmentedControl">
          {(isDematel ? ['Single expert matrix', 'Multiple experts'] : ['Single aggregated dataset', 'Multiple respondents']).map((option) => (
            <button key={option} className={dataInputMode === option ? 'active' : ''} onClick={() => updateDataInputMode(option)}>{dataInputModeLabel(option)}</button>
          ))}
        </div>
      </div>
      <div className="configGrid">
        <label><span>Study title</span><input aria-label="Study title" value={config.title} onChange={(event) => updateConfig({ ...config, title: event.target.value })} /></label>
        {method.supportsWeights ? <WeightingSelect isAHP={isAHP} value={config.weightingId} onChange={(weightingId) => updateConfig({ ...config, weightingId })} /> : null}
        {visibleSpecificationFields.map((field) => (
          field.key === 'lexicographicOrder' || field.key === 'smarterOrder' ? (
            <CriterionOrderEditor key={field.key} label={friendlyFieldLabel(field.label)} criteria={config.criteria} value={String(config.methodParams[field.key] ?? config.criteria.map((criterion) => criterion.id).join(','))} onChange={(values) => updateOrderParam(field.key, values)} />
          ) : (
            <label key={field.key}>
              <span>{friendlyFieldLabel(field.label)}</span>
              {field.key === 'pughBaselineAlternative' ? (
              <select aria-label={friendlyFieldLabel(field.label)} value={String(config.methodParams.pughBaselineAlternative ?? config.alternatives[0]?.id ?? '')} onChange={(event) => updateParam(field.key, event.target.value)}>
                {config.alternatives.map((alternative) => <option key={alternative.id} value={alternative.id}>{alternative.id} - {alternative.name}</option>)}
              </select>
            ) : field.type === 'select' ? (
              <select aria-label={friendlyFieldLabel(field.label)} value={String(config.methodParams[field.key] ?? field.defaultValue)} onChange={(event) => updateParam(field.key, event.target.value)}>
                {field.options?.map((option) => <option key={option} value={option}>{friendlyOptionLabel(option)}</option>)}
              </select>
            ) : (
              <input aria-label={friendlyFieldLabel(field.label)} type={field.type} {...(field.type === 'number' ? numericBounds(field.key) : {})} value={String(config.methodParams[field.key] ?? field.defaultValue)} onChange={(event) => updateParam(field.key, event.target.value)} />
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
          {fuzzyModeOptions(method.id).map((option) => <option key={option} value={option}>{fuzzyModeLabel(option)}</option>)}
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
        <strong>{usesGroupData ? 'Group Excel file' : 'Single Excel file'}</strong>
        <span>{isDematel
          ? usesGroupData ? 'One direct-relation matrix per expert.' : 'One final direct-relation matrix.'
          : usesGroupData ? 'One decision table per respondent.' : 'One final decision table.'}</span>
      </div>
      {method.supportsWeights && !usesManualWeights ? (
        <div className="workflowNote calculatedWeightNotice">
          <strong>{weightingLabel} weighting</strong>
          <span>{usesAHPWeights
            ? 'Weights come from pairwise judgments. The criteria table is only for names and benefit/cost type.'
            : `${weightingLabel} weights are calculated during analysis, so manual weight cells are hidden.`}</span>
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
                <td><button className="iconAction" onClick={() => removeAlternative(index)} disabled={config.alternatives.length <= 1} title={`Remove ${alternative.name}`} aria-label={`Remove ${alternative.name}`}><Trash2 size={14} /></button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : null}
      <div className="cleanTableWrap">
        <div className="tableToolbar">
          <h2>{criteriaLabel}</h2>
          <div className="toolbarActions">
            {usesAutomaticWeights ? <span>{weightingLabel} calculates weights for you</span> : null}
            {usesAHPWeights && !isAHP ? <span>AHP weights use the pairwise table below</span> : null}
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
              <td><button className="iconAction" onClick={() => removeCriterion(index)} disabled={config.criteria.length <= 1} title={`Remove ${criterion.name}`} aria-label={`Remove ${criterion.name}`}><Trash2 size={14} /></button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <details className="advancedSeedData">
        <summary>Optional starting values</summary>
        <p>Prefill the workbook if you want a starting point.</p>
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
            <div className="tableToolbar"><h2>Criteria pairwise comparison</h2><span>Saaty 1-9 scale</span></div>
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
                  <thead><tr><th>Option</th>{config.alternatives.map((alternative) => <th key={alternative.id}>{alternative.id}</th>)}</tr></thead>
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
      ) : <div className="readyNote">Setup looks good. Create the Excel file when ready.</div>}
      <div className="flowActions"><button className="primaryAction" onClick={onNext} disabled={!canGenerateTemplate}>Create Excel <ArrowRight size={16} /></button></div>
    </section>
  );
}

function WeightingSelect({ isAHP, value, onChange }: { isAHP: boolean; value: WeightingId; onChange: (value: WeightingId) => void }) {
  const groups = isAHP ? [
    { label: 'Pairwise', options: [{ value: 'ahp' as WeightingId, label: 'AHP pairwise priorities' }] },
  ] : [
    { label: 'Manual', options: [
      { value: 'manual' as WeightingId, label: 'Manual weights' },
      { value: 'equal' as WeightingId, label: 'Equal weights' },
    ] },
    { label: 'Objective data', options: [
      { value: 'stddev' as WeightingId, label: 'Standard deviation weights' },
      { value: 'cov' as WeightingId, label: 'Coefficient of variation weights' },
      { value: 'entropy' as WeightingId, label: 'Entropy weights' },
      { value: 'critic' as WeightingId, label: 'CRITIC weights' },
      { value: 'merec' as WeightingId, label: 'MEREC weights' },
      { value: 'merecG' as WeightingId, label: 'MEREC-G weights' },
      { value: 'lopcow' as WeightingId, label: 'LOPCOW weights' },
      { value: 'wenslo' as WeightingId, label: 'WENSLO weights' },
      { value: 'angular' as WeightingId, label: 'Angular weights' },
      { value: 'gini' as WeightingId, label: 'Gini coefficient weights' },
      { value: 'mpsi' as WeightingId, label: 'MPSI weights' },
      { value: 'cilos' as WeightingId, label: 'CILOS weights' },
      { value: 'idocriw' as WeightingId, label: 'IDOCRIW weights' },
      { value: 'cimas' as WeightingId, label: 'CIMAS weights' },
    ] },
    { label: 'Judgment based', options: [
      { value: 'ahp' as WeightingId, label: 'AHP weights' },
      { value: 'bwm' as WeightingId, label: 'BWM weights' },
      { value: 'dibr' as WeightingId, label: 'DIBR weights' },
      { value: 'simos' as WeightingId, label: 'Revised Simos / SRF cards' },
      { value: 'swara' as WeightingId, label: 'SWARA weights' },
      { value: 'fucom' as WeightingId, label: 'FUCOM weights' },
      { value: 'lbwa' as WeightingId, label: 'LBWA weights' },
      { value: 'piprecia' as WeightingId, label: 'PIPRECIA weights' },
    ] },
    { label: 'Rank order', options: [
      { value: 'roc' as WeightingId, label: 'ROC rank-order weights' },
      { value: 'rankSum' as WeightingId, label: 'Rank Sum weights' },
      { value: 'rankReciprocal' as WeightingId, label: 'Rank Reciprocal weights' },
      { value: 'rancom' as WeightingId, label: 'RANCOM weights' },
    ] },
  ];
  const hint = value === 'manual'
    ? 'Use known study weights.'
    : value === 'equal'
      ? 'Same weight for each criterion.'
      : value === 'ahp' || value === 'bwm' || value === 'dibr' || value === 'simos' || value === 'swara' || value === 'fucom' || value === 'lbwa' || value === 'piprecia' || value === 'roc' || value === 'rankSum' || value === 'rankReciprocal' || value === 'rancom'
        ? 'Uses judgement or order inputs.'
        : 'Calculated from the data.';

  return (
    <label className="weightingControl">
      <span>Weights</span>
      <select aria-label="Weighting method" value={value} onChange={(event) => onChange(event.target.value as WeightingId)}>
        {groups.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </optgroup>
        ))}
      </select>
      <em>{hint}</em>
    </label>
  );
}
function SetupReadinessLine({ config, method, canGenerateTemplate, issueCount }: { config: StudyConfig; method: MethodDefinition; canGenerateTemplate: boolean; issueCount: number }) {
  const isDematel = config.methodId === 'dematel';
  const fuzzyMode = String(config.methodParams.fuzzyInputMode ?? defaultFuzzyMode);
  const structureText = isDematel
    ? `${config.criteria.length} factors for the direct-relation matrix`
    : `${config.alternatives.length} options and ${config.criteria.length} criteria`;
  const weightText = isDematel
    ? 'DEMATEL factor influence only'
    : method.supportsWeights
      ? `${weightingDisplayName(config.weightingId)} weighting`
      : 'No external weighting needed';
  const fuzzyText = method.fuzzySupport.enabled ? fuzzyModeLabel(fuzzyMode) : 'Fuzzy ranges converted on upload';

  return (
    <div className={`setupReadiness ${canGenerateTemplate ? 'ready' : 'blocked'}`} aria-label="Setup readiness">
      <div>
        <span>{canGenerateTemplate ? 'Ready for Excel' : 'Fix setup first'}</span>
        <strong>{structureText}</strong>
      </div>
      <div>
        <span>Settings</span>
        <strong>{weightText}; {fuzzyText}</strong>
      </div>
      <div className="setupReadinessState">
        <span>Evidence</span>
        <strong>{canGenerateTemplate ? 'Ready to build file' : `${issueCount} setup issue${issueCount === 1 ? '' : 's'}`}</strong>
      </div>
    </div>
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
    <section className="singlePanel methodWorkbench">
      <div className="templateHero">
        <FileSpreadsheet size={32} />
        <h1>{methodName} Excel file</h1>
        <p>Download, fill, upload.</p>
        <button className="primaryAction" onClick={onDownload}><Download size={16} />Download Excel file</button>
      </div>
      <TemplateHandoffLine config={config} phase="template" />
      <details className="templateDetails">
        <summary>File details</summary>
        <TemplateSpecSummary config={config} methodName={methodName} />
        <CapabilityStrip method={method} config={config} />
      </details>
      <SamplePreview title={`${methodName} Excel preview`} config={config} templateSheets={templateSheets} />
      <div className="flowActions"><button className="secondaryAction" onClick={onBack}>Back to setup</button><button className="secondaryAction" onClick={onNext}>Upload data <ArrowRight size={16} /></button></div>
    </section>
  );
}

function TemplateHandoffLine({ config, phase }: { config: StudyConfig; phase: 'template' | 'upload' }) {
  const method = getMethod(config.methodId);
  const isDematel = config.methodId === 'dematel';
  const dataInputMode = String(config.methodParams.dataInputMode ?? (isDematel ? 'Single expert matrix' : 'Single aggregated dataset'));
  const matrixText = isDematel ? 'direct-relation matrix' : 'decision matrix';
  const groupText = dataInputModeLabel(dataInputMode);
  const steps = [
    { key: 'template', title: 'Download', text: `${method.name} Excel file` },
    { key: 'fill', title: 'Fill', text: `${groupText}; enter the ${matrixText}` },
    { key: 'upload', title: 'Upload', text: 'Check and run' },
  ];

  return (
    <div className="templateHandoff" aria-label="Excel handoff flow">
      {steps.map((item) => (
        <div key={item.key} className={item.key === phase ? 'active' : ''}>
          <span>{item.title}</span>
          <strong>{item.text}</strong>
        </div>
      ))}
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
    ? usesGroupData ? `${expertCount} expert direct-relation matrices` : 'One final direct-relation matrix'
    : usesGroupData ? `${respondentCount} respondent decision matrices` : 'One final decision matrix';
  const respondentRule = isDematel
    ? usesGroupData ? String(config.methodParams.dematelAggregation ?? 'Arithmetic mean') : 'No expert aggregation'
    : usesGroupData ? String(config.methodParams.respondentAggregation ?? 'Arithmetic mean') : 'No respondent aggregation';
  const pairwiseRule = usesGroupData && (config.methodId === 'ahp' || config.weightingId === 'ahp')
    ? `${ahpRespondents} AHP pairwise respondent sheet${ahpRespondents === 1 ? '' : 's'} combined`
    : config.methodId === 'ahp' || config.weightingId === 'ahp' ? 'Single pairwise table' : 'Not used for this setup';
  const fuzzyRule = fuzzyMode.startsWith('Native fuzzy')
    ? 'Fuzzy ranges stay fuzzy'
    : 'Fuzzy ranges convert before analysis';
  return (
    <div className="capabilityStrip" aria-label="Selected method capabilities">
      <div><span>Your input</span><strong>{respondentLabel}</strong><em>{respondentRule}</em></div>
      <div><span>AHP checks</span><strong>{pairwiseRule}</strong><em>Consistency checked</em></div>
      <div><span>Fuzzy values</span><strong>{method.fuzzySupport.nativeModeLabel ? fuzzyModeLabel(fuzzyMode) : fuzzyModeLabel(defaultFuzzyMode)}</strong><em>{fuzzyRule}</em></div>
      <div><span>Result</span><strong>{isDematel ? 'Factor influence map' : 'Ranked options'}</strong><em>{method.outputs.slice(0, 2).join(', ')}</em></div>
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
      <div><span>Selected method</span><strong>{methodName}</strong></div>
      <div><span>{isDematel ? 'Factors' : 'Alternatives'}</span><strong>{isDematel ? config.criteria.length : config.alternatives.length}</strong></div>
      <div><span>{isDematel ? 'Matrix shape' : 'Criteria'}</span><strong>{isDematel ? `${config.criteria.length} x ${config.criteria.length}` : config.criteria.length}</strong></div>
      <div><span>Weighting</span><strong>{isDematel ? 'Not used' : weightingDisplayName(config.weightingId)}</strong></div>
      <div><span>Input format</span><strong>{dataInputModeLabel(dataInputMode)}</strong></div>
      <div><span>{isDematel ? 'Experts' : 'Respondents'}</span><strong>{usesGroupData ? isDematel ? dematelExperts : respondentCount : 'Not used'}</strong></div>
      <div><span>AHP pairwise respondents</span><strong>{usesGroupData && (config.methodId === 'ahp' || config.weightingId === 'ahp') ? ahpRespondents : 'Not used'}</strong></div>
      <div><span>Fuzzy values</span><strong>{fuzzyModeLabel(fuzzyMode)}</strong></div>
      <div><span>Built from</span><strong>Your setup</strong></div>
    </div>
  );
}

function UploadStep({ config, methodName, validation, uploadAttempted, onUpload, onBack, onSample }: { config: StudyConfig; methodName: string; validation: ValidationResult; uploadAttempted: boolean; onUpload: (file: File) => void; onBack: () => void; onSample: () => void }) {
  return (
    <section className="singlePanel methodWorkbench">
      <div className="sectionTitle">
        <h1>Upload data</h1>
        <p>We check the file, then open results.</p>
      </div>
      <TemplateHandoffLine config={config} phase="upload" />
      <details className="templateDetails uploadDetails">
        <summary>Expected file</summary>
        <TemplateSpecSummary config={config} methodName={methodName} />
      </details>
      <label className="uploadZone">
        <Upload size={26} /><strong>Drop or choose Excel file</strong><span>.xlsx, .xls, or .csv</span>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = '';
          if (file) onUpload(file);
        }} />
      </label>
      <div className="validationList">
        {validation.issues.length ? validation.issues.map((issue) => <div className={`validationItem ${issue.severity}`} key={`${issue.sheet}-${issue.location}-${issue.message}`}><strong>{issue.severity}</strong><span>{issue.sheet} {issue.location}: {issue.message}</span></div>) : <div className="readyNote">{uploadAttempted ? 'File looks good. You can review the results now.' : 'Upload a file to run the analysis.'}</div>}
      </div>
      <div className="flowActions uploadActions">
        <button className="secondaryAction" onClick={onBack}>Back to Excel file</button>
        <button className="textAction" onClick={onSample}>Try with example data <ArrowRight size={16} /></button>
      </div>
    </section>
  );
}

function ResultsStep({ config, analysis, checksPassed, checksTotal, activeTab, compareIds, onTab, onCompareIds, onEdit, onUpload, onJson, onExcel, onDocx, onPdf, onExport }: { config: StudyConfig; analysis: AnalysisResult; checksPassed: number; checksTotal: number; activeTab: string; compareIds: MethodId[]; onTab: (tab: string) => void; onCompareIds: (ids: MethodId[]) => void; onEdit: () => void; onUpload: () => void; onJson: () => void; onExcel: () => void | Promise<void>; onDocx: () => void | Promise<void>; onPdf: () => void | Promise<void>; onExport: () => void | Promise<void> }) {
  const isDematel = analysis.methodId === 'dematel';
  const comparisonUnavailable = methodComparisonBlockReason(config.methodId, config, analysis.input);
  const canCompareMethods = !comparisonUnavailable;
  const passedDiagnostics = analysis.diagnostics.filter((item) => item.status === 'pass').length;
  const qualityText = checksTotal ? `${checksPassed}/${checksTotal} checks` : 'Checking';
  const externalEvidenceText = externalValidationCoverageLabel(config.methodId);
  const resultValidationStatus = externalValidationStatusFor(config.methodId, 'readiness');
  const resultFixtures = externalValidationFixturesFor(config.methodId);
  const resultCandidates = externalValidationCandidatesFor(config.methodId);
  const doiLabel = resultFixtures[0]?.doi ? `DOI ${resultFixtures[0].doi}` : resultCandidates[0]?.doi ? `Review DOI ${resultCandidates[0].doi}` : 'Awaiting DOI example';
  const tabs = ['Final Result', 'Charts', ...(canCompareMethods ? ['Compare Methods'] : []), 'Overview', 'Your Data', 'Prepared Data', 'Calculations', 'Checks'];
  const inputTable = inputMatrixTable(analysis);
  const activeTable = activeTab === 'Final Result'
    ? analysis.tables.find((table) => table.id === 'ranking' || table.id === 'cause-effect') ?? analysis.tables[0]
    : activeTab === 'Prepared Data'
      ? analysis.tables.find((table) => table.id.includes('normalized') || table.id.includes('total')) ?? analysis.tables[0]
      : analysis.tables[0];
  const rankingTable = analysis.tables.find((table) => table.id === 'ranking');
  return (
    <section className="resultsPanel">
      <div className="resultsHeader">
        <div><h1>{analysis.methodName} results</h1><p>Ready to review.</p></div>
        <div className="exportActions" aria-label="Export results">
          <button className="secondaryAction" onClick={onEdit}>Edit setup</button>
          <button className="secondaryAction" onClick={onUpload}><Upload size={15} />Re-upload</button>
          <button className="secondaryAction" onClick={() => void onExcel()} title="Export Excel"><FileSpreadsheet size={15} />Excel</button>
          <button className="secondaryAction" onClick={() => void onDocx()} title="Export DOCX"><FileText size={15} />DOCX</button>
          <button className="secondaryAction" onClick={() => void onPdf()} title="Export PDF"><FileText size={15} />PDF</button>
          <button className="secondaryAction" onClick={onJson}><Download size={15} />Project file</button>
          <button className="primaryAction" onClick={() => void onExport()}><FileText size={16} />Export all</button>
        </div>
      </div>
      <div className="resultStatusStrip resultsQaStrip" aria-label="Result quality and evidence">
        <div><span>Study</span><strong>{config.title}</strong></div>
        <div><span>Quality</span><strong>{qualityText}; {passedDiagnostics}/{analysis.diagnostics.length} diagnostics</strong></div>
        <div><span>Evidence</span><strong title={externalEvidenceText}>{resultValidationStatus.label}</strong></div>
        <div><span>DOI source</span>{resultFixtures[0] ? <a href={resultFixtures[0].sourceUrl} target="_blank" rel="noreferrer">{doiLabel}</a> : <strong>{doiLabel}</strong>}</div>
      </div>
      <OutcomeLine analysis={analysis} isDematel={isDematel} />
      <div className="resultTabs">{tabs.map((tab) => <button className={activeTab === tab ? 'active' : ''} key={tab} onClick={() => onTab(tab)}>{tab}</button>)}</div>
      {activeTab === 'Overview' ? <InputSummary analysis={analysis} config={config} checksPassed={checksPassed} checksTotal={checksTotal} /> : null}
      {activeTab === 'Your Data' ? <TableBlock table={inputTable} /> : null}
      {activeTab === 'Charts' ? <VisualizationPanel analysis={analysis} rankingTitle={rankingTable?.title ?? 'Ranking chart'} /> : null}
      {activeTab === 'Compare Methods' && canCompareMethods ? <CompareMethods config={config} analysis={analysis} compareIds={compareIds} onChange={onCompareIds} /> : null}
      {activeTab === 'Compare Methods' && !canCompareMethods ? <div className="readyNote">{comparisonUnavailable}</div> : null}
      {(activeTab === 'Prepared Data' || activeTab === 'Final Result') ? (
        <div className="resultsGridSimple">
          <TableBlock table={activeTable} />
          <VisualizationPanel analysis={analysis} rankingTitle={rankingTable?.title ?? 'Ranking chart'} compact />
        </div>
      ) : null}
      {activeTab === 'Checks' ? <Checks diagnostics={analysis.diagnostics} /> : null}
      {activeTab === 'Calculations' ? analysis.tables.map((table) => <TableBlock key={table.id} table={table} />) : null}
    </section>
  );
}

function OutcomeLine({ analysis, isDematel }: { analysis: AnalysisResult; isDematel: boolean }) {
  const top = analysis.ranking[0];
  const second = analysis.ranking[1];
  const margin = top && second ? Math.abs(top.score - second.score) : 0;
  const evidenceTarget = isDematel ? 'cause-effect map' : 'final ranking';
  const scoreLabel = isDematel ? 'Prominence score' : 'Preference score';
  const marginText = second
    ? `${margin.toFixed(4)} from ${second.alternative}`
    : 'Only one item in this study';

  return (
    <div className="outcomeLine" aria-label="Result summary">
      <div className="outcomeLead">
        <span>{isDematel ? 'Top factor' : 'Top option'}</span>
        <strong>{top?.alternative ?? 'N/A'}</strong>
        <em>{top ? `${scoreLabel} ${top.score.toFixed(4)}` : 'No result available'}</em>
      </div>
      <div className="outcomeNode">
        <span>{isDematel ? 'Influence gap' : 'Lead gap'}</span>
        <strong>{marginText}</strong>
      </div>
      <div className="outcomeNode">
        <span>Audit trail</span>
        <strong>{analysis.tables.length} table{analysis.tables.length === 1 ? '' : 's'} + {evidenceTarget}</strong>
      </div>
    </div>
  );
}
function inputMatrixTable(analysis: AnalysisResult): OutputTable {
  const isDematel = analysis.methodId === 'dematel';
  return {
    id: 'cleaned-input',
    title: isDematel ? 'Analyzed direct-relation matrix' : 'Analyzed decision matrix',
    columns: [isDematel ? 'Source factor' : 'Option', ...analysis.input.criteria.map((criterion) => criterion.id)],
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
          <summary>Methods that cannot compare this data</summary>
          <div>
            {unavailableMethods.map(({ method, reason }) => <p key={method.id}><strong>{method.name}</strong>: {reason}</p>)}
          </div>
        </details>
      ) : null}
      <div className="cleanTableWrap">
        <h2>Compare methods</h2>
        <table>
          <thead><tr><th>Method</th><th>Best option</th><th>Score</th><th>Order</th></tr></thead>
          <tbody>{rows.length ? rows.map((row) => <tr key={row.method}><td>{row.method}</td><td>{row.top}</td><td>{row.top === 'Unavailable' ? 'N/A' : row.score.toFixed(4)}</td><td>{row.ranking}</td></tr>) : <tr><td colSpan={4}>Select at least one method that can use this data.</td></tr>}</tbody>
        </table>
      </div>
    </div>
  );
}

function InputSummary({ analysis, config, checksPassed, checksTotal }: { analysis: AnalysisResult; config: StudyConfig; checksPassed: number; checksTotal: number }) {
  const method = getMethod(config.methodId);
  return (
    <>
      <div className="summaryGrid resultsQaStrip">
        <Metric label="Study" value={config.title} />
        <Metric label="Method" value={analysis.methodName} />
        <Metric label="Weighting" value={method.supportsWeights ? weightingDisplayName(config.weightingId) : 'Not used'} />
        <Metric label="Options or factors" value={String(analysis.input.alternatives.length)} />
        <Metric label="Criteria or factors" value={String(analysis.input.criteria.length)} />
        <Metric label="Checks" value={`${analysis.diagnostics.filter((item) => item.status === 'pass').length}/${analysis.diagnostics.length} passed`} />
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
        <h2>Review readiness</h2>
        <span>For this result</span>
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
          <span>Published examples</span>
          <strong>{externalFixtures.length ? `${externalFixtures.length} reproduced example${externalFixtures.length === 1 ? '' : 's'} for ${method.name}` : `No published example has been reproduced for ${method.name} yet`}</strong>
        </div>
        {externalFixtures.length ? externalFixtures.map((fixture) => (
          <a key={`${fixture.methodId}-${fixture.variant}`} href={fixture.sourceUrl} target="_blank" rel="noreferrer">
            <strong>{fixture.variant}</strong>
            <span>{fixture.source}; DOI {fixture.doi}</span>
          </a>
        )) : (
          <p>No matched DOI fixture yet.</p>
        )}
        {externalCandidates.length ? (
          <div className="evidenceNotice">
            <strong>Additional DOI sources kept in review</strong>
            {externalCandidates.map((candidate) => (
              <a key={`${candidate.methodId}-${candidate.variant}`} href={candidate.sourceUrl} target="_blank" rel="noreferrer">
                <span>{candidate.variant}</span>
                <em>{candidate.source}; DOI {candidate.doi}</em>
              </a>
            ))}
          </div>
        ) : null}
      </div>
      <div className="capabilityProfile">
        <div>
          <span>Group data</span>
          <strong>{groupDecisionCapability(method, config)}</strong>
        </div>
        <div>
          <span>Fuzzy values</span>
          <strong>{fuzzyCapability(method, config)}</strong>
        </div>
        <div>
          <span>Validation note</span>
          <strong>{validationBoundary(method)}</strong>
        </div>
      </div>
    </section>
  );
}

function Checks({ diagnostics }: { diagnostics: AnalysisResult['diagnostics'] }) {
  return <div className="diagnostics">{diagnostics.map((item) => <div key={item.label} className={item.status}><strong>{item.label}</strong><span>{item.value}</span></div>)}</div>;
}

function VisualizationPanel({ analysis, rankingTitle, compact = false }: { analysis: AnalysisResult; rankingTitle: string; compact?: boolean }) {
  return (
    <div className={compact ? 'visualPanel compact' : 'visualPanel'}>
      {analysis.methodId === 'dematel' ? <DematelPlot analysis={analysis} /> : <RankingBars analysis={analysis} title={compact ? 'Score chart' : rankingTitle} />}
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
      <h2>{visualization?.title ?? 'Weight sensitivity'}</h2>
      <p>Shows how the result behaves when criterion weights move up or down by 10%.</p>
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
    ? 'Use `(l,m,u)` or `(a,b,c,d)`. This method keeps fuzzy ranges in calculation.'
    : 'Fuzzy cells can use triangular `(l,m,u)` or trapezoidal `(a,b,c,d)` ranges. This method keeps those ranges in its fuzzy calculation.';
  const calculatedWeightPreviewNote = `${weightingDisplayName(config.weightingId)} weights are calculated in results and exports.`;
  const compactRows = (rows: Array<Array<string | number>>, maxRows = 5, maxColumns = 7) =>
    rows.slice(0, maxRows).map((row) => row.slice(0, maxColumns));
  const matrixSheet = templateSheets.find((sheet) => sheet.name === (isDematel ? 'Direct Relation Matrix' : 'Decision Matrix'));
  const matrixPreview = matrixSheet ? compactRows(matrixSheet.rows, 5, 7) : [];
  return (
    <section className="samplePanel">
      <h2>{title}</h2>
      <p className="sampleNote">Matched to the current setup.</p>
      <div className="templatePreviewMeta">
        <span>{templateSheets.length} workbook sheets</span>
        <span>{usesGroupData ? isDematel ? `${Number(config.methodParams.dematelExpertCount ?? 1)} expert matrices` : `${Number(config.methodParams.respondentCount ?? 1)} respondent matrices` : isDematel ? 'One direct-relation matrix' : 'One decision matrix'}</span>
        <span>{weightingNote}</span>
        <span>{fuzzyModeLabel(fuzzyMode)}</span>
      </div>
      {!isDematel && config.weightingId !== 'manual' ? (
        <p className="sampleNote">{calculatedWeightPreviewNote}</p>
      ) : null}
      {fuzzyMode.startsWith('Native fuzzy') ? (
        <p className="sampleNote">{nativeFuzzyPreviewNote}</p>
      ) : null}
      <details className="workbookPreviewDetails">
        <summary>Workbook structure</summary>
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
        {hiddenCount ? <p className="sampleNote">{hiddenCount} more sheet{hiddenCount === 1 ? '' : 's'} included in the download.</p> : null}
        <div className="cleanTableWrap previewMatrix">
          <div className="tableToolbar"><h2>{isDematel ? 'Direct-relation example' : 'Decision matrix example'}</h2><span>{isDematel ? `${config.criteria.length} x ${config.criteria.length}` : `${config.alternatives.length} x ${config.criteria.length}`}</span></div>
          <table>
            <tbody>{matrixPreview.map((row, rowIndex) => (
              <tr key={rowIndex}>{row.map((cell, cellIndex) => rowIndex === 0 ? <th key={cellIndex}>{cell}</th> : <td key={cellIndex}>{cell}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
      </details>
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


















