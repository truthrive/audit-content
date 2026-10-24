/***************************************
 * DataReadiness.gs
 * Evaluate data quality and readiness
 ***************************************/

function runDataReadiness(normalizedRows, headerMap, auditConfig) {
  var rows = [];
  var warnings = [];
  var score = 100;

  var missingCritical = getMissingCriticalFields(headerMap);
  var missingRecommended = getMissingRecommendedFields(headerMap);

  if (missingCritical.length) {
    missingCritical.forEach(function (field) {
      rows.push(makeReadinessRow(
        'Critical',
        field,
        'Blocked',
        'Thiếu field bắt buộc: ' + field,
        'Export lại file Screaming Frog có field này.'
      ));
    });

    return {
      score: 0,
      status: 'Blocked',
      warnings: ['Thiếu field bắt buộc: ' + missingCritical.join(', ')],
      rows: rows,
      summary: buildReadinessSummary(normalizedRows)
    };
  }

  rows.push(makeReadinessRow(
    'Critical',
    'URL / Status Code',
    'Good',
    'Có URL và Status Code.',
    ''
  ));

  if (!hasMappedField(headerMap, 'content_type')) {
    warnings.push('Content Type missing. Nếu file không phải Internal > HTML, HTML scope confidence sẽ thấp.');
    score -= 10;

    rows.push(makeReadinessRow(
      'Scope',
      'Content Type',
      'Warning',
      'Thiếu Content Type.',
      'Nên export Internal > All có Content Type hoặc xác nhận file là Internal > HTML.'
    ));
  } else {
    rows.push(makeReadinessRow(
      'Scope',
      'Content Type',
      'Good',
      'Có Content Type.',
      ''
    ));
  }

  if (!hasMappedField(headerMap, 'indexability')) {
    warnings.push('Indexability missing. Technical confidence sẽ thấp hơn.');
    score -= 10;

    rows.push(makeReadinessRow(
      'Technical',
      'Indexability',
      'Warning',
      'Thiếu Indexability.',
      'Nên bật/export Indexability trong Screaming Frog.'
    ));
  } else {
    rows.push(makeReadinessRow(
      'Technical',
      'Indexability',
      'Good',
      'Có Indexability.',
      ''
    ));
  }

  if (!hasMappedField(headerMap, 'canonical')) {
    warnings.push('Canonical missing. Canonical review confidence sẽ thấp.');
    score -= 5;

    rows.push(makeReadinessRow(
      'Technical',
      'Canonical',
      'Warning',
      'Thiếu Canonical.',
      'Nên export Canonical Link Element 1.'
    ));
  } else {
    rows.push(makeReadinessRow(
      'Technical',
      'Canonical',
      'Good',
      'Có Canonical.',
      ''
    ));
  }

  if (!isGscDataAvailable(headerMap)) {
    warnings.push('GSC data missing. Organic performance unknown.');
    score -= 20;

    rows.push(makeReadinessRow(
      'Performance',
      'GSC',
      'Warning',
      'Thiếu GSC Clicks/Impressions.',
      'Nên crawl Screaming Frog có kết nối GSC API.'
    ));
  } else {
    rows.push(makeReadinessRow(
      'Performance',
      'GSC',
      'Good',
      'Có GSC Clicks/Impressions.',
      ''
    ));
  }

  if (!isGa4BehaviorAvailable(headerMap)) {
    warnings.push('GA4 Sessions missing. User behavior unknown.');
    score -= 10;

    rows.push(makeReadinessRow(
      'Behavior',
      'GA4 Sessions',
      'Warning',
      'Thiếu GA4 Sessions.',
      'Nên crawl Screaming Frog có kết nối GA4 API.'
    ));
  } else {
    rows.push(makeReadinessRow(
      'Behavior',
      'GA4 Sessions',
      'Good',
      'Có GA4 Sessions.',
      ''
    ));
  }

  var businessValueAvailable = !!(
    hasMappedField(headerMap, 'ga4_conversions') ||
    hasMappedField(headerMap, 'ga4_total_revenue')
  );

  if (!businessValueAvailable) {
    warnings.push('GA4 conversion/revenue data missing. Business value unknown.');
    score -= 15;

    rows.push(makeReadinessRow(
      'Business Value',
      'GA4 Conversions / Revenue',
      'Warning',
      'Thiếu conversion/revenue data.',
      'Không kết luận no business value nếu thiếu field này.'
    ));
  } else {
    var totalConversions = sumMetric(normalizedRows, 'ga4_conversions');
    var totalRevenue = sumMetric(normalizedRows, 'ga4_total_revenue');

    if (totalConversions === 0 && totalRevenue === 0) {
      warnings.push('GA4 conversions/revenue = 0 toàn bộ. Cần kiểm tra Key Events/ecommerce tracking trước khi pruning.');
      score -= 10;

      rows.push(makeReadinessRow(
        'Business Value',
        'GA4 Conversions / Revenue',
        'Warning',
        'Conversions/revenue = 0 toàn bộ dataset.',
        'Kiểm tra setup GA4 Key Events/ecommerce tracking.'
      ));
    } else {
      rows.push(makeReadinessRow(
        'Business Value',
        'GA4 Conversions / Revenue',
        'Good',
        'Có conversion/revenue signal.',
        ''
      ));
    }
  }

  if (!isInternalLinkDataAvailable(headerMap)) {
    warnings.push('Internal link data missing. Internal Link Opportunity confidence sẽ thấp.');
    score -= 10;

    rows.push(makeReadinessRow(
      'Architecture',
      'Internal Links',
      'Warning',
      'Thiếu Inlinks/Unique Inlinks.',
      'Nên export Unique Inlinks từ Screaming Frog.'
    ));
  } else {
    rows.push(makeReadinessRow(
      'Architecture',
      'Internal Links',
      'Good',
      'Có internal link data.',
      ''
    ));
  }

  if (!hasMappedField(headerMap, 'crawl_depth')) {
    warnings.push('Crawl Depth missing. Architecture diagnosis confidence sẽ thấp.');
    score -= 5;

    rows.push(makeReadinessRow(
      'Architecture',
      'Crawl Depth',
      'Warning',
      'Thiếu Crawl Depth.',
      'Nên export Crawl Depth.'
    ));
  } else {
    rows.push(makeReadinessRow(
      'Architecture',
      'Crawl Depth',
      'Good',
      'Có Crawl Depth.',
      ''
    ));
  }

  var summary = buildReadinessSummary(normalizedRows);

  if (summary.nonHtmlRows > 0) {
    warnings.push('File có non-HTML resources. Tool sẽ bỏ qua non-HTML trong audit actions.');

    rows.push(makeReadinessRow(
      'Scope',
      'Non-HTML Resources',
      'Info',
      'Có ' + summary.nonHtmlRows + ' non-HTML rows.',
      'Non-HTML sẽ không vào 05_AUDIT_ACTIONS.'
    ));
  }

  score = Math.max(0, Math.min(100, score));

  var status = deriveReadinessStatus(score, warnings);

  return {
    score: score,
    status: status,
    warnings: warnings,
    rows: rows,
    summary: summary
  };
}

