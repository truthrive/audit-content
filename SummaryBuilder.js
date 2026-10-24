/***************************************
 * SummaryBuilder.gs
 * Build Google Sheet summary + Web App dashboard data
 ***************************************/

function buildSummary(auditRows, readiness, normalizedRows) {
  auditRows = auditRows || [];
  normalizedRows = normalizedRows || [];

  var readinessSummary = readiness && readiness.summary ? readiness.summary : {};

  return {
    overview: buildOverviewSummary(auditRows, readiness, normalizedRows, readinessSummary),
    readiness: buildReadinessBlock(readiness),
    byLabel: objectToTable(countBy(auditRows, 'Nhãn chính'), 'Nhãn chính', 'Số URL'),
    byAction: objectToTable(countBy(auditRows, 'Hành động đề xuất'), 'Hành động đề xuất', 'Số URL'),
    byPriority: objectToTable(countBy(auditRows, 'Ưu tiên'), 'Ưu tiên', 'Số URL'),
    byConfidence: objectToTable(countBy(auditRows, 'Độ tin cậy'), 'Độ tin cậy', 'Số URL'),
    manualReview: buildManualReviewSummary(auditRows),
    warnings: readiness && readiness.warnings ? readiness.warnings : []
  };
}

function buildWebAppDashboard(auditRows, readiness, normalizedRows) {
  auditRows = auditRows || [];
  normalizedRows = normalizedRows || [];

  var readinessSummary = readiness && readiness.summary ? readiness.summary : {};
  var warnings = readiness && readiness.warnings ? readiness.warnings : [];

  var priorityCounts = countBy(auditRows, 'Ưu tiên');
  var labelCounts = countBy(auditRows, 'Nhãn chính');
  var actionCounts = countBy(auditRows, 'Hành động đề xuất');
  var confidenceCounts = countBy(auditRows, 'Độ tin cậy');

  return {
    overview: {
      readinessStatus: readiness ? readiness.status : 'Unknown',
      readinessScore: readiness ? readiness.score : '',
      warningsCount: warnings.length,
      uploadedRows: readinessSummary.totalRows || normalizedRows.length || 0,
      htmlRows: readinessSummary.htmlRows || 0,
      nonHtmlRows: readinessSummary.nonHtmlRows || 0,
      eligibleRows: readinessSummary.eligibleRows || 0,
      auditRows: auditRows.length,
      manualReviewRows: countRowsWhere(auditRows, function (row) {
        return row['Cần review thủ công'] === YES_NO.YES;
      })
    },

    dataQuality: {
      status: readiness ? readiness.status : 'Unknown',
      score: readiness ? readiness.score : '',
      warnings: warnings
    },

    priorityBreakdown: countsToSortedItems(priorityCounts, ['P0', 'P1', 'P2', 'P3']),
    labelBreakdown: countsToSortedItems(labelCounts),
    actionBreakdown: countsToSortedItems(actionCounts),
    confidenceBreakdown: countsToSortedItems(confidenceCounts, [
      CONFIDENCE.HIGH,
      CONFIDENCE.MEDIUM,
      CONFIDENCE.LOW
    ]),

    keyCounts: {
      technicalBarrier: countByExact(auditRows, 'Nhãn chính', LABELS.TECHNICAL_BARRIER),
      growthOpportunity: countByExact(auditRows, 'Nhãn chính', LABELS.GROWTH_OPPORTUNITY),
      ctrOpportunity: countByExact(auditRows, 'Nhãn chính', LABELS.CTR_OPPORTUNITY),
      internalLinkOpportunity: countByExact(auditRows, 'Nhãn chính', LABELS.INTERNAL_LINK_OPPORTUNITY),
      contentImprovement: countByExact(auditRows, 'Nhãn chính', LABELS.CONTENT_RANKING_IMPROVEMENT),
      manualReview: countByExact(auditRows, 'Cần review thủ công', YES_NO.YES)
    },

    topPriorityRows: getTopPriorityRows(auditRows, 10),

    warnings: warnings
  };
}

function buildOverviewSummary(auditRows, readiness, normalizedRows, readinessSummary) {
  return [
    ['Metric', 'Value'],
    ['Total uploaded rows', readinessSummary.totalRows || normalizedRows.length || 0],
    ['HTML rows', readinessSummary.htmlRows || 0],
    ['Non-HTML skipped', readinessSummary.nonHtmlRows || 0],
    ['Eligible URLs', readinessSummary.eligibleRows || 0],
    ['Audit action rows', auditRows.length],
    ['Readiness status', readiness ? readiness.status : 'Unknown'],
    ['Readiness score', readiness ? readiness.score : ''],
    ['Warnings count', readiness && readiness.warnings ? readiness.warnings.length : 0],
    ['Manual review required', countRowsWhere(auditRows, function (row) {
      return row['Cần review thủ công'] === YES_NO.YES;
    })],
    ['P0/P1 rows', countRowsWhere(auditRows, function (row) {
      return row['Ưu tiên'] === PRIORITIES.P0 || row['Ưu tiên'] === PRIORITIES.P1;
    })]
  ];
}

