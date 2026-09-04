import type { MethodId, StudyConfig, TemplateSheet } from '../types';
import { weightingDisplayName } from './weightingMetadata';

function excelSafeSheetName(name: string): string {
  return name.replace(/[\\/:?*[\]]/g, '-').slice(0, 31);
}

const fuzzyTemplateGuidanceByMode: Record<string, string> = {
  'Native fuzzy TOPSIS': 'TOPSIS preserves triangular/trapezoidal cells for native fuzzy normalization, weighting, ideal distances, and closeness.',
  'Native fuzzy AHP': 'AHP preserves triangular/trapezoidal pairwise judgments for fuzzy geometric means and defuzzified priority weights.',
  'Native fuzzy DEMATEL': 'DEMATEL preserves triangular/trapezoidal expert judgments through fuzzy direct, normalized, and total-relation matrices before centroid D/R interpretation.',
  'Native fuzzy VIKOR': 'VIKOR preserves triangular/trapezoidal cells for fuzzy best/worst references, fuzzy-distance regret, and Q compromise ranking.',
  'Native fuzzy WASPAS': 'WASPAS preserves triangular/trapezoidal cells for fuzzy normalization, fuzzy weighting, and blended WSM/WPM utility scoring.',
  'Native fuzzy COPRAS': 'COPRAS preserves triangular/trapezoidal cells for fuzzy normalization, fuzzy weighting, and benefit/cost utility components.',
  'Native fuzzy EDAS': 'EDAS preserves triangular/trapezoidal cells for fuzzy average solution, positive/negative distance, and appraisal scoring.',
  'Native fuzzy SAW': 'SAW preserves triangular/trapezoidal cells for fuzzy normalization, fuzzy weighting, and additive utility scoring.',
  'Native fuzzy WPM': 'WPM preserves triangular/trapezoidal cells for fuzzy normalization and multiplicative utility scoring.',
  'Native fuzzy MOORA': 'MOORA preserves triangular/trapezoidal cells for fuzzy ratio normalization, fuzzy weighting, and benefit-cost net assessment.',
  'Native fuzzy MOOSRA': 'MOOSRA preserves triangular/trapezoidal cells for fuzzy vector normalization, fuzzy weighting, and centroid benefit-cost ratio scoring.',
  'Native fuzzy ARAS': 'ARAS preserves triangular/trapezoidal cells for fuzzy optimal reference, normalization, weighting, and utility-degree scoring.',
  'Native fuzzy MABAC': 'MABAC preserves triangular/trapezoidal cells for fuzzy weighted border approximation and centroid distance assessment.',
  'Native fuzzy MARCOS': 'MARCOS preserves triangular/trapezoidal cells for fuzzy anti-ideal/ideal references, normalization, weighting, and utility degrees.',
  'Native fuzzy CoCoSo': 'CoCoSo preserves triangular/trapezoidal cells for fuzzy additive and multiplicative appraisal before compromise scoring.',
  'Native fuzzy COMET': 'COMET preserves triangular/trapezoidal alternatives and evaluates characteristic-object membership on fuzzy centroids.',
  'Native fuzzy MAIRCA': 'MAIRCA preserves triangular/trapezoidal cells for fuzzy real assessment and centroid gap scoring.',
  'Native fuzzy OCRA': 'OCRA preserves triangular/trapezoidal cells for fuzzy weighted benefit/cost preference scoring.',
  'Native fuzzy PIV': 'PIV preserves triangular/trapezoidal cells for fuzzy weighted normalization and proximity-index scoring.',
  'Native fuzzy ROV': 'ROV preserves triangular/trapezoidal cells for fuzzy normalized best/worst utility scoring.',
  'Native fuzzy WISP': 'WISP preserves triangular/trapezoidal cells for fuzzy weighted sum/product appraisal scoring.',
  'Native fuzzy CODAS': 'CODAS preserves triangular/trapezoidal cells for fuzzy weighted Euclidean/taxicab distances and relative assessment from the negative ideal.',
  'Native fuzzy GRA': 'GRA preserves triangular/trapezoidal cells for fuzzy-distance grey relational coefficients and grades.',
  'Native fuzzy GRP': 'GRP preserves triangular/trapezoidal cells for fuzzy-distance positive and negative grey projection closeness.',
  'Native fuzzy RAM': 'RAM preserves triangular/trapezoidal cells for fuzzy weighted benefit-cost utility scoring.',
  'Native fuzzy SMART': 'SMART preserves triangular/trapezoidal cells for fuzzy single-attribute utility and weighted total utility scoring.',
  'Native fuzzy SMARTER': 'SMARTER preserves triangular/trapezoidal utilities for ROC-weighted centroid utility scoring.',
  'Native fuzzy MAUT': 'MAUT preserves triangular/trapezoidal cells for fuzzy utility functions, selected utility shaping, and weighted total utility scoring.',
  'Native fuzzy Pugh Matrix': 'Pugh preserves triangular/trapezoidal uploaded scores or fuzzy baseline comparisons for centroid weighted scoring.',
  'Native fuzzy LMAW': 'LMAW preserves triangular/trapezoidal cells for fuzzy positive standardization and logarithmic additive scoring.',
  'Native fuzzy DNMA': 'DNMA preserves triangular/trapezoidal cells for fuzzy target references and double-normalization aggregation.',
  'Native fuzzy PROBID': 'PROBID preserves triangular/trapezoidal cells for fuzzy ideal, average, and anti-ideal reference distances.',
  'Native fuzzy SPROBID': 'SPROBID preserves triangular/trapezoidal cells for fuzzy ordered quarter-reference distance aggregation.',
  'Native fuzzy RIM': 'RIM preserves triangular/trapezoidal cells for fuzzy closeness to observed or manual ideal intervals.',
  'Native fuzzy RAFSI': 'RAFSI preserves triangular/trapezoidal cells for fuzzy functional mapping into the configured interval.',
  'Native fuzzy LoPM': 'LoPM preserves triangular/trapezoidal cells for fuzzy merit penalties against observed or manual property limits.',
  'Native fuzzy B-SPOTIS': 'B-SPOTIS preserves triangular/trapezoidal cells for fuzzy ISP/ESP distance blending.',
  'Native fuzzy CRADIS': 'CRADIS preserves triangular/trapezoidal cells for fuzzy ideal/anti-ideal deviation appraisal.',
  'Native fuzzy AROMAN': 'AROMAN preserves triangular/trapezoidal cells for fuzzy blended linear and vector normalization.',
  'Native fuzzy COBRA': 'COBRA preserves triangular/trapezoidal cells for fuzzy positive ideal, average, and negative ideal distance components.',
};

