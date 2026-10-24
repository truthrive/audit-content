/***************************************
 * SheetFormatter.gs
 * Format output spreadsheet
 ***************************************/

function formatOutputSpreadsheet(ss) {
  var auditSheet = ss.getSheetByName(OUTPUT_SHEET_NAMES.AUDIT_ACTIONS);
  if (auditSheet) formatAuditActionsSheet(auditSheet);

  var summarySheet = ss.getSheetByName(OUTPUT_SHEET_NAMES.SUMMARY);
  if (summarySheet) formatSummarySheet(summarySheet);

  var readmeSheet = ss.getSheetByName(OUTPUT_SHEET_NAMES.README);
  if (readmeSheet) formatSimpleKeyValueSheet(readmeSheet);

  var importLogSheet = ss.getSheetByName(OUTPUT_SHEET_NAMES.IMPORT_LOG);
  if (importLogSheet) formatSimpleKeyValueSheet(importLogSheet);

  var readinessSheet = ss.getSheetByName(OUTPUT_SHEET_NAMES.DEBUG_READINESS);
  if (readinessSheet) formatDebugSheet(readinessSheet);

  var rawSheet = ss.getSheetByName(OUTPUT_SHEET_NAMES.DEBUG_RAW);
  if (rawSheet) formatDebugSheet(rawSheet);

  var normalizedSheet = ss.getSheetByName(OUTPUT_SHEET_NAMES.DEBUG_NORMALIZED);
  if (normalizedSheet) formatDebugSheet(normalizedSheet);

  var configSheet = ss.getSheetByName(OUTPUT_SHEET_NAMES.CONFIG);
  if (configSheet) formatSimpleKeyValueSheet(configSheet);

  // Put user-facing sheets first.
  reorderSheets(ss);
}

function formatAuditActionsSheet(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 1 || lastCol < 1) return;

  formatHeaderRow(sheet, 1, lastCol);

  sheet.setFrozenRows(1);
  safeCreateFilter(sheet);

  // Column widths
  setColumnWidthByHeader(sheet, 'URL', 280);
  setColumnWidthByHeader(sheet, 'Nhãn chính', 190);
  setColumnWidthByHeader(sheet, 'Nhãn phụ', 220);
  setColumnWidthByHeader(sheet, 'Hành động đề xuất', 190);
  setColumnWidthByHeader(sheet, 'Ưu tiên', 80);
  setColumnWidthByHeader(sheet, 'Độ tin cậy', 110);
  setColumnWidthByHeader(sheet, 'Bằng chứng', 460);
  setColumnWidthByHeader(sheet, 'Cần review thủ công', 140);
  setColumnWidthByHeader(sheet, 'Trạng thái xử lý', 160);
  setColumnWidthByHeader(sheet, 'Ghi chú', 260);

  var evidenceCol = getColumnIndexByHeader(sheet, 'Bằng chứng');
  if (evidenceCol) {
    sheet.getRange(2, evidenceCol, Math.max(lastRow - 1, 1), 1).setWrap(true);
  }

  var noteCol = getColumnIndexByHeader(sheet, 'Ghi chú');
  if (noteCol) {
    sheet.getRange(2, noteCol, Math.max(lastRow - 1, 1), 1).setWrap(true);
  }

  applyReviewerStatusDropdown(sheet);
  applyPriorityFormatting(sheet);
  applyConfidenceFormatting(sheet);
  applyManualReviewFormatting(sheet);

  sheet.getRange(1, 1, lastRow, lastCol).setVerticalAlignment('top');
}

function formatSummarySheet(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 1 || lastCol < 1) return;

  sheet.setFrozenRows(0);
  sheet.setColumnWidth(1, 280);
  sheet.setColumnWidth(2, 180);

  var values = sheet.getRange(1, 1, lastRow, Math.min(lastCol, 2)).getValues();

  for (var i = 0; i < values.length; i++) {
    var firstCell = values[i][0];
    var secondCell = values[i][1];

    var isSectionHeader =
      firstCell &&
      secondCell === '' &&
      [
        'Overview',
        'Readiness',
        'Count by Label',
        'Count by Action',
        'Count by Priority',
        'Count by Confidence',
        'Manual Review',
        'Top Warnings'
      ].indexOf(firstCell) !== -1;

    if (isSectionHeader) {
      sheet
        .getRange(i + 1, 1, 1, Math.max(lastCol, 2))
        .setFontWeight('bold')
        .setBackground('#e8f0fe');
    }
  }

  sheet.getRange(1, 1, lastRow, lastCol).setVerticalAlignment('top');
}

function formatSimpleKeyValueSheet(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 1 || lastCol < 1) return;

  sheet.setColumnWidth(1, 260);
  sheet.setColumnWidth(2, 520);

  sheet.getRange(1, 1, 1, lastCol).setFontWeight('bold');
  sheet.getRange(1, 1, lastRow, lastCol).setVerticalAlignment('top');
  sheet.getRange(1, 1, lastRow, lastCol).setWrap(true);
}

