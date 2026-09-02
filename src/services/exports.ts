import type { AnalysisResult, OutputTable } from '../types';
import { getBenchmarkSummary } from '../core/benchmarkReport';
import { benchmarkCoverageLabel } from '../core/benchmarkCoverage';
import { externalValidationCandidates, externalValidationCandidatesFor, externalValidationCoverageLabel, externalValidationFixtures, externalValidationFixturesFor, externalValidationStatusFor, validationEvidence } from '../core/validationEvidence';
import { safeFileName, safeSheetName } from './fileNames';

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeFileName(filename);
  link.click();
  URL.revokeObjectURL(url);
}

function reproducibilityRows(result: AnalysisResult): Array<[string, string]> {
  return Object.entries(result.reproducibility).map(([key, value]) => [
    key,
    typeof value === 'object' ? JSON.stringify(value) : String(value),
  ]);
}

function visualizationTable(result: AnalysisResult, visualizationId: string): OutputTable | null {
  const visualization = result.visualizations.find((item) => item.id === visualizationId);
  if (!visualization || !visualization.data.length) return null;
  const columns = Object.keys(visualization.data[0]);
  return {
    id: visualization.id,
    title: visualization.title,
    columns,
    rows: visualization.data.map((row) => columns.map((column) => row[column])),
  };
}

function analyzedInputTable(result: AnalysisResult): OutputTable {
  const isDematel = result.methodId === 'dematel';
  return {
    id: 'analyzed-input',
    title: isDematel ? 'Analyzed Direct Relation Matrix' : 'Analyzed Decision Matrix',
    columns: [isDematel ? 'Source factor' : 'Alternative', ...result.input.criteria.map((criterion) => criterion.id)],
    rows: result.input.values.map((row, index) => [
      isDematel
        ? (result.input.criteria[index]?.name ?? result.input.criteria[index]?.id ?? `F${index + 1}`)
        : (result.input.alternatives[index]?.name ?? result.input.alternatives[index]?.id ?? `A${index + 1}`),
      ...row.map((value) => Number.isFinite(value) ? Number(value.toFixed(6)) : 'Invalid'),
    ]),
  };
}

function validationEvidenceRows(result: AnalysisResult): Array<[string, string, string]> {
  const selectedStatus = externalValidationStatusFor(result.methodId, 'readiness');
  return [
    ['Certification status', 'Not publication-certified for every variant', 'Treat internal checks as implementation evidence. Treat only registered passing external fixtures as published-example validation for the selected method and variant.'],
    ['Selected method validation status', selectedStatus.label, selectedStatus.text],
    [validationEvidence.smokeChecks.label, 'Included', validationEvidence.smokeChecks.scope],
    [validationEvidence.numericalBenchmarks.label, `${validationEvidence.numericalBenchmarks.count} checks`, validationEvidence.numericalBenchmarks.scope],
    ['Selected method benchmark coverage', result.methodName, benchmarkCoverageLabel(result.methodId)],
    [validationEvidence.externalBenchmarks.label, `${validationEvidence.externalBenchmarks.status}: ${validationEvidence.externalBenchmarks.count} fixture${validationEvidence.externalBenchmarks.count === 1 ? '' : 's'}`, validationEvidence.externalBenchmarks.scope],
    ['Selected method external validation', result.methodName, externalValidationCoverageLabel(result.methodId)],
  ];
}

