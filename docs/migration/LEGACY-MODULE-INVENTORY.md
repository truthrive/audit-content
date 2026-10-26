# M00 — Legacy Module Inventory

Status: **Source inventory completed and re-inspected against source 2026-10-26; runtime call traces not independently verified**
Baseline: 16 Google Apps Script source files at repository root, plus `.gitignore`.

| File | Main responsibilities | Key functions or exports | Target migration |
|---|---|---|---|
| `appsscript.json` | V8 runtime, OAuth scopes, Web App deployment declaration | timezone, executeAs, access | environment/deployment documentation; not copied to Node runtime |
| `Config.js` | Constants, thresholds, labels, website types, header aliases, pattern defaults | `CONFIG`, `HEADER_ALIASES`, `DEFAULT_PATTERNS`, `LABELS`, `ACTIONS` | typed config, versioned rules |
| `Code.js` | Entrypoints, orchestrated run, history stored in Script Properties | `doGet`, `runAudit`, `saveAuditHistory`, `getAuditHistory`, `clearAuditHistory` | API orchestration, job submission, persistent audit history |
| `WebApp.js` | Build run config from UI; return UI option definitions | `buildAuditConfig`, `getUiOptions` | server-side config validation + frontend metadata API |
| `FileParser.js` | CSV parsing, delimiter detection, import log | `parseCsvFile`, `detectDelimiter`, `validateParsedCsv` | streaming parser, ingestion validation |
| `HeaderMapper.js` | Map aliases to required/recommended metrics, source availability | `buildHeaderMap`, `validateCriticalHeaders`, `isGscDataAvailable` | typed field mapping and source coverage |
| `Normalizer.js` | Scope/status/indexability/canonical/GSC/GA4/content fields; patterns and buckets | `normalizeRows`, `normalizeRow`, `deriveBuckets`, `applyMetricBuckets` | pure audit-core, 2-pass dataset context |
| `DataReadiness.js` | Missing-source warnings, readiness score/status | `runDataReadiness`, `deriveReadinessStatus` | deterministic data-quality module |
| `AuditEngine.js` | Ordered URL diagnosis and action row generation | `auditUrl`, `runBaselineAudit`, `evaluate*()` | versioned deterministic engine; parity tests |
| `SummaryBuilder.js` | Aggregation and web dashboard data | `buildSummary`, `buildWebAppDashboard` | reporting/query service |
| `OutputWriter.js` | Spreadsheet creation, Drive move, output sheets | `createOutputSpreadsheet`, `writeAllOutputSheets` | database writing + separate exporters |
| `SheetFormatter.js` | Sheet order, formatting, filters, conditional formatting | `formatOutputSpreadsheet`, `formatAuditActionsSheet` | optional Sheets export adapter |
| `Utils.js` | Number/percent/URL parsing, pattern and date helpers | `parseNumber`, `parsePercent`, `normalizeUrl`, `buildUrlKey`, `percentile` | pure shared/core utility package |
| `Index.html` | Server-rendered HTML layout and UI tabs | Google template includes | Next.js routes/components |
| `Styles.html` | CSS style definitions and responsive presentation | CSS rules | design tokens + UI components |
| `Client.html` | Client state, file reader, Apps Script RPC, dashboard/history rendering | `handleRunAudit`, `renderDashboard`, `loadAuditHistory` | React client + typed API hooks |

## Dependency / call graph observed
```text
Client.html --google.script.run--> Code.js:runAudit
  ├─ validateRunAuditPayload
  ├─ WebApp.js:buildAuditConfig
  ├─ FileParser.js:parseCsvFile + validateParsedCsv
  ├─ HeaderMapper.js:buildHeaderMap + validateCriticalHeaders
  ├─ OutputWriter.js:createOutputSpreadsheet   <-- SIDE EFFECT BEFORE AUDIT
  ├─ Normalizer.js:normalizeRows + deriveBuckets
  ├─ DataReadiness.js:runDataReadiness
  ├─ AuditEngine.js:runBaselineAudit
  ├─ SummaryBuilder.js:buildSummary + buildWebAppDashboard
  ├─ OutputWriter.js:writeAllOutputSheets
  └─ Code.js:saveAuditHistory + getAuditHistory
```
All Apps Script files share globals rather than ES module imports. Dependencies are logical/function-level, not import statements. The target must eliminate implicit global coupling.

