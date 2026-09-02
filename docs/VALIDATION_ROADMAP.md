# MCDM Studio Validation Roadmap

## Purpose

This file tracks what must be proven before MCDM Studio can claim journal-grade numerical accuracy for a method or variant. Internal checks prove that the app runs consistently; external validation proves that the implementation matches published method examples.

## Current Internal Evidence

- 65 built-in methods have execution smoke coverage.
- 65 built-in methods have template generation and parsing coverage.
- 65 built-in methods have report payload coverage.
- 65 non-DEMATEL methods have zero-value robustness coverage, including an EDAS all-zero average-column guard.
- 94 bundled numerical benchmark checks are included.
- Group decision checks cover respondent aggregation, DEMATEL expert aggregation, mean/max/relative disagreement reporting, consensus-level classification, and AHP geometric-mean pairwise aggregation.
- Fuzzy checks cover triangular/trapezoidal parsing and native fuzzy crisp-equivalence paths for all 65 built-in methods.
- Fuzzy DEMATEL checks cover both component-wise fuzzy total-relation calculation and the applied-paper convention that defuzzifies fuzzy judgments before the final total-relation matrix.
- VIKOR checks cover configurable acceptable-advantage and stability diagnostics in crisp and native fuzzy paths.
- Workflow checks cover template upload, wrong-method template rejection, malformed project import rejection, duplicate/mismatched project ID rejection, invalid saved workflow metadata rejection, malformed workbook rejection, invalid value rejection, invalid method settings rejection, automatic weighting ignoring edited workbook weight cells, Pugh uploaded-score template round-tripping and global rescaling, multiple-respondent workbook aggregation and reporting, DEMATEL expert workbook aggregation and reporting, TOPSIS normalization settings coverage, AHP group pairwise workbook aggregation/settings coverage, PROMETHEE and COMET settings coverage, MAUT/SMARTER utility-input workbook round-trip coverage, editable method settings sheet round-trip coverage, sheet-shaped reference mode/vector round-trip coverage, fuzzy tuple workbook upload through native and defuzzified paths, parameter round-tripping, Excel export, DOCX/PDF export paths, and project JSON package download.
- UX contract checks cover the guided workflow assumptions.

## External Validation Definition

A method is externally validated only when at least one independent published example is converted into an automated fixture that verifies:

- method id and variant
- citation and source type
- alternatives/factors and criteria/factors
- criterion directions
- weights or weighting method inputs
- method parameters
- original matrix, pairwise matrix, factor matrix, or expert/respondent matrices
- expected intermediate values where available
- expected final score, coefficient, flow, dominance, utility, or prominence values
- expected ranking or cause-effect grouping
- rounding tolerance

## Fixture Format

Published-example fixture files belong in `docs/external-fixtures` and are executed by `scripts/external-validation-smoke.mjs`.

Each fixture should include:

```json
{
  "methodId": "topsis",
  "variant": "crisp-single",
  "source": "Author, year, title, venue, page/table",
  "sourceUrl": "https://example.org/source",
  "doi": "10.xxxx/example",
  "config": {},
  "input": {},
  "expected": {
    "ranking": [],
    "scores": [],
    "tables": []
  },
  "tolerance": 0.0001
}
```

Discrepancy candidates are allowed when a published example provides useful inputs but does not match the app's documented method settings. These files must explain the discrepancy, preserve both the published result and the app-observed result, and fail the fixture runner if they start matching the published result so they can be promoted deliberately. They are not counted as passing external validation until reconciled.

## Priority Order

