# Publication Readiness Audit

This audit defines the remaining work needed before MCDM Studio should be described as publication ready in the strict journal-support sense. The app can already run complete local studies, generate templates, validate uploads, compute all built-in methods, and export publication-oriented material. The remaining risk is primarily external numerical validation depth and real-user UX evidence.

## Current Verified Strengths

- 65/65 built-in methods execute.
- 65/65 method templates generate, upload, parse, and analyze in automated workflow checks.
- 65/65 native fuzzy crisp-equivalence checks pass for triangular/trapezoidal fuzzy paths.
- 65/65 realistic demo upload workbooks validate, analyze, and produce Excel analysis exports.
- Multiple respondent decision matrices, AHP geometric-mean group pairwise matrices, and DEMATEL expert matrices are covered by workflow tests.
- Excel, DOCX, PDF, project JSON, and full-package export paths are exercised.
- Shared-hosting deployment package is built with relative asset paths for root or subfolder hosting.
- The duplicate row-ID regression found during PROMETHEE II testing is fixed and covered by UX contract checks.

## Publication-Ready Definition

A method or variant is publication ready only when all of these are true:

1. The app validates the exact workbook structure required by the method.
2. The method produces the expected intermediate tables and diagnostics.
3. The final ranking, score, flow, utility, or cause-effect result is reproducible.
4. Exports include the method settings, validation status, intermediate tables, final result, and reproducibility metadata.
5. At least one traceable external fixture from a published or official worked example passes for the exact method variant being claimed.

Internal smoke tests prove software behavior. External fixtures prove agreement with published examples.

## External Validation Status

- Passing external fixtures: 43 methods/variants.
- Validation candidates needing reconciliation: 1 methods.
- Internal coverage only: 21 methods.

## Internal-Only Methods Still Blocking Full Publication Certification

1. SRP (Newer ranking) - Needs published-example fixture.
2. FUCA (Newer ranking) - Needs published-example fixture.
3. SECA (Newer ranking) - Needs published-example fixture.
4. DEAR (Newer ranking) - Needs published-example fixture.
5. EAMR (Newer ranking) - Needs published-example fixture.
6. RAWEC (Newer ranking) - Needs published-example fixture.
7. ARLON (Newer ranking) - Needs published-example fixture.
8. MACONT (Newer ranking) - Needs published-example fixture.
9. RAPS (Newer ranking) - Needs published-example fixture.
10. ORESTE (Compromise/rank aggregation) - Needs published-example fixture.
11. QUALIFLEX (Compromise/rank aggregation) - Needs published-example fixture.
12. REGIME (Compromise/rank aggregation) - Needs published-example fixture.
13. EVAMIX (Compromise/rank aggregation) - Needs published-example fixture.
14. Lexicographic (Compromise/rank aggregation) - Needs published-example fixture.
15. MACBETH-style (Utility/additive) - Needs published-example fixture for the current categorical-anchor implementation.
16. TODIM (Newer ranking) - Needs published-example fixture.
17. GRP (Grey/relational) - Needs published-example fixture.
18. ESP-SPOTIS (Distance/reference) - Needs published-example fixture.
19. WEDBA (Distance/reference) - Needs published-example fixture.
20. DNMA (Compromise/rank aggregation) - Needs published-example fixture.
21. COBRA (Distance/reference) - Needs published-example fixture.

## Candidate Methods Needing Reconciliation

1. CRADIS (Distance/reference) - Journal of Applied Engineering Science 2025 fixture reproduces the combined-weight CRADIS ranking, but published score magnitudes need reconciliation before promotion.

## Next Completion Sequence

1. Resolve validation candidates first, because these already have source material.
2. Add external fixtures for internal-only methods in batches of 3-5, starting with methods that have official package examples or complete paper tables.
3. Add fuzzy published fixtures separately from crisp fixtures; native fuzzy implementation alone should not be described as paper-certified.
4. Add group-decision published fixtures for multiple respondents/experts, especially AHP and DEMATEL.
5. Continue live real-user QA on the deployed site after each release package.

## Release Claim Allowed Today

Safe claim:

MCDM Studio is a local-first MCDM research workbench with 65 implemented methods, 28 weighting modes, native triangular/trapezoidal fuzzy workflows, group/respondent support, method-specific Excel templates, upload validation, intermediate calculation tables, visualizations, and Excel/DOCX/PDF/JSON exports.

Claim to avoid until the checklist above is complete:

Every method and fuzzy/group variant is externally publication-certified against published examples.
