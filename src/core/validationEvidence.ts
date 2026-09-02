import type { MethodId } from '../types';

export type ExternalValidationTone = 'validated' | 'candidate' | 'internal';

export interface ExternalValidationStatus {
  label: string;
  tone: ExternalValidationTone;
  text: string;
}

export const validationEvidence = {
  smokeChecks: {
    label: 'Internal workflow and algorithm checks',
    scope: 'Registry integrity, method execution, group data, fuzzy input, zero-value handling, validation rules, templates, reports, and coverage summaries.',
  },
  numericalBenchmarks: {
    label: 'Bundled numerical benchmark checks',
    count: 94,
    scope: 'Known expected rankings and key coefficients for the built-in sample suites.',
  },
  externalBenchmarks: {
    label: 'External published-example validation',
    status: 'In progress',
    count: 48 as number,
    candidateRecords: 5,
    scope: 'TOPSIS, AHP, DEMATEL, VIKOR, COPRAS, WASPAS, SAW/WSM, SRP, FUCA, WPM, MOORA, MOOSRA, MULTIMOORA, MABAC, CODAS, CoCoSo, ARAS, EDAS, PROMETHEE II, ELECTRE I, ORESTE, REGIME, SMART, MAUT, SMARTER, Pugh Matrix, OCRA, ROV, GRA, MARCOS, MAIRCA, PSI, PIV, WISP, RAM, PROBID, SPROBID, LMAW, RIM, RAFSI, SPOTIS, B-SPOTIS, MARA, TODIM, LoPM, AROMAN, COMET, and ERVD external-example fixtures are registered; TOPSIS, CRADIS, and fuzzy DEMATEL discrepancy fixture records are tracked separately; SECA optimizer-backed reference behavior and the richer B-SPOTIS used-car published-example candidate are registry-only validation candidates; paper-by-paper comparisons for every crisp, fuzzy, and group-decision variant are not yet complete.',
  },
} as const;

