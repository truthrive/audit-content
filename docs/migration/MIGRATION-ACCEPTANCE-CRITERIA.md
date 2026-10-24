# M00 — Migration Acceptance Criteria

Status: **Plan drafted; test fixtures and production comparison outputs not yet collected.**

## Goal
Migrate the existing Google Apps Script SEO content audit into a TypeScript audit core for an agency app (20k–100k URLs per audit) without silently changing existing business rules. No application code is changed in M00.

## M00 — Evidence pack
- [x] Identify source tree, entrypoints, module map and side effects from GitHub.
- [x] Document legacy ordered rules and selected thresholds.
- [x] Document input/normalized/output contracts and known uncertainties.
- [ ] Obtain sanitized real CSV exports and their exact original Apps Script outputs.
- [ ] Record code commit SHA, tool/config version, timestamp, source scopes, dataset size, and test environment for every fixture.
- [ ] Freeze at least one **golden dataset** per major scenario and save approved expected outputs.
- [ ] Confirm deployed access/permissions and whether customer datasets can be used for testing.

**M00 exit gate:** All unchecked evidence-pack items resolved, or explicitly waived by reviewer. Documents alone do not constitute completed baseline parity.

## Golden fixture matrix (minimum)
| ID | Scenario | Required assertions |
|---|---|---|
| G01 | Valid Internal HTML + GSC + GA4 | header mapping, count, normalizations, actions, summary |
| G02 | Internal All incl images/PDF/CSS | non-HTML does not create main audit action |
| G03 | Missing GSC | readiness warnings; no unsupported growth/CTR conclusion |
| G04 | Missing GA4 and conversion columns | missing vs zero; no unsupported low-value claim |
| G05 | 200/noindex, 3xx, 404, 500 | technical rule precedence and manual-review flags |
| G06 | Cross-domain and alternate canonical | canonical review, business-value safeguards |
| G07 | Top3/10/11/20/21/50 boundaries | position bucket + chosen rule |
| G08 | CTR thresholds and impression confidence boundaries | computed/raw CTR handling |
| G09 | Protected/excluded/review patterns by website type | eligibility/manual-review outputs |
| G10 | Query URLs, Unicode and trailing slashes | raw vs normalized identity, duplicate handling |
| G11 | Metric p30/p50/p80 ties and dataset size variation | full-data bucket equality |
| G12 | Multi-condition URL | first-match precedence exact parity |
| G13 | Invalid/missing required headers, empty CSV, >20k rows | legacy errors and validation |
| G14 | Quoted CSV with delimiter/newlines, decimal/percent locale | parser compatibility |
| G15 | High business value + weak traffic/engagement | correct protect/review outcome |

## M02 — Functional parity gates
1. Record legacy baseline `main` commit SHA and legacy engine/config versions.
2. Run the same frozen input through old and new cores, with consistent project type, patterns and export source.
3. Require 100% equality in counts and user-facing action fields on approved golden fixtures; differences must be individually documented as approved intentional changes.
4. Compare readiness score/status/warnings, normalized fields used by the engine, metric buckets, category counts and summaries.
5. Verify sorted comparison by stable row identity; do not mistake row reordering for lost data.
6. Compare money/number/percentage parsing boundaries and null handling.
7. Keep a versioned discrepancy report with `expected`, `actual`, input row and explanation.
8. No first-match to multi-finding switch inside parity migration.

## M03 — Scalability and resilience gates (PROPOSED targets)
- 20k, 50k, 100k URLs per audit; record file size, columns, memory, CPU, duration.
- Baseline goal P95 <=10 min for import + deterministic audit **on a declared reference machine**; revise after real benchmark.
- At least 3 concurrent audit jobs in controlled benchmark.
- Worker restart, timeout, Redis disconnect and DB transient error cause bounded retry/recovery, not lost/duplicated findings.
- Chunk checkpoint + idempotency key + unique constraint; same job retried yields same final counts.
- 100% reconciliation for accepted and rejected input rows, with rejection reasons.
- Dataset-wide metric percentiles computed before per-row rule evaluation.
- Fail/cancel states remain visible; a partial audit is never labeled complete.

## M04 — Agency security and usability gates
- Organization/project-based authorization on every API/database access.
- Test cross-tenant URL/audit/action access attempts.
- Role matrix for organization admin, SEO manager, SEO specialist, reviewer and viewer.
- CSV validation by extension, type, size, schema and safe storage handling; export spreadsheet formula escaping.
- Pagination/filter/search over 100k URLs without loading all rows into browser.
- User can upload, map columns, see readiness, run audit, inspect evidence, create and approve actions, and export scoped report.
- Immutable audit observations with versioned reviewer decisions.
- Keyboard navigation, responsive layouts, readable Vietnamese typography.

## M05 — AI safety and quality gates
- AI calls use explicit evidence bundles with source identifiers and time windows.
- Structured response validation; mark hypotheses vs observed facts vs approved action.
- Missing evidence disclosed; no fabricated URL facts.
- Budget caps, actual tokens/cost logging, request dedup, rate limits and approved fallback providers.
- User-visible human approval required before destructive SEO actions.
- AI outputs and external content treated as untrusted; enforce tenant isolation.
- Task-specific evaluation suite compares providers on accuracy, evidence grounding, refusal to overclaim, cost and latency.

## M06 — Cutover gates
- Legacy vs new side-by-side reports signed off by SEO owner.
- Functional, security and load test results archived.
- Backup/restore tested and rollback documented.
- Staging passed; release staged by agency/project group.
- No automatic Apps Script `clasp push`, public deployment or merge to `main` without approval.

## Initial risks to turn into tickets
- R01: manifest has `ANYONE` + `USER_DEPLOYING`; verify actual deployment and protect server functions.
- R02: synchronous all-in-one audit; large CSV/runtime failures.
- R03: output spreadsheet created before normalization; partial artifact on error.
- R04: percentile buckets depend on full dataset; naive chunks change classification.
- R05: history in Script Properties (shared, limited).
- R06: fixed output folder ID, Google Drive/Sheets coupling.
- R07: lack of CI regression tests.
- R08: first-match hides other diagnoses; defer behavior change until separate approved release.

## Sign-off sheet (fill later)
- Baseline source commit:
- Fixture pack and checksums:
- Legacy runtime/deployment checked by:
- Audit Core parity reviewed by:
- Security reviewed by:
- Migration phase release approval:
- Outstanding deviations / waivers:
