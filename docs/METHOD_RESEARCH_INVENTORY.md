# MCDM Method Research Inventory

## Purpose

This inventory connects the implemented MCDM Studio method set to the broader MCDM literature. It is not a marketing list. It is a working engineering document that explains what is already implemented, what is covered by internal checks, what has started external validation, and what should be added only after careful source review.

## Literature Signals Used

- A recent 1996-2026 MCDM review highlights widely adopted methods including AHP, TOPSIS, VIKOR, DEMATEL, ELECTRE, PROMETHEE, MOORA, COPRAS, MARCOS, and CoCoSo, and notes growing hybrid work with fuzzy logic, grey theory, machine learning, deep learning, and AI.
- A systematic review of insulation-material selection reports frequent use of AHP, TOPSIS, MULTIMOORA, VIKOR, ELECTRE, COPRAS, MOORA, PROMETHEE, WSM, SWARA, SAW, and TODIM.
- A review of MCDM concepts lists classic and newer methods such as TOPSIS, VIKOR, GRA/GRM, COPRAS, CoCoSo, Multi-MOORA, WSM, MARCOS, MAUT, WPM, RAFSI, AHP, ANP, lexicographic methods, SMART/SMARTER-style utility models, and MACBETH.
- MACBETH literature frames the method as qualitative difference-of-attractiveness judgment elicitation that constructs numerical value scales; this app currently implements a transparent categorical value-anchor scoring workflow and leaves full interactive linear-programming elicitation as a future extension.
- Pugh concept selection uses a datum/baseline concept and criterion-wise better/same/worse comparisons to support controlled convergence in design selection.
- A fuzzy AHP integration survey identifies fuzzy TOPSIS, fuzzy VIKOR, fuzzy ELECTRE, fuzzy PROMETHEE, fuzzy EDAS, fuzzy CODAS, fuzzy COPRAS, fuzzy TODIM, fuzzy MULTIMOORA, fuzzy MABAC, and fuzzy WASPAS as common fuzzy integration targets.
- A review of novel weighting methods reports modern method combinations with FUCOM, MARCOS, TOPSIS, WASPAS, MABAC, EDAS, COPRAS, CoCoSo, CODAS, GRA, VIKOR, MAIRCA, ARAS, CRADIS, DNMA, PIV, EAMR, WSM, CIMAS, and related fuzzy, grey, rough, hesitant fuzzy, picture fuzzy, and neutrosophic variants.
- A recent BWM literature review reinforces the split between weighting methods such as AHP, ANP, BWM, FUCOM, MACBETH, and SWARA, and ranking methods such as ELECTRE, MABAC, PROMETHEE, TODIM, TOPSIS, and VIKOR.
- A systematic review of multiple-criteria group decision-making emphasizes that group studies need explicit expert/respondent aggregation, possible expert weighting, consensus diagnostics, and transparent rules for the data type used by each method.
- A 50-year MCDA review frames the field as several schools rather than one formula family: outranking methods such as ELECTRE and PROMETHEE, utility/value methods such as AHP/TOPSIS/MACBETH-style models, interactive methods, and more recent robust ordinal regression approaches.
- Recent adoption-focused and application reviews continue to identify AHP, TOPSIS, PROMETHEE, VIKOR, ELECTRE, ANP, MOORA, DEMATEL, BWM, and fuzzy AHP/TOPSIS-style variants as the most visible and frequently combined methods.
- Recent enterprise and site-selection reviews describe newer deterministic ranking methods such as WASPAS, MABAC, EDAS, CODAS, CoCoSo, MARCOS, AROMAN, DNMA, and MACONT, and uncertainty extensions using fuzzy, linguistic, Z-number, and neutrosophic sets.

## Implemented Method Coverage

MCDM Studio currently implements 65 methods:

TOPSIS, AHP, DEMATEL, VIKOR, COPRAS, SAW/WSM, SRP, FUCA, SECA, DEAR, EAMR, RAWEC, COMET, WPM, WASPAS, MOORA, MOOSRA, ARLON, MACONT, ARAS, EDAS, MABAC, CODAS, CoCoSo, CRADIS, MARA, RAPS, ORESTE, QUALIFLEX, REGIME, EVAMIX, Lexicographic, MARCOS, MAIRCA, PROMETHEE II, ELECTRE I, SMART, MAUT, SMARTER, MACBETH-style, Pugh Matrix, OCRA, MULTIMOORA, PSI, PIV, ROV, WISP, TODIM, RAM, GRA, GRP, SPOTIS, ESP-SPOTIS, B-SPOTIS, WEDBA, LMAW, DNMA, PROBID, SPROBID, RIM, RAFSI, LoPM, AROMAN, COBRA, and ERVD.