export const externalValidationFixtures = [
  {
    methodId: 'topsis',
    variant: 'crisp-vector-normalization-ahp-weights-hospital-supplier',
    source: 'Journal of Healthcare Engineering 2019 hospital supplier TOPSIS example',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6811789/',
    doi: '10.1155/2019/5614892',
    scope: 'TOPSIS vector normalization, AHP-derived manual weights, benefit/cost-aware ideal solutions, Euclidean separation distances, closeness coefficients, and final supplier ranking.',
  },
  {
    methodId: 'ahp',
    variant: 'crisp-criteria-priority',
    source: 'Energies 2026 worked AHP example',
    sourceUrl: 'https://www.mdpi.com/1996-1073/19/9/2214',
    doi: '10.3390/en19092214',
    scope: 'AHP 3x3 criteria pairwise matrix, criteria priorities, lambda max, CI, CR, and consistency diagnostic.',
  },
  {
    methodId: 'dematel',
    variant: 'crisp-average-expert-direct-matrix-mean-threshold',
    source: 'Sage Open 2025 collaborative innovation DEMATEL example',
    sourceUrl: 'https://journals.sagepub.com/doi/10.1177/21582440251387390',
    doi: '10.1177/21582440251387390',
    scope: 'DEMATEL average expert direct-relation matrix, row/column normalization factor, total-relation matrix, mean-threshold relation matrix, D/R cause-effect indicators, and prominence ranking.',
  },
  {
    methodId: 'waspas',
    variant: 'crisp-linear-normalization-manual-weights-alpha-0.5',
    source: 'Sage Open 2021 university location WASPAS example',
    sourceUrl: 'https://journals.sagepub.com/doi/10.1177/21582440211040115',
    doi: '10.1177/21582440211040115',
    scope: 'WASPAS benefit/cost linear normalization, manual weights, WSM/WPM components, alpha 0.5 compromise score, and final ranking.',
  },
  {
    methodId: 'saw',
    variant: 'crisp-linear-normalization-manual-weights',
    source: 'Sage Open 2021 university location WSM component example',
    sourceUrl: 'https://journals.sagepub.com/doi/10.1177/21582440211040115',
    doi: '10.1177/21582440211040115',
    scope: 'SAW/WSM benefit/cost linear normalization, manual weights, weighted normalized matrix, additive utility score, and final ranking.',
  },
  {
    methodId: 'srp',
    variant: 'crisp-dense-rank-vimm-weights-material-selection',
    source: 'Scientific Reports 2023 SRP material-selection example',
    sourceUrl: 'https://www.nature.com/articles/s41598-023-35405-z',
    doi: '10.1038/s41598-023-35405-z',
    scope: 'SRP criterion-wise dense ranking, VIMM-derived manual weights, weighted ranking matrix, total ranking scores, and final material ranking.',
  },
  {
    methodId: 'fuca',
    variant: 'crisp-average-rank-manual-weights-mcdabench-example',
    source: 'mcdabench 2026 FUCA reference manual example',
    sourceUrl: 'https://cran.r-universe.dev/mcdabench/doc/manual.html',
    doi: '10.32614/CRAN.package.mcdabench',
    scope: 'FUCA criterion-wise average ranks, benefit/cost orientation, manual weights, weighted-rank score aggregation, and lower-is-better final ranking.',
  },
  {
    methodId: 'wpm',
    variant: 'crisp-linear-normalization-manual-weights',
    source: 'Sage Open 2021 university location WPM component example',
    sourceUrl: 'https://journals.sagepub.com/doi/10.1177/21582440211040115',
    doi: '10.1177/21582440211040115',
    scope: 'WPM benefit/cost linear normalization, manual weights, product utility score, and final ranking.',
  },
  {
    methodId: 'copras',
    variant: 'crisp-column-sum-normalization-manual-weights',
    source: 'Sustainability 2022 clean-energy COPRAS example',
    sourceUrl: 'https://www.mdpi.com/2071-1050/14/3/1403',
    doi: '10.3390/su14031403',
    scope: 'COPRAS column-sum normalization, manual weights, beneficial/non-beneficial sums, relative significance, utility degree, and final ranking.',
  },
  {
    methodId: 'moora',
    variant: 'crisp-ratio-system-manual-weights',
    source: 'Journal of Industrial Engineering International 2017 laptop-selection MOORA example',
    sourceUrl: 'https://doi.org/10.1007/s40092-016-0175-5',
    doi: '10.1007/s40092-016-0175-5',
    scope: 'MOORA ratio-system normalization, manual weights, benefit/cost sums, net assessment score, and final ranking.',
  },
  {
    methodId: 'moosra',
    variant: 'crisp-benefit-cost-ratio-manual-weights',
    source: 'Journal of Industrial Engineering International 2017 laptop-selection MOOSRA example',
    sourceUrl: 'https://doi.org/10.1007/s40092-016-0175-5',
    doi: '10.1007/s40092-016-0175-5',
    scope: 'MOOSRA ratio-system normalization, manual weights, benefit/cost sums, benefit-cost ratio score, and final ranking.',
  },
  {
    methodId: 'multimoora',
    variant: 'crisp-dominance-theory-manual-weights',
    source: 'Journal of Industrial Engineering International 2017 laptop-selection MULTIMOORA example',
    sourceUrl: 'https://doi.org/10.1007/s40092-016-0175-5',
    doi: '10.1007/s40092-016-0175-5',
    scope: 'MULTIMOORA ratio-system, reference-point, full multiplicative form, dominance-theory aggregation, and final ranking.',
  },
  {
    methodId: 'mabac',
    variant: 'crisp-linear-normalization-manual-weights',
    source: 'Mathematics 2024 cross-dock terminal MABAC example',
    sourceUrl: 'https://www.mdpi.com/2227-7390/12/5/736',
    doi: '10.3390/math12050736',
    scope: 'MABAC linear normalization, manual IDOCRIW-derived weights, weighted matrix, border approximation area, distance matrix, and final ranking.',
  },
  {
    methodId: 'codas',
    variant: 'crisp-linear-normalization-manual-weights-tau-0.02',
    source: 'Economic Computation and Economic Cybernetics Studies and Research 2016 robot-selection CODAS example',
    sourceUrl: 'https://www.researchgate.net/publication/308697546_A_new_combinative_distance-based_assessment_CODAS_method_for_multi-criteria_decision-making',
    doi: '10.24818/18423264/50.3.16.07',
    scope: 'CODAS linear normalization, manual weights, negative ideal solution, Euclidean and taxicab distances, relative assessment matrix, and final ranking.',
  },
  {
    methodId: 'cocoso',
    variant: 'crisp-linear-normalization-manual-weights-lambda-0.5',
    source: 'Buildings 2022 stabilized road-mixture CoCoSo example',
    sourceUrl: 'https://www.mdpi.com/2075-5309/12/5/552',
    doi: '10.3390/buildings12050552',
    scope: 'CoCoSo linear normalization, manual MEREC-derived weights, weighted matrix, S/P comparability sequences, appraisal coefficients, and final ranking.',
  },
  {
    methodId: 'aras',
    variant: 'crisp-normalized-matrix-manual-ahp-weights',
    source: 'Frontiers in Public Health 2023 health-monitoring ARAS example',
    sourceUrl: 'https://www.frontiersin.org/journals/public-health/articles/10.3389/fpubh.2023.1341871/full',
    doi: '10.3389/fpubh.2023.1341871',
    scope: 'ARAS published normalized decision matrix, manual AHP-derived weights, weighted normalized matrix, optimality function, utility degree, and final ranking.',
  },
  {
    methodId: 'edas',
    variant: 'crisp-average-solution-manual-weights-set-1',
    source: 'Informatica 2015 original EDAS MCDM comparative-analysis example',
    sourceUrl: 'https://www.researchgate.net/publication/282365682_Multi-Criteria_Inventory_Classification_Using_a_New_Method_of_Evaluation_Based_on_Distance_from_Average_Solution_EDAS',
    doi: '10.15388/Informatica.2015.57',
    scope: 'EDAS average solution, benefit/cost PDA and NDA handling, Set 1 manual weights, appraisal-score ranking, and final ranking.',
  },
  {
    methodId: 'vikor',
    variant: 'crisp-manual-critic-weights-v-0.5',
    source: 'Scientific Reports 2023 nuclear-reactor power-quality CRITIC-VIKOR example',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10279760/',
    doi: '10.1038/s41598-023-36692-2',
    scope: 'VIKOR benefit/cost best-worst regret matrix, manual CRITIC-derived weights, S/R/Q compromise index, acceptable advantage, acceptable stability, and final ranking.',
  },
  {
    methodId: 'promethee',
    variant: 'crisp-usual-hand-computed-r-package',
    source: 'surveyframe R package PROMETHEE II hand-computed usual-function test case',
    sourceUrl: 'https://rdrr.io/cran/surveyframe/src/tests/testthat/test-decision-preference.R',
    doi: '10.1007/978-1-4939-3094-4_6',
    scope: 'PROMETHEE II usual preference function, weighted pairwise preference index, positive flow, negative flow, net flow, and final ranking from a complete hand-computed package test case.',
  },
  {
    methodId: 'oreste',
    variant: 'crisp-alpha-rank-rmcda-example',
    source: 'RMCDA 2025 ORESTE source implementation example',
    sourceUrl: 'https://rdrr.io/cran/RMCDA/src/R/ORESTE.R',
    doi: '10.1016/j.simpa.2025.100762',
    scope: 'ORESTE beneficial/cost alternative ranks, criterion ranks, alpha blended rank indexes, global rank scores, and final ranking.',
  },
  {
    methodId: 'regime',
    variant: 'crisp-weighted-pairwise-rmcda-example',
    source: 'RMCDA 2025 REGIME source implementation example',
    sourceUrl: 'https://rdrr.io/cran/RMCDA/src/R/REGIME.R',
    doi: '10.1016/j.simpa.2025.100762',
    scope: 'REGIME beneficial/cost criterion handling, weighted pairwise dominance signs, dominance flow scores, and final ranking.',
  },
  {
    methodId: 'electre',
    variant: 'crisp-hand-computed-rmcda-package',
    source: 'surveyframe R package ELECTRE I hand-computed RMCDA example',
    sourceUrl: 'https://rdrr.io/cran/surveyframe/src/tests/testthat/test-decision-preference.R',
    doi: '10.2307/2628673',
    scope: 'ELECTRE I complete raw matrix, manual weights, concordance matrix cells, discordance matrix cells, and outranking relation under explicit thresholds.',
  },
  {
    methodId: 'smart',
    variant: 'crisp-positive-ratio-utility-manual-weights',
    source: 'Journal of Physics: Conference Series 2017 SMART student-achievement worked example',
    sourceUrl: 'https://iopscience.iop.org/article/10.1088/1742-6596/930/1/012015',
    doi: '10.1088/1742-6596/930/1/012015',
    scope: 'SMART positive-ratio utility scaling for positive benefit criteria, manual relative weights from 100/80/50 point weights, utility matrix, weighted utility matrix, and final ranking.',
  },
  {
    methodId: 'maut',
    variant: 'crisp-input-utilities-manual-weights-linear',
    source: 'Computer-Aided Civil and Infrastructure Engineering 2009 seismic-retrofitting MAUT example',
    sourceUrl: 'https://onlinelibrary.wiley.com/doi/10.1111/j.1467-8667.2009.00599.x',
    doi: '10.1111/j.1467-8667.2009.00599.x',
    scope: 'MAUT published utility-table validation using input utility values, manual weights, linear utility shape, weighted utility matrix, and final ranking.',
  },
  {
    methodId: 'smarter',
    variant: 'crisp-roc-utility-input-normalized-total',
    source: 'Patient 2011 clinical decision-support SMARTER/MAUT primer',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3049911/',
    doi: '10.2165/11539470-000000000-00000',
    scope: 'SMARTER rank-order centroid weights, published utility-score inputs, ROC-weighted utilities, normalized total scores, and final treatment ranking.',
  },
  {
    methodId: 'pugh',
    variant: 'crisp-uploaded-score-global-rescale-travel-selection',
    source: 'Public Pugh travel-selection worked example following Mistree, Lewis, and Stonis 1994 AIAA qualitative scoring',
    sourceUrl: 'https://github.com/arthurrichards77/mcdm',
    doi: '10.2514/6.1994-4382',
    scope: 'Pugh uploaded qualitative score matrix, global 0-1 rescaling, manual intuition weights, weighted transformed score matrix, and final travel-mode ranking.',
  },
  {
    methodId: 'rov',
    variant: 'crisp-linear-max-min-entropy-weights-fortune500',
    source: 'Gazi University Journal of Science 2021 ROV normalization-technique example',
    sourceUrl: 'https://doi.org/10.35378/gujs.767525',
    doi: '10.35378/gujs.767525',
    scope: 'ROV linear max-min normalization, entropy-derived manual weights, weighted normalized matrix, best/worst utility functions, average utility score, and Fortune 500 financial-performance ranking.',
  },
  {
    methodId: 'ocra',
    variant: 'crisp-relative-distance-manual-weights-tablet-selection',
    source: 'JMcDM OCRA tablet-selection worked example citing Parkan 1994 OCRA foundations',
    sourceUrl: 'https://jbytecode.github.io/JMcDM/stable/mcdms/',
    doi: '10.1002/mde.4090150303',
    scope: 'OCRA relative-distance benefit and cost preference terms, shifted total preference scores, and final tablet-selection ranking.',
  },
  {
    methodId: 'gra',
    variant: 'crisp-minmax-ahp-weights-hospital-supplier',
    source: 'Journal of Healthcare Engineering 2019 hospital supplier GRA example',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6811789/',
    doi: '10.1155/2019/5614892',
    scope: 'GRA min-max normalization convention, AHP-derived manual weights, weighted grey relational coefficients, grey relational grades, and final supplier ranking.',
  },
  {
    methodId: 'marcos',
    variant: 'crisp-utility-normalization-roc-weights',
    source: 'Materia 2026 milling-process MARCOS example',
    sourceUrl: 'https://www.scielo.br/j/rmat/a/Hvrk63YfJLng6kvdxmzwf5k/?lang=en',
    doi: '10.1590/1517-7076-RMAT-2025-0857',
    scope: 'MARCOS utility normalization, ROC weights, range-scaled K- convention, f(K+) ranking, utility table cells, and final milling-process ranking.',
  },
  {
    methodId: 'mairca',
    variant: 'crisp-minmax-gap-rmcda-example',
    source: 'RMCDA 2026 MAIRCA worked example and source implementation',
    sourceUrl: 'https://rdrr.io/cran/RMCDA/src/R/MAIRCA.R',
    doi: '10.3390/su8040372',
    scope: 'MAIRCA min-max normalization, theoretical assessment matrix, real assessment matrix, gap matrix, total gap values, and final ranking by lowest total gap.',
  },
  {
    methodId: 'psi',
    variant: 'crisp-alternative-preference-index-jmcdm',
    source: 'JMcDM 2025 PSI material-selection worked example citing Maniya and Bhatt 2010 PSI foundations',
    sourceUrl: 'https://jbytecode.github.io/JMcDM/stable/mcdms/#PSI',
    doi: '10.1016/j.matdes.2009.11.020',
    scope: 'PSI divide-by-column max/min normalization, alternative preference variation, preference index, final scores, and best material-selection alternative.',
  },
  {
    methodId: 'piv',
    variant: 'crisp-vector-normalization-combined-weights-electric-vehicle',
    source: 'Journal of Applied Engineering Science 2025 electric-vehicle PIV example',
    sourceUrl: 'https://www.engineeringscience.rs/articles/applying-mcdm-methods-for-electric-vehicle-selection-a-comparative-study-between-cradis-and-piv-methods',
    doi: '10.5937/jaes0-56793',
    scope: 'PIV vector normalization, combined manual weights, benefit/cost-aware weighted proximity matrix, overall proximity values, and final electric-vehicle ranking.',
  },
  {
    methodId: 'wisp',
    variant: 'crisp-max-normalization-rmcda-material-selection',
    source: 'RMCDA 2025 WISP material-selection worked example and source implementation',
    sourceUrl: 'https://rdrr.io/cran/RMCDA/src/R/WISP.R',
    doi: '10.1109/TEM.2021.3075783',
    scope: 'WISP max normalization, weighted normalized matrix, sum/product difference and ratio utilities, recalculated utilities, and final material-selection ranking.',
  },
  {
    methodId: 'ram',
    variant: 'crisp-column-sum-root-assessment-pymcdm-example',
    source: 'pymcdm 2026 RAM documentation example',
    sourceUrl: 'https://pymcdm.readthedocs.io/en/master/pymcdm.methods.html#pymcdm.methods.RAM',
    doi: '10.1016/j.jclepro.2023.138695',
    scope: 'RAM column-sum normalization, weighted normalized matrix, S+/S- utility sums, root assessment RI score, and final ranking.',
  },
  {
    methodId: 'todim',
    variant: 'crisp-material-selection-rmcda-example-theta-1',
    source: 'RMCDA 2025 TODIM source implementation example',
    sourceUrl: 'https://rdrr.io/cran/RMCDA/src/R/TODIM.R',
    doi: '10.1016/j.simpa.2025.100762',
    scope: 'TODIM benefit/cost normalization, theta 1 prospect-dominance matrix, normalized dominance scores, and final material-selection ranking.',
  },
  {
    methodId: 'probid',
    variant: 'crisp-vector-normalization-ideal-average-distance-pymcdm-example',
    source: 'pymcdm 2026 PROBID documentation example',
    sourceUrl: 'https://pymcdm.readthedocs.io/en/master/pymcdm.methods.html#pymcdm.methods.PROBID',
    doi: '10.1021/acs.iecr.1c01453',
    scope: 'PROBID vector normalization, weighted normalized matrix, ideal/average/anti-ideal reference distances, preference index, and final ranking.',
  },
  {
    methodId: 'sprobid',
    variant: 'crisp-vector-normalization-simplified-probid-pymcdm-example',
    source: 'pymcdm 2026 SPROBID implementation example',
    sourceUrl: 'https://pymcdm.readthedocs.io/en/master/pymcdm.methods.html#pymcdm.methods.SPROBID',
    doi: '10.1021/acs.iecr.1c01453',
    scope: 'SPROBID vector normalization, weighted normalized matrix, ordered ideal solutions, first/last-quarter ideal-distance aggregation, preference index, and final ranking.',
  },
  {
    methodId: 'rim',
    variant: 'crisp-reference-ideal-index-rmcda-formula',
    source: 'RMCDA 2025 RIM source implementation and original RIM reference',
    sourceUrl: 'https://rdrr.io/cran/RMCDA/src/R/RIM.R',
    doi: '10.1016/j.ins.2015.12.011',
    scope: 'RIM domain bounds, reference ideal intervals, normalized closeness matrix, weighted closeness matrix, positive/negative distances, R index, and final ranking.',
  },
  {
    methodId: 'lmaw',
    variant: 'crisp-nonlinear-q-utility-jmcdm',
    source: 'JMcDM 2025 LMAW logistics worked example citing Pamucar et al. 2021 original LMAW paper',
    sourceUrl: 'https://jbytecode.github.io/JMcDM/stable/mcdms/#LMAW',
    doi: '10.22190/FUME210214031P',
    scope: 'LMAW positive standardization, logarithmic normalization, nonlinear Q utility matrix, final scores, and best logistics alternative.',
  },
  {
    methodId: 'rafsi',
    variant: 'crisp-manual-reference-r-package-example',
    source: 'rafsi R package README/vignette example citing the Mathematics 2020 RAFSI method paper',
    sourceUrl: 'https://rdrr.io/cran/rafsi/f/README.md',
    doi: '10.3390/math8061015',
    scope: 'RAFSI manual ideal/anti-ideal references, functional mapping matrix, arithmetic/harmonic normalized matrix, weighted matrix, and final ranking from the public R package example.',
  },
  {
    methodId: 'lopm',
    variant: 'crisp-manual-property-limits-pymcdm-material-selection',
    source: 'pymcdm LoPM documentation example citing Farag 2020 materials-selection reference',
    sourceUrl: 'https://pymcdm.readthedocs.io/en/master/pymcdm.methods.html#pymcdm.methods.LoPM',
    doi: '10.1201/9781003006091',
    scope: 'LoPM manual lower-limit, upper-limit, and target property requirements, merit components, weighted merit matrix, lower-is-better merit scores, and final material-selection ranking.',
  },
  {
    methodId: 'aroman',
    variant: 'crisp-pymcdm-beta-lambda-example',
    source: 'pymcdm AROMAN documentation example citing the IEEE Access 2023 AROMAN method paper',
    sourceUrl: 'https://pymcdm.readthedocs.io/en/master/pymcdm.methods.html#pymcdm.methods.AROMAN',
    doi: '10.1109/ACCESS.2023.3265818',
    scope: 'AROMAN min-max normalization, vector normalization, beta-averaged blended matrix, weighted matrix, lambda-powered cost/profit components, preference scores, and final ranking.',
  },
  {
    methodId: 'comet',
    variant: 'crisp-minmax-topsis-expert-pymcdm-example',
    source: 'pymcdm COMET documentation example using MethodExpert(TOPSIS) and min/max characteristic values',
    sourceUrl: 'https://pymcdm.readthedocs.io/en/master/pymcdm.methods.html#pymcdm.methods.COMET',
    doi: '10.1002/mcda.1525',
    scope: 'COMET min/max characteristic values, TOPSIS method-expert ranking of characteristic objects, rank-derived preference levels, triangular fuzzy membership interpolation, and final preference ranking.',
  },
  {
    methodId: 'ervd',
    variant: 'crisp-manual-reference-pymcdm-example',
    source: 'pymcdm ERVD documentation example citing the Foundations of Computing and Decision Sciences 2015 ERVD paper',
    sourceUrl: 'https://pymcdm.readthedocs.io/en/master/pymcdm.methods.html#pymcdm.methods.ERVD',
    doi: '10.1515/fcds-2015-0017',
    scope: 'ERVD sum normalization, normalized manual reference point, relative performance matrix, weighted separation measures from positive/negative ideal relative-value solutions, preference scores, and final ranking.',
  },
  {
    methodId: 'spotis',
    variant: 'crisp-manual-bounds-original-rank-reversal-example',
    source: 'Original SPOTIS rank-reversal numerical example',
    sourceUrl: 'https://www.researchgate.net/publication/344069742_The_SPOTIS_Rank_Reversal_Free_Method_for_Multi-Criteria_Decision-Making_Support',
    doi: '10.1109/ACCESS.2020.3023519',
    scope: 'SPOTIS manual criterion bounds, ideal solution point, normalized distance matrix, weighted distance scores, and rank-reversal-stable final ordering.',
  },
  {
    methodId: 'balancedSpotis',
    variant: 'crisp-manual-bounds-esp-alpha-0.5-pymcdm-example',
    source: 'pymcdm 2026 BalancedSPOTIS documentation example',
    sourceUrl: 'https://pymcdm.readthedocs.io/en/master/pymcdm.methods.html#pymcdm.methods.BalancedSPOTIS',
    doi: '10.5220/0013119800003890',
    scope: 'B-SPOTIS manual criterion bounds, ideal solution point, expected solution point, alpha-blended ESP/ISP distances, balanced distance scores, and final lower-is-better ranking.',
  },
  {
    methodId: 'mara',
    variant: 'crisp-benefit-cost-area-gap-rmcda-example',
    source: 'RMCDA 2025 MARA source implementation example',
    sourceUrl: 'https://rdrr.io/cran/RMCDA/src/R/MARA.R',
    doi: '10.1016/j.simpa.2025.100762',
    scope: 'MARA benefit/cost normalization, weighted normalized matrix, optimal alternative, benefit/cost area intensities, lower-is-better area-gap scores, and final ranking.',
  },
] as const;