function fuzzyTemplateGuidance(fuzzyMode: string): string {
  return fuzzyTemplateGuidanceByMode[fuzzyMode] ?? 'Triangular (l,m,u) and trapezoidal (a,b,c,d) cells are supported and defuzzified by centroid before analysis.';
}

export function createBaseTemplate(methodName: string, config: StudyConfig, parameters: string[]): TemplateSheet[] {
  const usesManualWeights = config.weightingId === 'manual';
  const includesWeightSheet = usesManualWeights;
  const weightHeader = usesManualWeights ? 'Manual Weight' : 'Weight Source';
  const weightingLabel = weightingDisplayName(config.weightingId);
  const calculatedWeightLabel = `${weightingLabel} weights calculated`;
  const weightingParameters: TemplateSheet[] = [];
  const respondentCount = Math.max(1, Number(config.methodParams.respondentCount) || 1);
  const usesGroupData = String(config.methodParams.dataInputMode ?? 'Single aggregated dataset') === 'Multiple respondents';
  const fuzzyMode = String(config.methodParams.fuzzyInputMode ?? 'Defuzzify on upload');
  const respondentAggregation = String(config.methodParams.respondentAggregation ?? 'Arithmetic mean');
  if (config.weightingId === 'bwm') {
    weightingParameters.push({
      name: 'BWM Parameters',
      rows: [
        ['Parameter', 'Value'],
        ['Best criterion', String(config.methodParams.bwmBestCriterion ?? config.criteria[0]?.id ?? '')],
        ['Worst criterion', String(config.methodParams.bwmWorstCriterion ?? config.criteria[config.criteria.length - 1]?.id ?? '')],
        ['Best-to-others vector', String(config.methodParams.bwmBestToOthers ?? config.criteria.map(() => 1).join(','))],
        ['Others-to-worst vector', String(config.methodParams.bwmOthersToWorst ?? config.criteria.map(() => 1).join(','))],
      ],
    });
  }
  if (config.weightingId === 'dibr') {
    weightingParameters.push({
      name: 'DIBR Parameters',
      rows: [
        ['Parameter', 'Value'],
        ['Criterion order', String(config.methodParams.dibrOrder ?? config.criteria.map((item) => item.id).join(','))],
        ['Adjacent importance ratios', String(config.methodParams.dibrAdjacentRatios ?? Array.from({ length: Math.max(config.criteria.length - 1, 0) }, () => 1).join(','))],
        ['First-to-last control ratio', String(config.methodParams.dibrFirstLastRatio ?? '')],
        ['Guidance', 'Order criteria from most important to least important. Adjacent ratios compare each criterion with the next criterion and must be greater than or equal to 1.'],
      ],
    });
  }
  if (config.weightingId === 'simos') {
    weightingParameters.push({
      name: 'SRF Cards Parameters',
      rows: [
        ['Parameter', 'Value'],
        ['Card groups', String(config.methodParams.simosGroups ?? config.criteria.map((item) => item.id).join(' | '))],
        ['Blank cards between groups', String(config.methodParams.simosBlankCards ?? Array.from({ length: Math.max(config.criteria.length - 1, 0) }, () => 0).join(','))],
        ['Z ratio', String(config.methodParams.simosZRatio ?? 1)],
        ['Guidance', 'List groups from least important to most important. Use commas for tied criteria in one group and vertical bars between groups. Blank cards describe importance gaps between consecutive groups.'],
      ],
    });
  }
  if (config.weightingId === 'swara') {
    weightingParameters.push({
      name: 'SWARA Parameters',
      rows: [
        ['Parameter', 'Value'],
        ['Criterion order', String(config.methodParams.swaraOrder ?? config.criteria.map((item) => item.id).join(','))],
        ['Comparative importance values', String(config.methodParams.swaraComparativeImportance ?? config.criteria.map((_, index) => index === 0 ? 0 : 0.1).join(','))],
      ],
    });
  }
  if (config.weightingId === 'roc') {
    weightingParameters.push({
      name: 'ROC Parameters',
      rows: [
        ['Parameter', 'Value'],
        ['Criterion order', String(config.methodParams.rocOrder ?? config.criteria.map((item) => item.id).join(','))],
      ],
    });
  }
  if (config.weightingId === 'fucom') {
    weightingParameters.push({
      name: 'FUCOM Parameters',
      rows: [
        ['Parameter', 'Value'],
        ['Criterion order', String(config.methodParams.fucomOrder ?? config.criteria.map((item) => item.id).join(','))],
        ['Adjacent comparative priorities', String(config.methodParams.fucomComparativePriorities ?? Array.from({ length: Math.max(config.criteria.length - 1, 0) }, () => 1).join(','))],
      ],
    });
  }
  if (config.weightingId === 'lbwa') {
    weightingParameters.push({
      name: 'LBWA Parameters',
      rows: [
        ['Parameter', 'Value'],
        ['Criterion levels', String(config.methodParams.lbwaLevels ?? config.criteria.map((_, index) => index + 1).join(','))],
        ['Level importance values', String(config.methodParams.lbwaImportance ?? config.criteria.map((_, index) => index).join(','))],
        ['Elasticity coefficient', String(config.methodParams.lbwaElasticity ?? Math.max(config.criteria.length, 5))],
        ['Guidance', 'Level 1 with importance 0 is the most important reference criterion; larger levels indicate lower importance groups.'],
      ],
    });
  }
  if (config.weightingId === 'piprecia') {
    weightingParameters.push({
      name: 'PIPRECIA Parameters',
      rows: [
        ['Parameter', 'Value'],
        ['Criterion order', String(config.methodParams.pipreciaOrder ?? config.criteria.map((item) => item.id).join(','))],
        ['Relative significance values', String(config.methodParams.pipreciaRelativeSignificance ?? config.criteria.map((_, index) => index === 0 ? 1 : 0.9).join(','))],
        ['Guidance', 'Use one value per criterion in the listed order. First value is usually 1; following values compare each criterion with the previous criterion and must be greater than 0 and less than 2.'],
      ],
    });
  }
  if (config.weightingId === 'rankSum') {
    weightingParameters.push({
      name: 'Rank Sum Parameters',
      rows: [
        ['Parameter', 'Value'],
        ['Criterion order', String(config.methodParams.rankSumOrder ?? config.criteria.map((item) => item.id).join(','))],
      ],
    });
  }
  if (config.weightingId === 'rankReciprocal') {
    weightingParameters.push({
      name: 'Rank Reciprocal Parameters',
      rows: [
        ['Parameter', 'Value'],
        ['Criterion order', String(config.methodParams.rankReciprocalOrder ?? config.criteria.map((item) => item.id).join(','))],
      ],
    });
  }
  if (config.weightingId === 'rancom') {
    weightingParameters.push({
      name: 'RANCOM Parameters',
      rows: [
        ['Parameter', 'Value'],
        ['Rank positions', String(config.methodParams.rancomRanks ?? config.criteria.map((_, index) => index + 1).join(','))],
        ['Guidance', 'Use lower numbers for more important criteria. Equal ranks are allowed for ties.'],
      ],
    });
  }
  if (config.weightingId === 'merecG') {
    weightingParameters.push({
      name: 'MEREC-G Parameters',
      rows: [
        ['Parameter', 'Value'],
        ['Mode', 'Objective geometric removal-effect weights'],
        ['Input requirement', 'Decision matrix values are converted to positive safe values during calculation'],
      ],
    });
  }
  if (config.weightingId === 'wenslo') {
    weightingParameters.push({
      name: 'WENSLO Parameters',
      rows: [
        ['Parameter', 'Value'],
        ['Mode', 'Objective envelope-slope weights'],
        ['Normalization', 'Column-share normalization'],
        ['Class interval', 'Sturges rule'],
        ['Guidance', 'Weights are calculated from the envelope-to-slope ratio of each normalized criterion column.'],
      ],
    });
  }
  if (config.weightingId === 'angular') {
    weightingParameters.push({
      name: 'Angular Parameters',
      rows: [
        ['Parameter', 'Value'],
        ['Mode', 'Objective angular weights'],
        ['Normalization', 'Benefit/cost adjusted min-max normalization'],
        ['Reference vector', 'Equal distribution vector'],
        ['Guidance', 'Weights are calculated from each criterion column angle relative to an equal reference vector.'],
      ],
    });
  }
  if (config.weightingId === 'gini') {
    weightingParameters.push({
      name: 'Gini Parameters',
      rows: [
        ['Parameter', 'Value'],
        ['Mode', 'Objective Gini coefficient weights'],
        ['Normalization', 'Benefit/cost adjusted min-max normalization'],
        ['Guidance', 'Weights are calculated from dispersion in each normalized criterion column using the Gini coefficient.'],
      ],
    });
  }
  if (config.weightingId === 'mpsi') {
    weightingParameters.push({
      name: 'MPSI Parameters',
      rows: [
        ['Parameter', 'Value'],
        ['Mode', 'Modified Preference Selection Index objective weights'],
        ['Normalization', 'Benefit: x/max; cost: min/x'],
        ['Preference variation', 'Squared deviation from criterion mean'],
        ['Guidance', 'Weights are calculated from normalized preference-value variation in each criterion column.'],
      ],
    });
  }
  if (config.weightingId === 'cimas') {
    weightingParameters.push({
      name: 'CIMAS Parameters',
      rows: [
        ['Parameter', 'Value'],
        ['Mode', 'Criteria Importance Assessment objective weights'],
        ['Normalization', 'Benefit/cost adjusted linear min-max normalization'],
        ['Distance measure', 'Per-criterion maximum minus minimum normalized value'],
        ['Guidance', 'Weights are calculated from each criterion range after linear normalization. Larger max-min spread means higher criterion importance.'],
      ],
    });
  }
  const usesNativeFuzzy = String(config.methodParams.fuzzyInputMode ?? '').startsWith('Native fuzzy');
  const requiredWorkbookAreas = usesManualWeights
    ? 'Fill Alternatives, Criteria, Decision Matrix, Weights, and Method Parameters. Do not rename sheets.'
    : 'Fill Alternatives, Criteria, Decision Matrix, and Method Parameters. Do not rename sheets. Weights are calculated by the selected weighting method during analysis.';
  const sampleCell = (rowIndex: number, columnIndex: number) => {
    const crisp = (rowIndex + 2) * (columnIndex + 3);
    if (!usesNativeFuzzy) return crisp;
    return columnIndex % 2 === 0
      ? `(${crisp - 1},${crisp},${crisp + 1})`
      : `(${crisp - 1},${crisp},${crisp + 1},${crisp + 2})`;
  };
  const sampleRows = config.alternatives.map((alternative, rowIndex) => [
    alternative.id,
    ...config.criteria.map((_, columnIndex) => sampleCell(rowIndex, columnIndex)),
  ]);
  return [
    {
      name: 'Instructions',
      rows: [
        ['MCDM Studio Template'],
        ['Method', methodName],
        [requiredWorkbookAreas],
        [usesManualWeights ? 'Criterion Direction values must be benefit or cost. Manual weights should sum to 1.' : `${weightingLabel} weighting is selected. This template intentionally has no editable manual-weight cells; the app calculates and reports the applied weights during analysis.`],
        ['Data collection', usesGroupData ? 'For multiple respondents, fill Respondent 1, Respondent 2, etc. The app aggregates respondent matrices before analysis.' : 'Use the Decision Matrix sheet as the already collected or already aggregated study dataset.'],
        ['Group aggregation', usesGroupData ? `${respondentAggregation} is used for respondent decision matrices. AHP pairwise respondent judgments are aggregated by geometric mean.` : 'No respondent aggregation is applied in single-dataset mode.'],
        ['Fuzzy values', usesNativeFuzzy ? 'Use (l,m,u) for triangular or (a,b,c,d) for trapezoidal values; native fuzzy mode preserves fuzzy values through supported fuzzy method tables.' : 'Use (l,m,u) for triangular or (a,b,c,d) for trapezoidal values; uploaded fuzzy cells are defuzzified by centroid before analysis.'],
        ['Tip', 'This template includes sample numeric values. Replace them with your research data before upload.'],
      ],
    },
    {
      name: 'Study Settings',
      rows: [
        ['Field', 'Value'],
        ['Title', config.title],
        ['Method', methodName],
        ['Weighting', config.weightingId],
        ['Data input mode', String(config.methodParams.dataInputMode ?? 'Single aggregated dataset')],
        ['Respondent count', String(config.methodParams.respondentCount ?? 1)],
        ['Respondent aggregation', respondentAggregation],
        ['Fuzzy input mode', fuzzyMode],
        ['Fuzzy number support', fuzzyTemplateGuidance(fuzzyMode)],
        ...(config.methodParams.fuzzyInputMode === 'Native fuzzy MULTIMOORA' ? [['Native fuzzy MULTIMOORA', 'MULTIMOORA preserves triangular/trapezoidal cells across ratio, reference point, and multiplicative components.']] : []),
        ...(config.methodParams.fuzzyInputMode === 'Native fuzzy PSI' ? [['Native fuzzy PSI', 'PSI preserves triangular/trapezoidal cells for fuzzy normalization and objective weights derived from centroid variation.']] : []),
        ...(config.methodParams.fuzzyInputMode === 'Native fuzzy SPOTIS' ? [['Native fuzzy SPOTIS', 'SPOTIS preserves triangular/trapezoidal cells for fuzzy distance scoring from observed or manual ideal bounds.']] : []),
        ...(config.methodParams.fuzzyInputMode === 'Native fuzzy WEDBA' ? [['Native fuzzy WEDBA', 'WEDBA preserves triangular/trapezoidal cells for fuzzy normalization, standardization, and ideal/anti-ideal distance scoring.']] : []),
        ...(config.methodParams.fuzzyInputMode === 'Native fuzzy TODIM' ? [['Native fuzzy TODIM', 'TODIM preserves triangular/trapezoidal cells for fuzzy normalized pairwise gain/loss dominance.']] : []),
        ...(config.methodParams.fuzzyInputMode === 'Native fuzzy PROMETHEE' ? [['Native fuzzy PROMETHEE', 'PROMETHEE preserves triangular/trapezoidal cells for fuzzy pairwise preference indices and net outranking flows.']] : []),
        ...(config.methodParams.fuzzyInputMode === 'Native fuzzy ELECTRE' ? [['Native fuzzy ELECTRE', 'ELECTRE preserves triangular/trapezoidal cells for fuzzy concordance, discordance, and thresholded outranking.']] : []),
        ...(config.methodParams.fuzzyInputMode === 'Native fuzzy ERVD' ? [['Native fuzzy ERVD', 'ERVD preserves triangular/trapezoidal cells for fuzzy utility mapping and gain/loss distances from the reference point.']] : []),
        ...Object.entries(config.methodParams).map(([key, value]) => [key, String(value)]),
      ],
    },
    {
      name: 'Alternatives',
      rows: [['Alternative ID', 'Alternative Name'], ...config.alternatives.map((item) => [item.id, item.name])],
    },
    {
      name: 'Criteria',
      rows: [
        usesManualWeights ? ['Criterion ID', 'Criterion Name', 'Direction', weightHeader] : ['Criterion ID', 'Criterion Name', 'Direction'],
        ...config.criteria.map((item) => usesManualWeights ? [item.id, item.name, item.direction, item.weight] : [item.id, item.name, item.direction]),
      ],
    },
    {
      name: 'Decision Matrix',
      rows: [
        ['Alternative ID', ...config.criteria.map((item) => item.id)],
        ...sampleRows,
      ],
    },
    ...(includesWeightSheet ? [{
      name: 'Weights',
      rows: [['Criterion ID', weightHeader], ...config.criteria.map((item) => [item.id, usesManualWeights ? item.weight : `${calculatedWeightLabel} during analysis`])],
    }] : []),
    ...(!usesManualWeights && config.weightingId !== 'ahp' ? [{
      name: 'Calculated Weights Guide',
      rows: [
        ['Selected weighting method', weightingLabel],
        ['Editable weight cells', 'Not used'],
        ['How weights are produced', 'The app calculates the criterion weights from the uploaded decision matrix or configured weighting judgments during analysis.'],
        ['Where to review them', 'Open Results > Input Summary or Visualizations after analysis. The exported Excel/DOCX/PDF reports include the applied weights.'],
      ],
    }] : []),
    {
      name: 'Method Parameters',
      rows: [['Parameter', 'Value'], ...parameters.map((parameter) => [parameter, String(config.methodParams[parameter] ?? '')])],
    },
    {
      name: 'Group Decision Guide',
      rows: [
        ['Topic', 'How this template is processed'],
        ['Respondent decision matrices', usesGroupData ? `Fill Respondent 1 through Respondent ${respondentCount}. These matrices are aggregated by ${respondentAggregation} before running ${methodName}.` : 'Not used in single-dataset mode; the Decision Matrix sheet is analyzed directly.'],
        ['AHP pairwise respondent matrices', 'When AHP is the selected method or weighting source, AHP Criteria Respondent sheets are aggregated by geometric mean because pairwise judgments are ratio-scale data.'],
        ['Manual weights with respondents', 'Manual weights apply after the respondent decision matrix has been aggregated.'],
        ['Objective weights with respondents', 'Objective weights are calculated from the aggregated respondent decision matrix.'],
        ['Fuzzy respondent cells', usesNativeFuzzy ? `${fuzzyMode} preserves aggregated triangular/trapezoidal respondent cells for native fuzzy calculations where this method supports them.` : 'Fuzzy respondent cells are defuzzified by centroid after parsing and before the crisp method run.'],
        ['Fuzzy syntax', 'Triangular: (l,m,u). Trapezoidal: (a,b,c,d). Values must be in nondecreasing order.'],
      ],
    },
    ...Array.from({ length: usesGroupData ? respondentCount : 0 }, (_, index) => ({
      name: `Respondent ${index + 1}`,
      rows: [
        ['Alternative ID', ...config.criteria.map((item) => item.id)],
        ...sampleRows,
      ],
    })),
    ...weightingParameters,
  ];
}

