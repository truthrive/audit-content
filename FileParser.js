/***************************************
 * FileParser.gs
 * Parse uploaded CSV into headers + row objects
 ***************************************/

function parseCsvFile(fileContent) {
  if (!fileContent || !String(fileContent).trim()) {
    throw new Error('File rỗng hoặc không đọc được nội dung.');
  }

  var delimiter = detectDelimiter(fileContent);
  var values = Utilities.parseCsv(fileContent, delimiter);

  if (!values || values.length < 2) {
    throw new Error('File không có đủ header và data rows.');
  }

  var headers = values[0].map(normalizeHeaderText);

  if (!headers.length || headers.every(isBlank)) {
    throw new Error('Không tìm thấy header trong file.');
  }

  var dataValues = values.slice(1).filter(function (row) {
    return row && row.some(function (cell) {
      return !isBlank(cell);
    });
  });

  if (!dataValues.length) {
    throw new Error('File không có data rows.');
  }

  if (dataValues.length > CONFIG.limits.maxRows) {
    throw new Error(
      'File có ' + dataValues.length + ' rows, vượt giới hạn MVP là ' +
      CONFIG.limits.maxRows + ' rows.'
    );
  }

  var rows = dataValues.map(function (row) {
    var obj = {};

    headers.forEach(function (header, index) {
      obj[header] = row[index];
    });

    return obj;
  });

  return {
    delimiter: delimiter,
    headers: headers,
    rows: rows,
    rawValues: values,
    totalRows: rows.length
  };
}

function detectDelimiter(sampleText) {
  var firstLine = getFirstNonEmptyLine(sampleText);

  if (!firstLine) return ',';

  var commaCount = countDelimiterOutsideQuotes(firstLine, ',');
  var semicolonCount = countDelimiterOutsideQuotes(firstLine, ';');
  var tabCount = countDelimiterOutsideQuotes(firstLine, '\t');

  if (tabCount > commaCount && tabCount > semicolonCount) return '\t';
  if (semicolonCount > commaCount && semicolonCount > tabCount) return ';';

  return ',';
}

function getFirstNonEmptyLine(text) {
  var lines = String(text).split(/\r?\n/);

  for (var i = 0; i < lines.length; i++) {
    if (!isBlank(lines[i])) return lines[i];
  }

  return '';
}

function countDelimiterOutsideQuotes(line, delimiter) {
  var count = 0;
  var inQuotes = false;

  for (var i = 0; i < line.length; i++) {
    var char = line.charAt(i);

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      count++;
    }
  }

  return count;
}

function validateParsedCsv(parsed) {
  if (!parsed) {
    throw new Error('CSV parse failed.');
  }

  if (!parsed.headers || !parsed.headers.length) {
    throw new Error('Không tìm thấy headers.');
  }

  if (!parsed.rows || !parsed.rows.length) {
    throw new Error('Không tìm thấy data rows.');
  }

  if (parsed.rows.length > CONFIG.limits.maxRows) {
    throw new Error('File vượt quá giới hạn rows cho MVP.');
  }

  return true;
}

function buildImportLog(payload, parsed, headerMap) {
  return {
    appName: CONFIG.appName,
    version: CONFIG.version,
    createdAt: nowString(),
    projectName: payload.projectName || '',
    websiteType: payload.websiteType || '',
    exportSource: payload.exportSource || '',
    fileName: payload.fileName || '',
    delimiter: parsed.delimiter,
    totalRows: parsed.totalRows,
    totalHeaders: parsed.headers.length,
    missingCriticalFields: getMissingCriticalFields(headerMap),
    missingRecommendedFields: getMissingRecommendedFields(headerMap)
  };
}