function makeReadinessRow(group, check, status, detail, recommendation) {
  return {
    group: group,
    check: check,
    status: status,
    detail: detail,
    recommendation: recommendation || ''
  };
}

function buildReadinessSummary(normalizedRows) {
  var totalRows = normalizedRows.length;

  var htmlRows = normalizedRows.filter(function (row) {
    return row.is_html === true;
  }).length;

  var nonHtmlRows = normalizedRows.filter(function (row) {
    return row.is_html === false;
  }).length;

  var unknownScopeRows = normalizedRows.filter(function (row) {
    return row.is_html === null;
  }).length;

  var status200Rows = normalizedRows.filter(function (row) {
    return row.status_code === 200 && row.is_html === true;
  }).length;

  var redirectRows = normalizedRows.filter(function (row) {
    return row.is_html === true && row.status_group === '3xx';
  }).length;

  var errorRows = normalizedRows.filter(function (row) {
    return row.is_html === true && (row.status_group === '4xx' || row.status_group === '5xx');
  }).length;

  var eligibleRows = normalizedRows.filter(function (row) {
    return row.eligible_url === true;
  }).length;

  var gscRows = normalizedRows.filter(function (row) {
    return row.gsc_clicks !== null || row.gsc_impressions !== null;
  }).length;

  var ga4Rows = normalizedRows.filter(function (row) {
    return row.ga4_sessions !== null;
  }).length;

  return {
    totalRows: totalRows,
    htmlRows: htmlRows,
    nonHtmlRows: nonHtmlRows,
    unknownScopeRows: unknownScopeRows,
    status200Rows: status200Rows,
    redirectRows: redirectRows,
    errorRows: errorRows,
    eligibleRows: eligibleRows,
    gscRows: gscRows,
    ga4Rows: ga4Rows
  };
}