function formatDebugSheet(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 1 || lastCol < 1) return;

  formatHeaderRow(sheet, 1, lastCol);
  sheet.setFrozenRows(1);
  safeCreateFilter(sheet);

  // Keep debug sheet readable but do not over-format.
  var maxColsToResize = Math.min(lastCol, 20);
  for (var col = 1; col <= maxColsToResize; col++) {
    sheet.setColumnWidth(col, 160);
  }

  sheet.getRange(1, 1, lastRow, lastCol).setVerticalAlignment('top');
}

function formatHeaderRow(sheet, rowIndex, lastCol) {
  sheet
    .getRange(rowIndex, 1, 1, lastCol)
    .setFontWeight('bold')
    .setBackground('#f1f3f4')
    .setVerticalAlignment('middle');
}

function safeCreateFilter(sheet) {
  try {
    var filter = sheet.getFilter();
    if (filter) filter.remove();

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();

    if (lastRow > 1 && lastCol > 0) {
      sheet.getRange(1, 1, lastRow, lastCol).createFilter();
    }
  } catch (err) {
    Logger.log('Could not create filter for sheet ' + sheet.getName() + ': ' + err.message);
  }
}

function getColumnIndexByHeader(sheet, headerName) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return null;

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  for (var i = 0; i < headers.length; i++) {
    if (headers[i] === headerName) {
      return i + 1;
    }
  }

  return null;
}

function setColumnWidthByHeader(sheet, headerName, width) {
  var col = getColumnIndexByHeader(sheet, headerName);
  if (col) sheet.setColumnWidth(col, width);
}

function applyReviewerStatusDropdown(sheet) {
  var col = getColumnIndexByHeader(sheet, 'Trạng thái xử lý');
  if (!col) return;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var rule = SpreadsheetApp
    .newDataValidation()
    .requireValueInList(REVIEWER_STATUS_OPTIONS, true)
    .setAllowInvalid(false)
    .build();

  sheet
    .getRange(2, col, lastRow - 1, 1)
    .setDataValidation(rule);
}

function applyPriorityFormatting(sheet) {
  var col = getColumnIndexByHeader(sheet, 'Ưu tiên');
  if (!col) return;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var range = sheet.getRange(2, col, lastRow - 1, 1);
  var rules = sheet.getConditionalFormatRules();

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('P0')
      .setBackground('#f4cccc')
      .setRanges([range])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('P1')
      .setBackground('#fce5cd')
      .setRanges([range])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('P2')
      .setBackground('#fff2cc')
      .setRanges([range])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('P3')
      .setBackground('#d9ead3')
      .setRanges([range])
      .build()
  );

  sheet.setConditionalFormatRules(rules);
}

function applyConfidenceFormatting(sheet) {
  var col = getColumnIndexByHeader(sheet, 'Độ tin cậy');
  if (!col) return;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var range = sheet.getRange(2, col, lastRow - 1, 1);
  var rules = sheet.getConditionalFormatRules();

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(CONFIDENCE.HIGH)
      .setBackground('#d9ead3')
      .setRanges([range])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(CONFIDENCE.MEDIUM)
      .setBackground('#fff2cc')
      .setRanges([range])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(CONFIDENCE.LOW)
      .setBackground('#fce5cd')
      .setRanges([range])
      .build()
  );

  sheet.setConditionalFormatRules(rules);
}

function applyManualReviewFormatting(sheet) {
  var col = getColumnIndexByHeader(sheet, 'Cần review thủ công');
  if (!col) return;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var range = sheet.getRange(2, col, lastRow - 1, 1);
  var rules = sheet.getConditionalFormatRules();

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(YES_NO.YES)
      .setBackground('#fce5cd')
      .setRanges([range])
      .build()
  );

  sheet.setConditionalFormatRules(rules);
}

function reorderSheets(ss) {
  var desiredOrder = [
    OUTPUT_SHEET_NAMES.README,
    OUTPUT_SHEET_NAMES.IMPORT_LOG,
    OUTPUT_SHEET_NAMES.SUMMARY,
    OUTPUT_SHEET_NAMES.AUDIT_ACTIONS,
    OUTPUT_SHEET_NAMES.DEBUG_RAW,
    OUTPUT_SHEET_NAMES.DEBUG_NORMALIZED,
    OUTPUT_SHEET_NAMES.DEBUG_READINESS,
    OUTPUT_SHEET_NAMES.CONFIG
  ];

  desiredOrder.forEach(function (name, index) {
    var sheet = ss.getSheetByName(name);
    if (sheet) {
      ss.setActiveSheet(sheet);
      ss.moveActiveSheet(index + 1);
    }
  });

  var summarySheet = ss.getSheetByName(OUTPUT_SHEET_NAMES.SUMMARY);
  if (summarySheet) ss.setActiveSheet(summarySheet);
}