function studyModeEvidenceRows(result: AnalysisResult): Array<[string, string, string]> {
  const fuzzyCellCount = Number(result.reproducibility.fuzzyCellCount ?? result.input.fuzzyCellCount ?? 0);
  const fuzzyTypes = Array.isArray(result.reproducibility.fuzzyTypes)
    ? result.reproducibility.fuzzyTypes.join(', ')
    : (result.input.fuzzyTypes ?? []).join(', ');
  const respondentCount = Number(result.reproducibility.respondentMatrices ?? result.input.groupAggregation?.sourceCount ?? result.input.respondentMatrices?.length ?? 0);
  const expertCount = Number(result.reproducibility.expertMatrices ?? result.input.expertMatrices?.length ?? 0);
  const fuzzyMode = String(result.reproducibility.fuzzyMode ?? result.input.groupAggregation?.fuzzyTupleAggregation ?? 'Crisp or centroid-defuzzified input');
  const respondentSummary = respondentCount > 0
    ? `${respondentCount} respondent matrix${respondentCount === 1 ? '' : 'es'}; ${String(result.reproducibility.respondentConsensusLevel ?? result.input.groupAggregation?.consensusLevel ?? 'consensus not reported')}`
    : 'No respondent matrix aggregation used';
  const expertSummary = expertCount > 0
    ? `${expertCount} expert matrix${expertCount === 1 ? '' : 'es'}; ${String(result.reproducibility.expertConsensusLevel ?? 'consensus not reported')}`
    : 'No DEMATEL expert matrix aggregation used';
  let dematelFuzzyCalculation = 'Not used';
  if (result.methodId === 'dematel') {
    const params = result.reproducibility.params;
    const savedParam = params && typeof params === 'object' && 'dematelFuzzyCalculation' in params
      ? (params as Record<string, unknown>).dematelFuzzyCalculation
      : undefined;
    dematelFuzzyCalculation = String(result.reproducibility.dematelFuzzyCalculation ?? savedParam ?? 'Not reported');
  }

  return [
    ['Input type', fuzzyCellCount > 0 ? `${fuzzyCellCount} fuzzy cell${fuzzyCellCount === 1 ? '' : 's'} detected` : 'Crisp numeric input', fuzzyCellCount > 0 ? `Fuzzy types: ${fuzzyTypes || 'detected'}. Mode: ${fuzzyMode}.` : 'No triangular/trapezoidal fuzzy cells were detected in this run.'],
    ['Respondent/group aggregation', respondentSummary, respondentCount > 0 ? `Aggregation: ${String(result.reproducibility.respondentAggregation ?? result.input.groupAggregation?.aggregation ?? 'not reported')}; mean disagreement: ${String(result.reproducibility.respondentMeanAbsoluteDisagreement ?? 'not reported')}.` : 'The uploaded/active decision matrix was treated as a single already aggregated dataset.'],
    ['Expert aggregation', expertSummary, expertCount > 0 ? `Mean disagreement: ${String(result.reproducibility.expertMeanAbsoluteDisagreement ?? 'not reported')}; relative disagreement: ${String(result.reproducibility.expertRelativeDisagreement ?? 'not reported')}.` : 'Only DEMATEL multiple-expert studies use expert direct-relation aggregation.'],
    ['Fuzzy calculation convention', result.methodId === 'dematel' ? dematelFuzzyCalculation : fuzzyMode, result.methodId === 'dematel' ? 'DEMATEL reports whether fuzzy tuples stayed component-wise through total relation or were defuzzified before the final causal matrix.' : 'Native fuzzy methods report the selected fuzzy mode; centroid-only methods report defuzzified input handling.'],
  ];
}

function externalFixtureRows(result?: AnalysisResult): Array<[string, string, string]> {
  const fixtures = result ? externalValidationFixturesFor(result.methodId) : externalValidationFixtures;
  const candidates = result ? externalValidationCandidatesFor(result.methodId) : externalValidationCandidates;
  return [
    ...fixtures.map((fixture) => [
    `${fixture.methodId.toUpperCase()} ${fixture.variant}`,
    `${fixture.source}; DOI ${fixture.doi}`,
    `${fixture.scope} Source: ${fixture.sourceUrl}`,
    ] as [string, string, string]),
    ...candidates.map((candidate) => [
      `${candidate.methodId.toUpperCase()} ${candidate.variant} (discrepancy candidate)`,
      `${candidate.source}; DOI ${candidate.doi}`,
      `${candidate.scope} Source: ${candidate.sourceUrl}`,
    ] as [string, string, string]),
  ];
}