This covers the main method families requested for a broad research workbench:

- utility and additive/product models: SAW/WSM, WPM, WASPAS, SMART, MAUT, SMARTER, MACBETH-style, Pugh Matrix
- distance/reference methods: TOPSIS, CODAS, EDAS, MABAC, SPOTIS, ESP-SPOTIS, B-SPOTIS, PROBID, SPROBID, RIM, COBRA
- compromise and rank aggregation methods: VIKOR, CoCoSo, MULTIMOORA, ORESTE, QUALIFLEX, REGIME, EVAMIX, Lexicographic, DNMA
- ratio and proportional methods: COPRAS, MOORA, MOOSRA, ARAS, MARCOS, MAIRCA
- outranking methods: PROMETHEE II, ELECTRE I
- causal/factor methods: DEMATEL
- pairwise and priority methods: AHP
- grey/relational methods: GRA, GRP
- newer ranking methods: SRP, FUCA, SECA, DEAR, EAMR, RAWEC, COMET, ARLON, MACONT, CRADIS, MARA, RAPS, OCRA, PSI, PIV, ROV, WISP, TODIM, RAM, WEDBA, LMAW, RAFSI, LoPM, AROMAN, ERVD

## Implemented Weighting Coverage

The app currently implements 28 weighting modes:

manual, equal, standard deviation, coefficient of variation, entropy, CRITIC, MEREC, MEREC-G, LOPCOW, WENSLO, angular, Gini, MPSI, CILOS, IDOCRIW, CIMAS, AHP, BWM, DIBR, Revised Simos/SRF cards, SWARA, ROC, FUCOM, LBWA, PIPRECIA, Rank Sum, Rank Reciprocal, and RANCOM.

## Fuzzy And Group-Decision Coverage

Current fuzzy support:

- triangular and trapezoidal fuzzy values are parsed from uploaded workbooks
- native fuzzy paths exist for all 65 built-in methods
- triangular/trapezoidal values are preserved through method-specific fuzzy tables, with centroid or fuzzy-distance projection used only where a final scalar rank is required
- native fuzzy crisp-equivalence checks are included for every built-in method

Current group/respondent support:

- ordinary ranking methods can aggregate multiple respondent decision matrices
- AHP pairwise respondent matrices aggregate by geometric mean
- DEMATEL expert matrices aggregate before total-relation analysis with expert disagreement and consensus reporting
- group and fuzzy input paths have smoke coverage

Important boundary for advanced fuzzy/group variants:

- triangular and trapezoidal fuzzy numbers are implemented as the current fuzzy-number family
- intuitionistic, Pythagorean, Fermatean, hesitant, picture, spherical, neutrosophic, Z-number, rough, and interval type-2 variants are tracked as future method families, not silently treated as equivalent to triangular/trapezoidal fuzzy data
- group decision workflows currently aggregate respondent/expert matrices; future expansion should add optional expert weights, respondent reliability tests, and consensus-improvement rounds where the source method requires them
- TODIM now follows the standard normalized dominance convention: relative weights are calculated against the reference criterion, pairwise gain/loss dominance is aggregated, and the final dominance score is rescaled to the 0-to-1 interval before ranking.
- RAFSI now follows the interval-mapping convention from the original method: benefit criteria map anti-ideal to lower interval and ideal to upper interval before arithmetic-mean normalization, while cost criteria map ideal to lower interval and anti-ideal to upper interval before harmonic-mean normalization. Users can keep observed extremes or declare manual ideal and anti-ideal vectors before template generation.
- PIV now reports the full publication pathway: vector normalized matrix, weighted normalized matrix, criterion-wise weighted proximity deviations from the benefit/cost-aware best value, and the final summed proximity index where lower is better.
- CRADIS now preserves the true anti-ideal utility denominator even when all anti-ideal deviation sums are below 1; no artificial denominator floor is applied before computing utility against the anti-ideal reference.
- SPOTIS, ESP-SPOTIS, and B-SPOTIS expose manual lower/upper bound vectors directly in the method specification model, so researchers can configure rank-reversal-resistant bounds before template generation instead of relying only on workbook edits. B-SPOTIS additionally combines distance from the ideal solution point with distance from a researcher-defined expected solution point through an alpha confidence parameter.
- RIM and LoPM expose their manual reference models in the method specification registry: RIM domain lower/upper bounds plus ideal interval vectors, and LoPM property types/limits, are declared before template generation and validated during upload. LoPM also reports a property-limit feasibility screen before weighted merit scoring, with configurable target-value tolerance.
- MAIRCA now reports the full publication sequence: normalized matrix, theoretical assessment matrix, real assessment matrix, gap matrix, and final total gap ranking for crisp and native fuzzy runs.
- RAM now follows the Root Assessment Method aggregation: column-sum normalization, weighted S+/S- benefit/cost sums, and RI=(2+S+)^(1/(2+S-)) root assessment score.
- PROBID now follows the ideal-average distance convention with ordered positive and negative ideal reference solutions, weighted reference-distance aggregation, average-solution distance, and the final preference index.
- SPROBID implements the simplified PROBID first/last-quarter ideal-distance convention with vector normalization, weighted ordered reference solutions, positive/negative quarter-distance aggregation, and preference-index ranking.
- ERVD exposes its complete manual reference-point model in the method specification registry while the configure screen renders it as a structured per-criterion vector editor only when manual reference mode is selected.

## External Validation State

Current external published-example fixtures:

- TOPSIS crisp vector-normalization hospital supplier selection: raw AHP-derived decision matrix, manual weights, benefit/cost-aware ideal solutions, Euclidean separation distances, closeness coefficients, and final supplier ranking from a Journal of Healthcare Engineering 2019 worked example.
- AHP crisp criteria priority: 3x3 pairwise matrix, expected criteria weights, lambda max, CI, CR, and consistency diagnostic from an Energies 2026 worked example.
- DEMATEL crisp cause-effect analysis: averaged expert direct-relation matrix, row/column normalization factor, total-relation matrix, mean-threshold relation matrix, D/R cause-effect indicators, and prominence ranking from a Sage Open 2025 worked example.
- VIKOR crisp v=0.5 compromise ranking: raw power-quality decision matrix, manual CRITIC-derived weights, weighted regret matrix, S/R/Q compromise values, acceptable-solution checks, and final ranking from a Scientific Reports 2023 worked example.
- COPRAS crisp column-sum normalization clean energy: normalized decision matrix, manual weights, beneficial/non-beneficial sums, relative significance, utility degree, and final ranking from a Sustainability 2022 worked example.
- SAW/WSM crisp linear-normalization university location: raw decision matrix, manual weights, weighted normalized matrix, additive utility score, and final ranking from the WSM component of a Sage Open 2021 worked example.
- WPM crisp linear-normalization university location: raw decision matrix, manual weights, normalized matrix, product utility score, and final ranking from the WPM component of a Sage Open 2021 worked example.
- WASPAS crisp alpha 0.5 university location: benefit/cost decision matrix, manual weights, WSM/WPM components, compromise score, and final ranking from a Sage Open 2021 worked example.
- MOORA crisp ratio-system laptop selection: raw decision matrix, manual AHP-derived weights, benefit/cost sums, net assessment score, and final ranking from a Journal of Industrial Engineering International 2017 worked example.
- MOOSRA crisp benefit-cost ratio laptop selection: raw decision matrix, manual AHP-derived weights, benefit/cost sums, ratio score, and final ranking from the same Journal of Industrial Engineering International 2017 worked example.
- MULTIMOORA crisp dominance-theory laptop selection: raw decision matrix, manual AHP-derived weights, ratio-system, reference-point, multiplicative-form components, dominance aggregation, and final ranking from the same Journal of Industrial Engineering International 2017 worked example.
- MABAC crisp linear-normalization cross-dock terminal location: raw decision matrix, manual IDOCRIW-derived weights, normalized matrix, weighted matrix, border approximation area, distance matrix, and final ranking from a Mathematics 2024 worked example.
- CODAS crisp linear-normalization robot selection: raw decision matrix, manual weights, weighted normalized matrix, negative ideal solution, Euclidean/taxicab distances, relative assessment matrix, and final ranking from the original 2016 CODAS worked example.
- CoCoSo crisp linear-normalization road mixture selection: raw decision matrix, manual MEREC-derived weights, normalized matrix, weighted matrix, S/P comparability sequences, appraisal coefficients, and final ranking from a Buildings 2022 worked example.
- ARAS normalized-matrix health-monitoring application selection: published normalized decision matrix, manual AHP-derived weights, weighted matrix, optimality function, utility degree, and final ranking from a Frontiers in Public Health 2023 worked example.
- EDAS crisp average-solution comparative analysis: raw decision matrix, Set 1 manual weights, average solution, appraisal score, and final ranking from the original Informatica 2015 EDAS worked example.
- SMART crisp student-achievement selection: raw decision matrix, point-derived relative weights, positive-ratio utility scaling, weighted utilities, and final ranking from a Journal of Physics: Conference Series 2017 worked example.
- MAUT crisp seismic-retrofitting selection: published utility-table inputs, manual weights, weighted utilities, and final ranking from a Computer-Aided Civil and Infrastructure Engineering 2009 worked example.
- SMARTER crisp clinical decision-support selection: rank-order centroid weights, published utility-score inputs, weighted utilities, normalized total scores, and final ranking from a Patient 2010 clinical decision-support primer.
- Pugh crisp uploaded-score travel selection: uploaded qualitative score matrix, global 0-1 rescaling, manual intuition weights, weighted scores, and final ranking from a public worked example following Mistree, Lewis, and Stonis 1994.
- OCRA crisp relative-distance tablet selection: raw decision matrix, manual weights, benefit/cost relative-distance preference terms, shifted total preference scores, and final ranking from the JMcDM official worked example citing Parkan 1994 OCRA foundations.
- ROV crisp Fortune 500 financial-performance selection: raw financial-ratio matrix, entropy-derived manual weights, linear max-min normalization, best/worst utility functions, average utility scores, and final ranking from a Gazi University Journal of Science 2021 worked example.
- MARCOS crisp utility-normalization milling-process selection: raw milling-process matrix, ROC weights, utility normalization, range-scaled K- convention, f(K+) utility ranking, utility-table cells, and final ranking from a Materia 2026 worked example.
- MAIRCA crisp min-max gap example: raw decision matrix, manual weights, normalized matrix, theoretical assessment matrix, real assessment matrix, gap matrix, total gap values, and final ranking from the RMCDA 2026 worked example/source implementation.
- PSI crisp alternative-preference-index material selection: raw decision matrix, benefit/cost directions, divide-by-column max/min normalization, alternative preference variation, preference index, final scores, and best alternative from the JMcDM 2025 worked example citing the original PSI paper.
- PIV crisp vector-normalization electric-vehicle selection: raw electric-vehicle matrix, combined manual weights, benefit/cost directions, vector normalization, weighted proximity matrix, overall proximity values, and final ranking from a Journal of Applied Engineering Science 2025 worked example.
- WISP crisp max-normalization material selection: raw material-property matrix, manual weights, benefit/cost directions, weighted normalized matrix, sum/product utility components, recalculated utilities, and final ranking from the RMCDA 2025 worked example/source implementation.
- RAM crisp column-sum root assessment: raw decision matrix, manual weights, benefit/cost directions, column-sum normalization, weighted matrix, S+/S- utility sums, RI score, and final ranking from the pymcdm documentation example citing the Journal of Cleaner Production 2023 RAM paper.
- PROBID crisp ideal-average distance: raw decision matrix, manual weights, benefit/cost directions, vector normalization, weighted matrix, ordered positive/negative ideal distance aggregation, average-solution distance, preference index, and final ranking from the pymcdm documentation example citing the Industrial & Engineering Chemistry Research 2021 PROBID paper.
- SPROBID crisp simplified PROBID: raw decision matrix, manual weights, benefit/cost directions, vector normalization, weighted matrix, ordered ideal solutions, first/last-quarter ideal-distance aggregation, preference index, and final ranking from the pymcdm SPROBID implementation example citing the Industrial & Engineering Chemistry Research 2021 PROBID paper.
- RIM crisp reference-ideal index: domain bounds, ideal intervals, normalized closeness matrix, weighted closeness matrix, positive/negative distances, R index, and final ranking from the RMCDA 2025 source implementation.
- LMAW crisp nonlinear-Q-utility logistics selection: raw decision matrix, manual weights, benefit/cost directions, positive standardization, logarithmic normalization, nonlinear Q utility values, final scores, and best alternative from the JMcDM 2025 worked example citing the original LMAW paper.
- RAFSI crisp manual-reference functional mapping: rafsi R package example with manual ideal and anti-ideal values, benefit/cost directions, functional mapping matrix, arithmetic/harmonic normalized matrix, weighted matrix, final scores, and ranking, with fixture metadata citing the original Mathematics 2020 RAFSI paper.
- LoPM crisp material-selection audit case: pymcdm documentation example with manual lower-limit, upper-limit, and target property requirements, merit components, weighted merit matrix, lower-is-better merit values, and final ranking.
- AROMAN crisp beta/lambda audit case: pymcdm documentation example with min-max normalization, vector normalization, beta-averaged blended matrix, weighted matrix, lambda-powered cost/profit components, preference scores, and final ranking.
- COMET crisp TOPSIS-expert audit case: pymcdm documentation example with min/max characteristic values, TOPSIS method-expert ranking of characteristic objects, rank-derived preference levels, triangular fuzzy membership interpolation, and final preference ranking.
- ERVD crisp relative-value-distance audit case: pymcdm documentation example with sum normalization, normalized manual reference point, relative performance matrix, weighted separation measures from positive/negative relative-value ideals, preference scores, and final ranking.
- SPOTIS crisp manual-bounds rank-reversal example: raw decision matrix, manual weights, benefit/cost directions, lower/upper criterion bounds, ideal solution point, normalized distance matrix, weighted distance scores, and final distance ordering from the original SPOTIS paper.
- B-SPOTIS crisp manual-bounds ESP/ISP audit case: pymcdm documentation example with manual criterion bounds, expected solution point, alpha 0.5, normalized distances from ESP and ISP, balanced distance scores, and final lower-is-better ranking.
- MARA crisp area-gap audit case: RMCDA source implementation example with benefit/cost normalization, weighted normalized matrix, optimal alternative, benefit/cost area intensities, lower-is-better MARA gap scores, and final ranking.