## Side-effect boundaries to extract
- `SpreadsheetApp`, `DriveApp`: create/move/write/format report.
- `PropertiesService`: save/read/clear history shared at script level.
- `HtmlService`, `google.script.run`: legacy server/client transport.
- `Utilities.parseCsv`: Apps Script parser; compatibility differences require fixtures.

## Core vs adapters
**Core candidates:** `Utils`, `HeaderMapper`, normalization/bucketing, data readiness, rule engine, summary calculations.

**Adapters to replace:** CSV reader, Apps Script entrypoints, Google Sheets/Drive, history storage, UI.

## Migration order
1. Snapshot reference files and write golden cases.
2. Utilities + types, header mapping, normalization.
3. Dataset preprocessing and readiness.
4. Rule engine (preserve exact ordered precedence), aggregation.
5. Streaming CSV adapter and data persistence.
6. API and background job orchestration.
7. UI and optional Google Sheets exporter.
8. AI review gateway only after trustworthy findings and provenance exist.

## Verified implementation details (re-inspection 2026-10-26)
- Header mapping (`findHeader`) is **exact equality** after `normalizeComparableText` (lowercase, trim, collapse whitespace, strip BOM). The second "loose match fallback" loop repeats the same equality test and is redundant dead code; there is no substring/fuzzy matching.
- Dead `CONFIG.thresholds` constants: `LOW_UNIQUE_INLINKS`, `DEEP_CRAWL_DEPTH`, `VERY_DEEP_CRAWL_DEPTH`, `SLOW_RESPONSE_TIME`, `VERY_SLOW_RESPONSE_TIME` are never read. Crawl-depth buckets (≤1 shallow / ≤3 normal / ≤5 deep / else very_deep) and response-time buckets (0.5 / 1.5 / 3 s) are hardcoded inline in `Normalizer.js`. Parity must replicate the **inline values**, not the unused constants; the constants are misleading configuration, not a demonstrated cause of incorrect SEO outcomes.
- `HEADER_ALIASES.outlinks` / `unique_outlinks` are mapped but never consumed by the Normalizer.
- `ACTIONS.REWRITE_EXPAND`, `MERGE_CANDIDATE`, `NOINDEX_CANDIDATE`, `REDIRECT_CANDIDATE`, `DELETE_CANDIDATE` are defined but **never emitted** by the engine; destructive outcomes can only be surfaced through Manual Review evidence text.
- The 10 MB file-size limit is enforced client-side only (`Client.html`); the server validates presence, extension and row count, but not size.
- `moveSpreadsheetToOutputFolder_` is invoked twice per run: after spreadsheet creation and again at the end of `writeAllOutputSheets`.

## Inventory risks / follow-up
Classification: **[Confirmed]** = verified in source; **[Risk]** = plausible harm, deployment-dependent; **[Hypothesis]** = unverified, requires benchmark or fixture.

- [Confirmed] Runs in one synchronous execution; the output spreadsheet is created after parse/header validation but **before** normalization and rule evaluation, so a later error leaves a partial artifact.
- [Confirmed] All data transformations operate on full in-memory arrays.
- [Confirmed] `deriveBuckets` computes dataset-wide distributions; arbitrary per-chunk evaluation would change findings.
- [Confirmed] Audit history lives in shared Script Properties (`AUDIT_HISTORY_V1`, newest-first, last 50 entries) and is overwritten across users.
- [Confirmed] Main output represents the first matching rule rather than every applicable rule.
- [Confirmed] Unknown-scope rows that match no rule are silently dropped: `evaluateMonitor` requires `is_html === true`.
- [Confirmed] Engine-version reporting is inconsistent: `CONFIG.auditEngineVersion` is undefined; UI/history fall back to `'1.2'`, while `00_README`/`CONFIG_SNAPSHOT` write an empty string.
- [Confirmed] Dead threshold constants and never-emitted destructive `ACTIONS` are configuration noise, **not** confirmed causes of wrong outcomes (see verified details).
- [Confirmed] 10 MB size limit enforced client-side only.
- [Risk] `webapp.access=ANYONE` + `ALLOWALL` framing require a deployed-instance audit; the repository manifest alone does not prove effective permissions.
- [Hypothesis] Specific memory/time failure at 20k/50k/100k URLs — unbenchmarked; do not assert outcomes or RAM figures.
- Script tests are callable smoke functions, not an automated CI suite.

**No source code changes authorized in M00.**
