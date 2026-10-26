# M00 — Project Understanding

Status: **Documented from source; runtime behavior not yet verified**  
Source: `truthrive/audit-content`, `main` as inspected 2026-10-24  
Scope: Legacy Google Apps Script baseline, NOT the future Next.js application.

## Product intent
**Baseline Content Audit Tool** turns a Screaming Frog CSV (optionally enriched with GSC/GA4 columns) into URL-level, evidence-based SEO action suggestions, a dashboard, and a Google Sheets report. Intended for SEO review and prioritization, not automatic SEO remediation. `CONFIG.version` is `1.0.0`. `CONFIG.auditEngineVersion` is **not defined** in `Config.js`: the UI and audit history fall back to `'1.2'` (`WebApp.js`, `Client.html`, `Code.js`), while the `00_README` and `CONFIG_SNAPSHOT` sheets write an empty Audit Engine Version (`CONFIG.auditEngineVersion || ''`).

## What exists (verified in source)
- Google Apps Script V8 with HTML Service UI (`Index.html`, `Styles.html`, `Client.html`).
- Server entrypoints: `doGet`, `getUiOptions`, `runAudit`, `getAuditHistory`, `clearAuditHistory`.
- CSV/TXT text parsing, delimiter detection, column alias mapping, mandatory URL and Status Code columns.
- URL/metrics normalization, percentile-based and threshold-based buckets, data-readiness assessment.
- Deterministic ordered rule engine returning at most **one primary audit row per evaluated URL** (first matching rule wins). Non-HTML rows are skipped; HTML rows always receive at least the `Monitor` fallback; **unknown-scope rows run through the same rules but are silently dropped if none matches**, because the `Monitor` fallback requires `is_html === true`.
- Web dashboard, summary, Google Sheets output, and audit-history snapshots stored in Script Properties.

## Actual data flow
1. User selects a file, project name, website type, export source and protected patterns in the browser.
2. `Client.html` reads file text and calls `google.script.run.runAudit(payload)`.
3. `Code.js` validates basic payload and builds configuration through `WebApp.js`.
4. `FileParser.js` parses the CSV and `HeaderMapper.js` matches field aliases.
5. `OutputWriter.js` creates a Google Spreadsheet **before** normalization and rule evaluation.
6. `Normalizer.js` produces normalized rows and dataset-based metric buckets.
7. `DataReadiness.js` computes readiness/warnings.
8. `AuditEngine.js` runs ordered rules; `SummaryBuilder.js` generates aggregate/dashboard data.
9. `OutputWriter.js` writes and formats the report sheets; `Code.js` saves audit-history metadata.
10. UI receives result, dashboard, warnings and history. Errors are returned as `{success:false,error}`.

## Output contracts
Google Sheet tabs: `00_README`, `01_IMPORT_LOG`, `05_AUDIT_ACTIONS`, `06_SUMMARY`, `DEBUG_RAW_UPLOAD`, `DEBUG_RAW_NORMALIZED`, `DEBUG_DATA_READINESS`, `CONFIG_SNAPSHOT`.
Audit action columns: URL, Nhãn chính, Nhãn phụ, Hành động đề xuất, Ưu tiên, Độ tin cậy, Bằng chứng, Cần review thủ công, Trạng thái xử lý, Ghi chú. Internal debug keys are not part of the user-facing contract.

## Current boundaries and limitations
- `CONFIG.limits.maxRows=20000` (recommended 10,000) is enforced server-side: both `parseCsvFile` and `validateParsedCsv` throw when parsed data rows exceed 20,000. The 10 MB file-size limit is enforced **only in the browser** (`Client.html` compares `file.size` with the limit advertised by `getUiOptions`, defaulting to 10 MB); the server performs no size check.
- CSV is held and parsed as a single input; report output depends on Google Sheets/Drive APIs and Apps Script runtime quotas.
- All transformation stages operate on full in-memory arrays within one synchronous Apps Script execution. No benchmark exists for 20k/50k/100k-URL datasets; capacity beyond the 20,000-row import limit is an **open hypothesis, not a measured failure** — do not assert failure or specific RAM usage without benchmarking.
- UTF-8 BOM is stripped from headers by `normalizeHeaderText`; delimiter detection counts delimiters on the first line and is unaffected by a leading BOM. No BOM-related parsing defect is confirmed in source; BOM/encoding variants still need fixture coverage (G14).
- URL identity (`buildUrlKey`) = lowercase hostname + path with **trailing slashes stripped** and lowercased, so `/a/` and `/a` share one identity; a canonical differing only by trailing slash is treated as self-canonical. Raw URLs are preserved in output. No noindex/deletion decision is attached to trailing-slash variants, and the engine never emits `NOINDEX_CANDIDATE`, `REDIRECT_CANDIDATE`, `DELETE_CANDIDATE` or `MERGE_CANDIDATE` (those `ACTIONS` constants are defined but unused).
- GSC/GA4 are **CSV fields**, not direct GSC/GA4 live API connectors in this repository.
- First matching audit rule wins; no complete multi-finding list per URL.
- No multi-user agency roles, project tenant isolation, database persistence, dedicated worker queue, AI gateway, or automated CI tests visible in current tree.
- `appsscript.json`: `webapp.access=ANYONE`, `executeAs=USER_DEPLOYING`, Drive/Sheets/external-request OAuth scopes. This is a **configuration-level security risk** until the active deployment's effective permissions are verified; the repository manifest alone does not prove deployed access.
- `doGet` sets `ALLOWALL` X-Frame-Options mode; deployment and embedding controls need separate verification.
- Output Drive folder ID configured in `Config.js` and fallback in `OutputWriter.js`; it is a project configuration reference, not an API token.
- Frontend HTML/CSS has observable markup/style defects; keep separate from migration parity.

## Target product (proposed, not implemented)
Agency product for 20,000–100,000 URLs/audit: TypeScript modular monolith, Next.js web, independent Node workers, PostgreSQL, Redis/BullMQ, object storage, role-based project/organization access, findings and action tracking, human-reviewed AI multi-model gateway.
Preserve existing rule semantics initially; improve rules only through separately approved changes.

## Migration principles
1. **Evidence first**: distinguish observations, deterministic findings, AI hypotheses, reviewer decisions.
2. **Baseline parity first**: preserve current `AuditEngine v1.2` outcomes before new capabilities.
3. **Missing is not zero**: persist availability/provenance of every key metric.
4. **Immutable audit snapshots**; tasks and reviewer decisions live in separately versioned records.
5. **Never automatically** push to Apps Script production, merge to main or execute destructive SEO actions.
6. Agency data must be scoped by organization/project on the server.
7. AI must not mutate source measurements or canonical deterministic findings.

## Decisions / unknowns to resolve in M00
- Obtain representative, sanitized CSVs and **actual legacy output files** (not yet supplied).
- Establish audit-run data window and GSC/GA4 date matching requirements.
- Define URL identity policy, parameter handling, trailing slash and canonical variants.
- Confirm whether 20k–100k is per upload, per site, or per complete joined dataset; current working assumption is per audit run.
- Confirm real deployment access, expected concurrent agency users, retention policy, and hosting budget.
- Benchmark memory/time with representative 20k/50k/100k files after migration.