export function createMethodTemplate(methodId: MethodId, methodName: string, config: StudyConfig, parameters: string[]): TemplateSheet[] {
  const base = createBaseTemplate(methodName, config, parameters);
  if (methodId === 'topsis') {
    return [
      ...base,
      { name: 'Criterion Types', rows: [['Criterion ID', 'Type'], ...config.criteria.map((item) => [item.id, item.direction])] },
      { name: 'Normalization Settings', rows: [['Setting', 'Value'], ['Normalization', String(config.methodParams.normalization)], ['Distance metric', String(config.methodParams.distanceMetric)], ['Ideal solution', String(config.methodParams.idealSolution)]] },
    ];
  }
  if (methodId === 'ahp') {
    const pairwise = config.ahpCriteriaPairwise ?? [];
    const alternativePairwise = config.ahpAlternativePairwise ?? {};
    const usesAHPRespondents = String(config.methodParams.dataInputMode ?? 'Single aggregated dataset') === 'Multiple respondents';
    const respondentCount = usesAHPRespondents ? Math.max(1, Number(config.methodParams.ahpRespondentCount ?? config.methodParams.respondentCount) || 1) : 0;
    return [
      ...base,
      { name: 'Criteria Pairwise Matrix', rows: [['Criterion', ...config.criteria.map((item) => item.id)], ...config.criteria.map((row, rowIndex) => [row.id, ...config.criteria.map((_, columnIndex) => rowIndex === columnIndex ? 1 : pairwise[rowIndex]?.[columnIndex] ?? '')])] },
      ...Array.from({ length: respondentCount }, (_, index) => ({ name: `AHP Criteria Respondent ${index + 1}`, rows: [['Criterion', ...config.criteria.map((item) => item.id)], ...config.criteria.map((row, rowIndex) => [row.id, ...config.criteria.map((_, columnIndex) => rowIndex === columnIndex ? 1 : pairwise[rowIndex]?.[columnIndex] ?? '')])] })),
      { name: 'Alternative Pairwise Matrices', rows: [
        ['Criterion', 'Alternative', ...config.alternatives.map((item) => item.id)],
        ...config.criteria.flatMap((criterion) => config.alternatives.map((alternative, rowIndex) => [
          criterion.id,
          alternative.id,
          ...config.alternatives.map((_, columnIndex) => rowIndex === columnIndex ? 1 : alternativePairwise[criterion.id]?.[rowIndex]?.[columnIndex] ?? 1),
        ])),
      ] },
      ...Array.from({ length: respondentCount }, (_, index) => ({ name: `AHP Alternatives Respondent ${index + 1}`, rows: [
        ['Criterion', 'Alternative', ...config.alternatives.map((item) => item.id)],
        ...config.criteria.flatMap((criterion) => config.alternatives.map((alternative, rowIndex) => [
          criterion.id,
          alternative.id,
          ...config.alternatives.map((_, columnIndex) => rowIndex === columnIndex ? 1 : alternativePairwise[criterion.id]?.[rowIndex]?.[columnIndex] ?? 1),
        ])),
      ] })),
      { name: 'Consistency Settings', rows: [['Metric', 'Value'], ['Threshold', String(config.methodParams.ahpConsistencyThreshold)], ['Pairwise mode', String(config.methodParams.ahpPairwiseMode)], ['Fuzzy input mode', String(config.methodParams.fuzzyInputMode ?? 'Defuzzify on upload')], ['Fuzzy pairwise guidance', 'Use positive triangular values like (1,2,3) or trapezoidal values like (1,2,3,4); reciprocal cells may be filled explicitly or inferred by the app.']] },
    ];
  }
  if (methodId === 'vikor') {
    const advantageMode = String(config.methodParams.vikorAcceptableAdvantageMode ?? 'Auto DQ = 1/(m-1)');
    const autoDQ = 1 / Math.max(config.alternatives.length - 1, 1);
    const dq = advantageMode === 'Manual DQ' ? Number(config.methodParams.vikorAcceptableAdvantageDQ ?? autoDQ) : autoDQ;
    return [...base, { name: 'VIKOR Parameters', rows: [['Parameter', 'Value'], ['v', String(config.methodParams.vikorV)], ['Acceptable advantage mode', advantageMode], ['Acceptable advantage DQ', String(dq)], ['Stability rule', String(config.methodParams.vikorStabilityRule ?? 'Q winner must also lead S or R')]] }];
  }
  if (methodId === 'waspas') {
    return [...base, { name: 'Lambda Settings', rows: [['Parameter', 'Value'], ['lambda', String(config.methodParams.waspasLambda)]] }];
  }
  if (methodId === 'srp') {
    return [...base, { name: 'SRP Settings', rows: [['Parameter', 'Value'], ['Rank mode', String(config.methodParams.srpRankMode ?? 'Criterion-wise rank aggregation')], ['Normalization', 'Not used'], ['Scoring', 'Ranks are multiplied by criterion weights; final preference score is alternatives count minus weighted rank score'], ['Ranking', 'Higher preference score ranks higher']] }];
  }
  if (methodId === 'fuca') {
    return [...base, { name: 'FUCA Settings', rows: [['Parameter', 'Value'], ['Rank mode', String(config.methodParams.fucaRankMode ?? 'Weighted criterion-wise ranks')], ['Normalization', 'Not used'], ['Scoring', 'Ranks are multiplied by criterion weights and summed'], ['Ranking', 'Lower weighted rank score ranks higher']] }];
  }
  if (methodId === 'seca') {
    return [...base, { name: 'SECA Settings', rows: [['Parameter', 'Value'], ['epsilon', String(config.methodParams.secaEpsilon ?? 0.001)], ['reference balance', String(config.methodParams.secaReferenceBalance ?? 0.5)], ['Weighting', 'SECA derives objective weights internally from performance, standard deviation, and correlation reference points'], ['Scoring', 'Weighted sum of SECA-normalized values; higher score ranks higher']] }];
  }
  if (methodId === 'dear') {
    return [...base, { name: 'DEAR Settings', rows: [['Parameter', 'Value'], ['Aggregation', String(config.methodParams.dearAggregation ?? 'Mean response performance index')], ['Benefit criteria', 'Response weight = value divided by column sum'], ['Cost criteria', 'Response weight = reciprocal value divided by reciprocal column sum'], ['Scoring', 'Weighted multi-response performance index; higher score ranks higher']] }];
  }
  if (methodId === 'eamr') {
    return [...base, { name: 'EAMR Settings', rows: [['Parameter', 'Value'], ['beta', String(config.methodParams.eamrBeta ?? 0.5)], ['lambda', String(config.methodParams.eamrLambda ?? 0.5)], ['Normalization', 'Range-normalized and vector-normalized matrices are blended by beta'], ['Scoring', 'Benefit and cost-control weighted sums are combined by lambda; higher score ranks higher']] }];
  }
  if (methodId === 'rawec') {
    return [...base, { name: 'RAWEC Settings', rows: [['Parameter', 'Value'], ['Normalization', 'Double normalization: one benefit-oriented and one cost-oriented matrix'], ['Deviation', 'Weighted deviations from the ideal normalized value 1 are summed for both normalizations'], ['Scoring', "Q = (v' - v) / (v' + v); higher Q ranks higher"]] }];
  }
  if (methodId === 'comet') {
    const mode = String(config.methodParams.cometCharacteristicValues ?? 'min,mid,max');
    const sampleCharacteristicValues = config.criteria.map((criterion, index) => {
      const baseValue = (index + 2) * 10;
      return [
        criterion.id,
        criterion.name,
        criterion.direction,
        mode === 'min,max' ? `${baseValue},${baseValue + 20}` : mode === 'quartiles' ? `${baseValue},${baseValue + 5},${baseValue + 10},${baseValue + 15},${baseValue + 20}` : `${baseValue},${baseValue + 10},${baseValue + 20}`,
      ];
    });
    return [
      ...base,
      {
        name: 'COMET Settings',
        rows: [
          ['Parameter', 'Value'],
          ['Characteristic values', mode],
          ['Preference model', String(config.methodParams.cometPreferenceModel ?? 'Weight-directed preference')],
          ['Guidance', 'The app generates characteristic objects from criterion characteristic values, evaluates preference values, then interpolates alternatives by fuzzy membership.'],
        ],
      },
      {
        name: 'Characteristic Values',
        rows: [
          ['Criterion ID', 'Criterion Name', 'Direction', 'Characteristic Values'],
          ...sampleCharacteristicValues,
        ],
      },
    ];
  }
  if (methodId === 'moosra') {
    return [...base, { name: 'MOOSRA Settings', rows: [['Parameter', 'Value'], ['Normalization', String(config.methodParams.normalization ?? 'Vector normalization')], ['Scoring', 'Weighted benefit objective sum divided by weighted cost objective sum'], ['Ranking', 'Higher MOOSRA ratio ranks higher']] }];
  }
  if (methodId === 'arlon') {
    return [...base, { name: 'ARLON Settings', rows: [['Parameter', 'Value'], ['Gamma', String(config.methodParams.arlonGamma ?? 0.5)], ['Normalization', 'Two-step product-log normalization with zero/negative protection through absolute safe values'], ['Kappa', 'Benefit criteria count divided by total criteria count'], ['Scoring', 'R = B^kappa + C^(1-kappa), with all-benefit or all-cost studies using the available component directly; higher values rank higher']] }];
  }
  if (methodId === 'macont') {
    return [...base, { name: 'MACONT Settings', rows: [['Parameter', 'Value'], ['lambda', String(config.methodParams.macontLambda ?? 0.3333)], ['mu', String(config.methodParams.macontMu ?? 0.3333)], ['delta', String(config.methodParams.macontDelta ?? 0.5)], ['theta', String(config.methodParams.macontTheta ?? 0.5)], ['Normalization', 'Sum-based, ratio-based, and range-based matrices are blended by lambda, mu, and 1-lambda-mu'], ['Reference alternative', 'Average comprehensive normalized value by criterion'], ['Scoring', 'Mixed aggregation score S; higher values rank higher']] }];
  }
  if (methodId === 'aroman') {
    return [...base, { name: 'AROMAN Settings', rows: [['Parameter', 'Value'], ['beta', String(config.methodParams.aromanBeta ?? 0.5)], ['lambda', String(config.methodParams.aromanLambda ?? 0.5)], ['Normalization', 'Blended linear and vector normalization'], ['Scoring', 'Benefit and cost weighted sums are combined by lambda']] }];
  }
  if (methodId === 'cobra') {
    return [...base, { name: 'COBRA Settings', rows: [['Parameter', 'Value'], ['Distance model', String(config.methodParams.cobraDistanceMode ?? 'Euclidean and taxicab')], ['Reference solutions', 'Positive ideal, negative ideal, and average solution']] }];
  }
  if (methodId === 'cradis') {
    return [...base, { name: 'CRADIS Settings', rows: [['Parameter', 'Value'], ['Normalization', String(config.methodParams.normalization ?? 'Ratio normalization')], ['Reference solutions', 'Ideal and anti-ideal weighted normalized criteria'], ['Scoring', 'Average of ideal-closeness and anti-ideal-separation utility coefficients']] }];
  }
  if (methodId === 'psi') {
    return [...base, { name: 'PSI Settings', rows: [['Parameter', 'Value'], ['Normalization', String(config.methodParams.normalization ?? 'Linear normalization')], ['Scoring convention', String(config.methodParams.psiScoreMode ?? 'Criterion objective weights')], ['Guidance', 'Criterion objective weights derives weights from criterion variation. Alternative preference index reproduces the JMcDM/original PSI worked-example convention.']] }];
  }
  if (methodId === 'mara') {
    return [...base, { name: 'MARA Settings', rows: [['Parameter', 'Value'], ['Normalization', String(config.methodParams.normalization ?? 'MPSI-style normalization')], ['Optimal alternative', 'Best weighted normalized value by criterion'], ['Scoring', 'Magnitude of area gap from the optimal alternative; smaller values rank higher']] }];
  }
  if (methodId === 'raps') {
    return [...base, { name: 'RAPS Settings', rows: [['Parameter', 'Value'], ['Normalization', String(config.methodParams.normalization ?? 'MPSI-style normalization')], ['Optimal alternative', 'Best weighted normalized value by criterion'], ['Scoring', 'Perimeter similarity to the optimal alternative; higher values rank higher']] }];
  }
  if (methodId === 'oreste') {
    return [...base, { name: 'ORESTE Settings', rows: [['Parameter', 'Value'], ['Rank model', String(config.methodParams.oresteRankModel ?? 'Besson projection ranks')], ['Criterion preference order', 'Derived from selected criterion weights'], ['Alternative preference order', 'Derived within each criterion using benefit/cost direction'], ['Scoring', 'Average global projection rank; smaller values rank higher']] }];
  }
  if (methodId === 'qualiflex') {
    return [...base, { name: 'QUALIFLEX Settings', rows: [['Parameter', 'Value'], ['Exact permutation limit', String(config.methodParams.qualiflexExactLimit ?? 7)], ['Pairwise evidence', 'Weighted concordance/discordance by criterion direction'], ['Scoring', 'Best ranking order maximizes the comprehensive concordance/discordance index'], ['Large studies', 'When alternatives exceed the exact limit, the app uses a deterministic pairwise net fallback to avoid browser lockups']] }];
  }
  if (methodId === 'regime') {
    return [...base, { name: 'REGIME Settings', rows: [['Parameter', 'Value'], ['Preference model', String(config.methodParams.regimePreferenceModel ?? 'Weighted sign dominance')], ['Pairwise evidence', 'Positive, neutral, or negative criterion dominance by benefit/cost direction'], ['Scoring', 'Net dominance flow; higher values rank higher']] }];
  }
  if (methodId === 'grp') {
    return [...base, { name: 'GRP Settings', rows: [['Parameter', 'Value'], ['Distinguishing coefficient zeta', String(config.methodParams.graZeta ?? 0.5)], ['Input scale', String(config.methodParams.grpInputScale ?? 'Normalize raw values')], ['Reference sequences', 'Positive and negative ideals come from the comparable matrix'], ['Scoring', 'Relative closeness from squared-weight grey relational projections']] }];
  }
  if (methodId === 'evamix') {
    return [...base, { name: 'EVAMIX Settings', rows: [['Parameter', 'Value'], ['Data mode', String(config.methodParams.evamixDataMode ?? 'Cardinal numeric criteria')], ['Ordinal criterion IDs', String(config.methodParams.evamixOrdinalCriteria ?? 'none')], ['Normalization', 'Benefit/cost-aware range normalization'], ['Dominance', 'Separate ordinal and cardinal pairwise dominance, then additive-interval standardization'], ['Appraisal', 'Inverse incoming/outgoing dominance-ratio score; higher score is better']] }];
  }
  if (methodId === 'ervd') {
    return [
      ...base,
      {
        name: 'ERVD Reference Point',
        rows: [
          ['Criterion ID', 'Reference Value', 'Mode'],
          ...config.criteria.map((item, index) => [
            item.id,
            String(config.methodParams.ervdReferencePoint ?? '').split(',')[index]?.trim() || '',
            String(config.methodParams.ervdReferenceMode ?? 'Observed mean'),
          ]),
        ],
      },
      { name: 'ERVD Settings', rows: [['Parameter', 'Value'], ['lambda', String(config.methodParams.ervdLambda ?? 2.25)], ['alpha', String(config.methodParams.ervdAlpha ?? 0.88)]] },
    ];
  }
  if (methodId === 'spotis') {
    return [
      ...base,
      {
        name: 'SPOTIS Bounds',
        rows: [
          ['Criterion ID', 'Lower Bound', 'Upper Bound', 'Mode'],
          ...config.criteria.map((item, index) => [
            item.id,
            String(config.methodParams.spotisLowerBounds ?? '').split(',')[index]?.trim() || '',
            String(config.methodParams.spotisUpperBounds ?? '').split(',')[index]?.trim() || '',
            String(config.methodParams.spotisBounds ?? 'Observed data range'),
          ]),
        ],
      },
    ];
  }
  if (methodId === 'espSpotis') {
    return [
      ...base,
      {
        name: 'ESP-SPOTIS Point',
        rows: [
          ['Criterion ID', 'Expected Point', 'Lower Bound', 'Upper Bound', 'Bounds Mode'],
          ...config.criteria.map((item, index) => [
            item.id,
            String(config.methodParams.espSpotisPoint ?? '').split(',')[index]?.trim() || '',
            String(config.methodParams.spotisLowerBounds ?? '').split(',')[index]?.trim() || '',
            String(config.methodParams.spotisUpperBounds ?? '').split(',')[index]?.trim() || '',
            String(config.methodParams.espSpotisBounds ?? 'Observed data range'),
          ]),
        ],
      },
    ];
  }
  if (methodId === 'balancedSpotis') {
    return [
      ...base,
      {
        name: 'B-SPOTIS Settings',
        rows: [
          ['Criterion ID', 'Expected Point', 'Lower Bound', 'Upper Bound', 'Bounds Mode', 'Alpha'],
          ...config.criteria.map((item, index) => [
            item.id,
            String(config.methodParams.espSpotisPoint ?? '').split(',')[index]?.trim() || '',
            String(config.methodParams.spotisLowerBounds ?? '').split(',')[index]?.trim() || '',
            String(config.methodParams.spotisUpperBounds ?? '').split(',')[index]?.trim() || '',
            String(config.methodParams.balancedSpotisBounds ?? 'Observed data range'),
            index === 0 ? String(config.methodParams.balancedSpotisAlpha ?? 0.5) : '',
          ]),
        ],
      },
    ];
  }
  if (methodId === 'rim') {
    return [
      ...base,
      {
        name: 'RIM Ideal Intervals',
        rows: [
          ['Criterion ID', 'Domain Lower', 'Domain Upper', 'Ideal Lower', 'Ideal Upper', 'Mode'],
          ...config.criteria.map((item, index) => [
            item.id,
            String(config.methodParams.rimDomainLower ?? '').split(',')[index]?.trim() || '',
            String(config.methodParams.rimDomainUpper ?? '').split(',')[index]?.trim() || '',
            String(config.methodParams.rimIdealLower ?? '').split(',')[index]?.trim() || '',
            String(config.methodParams.rimIdealUpper ?? '').split(',')[index]?.trim() || '',
            String(config.methodParams.rimReference ?? 'Observed ideal point'),
          ]),
        ],
      },
    ];
  }
  if (methodId === 'rafsi') {
    return [
      ...base,
      {
        name: 'RAFSI Interval',
        rows: [
          ['Parameter', 'Value'],
          ['Reference mode', String(config.methodParams.rafsiReferenceMode ?? 'Observed extremes')],
          ['Interval lower bound', String(config.methodParams.rafsiIntervalLower ?? 1)],
          ['Interval upper bound', String(config.methodParams.rafsiIntervalUpper ?? 6)],
          ['Reference values', config.methodParams.rafsiReferenceMode === 'Manual reference values' ? 'Manual ideal and anti-ideal by criterion' : 'Observed ideal and anti-ideal by criterion direction'],
        ],
      },
      {
        name: 'RAFSI Reference Values',
        rows: [
          ['Criterion ID', 'Ideal Value', 'Anti-Ideal Value'],
          ...config.criteria.map((criterion, index) => [
            criterion.id,
            String(config.methodParams.rafsiIdealValues ?? '').split(',')[index]?.trim() || '',
            String(config.methodParams.rafsiAntiIdealValues ?? '').split(',')[index]?.trim() || '',
          ]),
        ],
      },
    ];
  }
  if (methodId === 'lopm') {
    return [
      ...base,
      {
        name: 'LoPM Property Limits',
        rows: [
          ['Criterion ID', 'Property Type', 'Property Limit', 'Mode'],
          ...config.criteria.map((item, index) => [
            item.id,
            String(config.methodParams.lopmPropertyTypes ?? '').split(',')[index]?.trim() || (item.direction === 'benefit' ? 'lower' : 'upper'),
            String(config.methodParams.lopmPropertyLimits ?? '').split(',')[index]?.trim() || '',
            String(config.methodParams.lopmLimitsMode ?? 'Observed limits'),
          ]),
        ],
      },
    ];
  }
  if (methodId === 'promethee') {
    return [
      ...base,
      {
        name: 'PROMETHEE Settings',
        rows: [
          ['Setting', 'Value'],
          ['Preference function', String(config.methodParams.preferenceFunction ?? 'Usual')],
          ['Indifference threshold q', String(config.methodParams.prometheeIndifferenceThreshold ?? 0)],
          ['Preference threshold p', String(config.methodParams.prometheePreferenceThreshold ?? 1)],
          ['Gaussian sigma', String(config.methodParams.prometheeGaussianSigma ?? 1)],
          ['Weighting', config.weightingId],
          ['Guidance', 'Usual uses no thresholds; U-shape uses q; V-shape uses p; Level and Linear use q and p; Gaussian uses sigma.'],
        ],
      },
    ];
  }
  if (methodId === 'marcos') {
    return [...base, {
      name: 'MARCOS Settings',
      rows: [
        ['Parameter', 'Value'],
        ['Normalization', String(config.methodParams.normalization ?? 'Utility normalization')],
        ['Ranking convention', String(config.methodParams.marcosScoreMode ?? 'Standard utility function f(K)')],
        ['Guidance', 'Standard MARCOS ranks by f(K). Some published examples use range-scaled K- and rank by f(K+); select that convention only when reproducing such a source.'],
      ],
    }];
  }
  if (methodId === 'lmaw') {
    return [...base, {
      name: 'LMAW Settings',
      rows: [
        ['Parameter', 'Value'],
        ['Scaling', String(config.methodParams.lmawScaling ?? 'Log additive scaling')],
        ['Scoring convention', String(config.methodParams.lmawScoreMode ?? 'Nonlinear Q utility')],
        ['Normalization', 'Positive standardization followed by logarithmic additive transformation.'],
        ['Scoring', 'Nonlinear Q utility follows the original LMAW/JMcDM convention; weighted log sum is retained for continuity.'],
      ],
    }];
  }
  if (methodId === 'dnma') {
    return [...base, { name: 'DNMA Settings', rows: [['Parameter', 'Value'], ['Integration', String(config.methodParams.dnmaIntegration ?? 'Utility and rank integration')], ['CCM/UCM/ICM weights', String(config.methodParams.dnmaModelWeights ?? '0.6,0.1,0.3')], ['Utility-rank balance phi', String(config.methodParams.dnmaPhi ?? 0.5)], ['Scoring', 'Adjusted weights, CCM minus UCM plus ICM utility-rank integration']] }];
  }
  if (['copras', 'saw', 'wpm', 'moora', 'arlon', 'macont', 'aras', 'edas', 'mabac', 'codas', 'cocoso', 'marcos', 'mairca', 'promethee', 'electre', 'smart', 'maut', 'ocra', 'multimoora', 'psi', 'piv', 'rov', 'wisp', 'todim', 'ram', 'gra', 'spotis', 'espSpotis', 'balancedSpotis', 'wedba', 'lmaw', 'probid', 'sprobid', 'rim', 'rafsi', 'lopm', 'aroman', 'cobra', 'ervd'].includes(methodId)) {
    return [
      ...base,
      { name: excelSafeSheetName(`${methodName} Settings`), rows: [['Setting', 'Value'], ['Normalization/reference', String(config.methodParams.normalization ?? config.methodParams.reference ?? 'Method default')], ['Weighting', config.weightingId]] },
    ];
  }
  if (methodId === 'dematel') {
    const factors = config.criteria;
    const requestedDataMode = String(config.methodParams.dataInputMode ?? 'Single expert matrix');
    const dataInputMode = ['Single expert matrix', 'Multiple experts'].includes(requestedDataMode) ? requestedDataMode : 'Single expert matrix';
    const usesExpertSheets = dataInputMode === 'Multiple experts';
    const expertCount = usesExpertSheets ? Math.max(1, Number(config.methodParams.dematelExpertCount) || 1) : 0;
    const directRows = factors.map((row, rowIndex) => [
      row.id,
      ...factors.map((_, columnIndex) => rowIndex === columnIndex ? 0 : ((rowIndex + columnIndex) % 4) + 1),
    ]);
    return [
      { name: 'Instructions', rows: [['MCDM Studio DEMATEL Template'], ['Fill the direct relation matrix. Diagonal values must be zero.'], ['Scale', 'Use 0=no influence through 4=very high influence.'], ['Data collection', usesExpertSheets ? 'Fill Expert 1, Expert 2, etc. The app aggregates expert matrices before DEMATEL.' : 'Use Direct Relation Matrix as the already aggregated expert or committee matrix.'], ['Fuzzy values', 'Use (l,m,u) or (a,b,c,d) in direct/expert matrices; uploaded fuzzy cells are defuzzified by centroid.']] },
      { name: 'Study Settings', rows: [['Field', 'Value'], ['Title', config.title], ['Method', methodName], ['Data input mode', dataInputMode], ['Expert count', String(usesExpertSheets ? config.methodParams.dematelExpertCount : 1)], ['Aggregation', usesExpertSheets ? String(config.methodParams.dematelAggregation) : 'Not used'], ['Threshold', String(config.methodParams.dematelThreshold)], ['Manual threshold value', String(config.methodParams.dematelManualThreshold ?? 0.1)], ['Fuzzy input mode', String(config.methodParams.fuzzyInputMode ?? 'Defuzzify on upload')], ['Fuzzy DEMATEL calculation', String(config.methodParams.dematelFuzzyCalculation ?? 'Component-wise fuzzy total relation')], ['Fuzzy number support', 'Triangular and trapezoidal influence judgments are accepted in direct/expert matrices.']] },
      { name: 'Factors', rows: [['Factor ID', 'Factor Name'], ...factors.map((item) => [item.id, item.name])] },
      { name: 'Direct Relation Matrix', rows: [['Factor', ...factors.map((item) => item.id)], ...directRows] },
      { name: 'Threshold Settings', rows: [['Setting', 'Value'], ['Threshold method', String(config.methodParams.dematelThreshold)], ['Manual threshold value', String(config.methodParams.dematelManualThreshold ?? 0.1)], ['Fuzzy DEMATEL calculation', String(config.methodParams.dematelFuzzyCalculation ?? 'Component-wise fuzzy total relation')], ['Guidance', 'Mean threshold uses the average absolute off-diagonal total-relation value; manual threshold uses the value above.']] },
      { name: 'Group Decision Guide', rows: [['Topic', 'How this template is processed'], ['Expert direct-relation matrices', usesExpertSheets ? `Fill Expert 1 through Expert ${expertCount}. Expert matrices are aggregated by ${String(config.methodParams.dematelAggregation ?? 'Arithmetic mean')} before DEMATEL normalization.` : 'Not used in single expert matrix mode.'], ['Direct Relation Matrix', usesExpertSheets ? 'This sheet can hold an already aggregated backup matrix. If expert sheets are present, the app uses the expert aggregation for analysis.' : 'This sheet is analyzed directly as the final direct-relation matrix.'], ['Fuzzy expert cells', 'Component-wise fuzzy total relation preserves triangular/trapezoidal tuples through total-relation matrices. Defuzzify before total relation converts tuples to centroid values before the final causal matrix, matching many applied papers.'], ['Fuzzy syntax', 'Triangular: (l,m,u). Trapezoidal: (a,b,c,d). Values must be in nondecreasing order.']] },
      ...Array.from({ length: expertCount }, (_, index) => ({ name: `Expert ${index + 1}`, rows: [['Factor', ...factors.map((item) => item.id)], ...directRows] })),
    ];
  }
  return base;
}
