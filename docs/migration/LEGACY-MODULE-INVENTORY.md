# M00 — Legacy Module Inventory

Status: **Source inventory completed; runtime call traces not independently verified**  
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

## Inventory risks / follow-up
- App Script runs in one execution, with report creation before business logic is fully validated.
- All data transformations currently operate on arrays in memory.
- `deriveBuckets` needs dataset-wide distributions; arbitrary per-chunk evaluation will change findings.
- History may be overwritten across users; Script Properties are shared project-level.
- Main output currently represents first matching rule rather than every applicable rule.
- Security configuration requires a deployed-instance audit; repository manifest alone does not prove effective permissions.
- Script tests are callable smoke functions, not an automated CI suite.

**No source code changes authorized in M00.**
