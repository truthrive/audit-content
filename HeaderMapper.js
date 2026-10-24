/***************************************
 * HeaderMapper.gs
 * Map source headers to normalized field keys
 ***************************************/

function buildHeaderMap(headers) {
  if (!headers || !headers.length) {
    throw new Error('Không tìm thấy header trong file.');
  }

  var normalizedHeaders = headers.map(function (header) {
    return {
      original: normalizeHeaderText(header),
      comparable: normalizeComparableText(header)
    };
  });

  var headerMap = {};

  Object.keys(HEADER_ALIASES).forEach(function (fieldKey) {
    headerMap[fieldKey] = findHeader(normalizedHeaders, HEADER_ALIASES[fieldKey]);
  });

  return headerMap;
}

function findHeader(normalizedHeaders, aliases) {
  if (!aliases || !aliases.length) return null;

  var aliasComparables = aliases.map(function (alias) {
    return normalizeComparableText(alias);
  });

  // Exact normalized match first
  for (var i = 0; i < normalizedHeaders.length; i++) {
    if (aliasComparables.indexOf(normalizedHeaders[i].comparable) !== -1) {
      return normalizedHeaders[i].original;
    }
  }

  // Loose match fallback
  for (var j = 0; j < normalizedHeaders.length; j++) {
    for (var k = 0; k < aliasComparables.length; k++) {
      if (normalizedHeaders[j].comparable === aliasComparables[k]) {
        return normalizedHeaders[j].original;
      }
    }
  }

  return null;
}

function getMappedValue(rawRow, headerMap, fieldKey) {
  if (!rawRow || !headerMap || !fieldKey) return null;

  var sourceHeader = headerMap[fieldKey];

  if (!sourceHeader) return null;

  if (!Object.prototype.hasOwnProperty.call(rawRow, sourceHeader)) {
    return null;
  }

  var value = rawRow[sourceHeader];

  // Important: blank cell = null, not zero.
  if (isBlank(value)) return null;

  return value;
}

function hasMappedField(headerMap, fieldKey) {
  return !!(headerMap && headerMap[fieldKey]);
}

function getMissingCriticalFields(headerMap) {
  return CRITICAL_FIELDS.filter(function (fieldKey) {
    return !hasMappedField(headerMap, fieldKey);
  });
}

function getMissingRecommendedFields(headerMap) {
  return RECOMMENDED_FIELDS.filter(function (fieldKey) {
    return !hasMappedField(headerMap, fieldKey);
  });
}

function validateCriticalHeaders(headerMap) {
  var missing = getMissingCriticalFields(headerMap);

  if (missing.length) {
    throw new Error(
      'File thiếu field bắt buộc: ' + missing.join(', ') +
      '. Cần kiểm tra export từ Screaming Frog.'
    );
  }

  return true;
}

function buildHeaderMapReport(headers, headerMap) {
  var rows = [];

  rows.push({
    group: 'Summary',
    field: 'Total source headers',
    sourceHeader: headers ? headers.length : 0,
    status: 'info',
    note: ''
  });

  Object.keys(HEADER_ALIASES).forEach(function (fieldKey) {
    var sourceHeader = headerMap[fieldKey];

    rows.push({
      group: inArray(fieldKey, CRITICAL_FIELDS) ? 'Critical' :
        inArray(fieldKey, RECOMMENDED_FIELDS) ? 'Recommended' : 'Optional',
      field: fieldKey,
      sourceHeader: sourceHeader || '',
      status: sourceHeader ? 'mapped' : 'missing',
      note: sourceHeader ? '' : 'Không tìm thấy header phù hợp'
    });
  });

  return rows;
}

function isGscDataAvailable(headerMap) {
  return !!(
    headerMap &&
    headerMap.gsc_clicks &&
    headerMap.gsc_impressions
  );
}

function isGa4BehaviorAvailable(headerMap) {
  return !!(
    headerMap &&
    headerMap.ga4_sessions
  );
}

function isGa4BusinessValueAvailable(headerMap) {
  return !!(
    headerMap &&
    (
      headerMap.ga4_conversions ||
      headerMap.ga4_total_revenue ||
      headerMap.ga4_event_count
    )
  );
}

function isInternalLinkDataAvailable(headerMap) {
  return !!(
    headerMap &&
    (
      headerMap.unique_inlinks ||
      headerMap.inlinks
    )
  );
}

function isTechnicalDataAvailable(headerMap) {
  return !!(
    headerMap &&
    headerMap.status_code
  );
}

function isIndexabilityDataAvailable(headerMap) {
  return !!(
    headerMap &&
    headerMap.indexability
  );
}

function isCanonicalDataAvailable(headerMap) {
  return !!(
    headerMap &&
    headerMap.canonical
  );
}

/**
 * Simple manual test.
 * Run this function in Apps Script editor after adding Config.gs + Utils.gs + HeaderMapper.gs.
 */
function testHeaderMapper_() {
  var headers = [
    'Address',
    'Content Type',
    'Status Code',
    'Indexability',
    'Indexability Status',
    'Canonical Link Element 1',
    'Clicks',
    'Impressions',
    'CTR',
    'Position',
    'GA4 Sessions',
    'GA4 Conversions',
    'Unique Inlinks',
    'Crawl Depth',
    'Word Count'
  ];

  var headerMap = buildHeaderMap(headers);

  Logger.log(JSON.stringify(headerMap, null, 2));
  Logger.log('Missing critical: ' + JSON.stringify(getMissingCriticalFields(headerMap)));
  Logger.log('Missing recommended: ' + JSON.stringify(getMissingRecommendedFields(headerMap)));

  validateCriticalHeaders(headerMap);

  Logger.log('GSC available: ' + isGscDataAvailable(headerMap));
  Logger.log('GA4 behavior available: ' + isGa4BehaviorAvailable(headerMap));
  Logger.log('GA4 business value available: ' + isGa4BusinessValueAvailable(headerMap));
  Logger.log('Internal link available: ' + isInternalLinkDataAvailable(headerMap));
}