export const externalValidationCandidates = [
  {
    methodId: 'topsis',
    variant: 'crisp-vector-normalization-manual-weights',
    source: 'Central European Journal of Operations Research 2026 TOPSIS warehouse-storage example',
    sourceUrl: 'https://link.springer.com/article/10.1007/s10100-026-01038-6',
    doi: '10.1007/s10100-026-01038-6',
    scope: 'Published TOPSIS matrix and weights reproduce the top alternative but not all closeness values or the middle ranking under documented vector-normalized TOPSIS settings.',
  },
  {
    methodId: 'topsis',
    variant: 'crisp-vector-normalization-ahp-weights',
    source: 'SpringerPlus 2016 AHP-TOPSIS ETL software-selection example',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4775722/',
    doi: '10.1186/s40064-016-1888-z',
    scope: 'Published TOPSIS input and AHP-derived weights reproduce the top and bottom alternatives but not all closeness values or the middle ranking under documented vector-normalized TOPSIS settings.',
  },
  {
    methodId: 'topsis',
    variant: 'crisp-vector-normalization-ahp-weights-barge-service',
    source: 'Asian Journal of Shipping and Logistics 2025 barge-service supplier TOPSIS example',
    sourceUrl: 'https://doi.org/10.1016/j.ajsl.2024.11.002',
    doi: '10.1016/j.ajsl.2024.11.002',
    scope: 'Published TOPSIS matrix, AHP weights, and closeness coefficients do not match standard vector-normalized TOPSIS; the normalized table appears to reuse a denominator across criteria with different column norms.',
  },
  {
    methodId: 'cradis',
    variant: 'crisp-ratio-normalization-combined-weights-electric-vehicle',
    source: 'Journal of Applied Engineering Science 2025 electric-vehicle CRADIS example',
    sourceUrl: 'https://www.engineeringscience.rs/articles/applying-mcdm-methods-for-electric-vehicle-selection-a-comparative-study-between-cradis-and-piv-methods',
    doi: '10.5937/jaes0-56793',
    scope: 'Published CRADIS combined-weight ranking is reproduced, but score magnitudes differ from the visible S0+/S0- utility equations and need score-convention reconciliation.',
  },
  {
    methodId: 'seca',
    variant: 'crisp-rmcda-optimization-weights-example',
    source: 'RMCDA 2025 optimizer-backed SECA source implementation example',
    sourceUrl: 'https://rdrr.io/cran/RMCDA/src/R/SECA.R',
    doi: '10.1016/j.simpa.2025.100762',
    scope: 'RMCDA apply.SECA solves a constrained nonlinear optimization and returns criterion weights; the app currently uses a deterministic reference-balance approximation with alternative ranking, so this needs an optimizer-backed SECA variant or matching published output before promotion.',
  },
  {
    methodId: 'dematel',
    variant: 'native-fuzzy-triangular-smart-manufacturing',
    source: 'Sustainability 2023 smart-manufacturing fuzzy DEMATEL example',
    sourceUrl: 'https://www.mdpi.com/2071-1050/15/4/3864',
    doi: '10.3390/su15043864',
    scope: 'Published triangular fuzzy DEMATEL input and final cause/effect table are tracked, but the final D/R magnitudes appear to use a defuzzified or scaled convention different from the app native fuzzy component-wise pipeline.',
  },
  {
    methodId: 'balancedSpotis',
    variant: 'crisp-used-car-isp-esp-alpha-0.5',
    source: 'Enhancing Personalized Decision-Making with the Balanced SPOTIS Algorithm, SciTePress 2025 used-car example',
    sourceUrl: 'https://www.scitepress.org/publishedPapers/2025/131198/pdf/index.html',
    doi: '10.5220/0013119800003890',
    scope: 'Published B-SPOTIS case provides ideal-solution, expected-solution, alpha-balanced distance scores, and ranking; it needs the full criteria/weight table extracted before promotion to an active fixture.',
  },
] as const;