function methodSteps(result: AnalysisResult): string[] {
  const common = ['Validate workbook structure and numeric input.', 'Normalize criteria according to benefit/cost direction.', 'Generate intermediate matrices and final decision output.'];
  const steps: Record<string, string[]> = {
    topsis: ['Compute vector-normalized decision matrix.', 'Apply criteria weights.', 'Determine positive and negative ideal solutions.', 'Calculate separation distances and closeness coefficient.'],
    ahp: ['Build criteria pairwise comparison matrix.', 'Normalize pairwise matrix and derive criteria priorities.', 'Calculate lambda max, CI, and CR.', 'Combine priorities with alternative performance scores.'],
    vikor: ['Determine best and worst criterion values.', 'Compute group utility S and individual regret R.', 'Calculate compromise index Q using v coefficient.', 'Check acceptable advantage and acceptable stability for the compromise solution.', 'Rank alternatives by lowest Q value.'],
    dematel: ['Normalize direct relation matrix.', 'Compute total relation matrix T = N(I-N)^-1.', 'Calculate D, R, D+R, and D-R.', 'Classify factors into cause and effect groups.'],
    copras: ['Normalize the decision matrix by column sums.', 'Apply normalized criterion weights.', 'Separate beneficial S+ and non-beneficial S- components.', 'Calculate relative significance Q and utility degree.'],
    moora: ['Apply vector ratio normalization.', 'Apply criterion weights.', 'Sum beneficial criteria and subtract cost criteria.', 'Rank by net assessment score.'],
    aras: ['Add the optimal reference alternative.', 'Normalize benefit and cost criteria against the augmented matrix.', 'Calculate optimality function S.', 'Rank alternatives by utility degree K.'],
    mabac: ['Normalize and weight the decision matrix.', 'Calculate the border approximation area for each criterion.', 'Compute each alternative distance from the border area.', 'Rank by total border-distance score.'],
    codas: ['Normalize and weight the decision matrix.', 'Determine the negative ideal solution.', 'Calculate Euclidean and taxicab distances from the negative ideal.', 'Build the thresholded relative assessment matrix and rank by final assessment score.'],
    cocoso: ['Calculate additive S and multiplicative P appraisal scores.', 'Compute three compromise comparability measures.', 'Combine measures into final CoCoSo score.', 'Rank by final compromise appraisal.'],
    marcos: ['Construct ideal and anti-ideal reference alternatives.', 'Normalize and weight the augmented matrix.', 'Calculate utility degrees relative to both references.', 'Rank by the selected MARCOS convention: standard f(K), or f(K+) when reproducing sources that publish that convention.'],
    mairca: ['Construct theoretical assessment values.', 'Calculate real assessment matrix.', 'Compute gaps between theoretical and real assessments.', 'Rank by the smallest total gap.'],
    promethee: ['Calculate pairwise preference degrees by criterion.', 'Aggregate weighted preference indices.', 'Compute positive and negative outranking flows.', 'Rank alternatives by PROMETHEE II net flow.'],
    electre: ['Calculate concordance matrix.', 'Calculate discordance matrix.', 'Apply concordance and discordance thresholds.', 'Rank alternatives by net outranking dominance.'],
    smart: ['Scale each criterion into a single-attribute utility.', 'Apply criterion weights.', 'Aggregate weighted utilities.', 'Rank alternatives by total utility.'],
    maut: ['Select utility shape for single-attribute utilities.', 'Transform normalized performance values into utilities.', 'Apply criterion weights.', 'Rank by total multi-attribute utility.'],
    ocra: ['Normalize and weight the decision matrix.', 'Separate benefit and cost preference components.', 'Calculate operational competitiveness rating.', 'Rank alternatives by overall preference.'],
    multimoora: ['Calculate MOORA ratio system score.', 'Calculate reference point distance.', 'Calculate full multiplicative form score.', 'Aggregate component ranks into dominance ranking.'],
    psi: ['Normalize the decision matrix.', 'Calculate criterion variation and preference values.', 'Derive objective PSI weights.', 'Rank alternatives by weighted preference score.'],
    piv: ['Vector-normalize and weight the decision matrix.', 'Identify the best weighted value per criterion using benefit/cost direction.', 'Calculate criterion-wise weighted proximity deviations.', 'Sum deviations and rank by the smallest proximity index.'],
    rov: ['Normalize criterion performance values.', 'Calculate best and worst utility functions.', 'Average utility values.', 'Rank by average range-of-value utility.'],
    wisp: ['Calculate weighted sum and product benefit/cost components.', 'Calculate sum-difference, product-difference, sum-ratio, and product-ratio utilities.', 'Recalculate the four utility measures onto comparable scales.', 'Rank by final average WISP utility.'],
    todim: ['Normalize criterion performance values.', 'Calculate reference-criterion relative weights.', 'Calculate pairwise dominance values using weighted gains and attenuated losses.', 'Normalize aggregate dominance scores and rank alternatives.'],
    ram: ['Normalize benefit and cost criteria.', 'Apply criterion weights.', 'Aggregate weighted benefit and cost utility components.', 'Rank alternatives by final RAM utility score.'],
    gra: ['Normalize criteria according to benefit/cost direction.', 'Build the ideal reference sequence.', 'Calculate grey relational coefficients using the zeta coefficient.', 'Aggregate weighted grey relational grades and rank alternatives.'],
    spotis: ['Define criterion lower and upper bounds.', 'Select the ideal point using benefit/cost direction.', 'Calculate normalized distances from the ideal point.', 'Apply criterion weights and rank by lowest total distance.'],
    balancedSpotis: ['Define criterion bounds, the ideal solution point, and the expected solution point.', 'Calculate normalized distances from both reference points.', 'Blend ideal and expected-solution distances using alpha.', 'Apply criterion weights and rank by lowest balanced distance.'],
    wedba: ['Normalize benefit and cost criteria using ratio normalization.', 'Standardize normalized values by criterion mean and deviation.', 'Determine ideal and anti-ideal reference points.', 'Calculate weighted Euclidean distances and rank by performance index.'],
    lmaw: ['Transform benefit and cost criteria into positive standardized utilities.', 'Apply logarithmic additive normalization by criterion.', 'Apply the selected LMAW scoring convention: original nonlinear Q utility or weighted log sum.', 'Sum utility values and rank alternatives by highest LMAW index.'],
    dnma: ['Determine target values for each criterion.', 'Apply target-based linear and vector normalization.', 'Calculate complete, uncompensatory, and incomplete compensatory utilities.', 'Integrate utility and rank information into the final DNMA score.'],
    probid: ['Vector-normalize the decision matrix.', 'Apply criterion weights and build ordered positive and negative ideal reference solutions.', 'Aggregate positive/negative ideal distances and average-solution distance.', 'Rank alternatives by the PROBID preference index.'],
    rim: ['Define observed ranges and reference ideal intervals for each criterion.', 'Calculate normalized closeness to each reference ideal interval.', 'Apply criterion weights to the closeness matrix.', 'Rank alternatives by total weighted closeness to the reference ideal.'],
    rafsi: ['Determine observed ideal and anti-ideal values for each criterion.', 'Map benefit and cost criterion values into the configured RAFSI interval.', 'Normalize mapped benefit criteria with the arithmetic-mean expression and cost criteria with the harmonic-mean expression.', 'Apply criterion weights and rank alternatives by the final RAFSI score.'],
    lopm: ['Define lower-limit, upper-limit, or target property requirements.', 'Calculate merit components against each property limit.', 'Apply criterion weights to the merit matrix.', 'Rank alternatives by the lowest total merit value.'],
    aroman: ['Calculate linear normalized performance values.', 'Calculate vector normalized performance values.', 'Blend the two normalized matrices using beta.', 'Apply criterion weights, split benefit/cost sums, and combine them with lambda for the final AROMAN utility.'],
    cobra: ['Normalize and weight the decision matrix.', 'Determine positive ideal, negative ideal, and average reference solutions.', 'Calculate Euclidean and taxicab distance components.', 'Rank alternatives by the lowest comprehensive distance.'],
    ervd: ['Define the decision-maker reference point.', 'Normalize the decision matrix and reference point by criterion sums.', 'Calculate relative performance values with alpha and lambda parameters.', 'Apply criterion weights to separation from positive and negative relative-value ideals, then rank by relative closeness.'],
    waspas: ['Calculate WSM utility.', 'Calculate WPM utility.', 'Blend WSM and WPM using lambda.', 'Rank by final WASPAS score.'],
    edas: ['Calculate average solution.', 'Calculate positive and negative distances from average.', 'Aggregate weighted distances.', 'Rank by appraisal score.'],
  };
  return steps[result.methodId] ?? common;
}

