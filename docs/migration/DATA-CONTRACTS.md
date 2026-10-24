# M00 — Data Contracts

Status: **Legacy contract extracted from source; schema details still need golden output verification.**

## 1. Input transport
Browser UI reads CSV text and calls `google.script.run.runAudit(payload)`.

```text
payload:
  projectName: string (required, nonblank)
  websiteType: general | ecommerce | services | blog | directory
  exportSource: internal_html | internal_all | unknown
  protectedPatterns: string (optional)
  fileName: string (optional; .csv or .txt)
  fileContent: string (required; CSV text)
```
Basic server validation checks presence of projectName/fileContent and filename extension when given. CSV parser validates nonempty headers/data and <=20,000 rows. Scope is Screaming Frog CSV, optionally carrying GSC/GA4 columns.

## 2. Parsed CSV contract
`parseCsvFile` returns:
- `delimiter`: detected comma, semicolon or tab.
- `headers`: normalized heading strings.
- `rows`: array of objects keyed by header.
- `rawValues`: entire parsed grid.
- `totalRows`: count after blank-row filtering.

`HEADER_ALIASES` maps multiple source names to canonical fields. Critical fields: `url`, `status_code`. Recommended fields include `content_type`, `indexability`, `indexability_status`, `canonical`, `gsc_clicks`, `gsc_impressions`, `gsc_position`, `ga4_sessions`, `ga4_conversions`, `unique_inlinks`, `crawl_depth`.

## 3. Normalized row (selected fields)
Identity/scope: `row_index`, `url`, `url_key`, `domain`, `path`, `content_type`, `is_html`, `audit_scope`, `scope_confidence`, `eligible_url`.
Technical: `status_code`, `status_group`, indexability/index eligibility, canonical flags, `response_time`.
Search: `gsc_clicks`, `gsc_impressions`, `gsc_ctr_raw`, `gsc_ctr_computed`, `gsc_position`, position/volume/CTR buckets.
Analytics: `ga4_sessions`, `ga4_views`, `ga4_engaged_sessions`, `ga4_engagement_rate`, `ga4_conversions`, `ga4_total_revenue`, business-value status/availability.
Links/content: `internal_link_count`, inlink buckets, `crawl_depth`, `word_count`, title/meta/H1 fields, derived flags.
Patterns: `protected_pattern`, `excluded_pattern`, `review_pattern`.

**Do not treat this selected inventory as an exhaustive typed interface**. M01/M02 must derive the full type from all assignments and output fields, with fixtures.

## 4. Readiness
`runDataReadiness` returns `score`, `status`, `warnings[]`, `rows[]`, `summary`. Missing critical headers return blocked score 0. Selected penalties: Content Type -10, Indexability -10, Canonical -5, GSC -20, GA4 Sessions -10, business value metrics -15; additional logic is in `DataReadiness.js`. Score is *data completeness/readiness*, **not an SEO quality score**.

## 5. Audit action row
Required user-facing fields, by exact header:
```text
URL
Nhãn chính
Nhãn phụ
Hành động đề xuất
Ưu tiên
Độ tin cậy
Bằng chứng
Cần review thủ công
Trạng thái xử lý
Ghi chú
```
Defaults include `Trạng thái xử lý = Chưa review`; evidence truncated to 450 chars. Internal `_labelKey`, `_actionKey`, `_rowIndex` support diagnostics, not final sheet interface.

## 6. Side effects / reports
`writeAllOutputSheets` writes:
- `00_README`
- `01_IMPORT_LOG`
- `05_AUDIT_ACTIONS`
- `06_SUMMARY`
- `DEBUG_RAW_UPLOAD`
- `DEBUG_RAW_NORMALIZED`
- `DEBUG_DATA_READINESS`
- `CONFIG_SNAPSHOT`

Result returned to UI:
```text
success: boolean
spreadsheetUrl, spreadsheetId
readinessStatus, readinessScore
uploadedRows, auditedUrls
warnings[]
dashboard
historyItem, history
```
On caught failures: `{success:false,error:string}`. Output spreadsheet might already have been created.

History: Script Properties key `AUDIT_HISTORY_V1`, capped at 50; includes metadata, warnings and bounded dashboard snapshots. Not a durable multi-user audit database.

## 7. Target agency contracts (PROPOSED)
- `Organization` owns `Project`; each `AuditRun` is immutable and belongs to one project.
- `ImportFile` stores object reference, checksum, source schema version, field mapping, source dates.
- `AuditUrl` stores observed URL, normalized identity, metrics with **null/zero distinction**, source refs and snapshot date.
- `Finding` stores rule/version, evidence refs, severity, confidence and explanation.
- `Action` stores separately approved tasks/status/owner, not mixed into immutable audit snapshots.
- `AiReview` stores model/provider/prompt version, evidence refs, hypotheses, approval, tokens/cost.
- Explicit org/project authorization applies to every read/write.

## 8. Data invariants
1. Missing/null differs from numeric 0; lack of conversions data is not proof of no business value.
2. Preserve the raw URL exactly; normalization and identity algorithm are versioned.
3. Do not strip query parameters by default; parameter URLs may have distinct meaning.
4. Keep crawl/GSC/GA4 source periods and origin metadata distinct.
5. Separate observed facts from inferred flags, findings and human decisions.
6. Import and finding writes must be idempotent on retry; no partial output presented as final.
7. No storing raw external page HTML or sensitive values inside AI logs without retention/privacy policy.

## 9. Open questions
- GSC/GA4 dates, account/property/source configuration, cross-source joining by canonical vs exact URL.
- Duplicate URL rows and query-parameter policy.
- Formula/CSV injection handling for exported spreadsheet cells.
- Schema version migration strategy and data retention.
- Whether source CSV is authoritative enough to establish page type and content freshness.
