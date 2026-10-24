/***************************************
 * OutputWriter.gs
 * Create and write Google Sheet output
 ***************************************/

var OUTPUT_SHEET_NAMES = {
  README: '00_README',
  IMPORT_LOG: '01_IMPORT_LOG',
  AUDIT_ACTIONS: '05_AUDIT_ACTIONS',
  SUMMARY: '06_SUMMARY',
  DEBUG_RAW: 'DEBUG_RAW_UPLOAD',
  DEBUG_NORMALIZED: 'DEBUG_RAW_NORMALIZED',
  DEBUG_READINESS: 'DEBUG_DATA_READINESS',
  CONFIG: 'CONFIG_SNAPSHOT'
};

// Folder output của Thịnh VC
// URL folder: https://drive.google.com/drive/u/0/folders/1j_CKiReQGEM42HuW0lGIIJ1PbFqI3C8K
var OUTPUT_FOLDER_ID = '1j_CKiReQGEM42HuW0lGIIJ1PbFqI3C8K';

function createOutputSpreadsheet(projectName) {
  var safeProjectName = sanitizeProjectName(projectName || 'Untitled Project');
  var fileName = '[Audit Content] ' + safeProjectName + ' - ' + formatDateTime(new Date());

  var ss = SpreadsheetApp.create(fileName);

  SpreadsheetApp.flush();

  moveSpreadsheetToOutputFolder_(ss);

  return ss;
}

function moveSpreadsheetToOutputFolder_(ss) {
  if (!ss || !ss.getId) return false;

  var folderId = getOutputFolderId_();

  if (!folderId) {
    Logger.log('Output folder ID is empty. Skip moving file.');
    return false;
  }

  try {
    var file = DriveApp.getFileById(ss.getId());
    var folder = DriveApp.getFolderById(folderId);

    // Cách chính: moveTo
    file.moveTo(folder);

    Logger.log('Moved output spreadsheet to folder: ' + folder.getName());
    return true;

  } catch (err) {
    Logger.log('moveTo failed: ' + err.message);

    // Fallback cho một số trường hợp Apps Script/DriveApp không moveTo được.
    try {
      var fallbackFile = DriveApp.getFileById(ss.getId());
      var fallbackFolder = DriveApp.getFolderById(folderId);

      fallbackFolder.addFile(fallbackFile);

      try {
        DriveApp.getRootFolder().removeFile(fallbackFile);
      } catch (removeErr) {
        Logger.log('Could not remove file from root folder: ' + removeErr.message);
      }

      Logger.log('Added output spreadsheet to folder by fallback addFile.');
      return true;

    } catch (fallbackErr) {
      Logger.log('Could not move output spreadsheet to folder by fallback: ' + fallbackErr.message);
      return false;
    }
  }
}

function getOutputFolderId_() {
  if (
    typeof CONFIG !== 'undefined' &&
    CONFIG.drive &&
    CONFIG.drive.outputFolderId
  ) {
    return CONFIG.drive.outputFolderId;
  }

  return OUTPUT_FOLDER_ID;
}

function writeReadmeSheet(ss, auditConfig, readiness) {
  var sheet = getOrCreateCleanSheet(ss, OUTPUT_SHEET_NAMES.README);

  var values = [
    ['Baseline Content Audit Tool'],
    [''],
    ['Credit', '© Thịnh VC — Baseline Content Audit Tool'],
    [''],
    ['Thông tin audit', ''],
    ['Project Name', auditConfig.projectName || ''],
    ['Website Type', auditConfig.websiteType || ''],
    ['Export Source', auditConfig.exportSource || ''],
    ['Created At', auditConfig.createdAt || nowString()],
    ['Tool Version', CONFIG.version],
    ['Audit Engine Version', CONFIG.auditEngineVersion || ''],
    [''],
    ['Data Readiness', ''],
    ['Status', readiness ? readiness.status : 'Unknown'],
    ['Score', readiness ? readiness.score : ''],
    ['Warnings', readiness && readiness.warnings ? readiness.warnings.length : 0],
    [''],
    ['Cách sử dụng output', ''],
    ['1', 'Xem Dashboard trong Web App để nắm nhanh kết quả.'],
    ['2', 'Xem 06_SUMMARY để nắm tổng quan trong Google Sheet.'],
    ['3', 'Xem 05_AUDIT_ACTIONS để xử lý từng URL.'],
    ['4', 'Các sheet DEBUG dùng để kiểm tra dữ liệu khi cần.'],
    ['5', 'Các action như Noindex/Gộp/Xóa luôn cần review thủ công trước khi làm.'],
    [''],
    ['Lưu ý', ''],
    ['-', 'Tool không tự quyết định xóa/noindex URL.'],
    ['-', 'Nếu conversion/revenue = 0 toàn site, cần kiểm tra GA4 Key Events trước khi pruning.'],
    ['-', 'Missing data không được hiểu là giá trị bằng 0.']
  ];

  writeValuesToSheet(sheet, values);
}

function writeImportLogSheet(ss, importLog) {
  var sheet = getOrCreateCleanSheet(ss, OUTPUT_SHEET_NAMES.IMPORT_LOG);

  var values = [
    ['Field', 'Value'],
    ['App Name', importLog.appName || CONFIG.appName],
    ['Version', importLog.version || CONFIG.version],
    ['Created At', importLog.createdAt || nowString()],
    ['Project Name', importLog.projectName || ''],
    ['Website Type', importLog.websiteType || ''],
    ['Export Source', importLog.exportSource || ''],
    ['File Name', importLog.fileName || ''],
    ['Delimiter', importLog.delimiter || ''],
    ['Total Rows', importLog.totalRows || 0],
    ['Total Headers', importLog.totalHeaders || 0],
    ['Missing Critical Fields', (importLog.missingCriticalFields || []).join(', ')],
    ['Missing Recommended Fields', (importLog.missingRecommendedFields || []).join(', ')],
    ['Output Folder ID', getOutputFolderId_()]
  ];

  writeValuesToSheet(sheet, values);
}

function writeAuditActionsSheet(ss, auditRows) {
  var sheet = getOrCreateCleanSheet(ss, OUTPUT_SHEET_NAMES.AUDIT_ACTIONS);

  var values = [AUDIT_ACTION_COLUMNS];

  (auditRows || []).forEach(function (row) {
    values.push(AUDIT_ACTION_COLUMNS.map(function (col) {
      return serializeCellValue(row[col]);
    }));
  });

  writeValuesToSheet(sheet, values);
}

function writeSummarySheet(ss, summary) {
  var sheet = getOrCreateCleanSheet(ss, OUTPUT_SHEET_NAMES.SUMMARY);
  var values = flattenSummaryForSheet(summary || {});

  if (!values || !values.length) {
    values = [['Summary'], ['No summary data']];
  }

  writeValuesToSheet(sheet, values);
}

function writeReadinessSheet(ss, readiness) {
  var sheet = getOrCreateCleanSheet(ss, OUTPUT_SHEET_NAMES.DEBUG_READINESS);

  var rows = readiness && readiness.rows ? readiness.rows : [];

  var headers = [
    'group',
    'check',
    'status',
    'detail',
    'recommendation'
  ];

  var values = [headers];

  rows.forEach(function (row) {
    values.push(headers.map(function (h) {
      return serializeCellValue(row[h]);
    }));
  });

  if (values.length === 1) {
    values.push(['', '', '', 'No readiness rows', '']);
  }

  writeValuesToSheet(sheet, values);
}

function writeDebugRawSheet(ss, parsed) {
  var sheet = getOrCreateCleanSheet(ss, OUTPUT_SHEET_NAMES.DEBUG_RAW);

  if (parsed && parsed.rawValues && parsed.rawValues.length) {
    writeValuesToSheet(sheet, parsed.rawValues);
    return;
  }

  if (parsed && parsed.rows && parsed.rows.length) {
    writeObjectRowsToSheet(sheet, parsed.rows);
    return;
  }

  writeValuesToSheet(sheet, [['No raw data']]);
}

function writeDebugNormalizedSheet(ss, normalizedRows) {
  var sheet = getOrCreateCleanSheet(ss, OUTPUT_SHEET_NAMES.DEBUG_NORMALIZED);
  writeObjectRowsToSheet(sheet, normalizedRows || []);
}

