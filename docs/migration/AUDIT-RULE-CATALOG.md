# M00 — Audit Rule Catalog (Legacy v1.2)

Status: **Documented from AuditEngine.js; parity not yet verified against production outputs**.

## Evaluation contract
- Input: one normalized row, shared readiness/config/context.
- `shouldSkipFromMainAudit` excludes `row.is_html === false`. Unknown scope may remain for insufficient/manual review.
- `auditUrl` evaluates ordered functions connected by `||`; the FIRST non-null diagnosis wins.
- `toAuditActionRow` outputs primary label, up to 2 secondary labels, proposed action, P0–P3 priority, confidence, evidence (truncated to 450 chars), manual-review flag, reviewer status = `Chưa review`, empty notes, and internal debug keys.
- A rule's label is not proof of a confirmed fault. Existing 'review' categories are deliberately cautious.

## Rule priority and key conditions
| Order | Rule function | Key predicate / intent | Proposed action | Caveats |
|---:|---|---|---|---|
| 1 | `evaluateTechnicalBarrier` | Non-200 status or 200/non-indexable excluding canonicalized, for relevant/unknown HTML scope | Technical review/fix | Manual review; noindex might be intentional; 3xx not universally an error |
| 2 | `evaluateCanonicalReview` | Canonicalized, cross-domain or index eligibility canonicalized | Canonical review | A cross-URL canonical may be intentional |
| 3 | `evaluateCtrOpportunity` | Eligible URL; meaningful impressions; Top 10; adequate CTR confidence; low-CTR candidate | Optimize snippet | Threshold heuristics, not measured CTR expected by query/device |
| 4 | `evaluateGrowthOpportunity` | Eligible; meaningful impressions; position 11–20 | Update/refresh; may prefer internal link | Position is aggregate and non-causal |
| 5 | `evaluateInternalLinkOpportunity` | Eligible; low internal links; has additional opportunity signal | Improve internal linking | Relative distribution and business-value checks |
| 6 | `evaluateEngagementIssue` | Eligible; low engagement candidate, adequate confidence; excludes value/protected/excluded | Update/refresh | Low engagement alone cannot prove poor content |
| 7 | `evaluateContentRankingImprovement` | Eligible; meaningful impressions; position 21–50 | Update/refresh | Review intent/coverage first |
| 8 | `evaluateBusinessValuePage` | Business value signal present | Keep/protect | Earlier technical/CTR/growth issues can take priority |
| 9 | `evaluateActivePerformer` | Eligible and `isActivePerformer` | Keep/protect | Earlier issues still outrank |
| 10 | `evaluateLowValueCandidate` | Eligible; not protected/review/excluded/value; has GSC + GA4 behavior + business data; weak visibility/traffic/business/internal links | **Manual review** | Never auto-noindex, merge, redirect or delete |
| 11 | `evaluateManualReview` | Excluded, review-pattern, protected or other manual-review guardrails | Manual review | Exact branch priority should be golden-tested |
| 12 | `evaluateInsufficientData` | Insufficient reliable signals for decision | Insufficient data | Missing is not zero |
| 13 | `evaluateMonitor` | Final fallback for remaining rows | Monitor | Baseline fallback |

## Selected thresholds and calculations from source
- Meaningful impressions >= 50; high confidence impressions >= 200.
- Meaningful clicks >= 10; high confidence clicks >= 50.
- Meaningful sessions >= 10; high confidence sessions >= 50.
- Low engagement rate threshold < 0.30 when adequate data present.
- Very low unique inlinks <= 1; other inlink buckets use dataset distribution.
- Position buckets <=3, <=10, <=20, <=50, >50.
- Low CTR candidate: position <=3 and CTR <3%, or position <=10 and CTR <1%, after confidence gate.
- Word count <100 very low, <300 low, <800 medium; **not standalone proof of low content quality**.
- Metric buckets depend on distribution of positive values: percentile p80 high, p50 medium in `applyMetricBuckets`; internal-link distribution uses p30/p80 plus absolute threshold.
- Actual eligibility/confidence calculations reside in `Normalizer.js`; rule predicates must be tested together with normalization, not in isolation.

## Output nomenclature
Primary categories from `LABELS`: technical barrier, business value page, active performer, growth opportunity, CTR opportunity, internal link opportunity, ranking/content improvement, engagement issue, low value candidate, canonical review, manual review, insufficient data, monitor.

Priorities: `P0`, `P1`, `P2`, `P3`. Confidence: `Cao`, `Trung bình`, `Thấp`. Manual-review flag: `Có`/`Không`.

## Known design constraints
1. First-match classification hides other potentially relevant diagnoses; **do not fix during parity migration**.
2. Secondary labels are limited to two and do not imply all applicable rules were evaluated.
3. Cross-audit changes in dataset percentiles can alter classifications without changes to an individual URL.
4. Eligibility and protected/review/excluded patterns depend on website type and user inputs.
5. CTR benchmarks are fixed heuristics; they are not channel/device/brand-adjusted expectations.
6. Missing data coverage must prevent unsupported destructive recommendations.

## Required test matrix
- Each of 13 rules: one positive case, one negative boundary case, one conflicting higher-priority case.
- Status 200/3xx/4xx/5xx; indexable/noindex/canonicalized; HTML/non-HTML/unknown content type.
- CTR at impressions 49/50/199/200, position 3/10/11, CTR 0.0099/0.01/0.0299/0.03.
- Position 3/10/20/50 and immediately outside each boundary.
- Missing/null vs zero for GSC/GA4/revenue.
- Business-value page also matching higher priority issue.
- Protected/review/excluded pattern overlap; query-parameter URL variants.
- Dataset p30/p50/p80 tie/boundary distributions; compare full-dataset vs chunked computations.
- Conflicting two+ findings on one URL: preserve first-match primary in legacy parity test.

## Future engine proposal (NOT current behavior)
Produce a collection of `rule_findings[]`, choose primary with explicit ranking, track each rule version and evidence provenance, then let human or AI-assisted review propose actions. Version this as a separate change after M02 parity acceptance.
