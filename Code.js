/***************************************
 * Code.gs
 * Main entry + pipeline integration + Audit History
 ***************************************/

var AUDIT_HISTORY_KEY = 'AUDIT_HISTORY_V1';
var AUDIT_HISTORY_LIMIT = 50;

function doGet(e) {
  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle(CONFIG.appName)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Main server-side audit runner.
 * Called from Client.html via google.script.run.runAudit(payload)
 */
function runAudit(payload) {
  try {
    validateRunAuditPayload(payload);

    var auditConfig = buildAuditConfig(payload);

    var parsed = parseCsvFile(payload.fileContent);
    validateParsedCsv(parsed);

    var headerMap = buildHeaderMap(parsed.headers);
    validateCriticalHeaders(headerMap);

    var ss = createOutputSpreadsheet(auditConfig.projectName);

    var importLog = buildImportLog(payload, parsed, headerMap);

    var normalizedRows = normalizeRows(parsed.rows, headerMap, auditConfig);
    normalizedRows = deriveBuckets(normalizedRows, auditConfig);

    var readiness = runDataReadiness(normalizedRows, headerMap, auditConfig);

    var auditRows = runBaselineAudit(normalizedRows, readiness, auditConfig);

    var summary = buildSummary(auditRows, readiness, normalizedRows);
    var dashboard = buildWebAppDashboard(auditRows, readiness, normalizedRows);

    writeAllOutputSheets(ss, {
      auditConfig: auditConfig,
      importLog: importLog,
      parsed: parsed,
      normalizedRows: normalizedRows,
      readiness: readiness,
      auditRows: auditRows,
      summary: summary
    });

    var result = {
      success: true,
      spreadsheetUrl: ss.getUrl(),
      spreadsheetId: ss.getId(),
      readinessStatus: readiness.status,
      readinessScore: readiness.score,
      uploadedRows: parsed.totalRows,
      auditedUrls: auditRows.length,
      warnings: readiness.warnings || [],
      dashboard: dashboard
    };

    var historyItem = saveAuditHistory({
      auditConfig: auditConfig,
      payload: payload,
      result: result,
      readiness: readiness,
      parsed: parsed,
      auditRows: auditRows
    });

    result.historyItem = historyItem;
    result.history = getAuditHistory();

    return result;

  } catch (err) {
    return {
      success: false,
      error: err && err.message ? err.message : String(err)
    };
  }
}

/**
 * Optional backend smoke test.
 * Run this directly in Apps Script editor.
 */
function runBackendIntegrationTest() {
  var sampleCsv = [
    'Address,Content Type,Status Code,Indexability,Indexability Status,Canonical Link Element 1,Clicks,Impressions,CTR,Position,GA4 Sessions,GA4 Conversions,Unique Inlinks,Crawl Depth,Word Count,Response Time',
    'https://example.com/cong-nhom-duc/,text/html,200,Indexable,,https://example.com/cong-nhom-duc/,97,10490,0.9%,8.96,120,0,20,2,1200,0.7',
    'https://example.com/ban-ghe-nhom-duc/,text/html,200,Indexable,,https://example.com/ban-ghe-nhom-duc/,10,1047,0.9%,16.59,12,0,4,3,800,0.8',
    'https://example.com/tin-tuc/,text/html,200,Non-Indexable,Noindex,https://example.com/tin-tuc/,5,300,1.6%,9,6,0,207,1,500,1.2',
    'https://example.com/image.jpg,image/jpeg,200,,,,0,0,,0,0,0,0,0,0,0.2'
  ].join('\n');

  var result = runAudit({
    projectName: 'Backend Integration Test',
    websiteType: WEBSITE_TYPES.SERVICES,
    exportSource: EXPORT_SOURCES.INTERNAL_ALL,
    protectedPatterns: '',
    fileName: 'backend_integration_test.csv',
    fileContent: sampleCsv
  });

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function validateRunAuditPayload(payload) {
  if (!payload) {
    throw new Error('Không nhận được payload.');
  }

  if (isBlank(payload.projectName)) {
    throw new Error('Vui lòng nhập Project Name.');
  }

  if (isBlank(payload.fileContent)) {
    throw new Error('Không đọc được nội dung file CSV.');
  }

  if (payload.fileName && !String(payload.fileName).toLowerCase().match(/\.(csv|txt)$/)) {
    throw new Error('MVP hiện chỉ hỗ trợ file CSV/TXT export từ Screaming Frog.');
  }

  return true;
}

/***************************************
 * Audit History
 ***************************************/

function saveAuditHistory(data) {
  data = data || {};

  var auditConfig = data.auditConfig || {};
  var payload = data.payload || {};
  var result = data.result || {};
  var readiness = data.readiness || {};
  var parsed = data.parsed || {};
  var auditRows = data.auditRows || [];

  var item = {
    id: 'HIS_' + formatDateKey(new Date()) + '_' + Math.floor(Math.random() * 100000),
    createdAt: auditConfig.createdAt || nowString(),
    projectName: auditConfig.projectName || payload.projectName || '',
    websiteType: auditConfig.websiteType || payload.websiteType || '',
    exportSource: auditConfig.exportSource || payload.exportSource || '',
    fileName: payload.fileName || auditConfig.fileName || '',
    spreadsheetUrl: result.spreadsheetUrl || '',
    spreadsheetId: result.spreadsheetId || '',
    readinessStatus: readiness.status || result.readinessStatus || '',
    readinessScore: readiness.score !== undefined ? readiness.score : result.readinessScore,
    uploadedRows: parsed.totalRows || result.uploadedRows || 0,
    auditRows: auditRows.length || result.auditedUrls || 0,
    warningsCount: readiness.warnings ? readiness.warnings.length : (result.warnings ? result.warnings.length : 0),
    warnings: readiness.warnings || result.warnings || [],
    dashboardSnapshot: createDashboardSnapshotForHistory_(result.dashboard),
    toolVersion: CONFIG.version,
    auditEngineVersion: CONFIG.auditEngineVersion || '1.2'
  };

  var history = getAuditHistory();

  history.unshift(item);

  history = history.slice(0, AUDIT_HISTORY_LIMIT);

  PropertiesService
    .getScriptProperties()
    .setProperty(AUDIT_HISTORY_KEY, JSON.stringify(history));

  return item;
}

function getAuditHistory() {
  var raw = PropertiesService
    .getScriptProperties()
    .getProperty(AUDIT_HISTORY_KEY);

  if (!raw) return [];

  try {
    var parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed;
  } catch (err) {
    Logger.log('Cannot parse audit history: ' + err.message);
    return [];
  }
}

function clearAuditHistory() {
  PropertiesService
    .getScriptProperties()
    .deleteProperty(AUDIT_HISTORY_KEY);

  return {
    success: true,
    history: []
  };
}

function runAuditHistoryTest() {
  var history = getAuditHistory();
  Logger.log(JSON.stringify(history, null, 2));
  return history;
}
function createDashboardSnapshotForHistory_(dashboard) {
  if (!dashboard) return null;

  return {
    overview: dashboard.overview || {},
    dataQuality: dashboard.dataQuality || {},
    keyCounts: dashboard.keyCounts || {},

    priorityBreakdown: (dashboard.priorityBreakdown || []).slice(0, 8),
    labelBreakdown: (dashboard.labelBreakdown || []).slice(0, 12),
    actionBreakdown: (dashboard.actionBreakdown || []).slice(0, 12),
    confidenceBreakdown: (dashboard.confidenceBreakdown || []).slice(0, 8),

    topPriorityRows: (dashboard.topPriorityRows || []).slice(0, 10).map(function (row) {
      return {
        url: truncateText(row.url || '', 180),
        primaryLabel: row.primaryLabel || '',
        action: row.action || '',
        priority: row.priority || '',
        confidence: row.confidence || '',
        evidence: truncateText(row.evidence || '', 220),
        manualReview: row.manualReview || ''
      };
    }),

    warnings: (dashboard.warnings || []).slice(0, 10)
  };
}