export async function exportAnalysisWorkbook(result: AnalysisResult): Promise<void> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const usedSheetNames = new Set<string>();
  const inputTable = analyzedInputTable(result);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Field', 'Value'],
    ['Method', result.methodName],
    ['Alternatives or factors', result.input.alternatives.length],
    ['Criteria or factors', result.input.criteria.length],
    ['Top result', result.ranking[0]?.alternative ?? 'N/A'],
    ['Generated locally', 'Yes'],
    ['Certification status', 'Not publication-certified for every variant'],
    ['Selected method benchmark coverage', benchmarkCoverageLabel(result.methodId)],
    ['Selected method external validation', externalValidationCoverageLabel(result.methodId)],
    ['Fuzzy/input mode evidence', studyModeEvidenceRows(result).map(([label, status]) => `${label}: ${status}`).join('; ')],
    ['Validation evidence', getBenchmarkSummary()],
  ]), safeSheetName('Method Summary', usedSheetNames));
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Parameter', 'Value'],
    ...reproducibilityRows(result),
  ]), safeSheetName('Parameters', usedSheetNames));
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Step', 'Description'],
    ...methodSteps(result).map((step, index) => [index + 1, step]),
  ]), safeSheetName('Calculation Steps', usedSheetNames));
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([inputTable.columns, ...inputTable.rows]), safeSheetName(inputTable.title, usedSheetNames));
  result.tables.forEach((table) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([table.columns, ...table.rows]), safeSheetName(table.title, usedSheetNames));
  });
  result.visualizations.forEach((visualization) => {
    const table = visualizationTable(result, visualization.id);
    if (table) {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([table.columns, ...table.rows]), safeSheetName(table.title, usedSheetNames));
    }
  });
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(result.diagnostics), safeSheetName('Validation Summary', usedSheetNames));
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([result.reproducibility]), safeSheetName('Reproducibility', usedSheetNames));
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Evidence type', 'Status', 'Scope'],
    ...studyModeEvidenceRows(result),
    ...validationEvidenceRows(result),
    ...externalFixtureRows(result),
  ]), safeSheetName('Validation Evidence', usedSheetNames));
  XLSX.writeFile(workbook, safeFileName(`${result.methodName}-analysis-package.xlsx`));
}