function deriveReadinessStatus(score, warnings) {
  if (score <= 40) return 'Poor';
  if (score < 70) return 'Warning';
  if (warnings && warnings.length) return 'Good with warnings';
  return 'Good';
}

function sumMetric(rows, key) {
  return rows.reduce(function (sum, row) {
    var value = parseNumber(row[key]);
    return sum + (value || 0);
  }, 0);
}

/**
 * Test Phase 2 after adding:
 * Config.gs
 * Utils.gs
 * HeaderMapper.gs
 * FileParser.gs
 * Normalizer.gs
 * DataReadiness.gs
 */
function runPhase2Test() {
  var sampleCsv = [
    'Address,Content Type,Status Code,Indexability,Indexability Status,Canonical Link Element 1,Clicks,Impressions,CTR,Position,GA4 Sessions,GA4 Conversions,Unique Inlinks,Crawl Depth,Word Count,Response Time',
    'https://example.com/dich-vu/,text/html,200,Indexable,,https://example.com/dich-vu/,20,1000,2%,12.5,30,0,2,3,900,0.8',
    'https://example.com/blog/a/,text/html,200,Indexable,,https://example.com/blog/a/,0,120,0%,28,3,0,1,5,180,2.1',
    'https://example.com/tin-tuc/,text/html,200,Non-Indexable,Noindex,https://example.com/tin-tuc/,5,300,1.6%,9,6,0,40,1,500,1.2',
    'https://example.com/image.jpg,image/jpeg,200,,,,0,0,,0,0,0,0,0,0,0.2'
  ].join('\n');

  var parsed = parseCsvFile(sampleCsv);
  validateParsedCsv(parsed);

  var headerMap = buildHeaderMap(parsed.headers);
  validateCriticalHeaders(headerMap);

  var auditConfig = {
    projectName: 'Phase 2 Test',
    websiteType: WEBSITE_TYPES.SERVICES,
    exportSource: EXPORT_SOURCES.INTERNAL_ALL,
    protectedPatterns: [],
    excludedPatterns: [],
    reviewPatterns: [],
    thresholds: CONFIG.thresholds,
    createdAt: nowString()
  };

  var normalizedRows = normalizeRows(parsed.rows, headerMap, auditConfig);
  normalizedRows = deriveBuckets(normalizedRows, auditConfig);

  var readiness = runDataReadiness(normalizedRows, headerMap, auditConfig);

  Logger.log('Parsed rows: ' + parsed.totalRows);
  Logger.log('Header map: ' + JSON.stringify(headerMap, null, 2));
  Logger.log('First normalized row: ' + JSON.stringify(normalizedRows[0], null, 2));
  Logger.log('Readiness: ' + JSON.stringify(readiness, null, 2));
}