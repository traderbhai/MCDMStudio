# External Validation Matrix

This matrix is the operational certification tracker for MCDM Studio. It separates implemented method coverage from external published-example validation.

Status meanings:

- Passing external fixture: at least one automated fixture from a traceable published or official worked example passes with final-result evidence and intermediate-table or diagnostic evidence.
- Validation candidate: a published example is tracked, but the source data still needs extraction or the app's documented method settings do not yet reproduce the published result closely enough to count as passing validation.
- Internal coverage only: the method has engine, template, workflow, report, and bundled benchmark coverage, but still needs a published-example fixture before journal-certified accuracy can be claimed.

| Method | Family | External validation status | Current evidence |
| --- | --- | --- | --- |
| TOPSIS | Distance/reference | Passing external fixture | Journal of Healthcare Engineering 2019 fixture checks vector normalization, ideal solutions, separation distances, closeness coefficients, and final supplier ranking; three discrepancy candidates remain tracked separately. |
| AHP | Pairwise/priority | Passing external fixture | Energies 2026 criteria-priority fixture checks pairwise priorities, lambda max, CI, CR, and consistency diagnostic. |
| DEMATEL | Cause-effect | Passing external fixture | Sage Open 2025 fixture checks expert aggregation, normalized direct matrix, total relation matrix, threshold relation matrix, D/R values, and cause-effect grouping; a Sustainability 2023 native fuzzy DEMATEL discrepancy candidate is tracked separately. |
| VIKOR | Compromise/rank aggregation | Passing external fixture | Scientific Reports 2023 fixture checks regret matrix, S/R/Q values, acceptable advantage/stability, and final ranking. |
| COPRAS | Ratio/proportional | Passing external fixture | Sustainability 2022 fixture checks normalized matrix, beneficial/non-beneficial sums, relative significance, utility degree, and ranking. |
| SAW/WSM | Utility/additive | Passing external fixture | Sage Open 2021 WSM component fixture checks normalization, weighted matrix, additive score, and ranking. |
| SRP | Newer ranking | Passing external fixture | Scientific Reports 2023 fixture checks criterion-wise dense ranks, VIMM-derived weights, weighted rank matrix, final preference scores, and material-selection ranking. |
| FUCA | Newer ranking | Passing external fixture | mcdabench 2026 FUCA manual example validates criterion-wise average ranks, weighted rank scores, and lower-is-better final ranking. |
| SECA | Newer ranking | Internal coverage only | Needs published-example fixture. |
| DEAR | Newer ranking | Internal coverage only | Needs published-example fixture. |
| EAMR | Newer ranking | Internal coverage only | Needs published-example fixture. |
| RAWEC | Newer ranking | Internal coverage only | Needs published-example fixture. |
| COMET | Newer ranking | Passing external fixture | pymcdm COMET fixture checks min/max characteristic values, TOPSIS method-expert ranking of characteristic objects, rank-derived preference levels, triangular fuzzy membership interpolation, and final preference ranking. |
| WPM | Utility/additive | Passing external fixture | Sage Open 2021 WPM component fixture checks normalization, product utility score, and ranking. |
| WASPAS | Utility/additive | Passing external fixture | Sage Open 2021 fixture checks WSM/WPM components, lambda 0.5 score, and ranking. |
| MOORA | Ratio/proportional | Passing external fixture | Journal of Industrial Engineering International 2017 fixture checks ratio-system normalization, benefit/cost sums, net score, and ranking. |
| MOOSRA | Ratio/proportional | Passing external fixture | Journal of Industrial Engineering International 2017 fixture checks benefit/cost sums, MOOSRA ratio, and ranking. |
| ARLON | Newer ranking | Internal coverage only | Needs published-example fixture. |
| MACONT | Newer ranking | Internal coverage only | Needs published-example fixture. |
| ARAS | Ratio/proportional | Passing external fixture | Frontiers in Public Health 2023 fixture checks published normalized matrix, weighted matrix, optimality function, utility degree, and ranking. |
| EDAS | Distance/reference | Passing external fixture | Informatica 2015 fixture checks average solution, PDA/NDA handling, appraisal score, and ranking. |
| MABAC | Distance/reference | Passing external fixture | Mathematics 2024 fixture checks normalized matrix, weighted matrix, border approximation area, distance matrix, and ranking. |
| CODAS | Distance/reference | Passing external fixture | Original CODAS robot-selection fixture checks negative ideal solution, Euclidean/taxicab distances, relative assessment matrix, and ranking. |
| CoCoSo | Compromise/rank aggregation | Passing external fixture | Buildings 2022 fixture checks S/P comparability sequences, appraisal coefficients, and ranking. |
| CRADIS | Distance/reference | Validation candidate | Journal of Applied Engineering Science 2025 fixture reproduces the combined-weight CRADIS ranking, but published score magnitudes need reconciliation before promotion. |
| MARA | Newer ranking | Passing external fixture | RMCDA 2025 fixture checks benefit/cost normalization, weighted normalized matrix, optimal alternative, area intensities, lower-is-better MARA gap scores, and final ranking. |
| RAPS | Newer ranking | Internal coverage only | Needs published-example fixture. |
| ORESTE | Compromise/rank aggregation | Passing external fixture | RMCDA 2025 fixture checks beneficial/cost alternative ranks, criterion ranks, alpha-blended rank indexes, global rank scores, and final ranking. |
| QUALIFLEX | Compromise/rank aggregation | Internal coverage only | Needs published-example fixture. |
| REGIME | Compromise/rank aggregation | Passing external fixture | RMCDA 2025 fixture checks weighted pairwise dominance signs, dominance flow scores, and final ranking for the official REGIME worked example. |
| EVAMIX | Compromise/rank aggregation | Internal coverage only | Needs published-example fixture. |
| Lexicographic | Compromise/rank aggregation | Internal coverage only | Needs published-example fixture. |
| MARCOS | Ratio/proportional | Passing external fixture | Materia 2026 fixture checks utility normalization, ROC weights, range-scaled K- convention, f(K+) ranking, utility-table cells, and final milling-process ranking. |
| MAIRCA | Ratio/proportional | Passing external fixture | RMCDA 2026 fixture checks min-max normalization, theoretical assessment matrix, real assessment matrix, gap matrix, total gap values, and final ranking. |
| PROMETHEE II | Outranking | Passing external fixture | Hand-computed package fixture checks preference-index cells, positive/negative/net flows, and ranking. |
| ELECTRE I | Outranking | Passing external fixture | Hand-computed RMCDA-based fixture checks concordance, discordance, and outranking relation. |
| SMART | Utility/additive | Passing external fixture | Journal of Physics: Conference Series 2017 fixture checks positive-ratio utility scaling, relative weights, weighted utilities, and final ranking. |
| MAUT | Utility/additive | Passing external fixture | Computer-Aided Civil and Infrastructure Engineering 2009 fixture checks published utility inputs, weighted utilities, and final ranking. |
| SMARTER | Utility/additive | Passing external fixture | Patient 2010 clinical decision-support fixture checks ROC weights, utility-score inputs, weighted utilities, normalized total scores, and final ranking. |
| MACBETH-style | Utility/additive | Internal coverage only | Needs published-example fixture for the current categorical-anchor implementation. |
| Pugh Matrix | Utility/additive | Passing external fixture | Public travel-selection worked example fixture checks uploaded Pugh score matrix, global 0-1 rescale, intuition weights, weighted scores, and final ranking; fixture cites Mistree, Lewis, and Stonis 1994 qualitative scoring. |
| OCRA | Newer ranking | Passing external fixture | JMcDM tablet-selection fixture checks relative-distance benefit/cost preference terms, shifted OCRA scores, and final ranking; fixture cites Parkan 1994 OCRA foundations. |
| MULTIMOORA | Compromise/rank aggregation | Passing external fixture | Journal of Industrial Engineering International 2017 fixture checks ratio-system, reference-point, multiplicative-form components, dominance aggregation, and ranking. |
| PSI | Newer ranking | Passing external fixture | JMcDM 2025 fixture checks divide-by-column max/min normalization, alternative preference variation, preference index, final scores, and best material-selection alternative. |
| PIV | Distance/reference | Passing external fixture | Journal of Applied Engineering Science 2025 fixture checks vector normalization, combined weights, weighted proximity matrix, overall proximity scores, and final electric-vehicle ranking. |
| ROV | Utility/additive | Passing external fixture | Gazi University Journal of Science 2021 fixture checks linear max-min normalization, best/worst utility functions, average utility scores, and final Fortune 500 ranking. |
| WISP | Utility/additive | Passing external fixture | RMCDA 2025 fixture checks max normalization, weighted matrix, WISP utility components, recalculated utilities, and final material-selection ranking. |
| TODIM | Newer ranking | Passing external fixture | RMCDA 2025 fixture checks benefit/cost normalization, theta 1 pairwise prospect-dominance cells, normalized dominance scores, and final material-selection ranking. |
| RAM | Utility/additive | Passing external fixture | pymcdm 2026 fixture checks column-sum normalization, weighted matrix, S+/S- utility sums, root assessment RI score, and final ranking. |
| GRA | Grey/relational | Passing external fixture | Journal of Healthcare Engineering 2019 fixture checks grey relational coefficients, grey relational grades, and supplier ranking. |
| GRP | Grey/relational | Internal coverage only | Needs published-example fixture. |
| SPOTIS | Distance/reference | Passing external fixture | Original SPOTIS rank-reversal example checks manual bounds, ideal solution point, normalized distance matrix, weighted distance scores, and final distance ranking. |
| ESP-SPOTIS | Distance/reference | Internal coverage only | Needs published-example fixture. |
| B-SPOTIS | Distance/reference | Passing external fixture | pymcdm 2026 fixture checks manual criterion bounds, ideal solution point, expected solution point, alpha-blended ESP/ISP distances, balanced distance scores, and final lower-is-better ranking; the richer SciTePress used-car case remains tracked separately as a candidate needing full table extraction. |
| WEDBA | Distance/reference | Internal coverage only | Needs published-example fixture. |
| LMAW | Utility/additive | Passing external fixture | JMcDM 2025 fixture checks positive standardization, logarithmic normalization, nonlinear Q utility matrix, final scores, and best logistics alternative. |
| DNMA | Compromise/rank aggregation | Internal coverage only | Needs published-example fixture. |
| PROBID | Distance/reference | Passing external fixture | pymcdm 2026 fixture checks vector normalization, weighted matrix, ideal/average reference distance aggregation, preference index, and final ranking. |
| SPROBID | Distance/reference | Passing external fixture | pymcdm 2026 fixture checks vector normalization, weighted matrix, ordered ideal solutions, first/last-quarter ideal-distance aggregation, preference index, and final ranking. |
| RIM | Distance/reference | Passing external fixture | RMCDA 2025 fixture checks domain bounds, reference ideal intervals, normalized closeness matrix, weighted closeness matrix, positive/negative distances, R index, and final ranking. |
| RAFSI | Newer ranking | Passing external fixture | rafsi R package example checks manual ideal/anti-ideal references, functional mapping matrix, normalized matrix, weighted matrix, final scores, and ranking. |
| LoPM | Distance/reference | Passing external fixture | pymcdm 2026 fixture checks manual lower-limit, upper-limit, and target property limits, merit components, weighted merit matrix, lower-is-better merit scores, and final material-selection ranking. |
| AROMAN | Utility/additive | Passing external fixture | pymcdm 2026 fixture checks min-max normalization, vector normalization, beta-averaged blended matrix, weighted matrix, lambda-powered cost/profit components, preference scores, and final ranking. |
| COBRA | Distance/reference | Internal coverage only | Needs published-example fixture. |
| ERVD | Distance/reference | Passing external fixture | pymcdm 2026 fixture checks sum normalization, normalized manual reference point, relative performance matrix, weighted separation measures, preference scores, and final ranking. |

Current count:

- Passing external fixtures: 48 methods/variants
- Validation candidates: 1 methods, 6 candidate records
- Internal coverage only: 16 methods

This matrix should be updated only when `scripts/external-validation-smoke.mjs` and `npm run verify` pass.