Tracked discrepancy candidates:

- CRADIS crisp ratio-normalization electric-vehicle case: source matrix and combined weights reproduce the published Table 5 ranking exactly, but not the published score magnitudes under the visible CRADIS S0+/S0- utility equations.
- DEMATEL native fuzzy triangular smart-manufacturing case: Sustainability 2023 provides triangular fuzzy input and final D/R values, but the final table appears to use a defuzzified or scaled convention rather than the app's native component-wise fuzzy DEMATEL pipeline.
- TOPSIS crisp vector-normalization warehouse-storage case: source matrix and weights reproduce the top ASRS result but not the published middle ranking or all closeness values under the app's documented standard TOPSIS settings.
- TOPSIS crisp vector-normalization ETL software-selection case: source matrix and AHP-derived weights reproduce S3 as the top result and S1 as the bottom result, but not the published middle ordering or closeness magnitudes under the app's documented standard TOPSIS settings.
- TOPSIS crisp vector-normalization barge-service supplier case: source decision matrix and AHP weights do not reproduce the published normalized matrix, distance table, or performance-index ranking under standard column-wise vector TOPSIS.
- B-SPOTIS crisp used-car case: the SciTePress 2025 paper identifies ISP/ESP balanced scoring and a worked used-car ranking, but the full criteria/weight table must still be extracted before this richer applied case can be promoted; B-SPOTIS also has a separate passing pymcdm reference fixture.

All other methods currently have internal benchmark/workflow evidence but still need method-specific external published fixtures before publication-certified accuracy should be claimed.

For a method-by-method certification tracker, see `docs/EXTERNAL_VALIDATION_MATRIX.md`.

## Candidate Methods And Variants To Add Later

Add only after source formulas and validation examples are available:

- ANP, especially when network dependence between criteria is required
- DEA and fuzzy DEA, because they are performance-efficiency frontier models rather than ordinary alternatives-by-criteria ranking formulas and need different template/result semantics
- robust ordinal regression and interactive preference-disaggregation workflows, because they require preference statements, feasible model sets, and robustness conclusions rather than a single direct ranking calculation
- full interactive MACBETH linear-programming elicitation, beyond the current transparent categorical value-anchor workflow
- ELECTRE II, III, IV, TRI, and other ELECTRE variants
- PROMETHEE I, V, GAIA, and preference-function parameter variants
- BWM, SWARA, FUCOM, LBWA, PIPRECIA as standalone weighting-workflow studies with report narratives
- grey, interval, rough, hesitant fuzzy, intuitionistic fuzzy, Pythagorean fuzzy, Fermatean fuzzy, picture fuzzy, spherical fuzzy, Z-number, and neutrosophic variants
- group consensus diagnostics and respondent agreement/reliability reporting
- machine-learning-assisted weighting or hybrid MCDM pipelines only when the workflow remains explainable and reproducible

## Coding Rule

Do not add a method just because a name exists in the literature. Add a method when the app can provide:

- method-specific configuration
- method-specific template sheets
- upload validation
- intermediate calculation tables
- diagnostics
- final result or cause-effect result
- visualizations or chart-ready data
- report narrative
- internal smoke/benchmark coverage
- external published fixture target when available

## Sources

- Journal of Contemporary Decision Science, "Three Decades of Multiple Criteria-Decision Making (MCDM) Methods (1996-2026): A Comprehensive Review of Advancements, Applications, and Future Directions", 2026: https://www.cds-journal.org/index.php/cds/article/view/31
- Sustainability, "A Systematic Literature Review of Multi-Criteria Decision-Making Methods for Sustainable Selection of Insulation Materials in Buildings", 2021: https://www.mdpi.com/2071-1050/13/2/737
- Encyclopedia, "Multi-Criteria Decision Making (MCDM) Methods and Concepts", 2023: https://www.mdpi.com/2673-8392/3/1/6
- Organizational Behavior and Human Decision Processes, "SMARTS and SMARTER: Improved Simple Methods for Multiattribute Utility Measurement", 1994: https://doi.org/10.1006/obhd.1994.1087
- Management Science, "Decision Quality Using Ranked Attribute Weights", 1996: https://doi.org/10.1287/mnsc.42.11.1515
- Wiley Encyclopedia of Operations Research and Management Science, "MACBETH (Measuring Attractiveness by a Categorical Based Evaluation Technique)", 2011: https://doi.org/10.1002/9780470400531.eorms0970
- Springer, "Cardinal Value Measurement with MACBETH", 2000: https://doi.org/10.1007/978-1-4757-4919-9_21
- Design Methods: Seeds of Human Futures, "Controlled convergence", 1981: https://archive.org/details/designmethodssee0000pugh
- Istanbul Technical University research record, "Integration of fuzzy AHP with other fuzzy multicriteria methods: A state of the art survey", 2020: https://research.itu.edu.tr/en/publications/integration-of-fuzzy-ahp-with-other-fuzzy-multicriteria-methods-a/
- Information, "A Comprehensive Review of the Novel Weighting Methods for Multi-Criteria Decision-Making", 2023: https://doi.org/10.3390/info14050285
- Socio-Economic Planning Sciences, "Best-worst multi-criteria decision-making method: A review of the literature", 2025: https://doi.org/10.1016/j.seps.2025.102290
- Information Fusion, "A systematic review on multi-criteria group decision-making methods based on weights: Analysis and classification scheme", 2023: https://doi.org/10.1016/j.inffus.2023.03.004
- European Journal of Operational Research, "Fifty years of multiple criteria decision analysis: From classical methods to robust ordinal regression", 2025: https://doi.org/10.1016/j.ejor.2024.07.038
- Applied Sciences, "Widely Used Multi-Criteria Decision Analysis Methods-A Comprehensive Ranking", 2026: https://www.mdpi.com/2076-3417/16/14/7269
- Procedia Computer Science, "Subjective weight determination methods in multi-criteria decision-making: a systematic review", 2024: https://doi.org/10.1016/j.procs.2024.09.673
- "A Comprehensive Survey and Literature Review on TOPSIS", 2024: https://www.sciencedirect.com/org/science/article/pii/S1947959X24000123