function writeConfigSnapshotSheet(ss, auditConfig) {
  var sheet = getOrCreateCleanSheet(ss, OUTPUT_SHEET_NAMES.CONFIG);

  var values = [
    ['Config Key', 'Value'],
    ['appName', CONFIG.appName],
    ['version', CONFIG.version],
    ['auditEngineVersion', CONFIG.auditEngineVersion || ''],
    ['timezone', CONFIG.timezone],
    ['outputFolderId', getOutputFolderId_()],
    ['projectName', auditConfig.projectName || ''],
    ['websiteType', auditConfig.websiteType || ''],
    ['exportSource', auditConfig.exportSource || ''],
    ['protectedPatterns', JSON.stringify(auditConfig.protectedPatterns || [])],
    ['excludedPatterns', JSON.stringify(auditConfig.excludedPatterns || [])],
    ['reviewPatterns', JSON.stringify(auditConfig.reviewPatterns || [])],
    ['thresholds', JSON.stringify(CONFIG.thresholds)]
  ];

  writeValuesToSheet(sheet, values);
}

function writeObjectRowsToSheet(sheet, rows, preferredHeaders) {
  rows = rows || [];

  if (!rows.length) {
    writeValuesToSheet(sheet, [['No data']]);
    return;
  }

  var headers = preferredHeaders && preferredHeaders.length
    ? preferredHeaders
    : getUnionHeaders(rows);

  var values = [headers];

  rows.forEach(function (row) {
    values.push(headers.map(function (header) {
      return serializeCellValue(row[header]);
    }));
  });

  writeValuesToSheet(sheet, values);
}

function getUnionHeaders(rows) {
  var seen = {};
  var headers = [];

  rows.forEach(function (row) {
    Object.keys(row || {}).forEach(function (key) {
      if (!seen[key]) {
        seen[key] = true;
        headers.push(key);
      }
    });
  });

  return headers;
}

function writeValuesToSheet(sheet, values) {
  if (!values || !values.length) {
    values = [['']];
  }

  var width = values.reduce(function (max, row) {
    return Math.max(max, row.length);
  }, 1);

  var normalizedValues = values.map(function (row) {
    var newRow = row.slice();

    while (newRow.length < width) {
      newRow.push('');
    }

    return newRow.map(serializeCellValue);
  });

  sheet.clearContents();
  sheet.clearFormats();

  sheet
    .getRange(1, 1, normalizedValues.length, width)
    .setValues(normalizedValues);
}

function getOrCreateCleanSheet(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  sheet.clear();
  return sheet;
}

function serializeCellValue(value) {
  if (value === null || value === undefined) return '';

  if (Object.prototype.toString.call(value) === '[object Date]') {
    return value;
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (err) {
      return String(value);
    }
  }

  return value;
}

function cleanupDefaultSheets(ss) {
  var sheets = ss.getSheets();

  sheets.forEach(function (sheet) {
    var name = sheet.getName();

    if (name === 'Sheet1' || name === 'Trang tính1') {
      if (ss.getSheets().length > 1) {
        ss.deleteSheet(sheet);
      }
    }
  });
}

function writeAllOutputSheets(ss, payload) {
  writeReadmeSheet(ss, payload.auditConfig, payload.readiness);
  writeImportLogSheet(ss, payload.importLog);
  writeAuditActionsSheet(ss, payload.auditRows);
  writeSummarySheet(ss, payload.summary);
  writeDebugRawSheet(ss, payload.parsed);
  writeDebugNormalizedSheet(ss, payload.normalizedRows);
  writeReadinessSheet(ss, payload.readiness);
  writeConfigSnapshotSheet(ss, payload.auditConfig);

  cleanupDefaultSheets(ss);

  if (typeof formatOutputSpreadsheet === 'function') {
    formatOutputSpreadsheet(ss);
  }

  // Gọi lại một lần sau khi ghi/format để chắc file vẫn nằm đúng folder.
  moveSpreadsheetToOutputFolder_(ss);
}

/**
 * Test move file vào output folder.
 * Chạy trực tiếp function này trong Apps Script để kiểm tra.
 */
function runOutputFolderMoveTest() {
  var ss = createOutputSpreadsheet('Output Folder Move Test');

  var sheet = ss.getSheets()[0];
  sheet.getRange(1, 1).setValue('Test file created at ' + nowString());
  sheet.getRange(2, 1).setValue('If this file is inside output folder, move logic works.');

  Logger.log('Created test spreadsheet: ' + ss.getUrl());
  Logger.log('Expected folder ID: ' + getOutputFolderId_());

  return ss.getUrl();
}