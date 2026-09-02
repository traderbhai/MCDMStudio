# MCDM Studio Product Blueprint

## Product Aim

MCDM Studio is a research-grade workbench for multi-criteria decision-making studies. It should feel like a focused academic tool: one main task per screen, compact data-first layouts, method-specific specifications, clear validation, complete intermediate tables, and publication-oriented exports.

The app is web-first and local-first. The same calculation core can later be wrapped as a desktop app with Tauri or Electron.

## Current Product Shape

- Guided workflow: Select Method -> Configure -> Template -> Upload -> Results.
- First screen: compact method dropdown, search, selected-method summary, and optional catalog.
- Configure screen: editable study title, method parameters, weighting mode, fuzzy mode, group/respondent mode, alternatives, criteria/factors, matrix values, and pairwise controls where relevant.
- VIKOR configuration includes strategy coefficient, acceptable-advantage mode/DQ, and stability rule; results expose the compromise-solution checks.
- Template screen: method-specific workbook preview and download.
- Upload screen: workbook validation before analysis.
- Results screen: input summary, transformed matrices, method tables, diagnostics, final result, visualizations, method comparison where applicable, and exports.

## Supported Method Inventory

The app currently includes 65 methods:

TOPSIS, AHP, DEMATEL, VIKOR, COPRAS, SAW/WSM, SRP, FUCA, SECA, DEAR, EAMR, RAWEC, COMET, WPM, WASPAS, MOORA, MOOSRA, ARLON, MACONT, ARAS, EDAS, MABAC, CODAS, CoCoSo, CRADIS, MARA, RAPS, ORESTE, QUALIFLEX, REGIME, EVAMIX, Lexicographic, MARCOS, MAIRCA, PROMETHEE II, ELECTRE I, SMART, MAUT, SMARTER, MACBETH-style, Pugh Matrix, OCRA, MULTIMOORA, PSI, PIV, ROV, WISP, TODIM, RAM, GRA, GRP, SPOTIS, ESP-SPOTIS, B-SPOTIS, WEDBA, LMAW, DNMA, PROBID, SPROBID, RIM, RAFSI, LoPM, AROMAN, COBRA, and ERVD.

The broader literature inventory, sources, and deferred variant decisions are maintained in `docs/METHOD_RESEARCH_INVENTORY.md`.

## Weighting Inventory

The app currently includes manual, equal, standard deviation, coefficient of variation, entropy, CRITIC, MEREC, MEREC-G, LOPCOW, WENSLO, angular, Gini, MPSI, CILOS, IDOCRIW, CIMAS, AHP, BWM, DIBR, Revised Simos/SRF cards, SWARA, ROC, FUCOM, LBWA, PIPRECIA, Rank Sum, Rank Reciprocal, and RANCOM weighting.

## Data-Collection Strategy

- Single aggregated dataset: one final decision matrix.
- Multiple respondents: one decision matrix per respondent, aggregated before method analysis with mean, max, relative disagreement and a practical consensus-level diagnostic.
- AHP group judgments: respondent pairwise matrices are aggregated by geometric mean.
- DEMATEL group judgments: one direct-relation matrix per expert, aggregated before total-relation analysis with expert disagreement and consensus reporting.
- Fuzzy inputs: triangular `(l,m,u)` and trapezoidal `(a,b,c,d)` cells are accepted. All built-in methods now expose native fuzzy workflows that preserve fuzzy values through method-specific calculation stages and document the final scalar ranking convention.
- Fuzzy DEMATEL: the method specification exposes both component-wise fuzzy total-relation calculation and centroid defuzzification before total-relation calculation, so researchers can match the convention used by their source paper.
- Capability disclosure: the Results readiness panel now states the selected method's respondent strategy, fuzzy strategy, and validation boundary so researchers can see whether the current run is native fuzzy, centroid-defuzzified, single-response, multi-respondent, AHP geometric-mean, or DEMATEL expert-aggregation.

