# MCDM Studio

MCDM Studio is a local-first browser app for multi-criteria decision-making studies. It guides a researcher through method selection, method-specific configuration, Excel template generation, workbook upload validation, full calculation tables, diagnostics, visualizations, and publication-oriented exports.

All v1 computation and file processing runs in the browser. There is no login, server database, or cloud storage requirement.

## Current Capabilities

- Built-in methods: TOPSIS, AHP, DEMATEL, VIKOR, COPRAS, SAW/WSM, SRP, FUCA, SECA, DEAR, EAMR, RAWEC, COMET, WPM, WASPAS, MOORA, MOOSRA, ARLON, MACONT, ARAS, EDAS, MABAC, CODAS, CoCoSo, CRADIS, MARA, RAPS, ORESTE, QUALIFLEX, REGIME, EVAMIX, Lexicographic, MARCOS, MAIRCA, PROMETHEE II, ELECTRE I, SMART, MAUT, SMARTER, MACBETH-style, Pugh Matrix, OCRA, MULTIMOORA, PSI, PIV, ROV, WISP, TODIM, RAM, GRA, GRP, SPOTIS, ESP-SPOTIS, B-SPOTIS, WEDBA, LMAW, DNMA, PROBID, SPROBID, RIM, RAFSI, LoPM, AROMAN, COBRA, and ERVD.
- Weighting modes: manual, equal, standard deviation, coefficient of variation, entropy, CRITIC, MEREC, MEREC-G, LOPCOW, WENSLO, angular, Gini, MPSI, CILOS, IDOCRIW, CIMAS, AHP, BWM, DIBR, Revised Simos/SRF cards, SWARA, ROC, FUCOM, LBWA, PIPRECIA, Rank Sum, Rank Reciprocal, and RANCOM.
- Fuzzy inputs: triangular and trapezoidal values are accepted. The app now has native fuzzy smoke/crisp-equivalence coverage for 65 methods; external fuzzy publication fixtures are tracked separately before claiming paper-certified accuracy for a specific fuzzy variant.
- Group/respondent data: ordinary ranking methods can aggregate multiple respondent decision matrices and report mean, max, relative disagreement plus a practical consensus level; AHP pairwise judgments aggregate by geometric mean; DEMATEL supports multiple expert influence matrices with expert disagreement and consensus reporting.
- Fuzzy DEMATEL conventions: users can choose component-wise fuzzy total-relation calculation or centroid defuzzification before the final total-relation matrix, matching the two common reporting styles found in applied papers.
- Editable study setup: method-specific parameters, alternatives, criteria/factors, directions, weights, pairwise matrices, and decision matrix values.
- Method-owned templates: templates reflect the selected method, study shape, fuzzy mode, respondent/expert mode, weighting mode, and method parameters.
- VIKOR compromise checks: VIKOR reports S, R, Q plus configurable acceptable-advantage and stability diagnostics.
- Exports: formatted Excel package, DOCX report, PDF report, and reproducibility project JSON.
- Production bundling separates the MCDM engine, UI, services, Excel, DOCX, PDF, icons, and React runtime so export libraries do not bloat the main app chunk.

## Workflow

1. Select one MCDM method using search, family filtering, or the optional catalog.
2. Configure method parameters, data collection mode, fuzzy mode, weighting mode, alternatives, and criteria/factors.
3. Download the generated method-specific Excel template.
4. Fill the workbook and upload it back into the app.
5. Review validation messages, intermediate tables, diagnostics, rankings or cause-effect results, and visualizations.
6. Export Excel, DOCX, PDF, JSON, or the full publication package.

## Validation Status

The app currently includes:

- 65/65 method execution smoke coverage.
- 65/65 method template generation and parsing coverage.
- 65/65 report payload coverage.
- 65/65 non-DEMATEL methods handle zero-containing inputs, including EDAS all-zero average-column protection.
- 94 bundled numerical benchmark checks.
- Validation checks for wrong-method templates, malformed project imports, duplicate or mismatched project IDs, invalid saved workflow metadata, malformed workbooks, invalid matrix cells, AHP pairwise issues, VIKOR parameters, SRF parameters, fuzzy input handling, group data handling, and automatic/manual weight behavior.
- UX contract checks for focused method selection, contextual template preview, editable criteria/alternatives, conditional AHP controls, read-only automatic weights, upload validation, and results recovery actions.
- External published-example fixture runner is available in `scripts/external-validation-smoke.mjs`; fixture files and discrepancy candidates belong in `docs/external-fixtures`.

Important boundary: external paper-by-paper validation is in progress, not complete. Passing fixtures are counted separately from discrepancy candidates. Before claiming journal-certified numerical accuracy for a method variant, compare that variant against published examples with expected intermediate matrices, scores, diagnostics, and final rankings.

See [docs/METHOD_RESEARCH_INVENTORY.md](docs/METHOD_RESEARCH_INVENTORY.md) for the implemented method inventory, literature signals, deferred variants, and coding rules for future methods. See [docs/EXTERNAL_VALIDATION_MATRIX.md](docs/EXTERNAL_VALIDATION_MATRIX.md) for the method-by-method external validation status. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for shared-hosting, Apache, Nginx, Netlify-style static hosting, and subfolder deployment instructions.

## Run

Use the bundled Node runtime path in this Codex workspace, or a local Node installation if available.

```powershell
pnpm install
npm run verify
pnpm run preview
```

`npm run verify` is the no-install quality gate used in this workspace after dependencies are present. In this Codex environment, direct commands are often used instead of package-manager shortcuts:

```powershell
.\node_modules\.bin\tsc.cmd --noEmit
node scripts\benchmark-tests.mjs
node scripts\algorithm-smokecheck.mjs
node scripts\workflow-smoke.mjs
node scripts\ux-contract-smoke.mjs
node scripts\external-validation-smoke.mjs
node scripts\docs-inventory-smoke.mjs
.\node_modules\.bin\vite.cmd build
```

## Engine Contract

Each method is registered in `src/core/methods.ts` and follows the same product contract:

- declare method metadata and method-specific parameters
- generate the required template sheets
- validate uploaded workbook data
- run the calculation pipeline
- return intermediate tables and diagnostics
- return ranking or cause-effect outputs
- return visualization data
- provide report narrative and reproducibility metadata

This keeps the app extensible while preserving one consistent workflow for researchers.