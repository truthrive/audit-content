# M00 — Audit Rule Catalog (Legacy v1.2)

Status: **Documented from AuditEngine.js; re-inspected against source 2026-10-26; parity not yet verified against production outputs**.

## Evaluation contract
- Input: one normalized row, shared readiness/config/context.
- `shouldSkipFromMainAudit` excludes `row.is_html === false`. Unknown-scope rows (`is_html === null`) are **not** skipped; they are evaluated by the same ordered rules, but because the final `Monitor` fallback requires `is_html === true`, an unknown-scope row that matches no earlier rule is silently dropped and produces no output row.
- `auditUrl` evaluates ordered functions connected by `||`; the FIRST non-null diagnosis wins.
- `toAuditActionRow` outputs primary label, up to 2 secondary labels, proposed action, P0–P3 priority, confidence, evidence (truncated by `truncateText` to 450 chars: `slice(0, 449) + '…'`), manual-review flag, reviewer status = `Chưa review`, empty notes, and internal debug keys.
- A rule's label is not proof of a confirmed fault. Existing 'review' categories are deliberately cautious.

## Rule priority and key conditions
| Order | Rule function | Key predicate / intent | Proposed action | Caveats |
|---:|---|---|---|---|
| 1 | `evaluateTechnicalBarrier` | Guard: `is_html === true` OR `audit_scope === 'unknown'`; non-200 status, or 200 + non-indexable with `index_eligibility !== 'canonicalized'` | Technical review/fix | Manual review; noindex might be intentional; 3xx not universally an error; priority ladder: P0 if business value, P1 if clicks > 0 or impressions ≥ 200, P2 if inlinks ≥ 50 (the ≥ 100 branch also returns P2) or protected, else P3 |
| 2 | `evaluateCanonicalReview` | `is_canonicalized` OR `is_cross_domain_canonical` OR `index_eligibility === 'canonicalized'` | Canonical review | A cross-URL canonical may be intentional; priority P3 base, P1 if business value or strong traffic/visibility, P2 if any visibility/sessions/inlinks > 0 |
| 3 | `evaluateCtrOpportunity` | Eligible URL; meaningful impressions; Top 10; adequate CTR confidence; low-CTR candidate | Optimize snippet | Threshold heuristics, not measured CTR expected by query/device |
| 4 | `evaluateGrowthOpportunity` | Eligible; meaningful impressions; position 11–20 | Update/refresh; may prefer internal link | Position is aggregate and non-causal |
| 5 | `evaluateInternalLinkOpportunity` | Eligible; low internal links; has additional opportunity signal | Improve internal linking | Relative distribution and business-value checks |
| 6 | `evaluateEngagementIssue` | Eligible; low engagement candidate, adequate confidence; excludes value/protected/excluded | Update/refresh | Low engagement alone cannot prove poor content |
| 7 | `evaluateContentRankingImprovement` | Eligible; meaningful impressions; position 21–50 | Update/refresh | Review intent/coverage first |
| 8 | `evaluateBusinessValuePage` | `has_business_value` (conversions > 0 OR revenue > 0); **no `eligible_url` check** — applies to any non-skipped row | Keep/protect | Earlier technical/CTR/growth issues can take priority |
| 9 | `evaluateActivePerformer` | Eligible and `isActivePerformer` | Keep/protect | Earlier issues still outrank |
| 10 | `evaluateLowValueCandidate` | Eligible; not protected/review/excluded; no business value; GSC, GA4 Sessions and conversions/revenue **columns present** (header availability); impressions, clicks and sessions each zero or `'low'` bucket; business status `no_value_detected`; internal-link bucket very_low/low | **Manual review** | Never auto-noindex, merge, redirect or delete; **null metrics do not count as weak** (`isZeroOrLow` returns false for null), so rows with missing values fall through to rules 11/12 instead |
| 11 | `evaluateManualReview` | Branch order: excluded pattern → review pattern (P2 if strong traffic/visibility) → protected pattern without value/potential → GA4 sessions > 0 with no/zero GSC clicks | Manual review | Golden-test each branch |
| 12 | `evaluateInsufficientData` | Insufficient reliable signals for decision | Insufficient data | Missing is not zero |
| 13 | `evaluateMonitor` | Final fallback **only for `is_html === true`**; unknown-scope rows reaching this point return null and emit no row | Monitor | Baseline fallback |

## Selected thresholds and calculations from source
- Fixed volume thresholds: meaningful impressions >= 50 / high confidence >= 200; clicks >= 10 / >= 50; sessions >= 10 / >= 50. `deriveVolumeConfidence`: null → `'unknown'`, 0 → `'none'`, below meaningful → Low, below high-confidence → Medium, else High.
- Percentile engine (`Utils.percentile`): sorts values and linearly interpolates at index `(p / 100) * (n - 1)`.
- Percentile populations (`deriveBuckets`): impression and click buckets are computed over **eligible rows with values > 0 only**; session buckets over **HTML rows with values > 0 only**. Zeros are excluded from the distribution but bucketed `'none'`; nulls → `'unknown'`. high = value >= p80, medium = >= p50, else low.
- Internal-link buckets (eligible rows, all non-null values **including 0**): `very_low` if <= `VERY_LOW_UNIQUE_INLINKS` (=1), checked before the distribution; then `low` if <= p30, `high` if >= p80, else `medium`.
- Position buckets: <=3 `top_1_3`, <=10 `top_4_10`, <=20 `top_11_20`, <=50 `top_21_50`, else `beyond_50`.
- CTR confidence: Low if impressions < 50 or position null/>20; High if impressions >= 200 and position <= 10; else Medium. Low-CTR candidate uses **computed CTR** (`clicks/impressions`, falling back to raw CTR): position <= 3 and CTR < 3%, or position <= 10 and CTR < 1%, only when confidence is not Low.
- `meaningful_impressions` / `active_organic_traffic` / `active_user_traffic` are true when the respective bucket is high/medium **or** the volume confidence is Medium/High.
- Engagement: low-engagement candidate when engagement rate < 0.30; high-engagement signal when >= 0.6; both require engagement confidence above Low.
- Word count buckets: <100 very_low, <300 low, <800 medium, else high; **not standalone proof of low content quality**.
- Crawl-depth buckets are hardcoded inline: <=1 shallow, <=3 normal, <=5 deep, else very_deep (the `DEEP_CRAWL_DEPTH`/`VERY_DEEP_CRAWL_DEPTH` constants are unused). Response-time buckets likewise hardcoded: <0.5 fast, <1.5 normal, <3 slow, else very_slow.
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
7. The engine never emits `NOINDEX_CANDIDATE`, `REDIRECT_CANDIDATE`, `DELETE_CANDIDATE`, `MERGE_CANDIDATE` or `REWRITE_EXPAND`; destructive outcomes are only referenced in Manual Review evidence text. Trailing-slash variants share one `url_key` (lowercased, trailing slashes stripped), so a canonical differing only by a trailing slash is treated as self-canonical; no noindex/deletion conclusion is attached to that.

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