1. Core crisp ranking methods: TOPSIS, VIKOR, COPRAS, SAW/WSM, WPM, WASPAS, MOORA, ARAS, EDAS, MABAC, CODAS, CoCoSo, MARCOS, MAIRCA, PROMETHEE II, ELECTRE I, MULTIMOORA, TODIM.
2. AHP and DEMATEL: criteria/factor priorities, consistency ratio, expert/respondent aggregation, and final priority or cause-effect results.
3. Objective weighting methods: entropy, CRITIC, MEREC, MEREC-G, LOPCOW, WENSLO, angular, Gini, MPSI, CILOS, IDOCRIW, CIMAS, standard deviation, coefficient of variation.
4. Subjective/rank weighting methods: AHP, BWM, DIBR, Revised Simos/SRF, SWARA, ROC, FUCOM, LBWA, PIPRECIA, Rank Sum, Rank Reciprocal, RANCOM.
5. Native fuzzy variants: fuzzy TOPSIS, fuzzy AHP, fuzzy VIKOR, fuzzy WASPAS, fuzzy MOORA, fuzzy MABAC, fuzzy CODAS, fuzzy CoCoSo, fuzzy MAIRCA, fuzzy PROMETHEE, fuzzy ELECTRE, fuzzy MULTIMOORA, fuzzy TODIM, fuzzy GRA/GRP, and the remaining native fuzzy paths including SRP, FUCA, SECA, DEAR, EAMR, RAWEC, ARLON, MACONT, MARA, RAPS, ORESTE, QUALIFLEX, REGIME, EVAMIX, Lexicographic, MACBETH-style, and ESP-SPOTIS.
6. Group decision variants: multiple respondent matrices, multiple fuzzy respondent matrices, AHP group pairwise matrices, and DEMATEL expert matrices.

## Completion Criteria

For a method variant to be marked externally validated:

- At least one fixture from a published source passes in automation.
- The fixture checks final results and at least one intermediate table or diagnostic when the source provides it.
- Active external fixtures must include an explicit DOI, a traceable source URL, and a source description detailed enough for audit.
- The fixture must prove the method's final result form: ranking/scores for ranking methods, criteria priorities for AHP priority fixtures, or an outranking relation for ELECTRE-style fixtures.
- Active fixtures without diagnostic checks must compare at least two intermediate table cells.
- The exported Excel report contains the checked intermediate/final tables.
- The app's readiness panel can distinguish internal benchmark coverage from external published validation.

## Status

External published-example validation is in progress. TOPSIS crisp vector-normalization, AHP crisp criteria-priority, DEMATEL crisp cause-effect analysis, VIKOR crisp v=0.5 compromise ranking, COPRAS crisp column-sum normalization, SAW/WSM crisp linear-normalization, WPM crisp linear-normalization, WASPAS crisp alpha 0.5, MOORA crisp ratio-system, MOOSRA crisp benefit-cost ratio, MULTIMOORA crisp dominance-theory, MABAC crisp linear-normalization, CODAS crisp linear-normalization, CoCoSo crisp linear-normalization, ARAS normalized-matrix, EDAS crisp average-solution, SMART crisp positive-ratio utility, MAUT crisp input-utilities, SMARTER crisp ROC utility-input, Pugh crisp uploaded-score, OCRA crisp relative-distance, ROV crisp linear max-min, MARCOS crisp utility-normalization, MAIRCA crisp min-max gap, PSI crisp alternative-preference-index, PIV crisp vector-normalization, WISP crisp max-normalization, RAM crisp column-sum root assessment, PROBID crisp ideal-average distance, SPROBID crisp simplified PROBID, RIM crisp reference-ideal index, LMAW crisp nonlinear-Q-utility, RAFSI crisp manual-reference, LoPM crisp manual-property-limits, AROMAN crisp beta/lambda, COMET crisp TOPSIS-expert, ERVD crisp relative-value-distance, SPOTIS crisp manual-bounds, B-SPOTIS crisp alpha-balanced ESP/ISP distance, and MARA crisp area-gap fixtures are registered. TOPSIS, CRADIS, and B-SPOTIS discrepancy/candidate records are tracked; a fuzzy DEMATEL discrepancy candidate is also tracked for native fuzzy formula reconciliation. The app should continue to describe bundled benchmark coverage as internal evidence, not publication-certified proof for all methods and variants.