Native fuzzy smoke and crisp-equivalence coverage currently exists for 65 methods, including the former centroid-only group: SRP, FUCA, SECA, DEAR, EAMR, RAWEC, ARLON, MACONT, MARA, RAPS, ORESTE, QUALIFLEX, REGIME, EVAMIX, Lexicographic, MACBETH-style, and ESP-SPOTIS. External fuzzy publication fixtures remain separate evidence and should be added method-by-method before making paper-certified fuzzy claims.

## Method Registry Standard

Every method should define:

- method id and display name
- supported method family: ranking, outranking, utility, distance, compromise, cause-effect, or self-weighted
- required method parameters
- template sheets and expected sheet structures
- validation rules for sheets, dimensions, values, weights, directions, pairwise reciprocity, respondent/expert counts, fuzzy cells, and method parameters
- calculation stages and intermediate tables
- diagnostics
- final result shape: ranking, compromise result, or cause-effect result
- visualization data
- report narrative and reproducibility metadata

## Professional Output Standard

Each supported method should generate:

- input summary
- cleaned matrix or factor matrix
- normalized/transformed matrix
- weighted matrix or method equivalent
- method-specific calculation tables
- diagnostics and validation summary
- final ranking or cause-effect grouping
- charts or chart-ready data
- reproducibility metadata
- Excel export with separate sheets
- DOCX/PDF report sections with method narrative and key tables
- project JSON export for local resume and reproducibility handoff

## Quality Gates

Current automated gates:

- TypeScript check.
- Production build with dedicated chunks for the MCDM engine, UI, services, Excel, DOCX, PDF, icons, and React runtime.
- 94 bundled numerical benchmark checks.
- 65/65 method execution smoke checks.
- 65/65 method template checks.
- 65/65 report payload checks.
- 65/65 non-DEMATEL zero-value robustness checks, including EDAS all-zero average-column protection.
- Workbook workflow smoke check for template generation, parsing, wrong-method template rejection, malformed project import rejection, duplicate/mismatched project ID rejection, invalid saved workflow metadata rejection, invalid method settings rejection, automatic weighting ignoring edited workbook weight cells, Pugh uploaded-score template round-tripping and global rescaling, multiple-respondent workbook aggregation and reporting, DEMATEL expert workbook aggregation and reporting, TOPSIS normalization settings coverage, AHP group pairwise workbook aggregation/settings coverage, PROMETHEE and COMET settings coverage, MAUT/SMARTER utility-input workbook round-trip coverage, editable method settings sheet round-trip coverage, sheet-shaped reference mode/vector round-trip coverage, fuzzy tuple workbook upload through native and defuzzified paths, validation, analysis, Excel/DOCX/PDF exports, and project JSON package download.
- UX contract smoke check for first-screen simplicity, contextual previews, conditional controls, editable criteria/alternatives, read-only automatic weights, and recovery actions.
- Production build.

## Remaining Research-Grade Validation Work

The app should not claim publication-certified accuracy until each method variant has external published-example validation. For every method and variant, collect at least one peer-reviewed or textbook example with:

- source citation
- original decision matrix or pairwise/factor matrix
- weights and criterion directions
- method parameters
- intermediate matrices or coefficients
- expected final scores and ranking
- tolerance rules for rounding

Then add a fixture and automated check that compares the app output to the published result.

High-priority variants for external validation:

- crisp single-decision methods
- group decision aggregation
- AHP and DEMATEL expert/respondent aggregation
- native fuzzy TOPSIS, AHP, VIKOR, WASPAS, MOORA, MABAC, CODAS, CoCoSo, MAIRCA, PROMETHEE, ELECTRE, MULTIMOORA, TODIM, GRA/GRP, and other native fuzzy paths
- advanced weighting methods such as BWM, FUCOM, SWARA, LBWA, PIPRECIA, LOPCOW, IDOCRIW, CIMAS, and MEREC-G

## Future Expansion Candidates

Potential additions after published validation coverage matures:

- additional ELECTRE variants
- PROMETHEE preference-function variants
- fuzzy, grey, interval, hesitant fuzzy, intuitionistic fuzzy, picture fuzzy, spherical fuzzy, Pythagorean fuzzy, and neutrosophic variants where method definitions are stable
- group consensus diagnostics
- reliability/consistency summaries across respondents
- LaTeX export for equations and tables
- desktop packaging with the same local-first engine