function buildReadinessBlock(readiness) {
  if (!readiness) {
    return [
      ['Field', 'Value'],
      ['Status', 'Unknown']
    ];
  }

  return [
    ['Field', 'Value'],
    ['Status', readiness.status],
    ['Score', readiness.score],
    ['Warnings', readiness.warnings ? readiness.warnings.length : 0]
  ];
}

function buildManualReviewSummary(auditRows) {
  var yes = countRowsWhere(auditRows, function (row) {
    return row['Cần review thủ công'] === YES_NO.YES;
  });

  var no = countRowsWhere(auditRows, function (row) {
    return row['Cần review thủ công'] === YES_NO.NO;
  });

  return [
    ['Cần review thủ công', 'Số URL'],
    [YES_NO.YES, yes],
    [YES_NO.NO, no]
  ];
}

function countRowsWhere(rows, predicate) {
  return (rows || []).filter(predicate).length;
}

function countByExact(rows, key, expectedValue) {
  return countRowsWhere(rows || [], function (row) {
    return row[key] === expectedValue;
  });
}

function objectToTable(obj, firstHeader, secondHeader) {
  var rows = [[firstHeader, secondHeader]];

  Object.keys(obj || {})
    .sort(function (a, b) {
      return obj[b] - obj[a];
    })
    .forEach(function (key) {
      rows.push([key, obj[key]]);
    });

  return rows;
}

function countsToSortedItems(counts, fixedOrder) {
  counts = counts || {};

  var items = Object.keys(counts).map(function (key) {
    return {
      label: key,
      count: counts[key]
    };
  });

  if (fixedOrder && fixedOrder.length) {
    items.sort(function (a, b) {
      var ai = fixedOrder.indexOf(a.label);
      var bi = fixedOrder.indexOf(b.label);

      if (ai === -1) ai = 999;
      if (bi === -1) bi = 999;

      if (ai !== bi) return ai - bi;
      return b.count - a.count;
    });

    return items;
  }

  items.sort(function (a, b) {
    return b.count - a.count;
  });

  return items;
}

function getTopPriorityRows(auditRows, limit) {
  var priorityWeight = {
    P0: 1,
    P1: 2,
    P2: 3,
    P3: 4
  };

  return (auditRows || [])
    .slice()
    .sort(function (a, b) {
      var aw = priorityWeight[a['Ưu tiên']] || 99;
      var bw = priorityWeight[b['Ưu tiên']] || 99;

      if (aw !== bw) return aw - bw;

      var aManual = a['Cần review thủ công'] === YES_NO.YES ? 0 : 1;
      var bManual = b['Cần review thủ công'] === YES_NO.YES ? 0 : 1;

      if (aManual !== bManual) return aManual - bManual;

      return String(a['URL'] || '').localeCompare(String(b['URL'] || ''));
    })
    .slice(0, limit || 10)
    .map(function (row) {
      return {
        url: row['URL'] || '',
        primaryLabel: row['Nhãn chính'] || '',
        action: row['Hành động đề xuất'] || '',
        priority: row['Ưu tiên'] || '',
        confidence: row['Độ tin cậy'] || '',
        evidence: row['Bằng chứng'] || '',
        manualReview: row['Cần review thủ công'] || ''
      };
    });
}

/**
 * Flatten summary to rows for writing to Google Sheet.
 */
function flattenSummaryForSheet(summary) {
  var output = [];

  appendSection(output, 'Overview', summary.overview);
  appendSection(output, 'Readiness', summary.readiness);
  appendSection(output, 'Count by Label', summary.byLabel);
  appendSection(output, 'Count by Action', summary.byAction);
  appendSection(output, 'Count by Priority', summary.byPriority);
  appendSection(output, 'Count by Confidence', summary.byConfidence);
  appendSection(output, 'Manual Review', summary.manualReview);

  if (summary.warnings && summary.warnings.length) {
    output.push(['Top Warnings', '']);
    summary.warnings.forEach(function (warning) {
      output.push([warning, '']);
    });
    output.push(['', '']);
  }

  return output;
}

function appendSection(output, title, table) {
  output.push([title, '']);

  (table || []).forEach(function (row) {
    output.push(row);
  });

  output.push(['', '']);
}