async function docxTable(table: OutputTable) {
  const { Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = await import('docx');
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: table.columns.map((column) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: column, bold: true })] })] })) }),
      ...table.rows.map((row) => new TableRow({ children: row.map((cell) => new TableCell({ children: [new Paragraph(String(cell))] })) })),
    ],
  });
}

export async function exportDocx(result: AnalysisResult): Promise<void> {
  const { Document, Packer, Paragraph, TextRun } = await import('docx');
  const inputTable = analyzedInputTable(result);
  const parameterTable = await docxTable({
    id: 'parameters',
    title: 'Specification and Reproducibility Summary',
    columns: ['Field', 'Value'],
    rows: reproducibilityRows(result),
  });
  const renderedInputTable = await docxTable(inputTable);
  const renderedTables = await Promise.all(result.tables.map(async (table) => ({
    table,
    rendered: await docxTable(table),
  })));
  const renderedVisualTables = await Promise.all(result.visualizations.map(async (visualization) => {
    const table = visualizationTable(result, visualization.id);
    return table ? { table, rendered: await docxTable(table) } : null;
  }));
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ children: [new TextRun({ text: `${result.methodName} MCDM Analysis Report`, bold: true, size: 32 })] }),
        new Paragraph(result.narrative),
        new Paragraph({ children: [new TextRun({ text: 'Study Summary', bold: true, size: 24 })] }),
        new Paragraph(`Alternatives/factors: ${result.input.alternatives.length}. Criteria/factors: ${result.input.criteria.length}. Top result: ${result.ranking[0]?.alternative ?? 'N/A'}.`),
        new Paragraph({ children: [new TextRun({ text: 'Specification and Reproducibility Summary', bold: true, size: 24 })] }),
        parameterTable,
        new Paragraph({ children: [new TextRun({ text: 'Method and Reproducibility Notes', bold: true, size: 24 })] }),
        new Paragraph(`This report was generated locally in the browser. ${getBenchmarkSummary()}`),
        new Paragraph('Certification status: not publication-certified for every variant. Only registered passing external fixtures should be treated as published-example validation evidence for the selected method and variant.'),
        new Paragraph({ children: [new TextRun({ text: 'Study Mode Evidence', bold: true, size: 24 })] }),
        ...(studyModeEvidenceRows(result).flatMap(([label, status, scope]) => [
          new Paragraph({ children: [new TextRun({ text: `${label}: ${status}`, bold: true })] }),
          new Paragraph(scope),
        ])),
        new Paragraph({ children: [new TextRun({ text: 'Validation Evidence', bold: true, size: 24 })] }),
        ...(validationEvidenceRows(result).flatMap(([label, status, scope]) => [
          new Paragraph({ children: [new TextRun({ text: `${label}: ${status}`, bold: true })] }),
          new Paragraph(scope),
        ])),
        ...(externalFixtureRows(result).flatMap(([label, status, scope]) => [
          new Paragraph({ children: [new TextRun({ text: `External fixture: ${label}`, bold: true })] }),
          new Paragraph(`${status}. ${scope}`),
        ])),
        new Paragraph({ children: [new TextRun({ text: 'Calculation Steps', bold: true, size: 24 })] }),
        ...methodSteps(result).map((step, index) => new Paragraph(`${index + 1}. ${step}`)),
        new Paragraph({ children: [new TextRun({ text: inputTable.title, bold: true, size: 24 })] }),
        renderedInputTable,
        ...renderedTables.flatMap(({ table, rendered }) => [new Paragraph({ children: [new TextRun({ text: table.title, bold: true, size: 24 })] }), rendered]),
        ...renderedVisualTables.filter(Boolean).flatMap((item) => item ? [new Paragraph({ children: [new TextRun({ text: `Figure data: ${item.table.title}`, bold: true, size: 24 })] }), item.rendered] : []),
      ],
    }],
  });
  saveBlob(await Packer.toBlob(doc), `${result.methodName}-research-report.docx`);
}