export function externalValidationFixturesFor(methodId: MethodId) {
  return externalValidationFixtures.filter((fixture) => fixture.methodId === methodId);
}

export function externalValidationCandidatesFor(methodId: MethodId) {
  return externalValidationCandidates.filter((candidate) => candidate.methodId === methodId);
}

export function externalValidationCoverageLabel(methodId: MethodId): string {
  const fixtures = externalValidationFixturesFor(methodId);
  const candidates = externalValidationCandidatesFor(methodId);
  if (!fixtures.length) {
    if (candidates.length) {
      return `No passing external fixture is registered yet; ${candidates.length} external validation candidate${candidates.length === 1 ? '' : 's'} tracked.`;
    }
    return 'No external published-example fixture is registered for this selected method yet.';
  }
  return `${fixtures.length} external published-example fixture${fixtures.length === 1 ? '' : 's'} registered for this selected method: ${fixtures.map((fixture) => fixture.variant).join(', ')}${candidates.length ? `; ${candidates.length} validation candidate${candidates.length === 1 ? '' : 's'} also tracked` : ''}.`;
}

export function externalValidationStatusFor(methodId: MethodId, mode: 'selection' | 'readiness' = 'selection'): ExternalValidationStatus {
  const fixtures = externalValidationFixturesFor(methodId);
  const candidates = externalValidationCandidatesFor(methodId);
  if (fixtures.length) {
    return {
      label: candidates.length && mode === 'readiness' ? 'Validated with discrepancies tracked' : mode === 'readiness' ? 'Externally validated' : 'External fixture',
      tone: 'validated',
      text: `${fixtures.length} ${mode === 'readiness' ? 'passing ' : ''}published-example fixture${fixtures.length === 1 ? '' : 's'}${candidates.length ? `; ${candidates.length} validation candidate${candidates.length === 1 ? '' : 's'} tracked separately` : ''}`,
    };
  }
  if (candidates.length) {
    return {
      label: 'Validation candidate',
      tone: 'candidate',
      text: `${candidates.length} published-example candidate${candidates.length === 1 ? '' : 's'} needs source extraction or reconciliation`,
    };
  }
  return {
    label: mode === 'readiness' ? 'Internal coverage only' : 'Internal coverage',
    tone: 'internal',
    text: 'Needs published-example fixture before certification',
  };
}

export function externalValidationSummaryFor(methodIds: MethodId[]) {
  const summary = methodIds.reduce((acc, methodId) => {
    const tone = externalValidationStatusFor(methodId).tone;
    if (tone === 'validated') acc.validated += 1;
    else if (tone === 'candidate') acc.candidates += 1;
    else acc.internal += 1;
    return acc;
  }, { validated: 0, candidates: 0, internal: 0 });
  return {
    ...summary,
    candidateFixtures: externalValidationCandidates.filter((candidate) => methodIds.includes(candidate.methodId)).length,
  };
}

export function benchmarkEvidenceSummary(): string {
  const externalCount = validationEvidence.externalBenchmarks.count;
  const externalLabel = externalCount === 1 ? 'fixture is' : 'fixtures are';
  return `${validationEvidence.numericalBenchmarks.count} bundled numerical checks and ${externalCount} external published-example ${externalLabel} included; ${validationEvidence.externalBenchmarks.scope}`;
}