export async function exportPdf(result: AnalysisResult): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF();
  let y = 18;
  const ensureSpace = (needed = 8) => {
    if (y + needed > 280) {
      pdf.addPage();
      y = 16;
    }
  };
  const writeWrapped = (text: string, size = 8, lineHeight = 5, maxWidth = 180) => {
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(text, maxWidth) as string[];
    lines.forEach((line) => {
      ensureSpace(lineHeight);
      pdf.text(line, 14, y);
      y += lineHeight;
    });
  };
  const writeHeading = (text: string) => {
    ensureSpace(12);
    pdf.setFontSize(12);
    pdf.text(text, 14, y);
    y += 7;
  };
  pdf.setFontSize(16);
  pdf.text(`${result.methodName} MCDM Analysis Report`, 14, y);
  y += 10;
  writeWrapped(result.narrative, 10, 5);
  y += 6;
  writeHeading('Study Summary');
  writeWrapped(`Alternatives/factors: ${result.input.alternatives.length}. Criteria/factors: ${result.input.criteria.length}. Top result: ${result.ranking[0]?.alternative ?? 'N/A'}.`, 9, 5);
  writeWrapped(getBenchmarkSummary(), 9, 5);
  writeWrapped('Certification status: not publication-certified for every variant. Only registered passing external fixtures count as published-example validation evidence for the selected method and variant.', 9, 5);
  y += 4;
  writeHeading('Study Mode Evidence');
  studyModeEvidenceRows(result).forEach(([label, status, scope]) => {
    writeWrapped(`${label}: ${status}. ${scope}`, 8, 4);
    y += 2;
  });
  writeHeading('Validation Evidence');
  validationEvidenceRows(result).forEach(([label, status, scope]) => {
    writeWrapped(`${label}: ${status}. ${scope}`, 8, 4);
    y += 2;
  });
  externalFixtureRows(result).forEach(([label, status, scope]) => {
    writeWrapped(`External fixture: ${label}. ${status}. ${scope}`, 8, 4);
    y += 3;
  });
  writeHeading('Calculation Steps');
  methodSteps(result).forEach((step, index) => {
    writeWrapped(`${index + 1}. ${step}`, 8, 4);
  });
  y += 4;
  const inputTable = analyzedInputTable(result);
  writeHeading(inputTable.title);
  writeWrapped(inputTable.columns.join(' | '), 8, 4);
  inputTable.rows.forEach((row) => {
    writeWrapped(row.map(String).join(' | '), 8, 4);
  });
  y += 5;
  result.tables.forEach((table) => {
    writeHeading(table.title);
    writeWrapped(table.columns.join(' | '), 8, 4);
    table.rows.forEach((row) => {
      writeWrapped(row.map(String).join(' | '), 8, 4);
    });
    y += 5;
  });
  result.visualizations.forEach((visualization) => {
    const table = visualizationTable(result, visualization.id);
    if (!table) return;
    writeHeading(`Figure data: ${table.title}`);
    writeWrapped(table.columns.join(' | '), 8, 4);
    table.rows.forEach((row) => {
      writeWrapped(row.map(String).join(' | '), 8, 4);
    });
    y += 5;
  });
  pdf.save(safeFileName(`${result.methodName}-publication-report.pdf`));
}
