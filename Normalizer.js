/***************************************
 * Normalizer.gs
 * Normalize raw Screaming Frog/GSC/GA4 rows
 ***************************************/

function normalizeRows(rawRows, headerMap, auditConfig) {
  return rawRows.map(function (rawRow, index) {
    return normalizeRow(rawRow, headerMap, auditConfig, index + 1);
  });
}

function normalizeRow(rawRow, headerMap, auditConfig, rowIndex) {
  var url = getMappedValue(rawRow, headerMap, 'url');

  var row = {
    row_index: rowIndex,
    url: normalizeUrl(url),
    url_key: buildUrlKey(url),
    domain: extractDomain(url),
    path: extractPath(url)
  };

  normalizeScopeFields(row, rawRow, headerMap, auditConfig);
  normalizeStatusFields(row, rawRow, headerMap);
  normalizeIndexabilityFields(row, rawRow, headerMap);
  normalizeCanonicalFields(row, rawRow, headerMap);
  normalizeGscFields(row, rawRow, headerMap);
  normalizeGa4Fields(row, rawRow, headerMap);
  normalizeInternalLinkFields(row, rawRow, headerMap);
  normalizeContentFields(row, rawRow, headerMap);
  normalizeTechnicalFields(row, rawRow, headerMap);

  applyPatternFlags(row, auditConfig);

  row.eligible_url = deriveEligibleUrl(row);

  return row;
}

function normalizeScopeFields(row, rawRow, headerMap, auditConfig) {
  row.content_type = getMappedValue(rawRow, headerMap, 'content_type');
  row.content_type_available = hasMappedField(headerMap, 'content_type');
  row.is_html = deriveIsHtml(row.content_type, auditConfig.exportSource);
  row.audit_scope = deriveAuditScope(row);
  row.scope_confidence = deriveScopeConfidence(row, auditConfig);
}

function deriveIsHtml(contentType, exportSource) {
  if (!isBlank(contentType)) {
    return String(contentType).toLowerCase().indexOf('text/html') !== -1;
  }

  if (exportSource === EXPORT_SOURCES.INTERNAL_HTML) {
    return true;
  }

  return null;
}

function deriveAuditScope(row) {
  if (row.is_html === true) return 'in_scope';
  if (row.is_html === false) return 'out_of_scope';
  return 'unknown';
}

function deriveScopeConfidence(row, auditConfig) {
  if (row.content_type_available && row.is_html !== null) return CONFIDENCE.HIGH;
  if (!row.content_type_available && auditConfig.exportSource === EXPORT_SOURCES.INTERNAL_HTML) {
    return CONFIDENCE.MEDIUM;
  }
  return CONFIDENCE.LOW;
}

function normalizeStatusFields(row, rawRow, headerMap) {
  row.status_code = parseNumber(getMappedValue(rawRow, headerMap, 'status_code'));
  row.status = getMappedValue(rawRow, headerMap, 'status');
  row.status_group = deriveStatusGroup(row.status_code);

  row.is_status_200 = row.status_code === 200;
  row.is_redirect = row.status_group === '3xx';
  row.is_client_error = row.status_group === '4xx';
  row.is_server_error = row.status_group === '5xx';

  row.technical_eligibility = deriveTechnicalEligibility(row);
  row.status_confidence = row.status_code === null ? CONFIDENCE.LOW : CONFIDENCE.HIGH;
}

function deriveStatusGroup(statusCode) {
  if (statusCode === null || statusCode === undefined) return 'unknown';

  if (statusCode >= 200 && statusCode < 300) return '2xx';
  if (statusCode >= 300 && statusCode < 400) return '3xx';
  if (statusCode >= 400 && statusCode < 500) return '4xx';
  if (statusCode >= 500) return '5xx';

  return 'unknown';
}

function deriveTechnicalEligibility(row) {
  if (row.status_code === null) return 'unknown';
  if (row.status_code === 200) return 'eligible';
  if (row.status_group === '3xx') return 'redirected';
  if (row.status_group === '4xx') return 'client_error';
  if (row.status_group === '5xx') return 'server_error';
  return 'unknown';
}

function normalizeIndexabilityFields(row, rawRow, headerMap) {
  row.indexability = getMappedValue(rawRow, headerMap, 'indexability');
  row.indexability_status = getMappedValue(rawRow, headerMap, 'indexability_status');

  row.indexability_available = hasMappedField(headerMap, 'indexability');
  row.is_indexable = deriveIsIndexable(row.indexability);

  row.is_non_indexable = row.is_indexable === false;
  row.index_eligibility = deriveIndexEligibility(row);
  row.indexability_confidence = row.indexability_available ? CONFIDENCE.HIGH : CONFIDENCE.LOW;
}

function deriveIsIndexable(indexability) {
  if (isBlank(indexability)) return null;

  var value = String(indexability).toLowerCase();

  if (value.indexOf('non-indexable') !== -1 || value.indexOf('non indexable') !== -1) {
    return false;
  }

  if (value.indexOf('indexable') !== -1) {
    return true;
  }

  return null;
}

function deriveIndexEligibility(row) {
  if (row.is_indexable === true) return 'eligible';

  if (row.is_indexable === false) {
    var status = safeString(row.indexability_status).toLowerCase();

    if (status.indexOf('noindex') !== -1) return 'blocked_noindex';
    if (status.indexOf('canonical') !== -1) return 'canonicalized';
    if (status.indexOf('redirect') !== -1) return 'redirected';

    return 'non_indexable';
  }

  return 'unknown';
}

function normalizeCanonicalFields(row, rawRow, headerMap) {
  row.canonical = normalizeUrl(getMappedValue(rawRow, headerMap, 'canonical'));
  row.canonical_available = hasMappedField(headerMap, 'canonical');
  row.canonical_key = buildUrlKey(row.canonical);
  row.canonical_domain = extractDomain(row.canonical);

  row.is_self_canonical = false;
  row.is_canonicalized = false;
  row.is_cross_domain_canonical = false;

  row.canonical_status = deriveCanonicalStatus(row);
  row.canonical_confidence = row.canonical_available ? CONFIDENCE.HIGH : CONFIDENCE.LOW;
}

function deriveCanonicalStatus(row) {
  if (isBlank(row.canonical)) return 'missing';

  if (row.canonical_domain && row.domain && row.canonical_domain !== row.domain) {
    row.is_cross_domain_canonical = true;
    return 'cross_domain';
  }

  if (row.canonical_key && row.url_key && row.canonical_key === row.url_key) {
    row.is_self_canonical = true;
    return 'self_canonical';
  }

  if (row.canonical_key && row.url_key && row.canonical_key !== row.url_key) {
    row.is_canonicalized = true;
    return 'canonicalized';
  }

  return 'unknown';
}

function normalizeGscFields(row, rawRow, headerMap) {
  row.gsc_data_available = isGscDataAvailable(headerMap);

  row.gsc_clicks = parseNumber(getMappedValue(rawRow, headerMap, 'gsc_clicks'));
  row.gsc_impressions = parseNumber(getMappedValue(rawRow, headerMap, 'gsc_impressions'));
  row.gsc_ctr_raw = parsePercent(getMappedValue(rawRow, headerMap, 'gsc_ctr_raw'));
  row.gsc_position = parseNumber(getMappedValue(rawRow, headerMap, 'gsc_position'));

  row.gsc_ctr_computed = null;
  if (row.gsc_impressions !== null && row.gsc_impressions > 0 && row.gsc_clicks !== null) {
    row.gsc_ctr_computed = row.gsc_clicks / row.gsc_impressions;
  }

  row.has_search_visibility = row.gsc_impressions !== null && row.gsc_impressions > 0;
  row.has_organic_clicks = row.gsc_clicks !== null && row.gsc_clicks > 0;

  row.impression_volume_confidence = deriveVolumeConfidence(
    row.gsc_impressions,
    CONFIG.thresholds.MIN_MEANINGFUL_IMPRESSIONS,
    CONFIG.thresholds.HIGH_CONFIDENCE_IMPRESSIONS
  );

  row.click_volume_confidence = deriveVolumeConfidence(
    row.gsc_clicks,
    CONFIG.thresholds.MIN_MEANINGFUL_CLICKS,
    CONFIG.thresholds.HIGH_CONFIDENCE_CLICKS
  );
}

function normalizeGa4Fields(row, rawRow, headerMap) {
  row.ga4_behavior_available = isGa4BehaviorAvailable(headerMap);

  // Business value should rely mainly on conversion/revenue fields.
  row.ga4_business_value_available = !!(
    hasMappedField(headerMap, 'ga4_conversions') ||
    hasMappedField(headerMap, 'ga4_total_revenue')
  );

  row.ga4_sessions = parseNumber(getMappedValue(rawRow, headerMap, 'ga4_sessions'));
  row.ga4_views = parseNumber(getMappedValue(rawRow, headerMap, 'ga4_views'));
  row.ga4_engaged_sessions = parseNumber(getMappedValue(rawRow, headerMap, 'ga4_engaged_sessions'));
  row.ga4_engagement_rate = parsePercent(getMappedValue(rawRow, headerMap, 'ga4_engagement_rate'));

  row.ga4_conversions = parseNumber(getMappedValue(rawRow, headerMap, 'ga4_conversions'));
  row.ga4_event_count = parseNumber(getMappedValue(rawRow, headerMap, 'ga4_event_count'));
  row.ga4_total_revenue = parseNumber(getMappedValue(rawRow, headerMap, 'ga4_total_revenue'));

  row.has_sessions = row.ga4_sessions !== null && row.ga4_sessions > 0;

  row.session_volume_confidence = deriveVolumeConfidence(
    row.ga4_sessions,
    CONFIG.thresholds.MIN_MEANINGFUL_SESSIONS,
    CONFIG.thresholds.HIGH_CONFIDENCE_SESSIONS
  );

  row.has_business_value = (
    (row.ga4_conversions !== null && row.ga4_conversions > 0) ||
    (row.ga4_total_revenue !== null && row.ga4_total_revenue > 0)
  );

  row.business_value_status = deriveBusinessValueStatus(row);
  row.business_value_confidence = deriveBusinessValueConfidence(row);
}

function deriveBusinessValueStatus(row) {
  if (!row.ga4_business_value_available) return 'unknown';

  if (row.has_business_value) return 'has_value';

  return 'no_value_detected';
}

function deriveBusinessValueConfidence(row) {
  if (!row.ga4_business_value_available) return CONFIDENCE.LOW;
  if (row.has_business_value) return CONFIDENCE.HIGH;
  return CONFIDENCE.MEDIUM;
}

function normalizeInternalLinkFields(row, rawRow, headerMap) {
  row.internal_link_data_available = isInternalLinkDataAvailable(headerMap);

  row.inlinks = parseNumber(getMappedValue(rawRow, headerMap, 'inlinks'));
  row.unique_inlinks = parseNumber(getMappedValue(rawRow, headerMap, 'unique_inlinks'));

  if (row.unique_inlinks !== null) {
    row.internal_link_count = row.unique_inlinks;
    row.internal_link_source = 'unique_inlinks';
  } else if (row.inlinks !== null) {
    row.internal_link_count = row.inlinks;
    row.internal_link_source = 'inlinks';
  } else {
    row.internal_link_count = null;
    row.internal_link_source = '';
  }

  row.internal_link_confidence = row.unique_inlinks !== null
    ? CONFIDENCE.HIGH
    : row.inlinks !== null
      ? CONFIDENCE.MEDIUM
      : CONFIDENCE.LOW;
}

function normalizeContentFields(row, rawRow, headerMap) {
  row.word_count = parseNumber(getMappedValue(rawRow, headerMap, 'word_count'));
  row.word_count_available = hasMappedField(headerMap, 'word_count');

  row.title = getMappedValue(rawRow, headerMap, 'title');
  row.title_length = parseNumber(getMappedValue(rawRow, headerMap, 'title_length'));

  row.meta_description = getMappedValue(rawRow, headerMap, 'meta_description');
  row.meta_description_length = parseNumber(getMappedValue(rawRow, headerMap, 'meta_description_length'));

  row.h1 = getMappedValue(rawRow, headerMap, 'h1');
  row.h1_length = parseNumber(getMappedValue(rawRow, headerMap, 'h1_length'));

  row.title_missing = isBlank(row.title);
  row.meta_missing = isBlank(row.meta_description);
  row.h1_missing = isBlank(row.h1);

  row.onpage_flags = [];
  if (row.title_missing) row.onpage_flags.push('title_missing');
  if (row.meta_missing) row.onpage_flags.push('meta_missing');
  if (row.h1_missing) row.onpage_flags.push('h1_missing');

  row.onpage_context_confidence = row.word_count_available ? CONFIDENCE.MEDIUM : CONFIDENCE.LOW;
}

function normalizeTechnicalFields(row, rawRow, headerMap) {
  row.response_time = parseNumber(getMappedValue(rawRow, headerMap, 'response_time'));
  row.speed_signal_available = hasMappedField(headerMap, 'response_time');
  row.speed_signal_confidence = row.speed_signal_available ? CONFIDENCE.MEDIUM : CONFIDENCE.LOW;

  row.crawl_depth = parseNumber(getMappedValue(rawRow, headerMap, 'crawl_depth'));
  row.crawl_depth_available = hasMappedField(headerMap, 'crawl_depth');
}

function applyPatternFlags(row, auditConfig) {
  var websiteType = auditConfig.websiteType || WEBSITE_TYPES.GENERAL;

  var protectedPatterns = mergeArraysUnique(
    getDefaultPatterns('protected', websiteType),
    auditConfig.protectedPatterns || []
  );

  var excludedPatterns = mergeArraysUnique(
    getDefaultPatterns('excluded', websiteType),
    auditConfig.excludedPatterns || []
  );

  var reviewPatterns = mergeArraysUnique(
    getDefaultPatterns('review', websiteType),
    auditConfig.reviewPatterns || []
  );

  row.protected_pattern = pathMatchesPatterns(row.url, protectedPatterns);
  row.excluded_pattern = pathMatchesPatterns(row.url, excludedPatterns);
  row.review_pattern = pathMatchesPatterns(row.url, reviewPatterns);

  row.risky_action_blocked = row.protected_pattern || row.review_pattern || row.excluded_pattern;
  row.exclude_from_seo_growth = row.excluded_pattern;

  if (row.excluded_pattern) {
    row.url_pattern_group = 'excluded';
  } else if (row.protected_pattern) {
    row.url_pattern_group = 'protected';
  } else if (row.review_pattern) {
    row.url_pattern_group = 'review';
  } else {
    row.url_pattern_group = '';
  }

  row.pattern_confidence = row.url_pattern_group ? CONFIDENCE.MEDIUM : CONFIDENCE.LOW;
}

function getDefaultPatterns(patternType, websiteType) {
  if (!DEFAULT_PATTERNS[patternType]) return [];

  return DEFAULT_PATTERNS[patternType][websiteType] ||
    DEFAULT_PATTERNS[patternType][WEBSITE_TYPES.GENERAL] ||
    [];
}

function deriveEligibleUrl(row) {
  return (
    row.is_html === true &&
    row.status_code === 200 &&
    row.is_indexable === true &&
    row.is_canonicalized !== true &&
    row.is_cross_domain_canonical !== true &&
    row.excluded_pattern !== true
  );
}

function deriveBuckets(rows, auditConfig) {
  var eligibleRows = rows.filter(function (row) {
    return row.eligible_url === true;
  });

  applyMetricBuckets(eligibleRows, 'gsc_impressions', 'impression_bucket');
  applyMetricBuckets(eligibleRows, 'gsc_clicks', 'click_bucket');

  var htmlRows = rows.filter(function (row) {
    return row.is_html === true;
  });

  applyMetricBuckets(htmlRows, 'ga4_sessions', 'session_bucket');
  applyInternalLinkBuckets(eligibleRows);

  rows.forEach(function (row) {
    derivePositionBucket(row);
    deriveCtrConfidence(row);
    deriveEngagementConfidence(row);
    deriveDepthBucket(row);
    deriveWordCountBucket(row);
    deriveResponseTimeBucket(row);

    row.meaningful_impressions = (
      row.impression_bucket === 'high' ||
      row.impression_bucket === 'medium' ||
      row.impression_volume_confidence === CONFIDENCE.MEDIUM ||
      row.impression_volume_confidence === CONFIDENCE.HIGH
    );

    row.active_organic_traffic = (
      row.click_bucket === 'high' ||
      row.click_bucket === 'medium' ||
      row.click_volume_confidence === CONFIDENCE.MEDIUM ||
      row.click_volume_confidence === CONFIDENCE.HIGH
    );

    row.active_user_traffic = (
      row.session_bucket === 'high' ||
      row.session_bucket === 'medium' ||
      row.session_volume_confidence === CONFIDENCE.MEDIUM ||
      row.session_volume_confidence === CONFIDENCE.HIGH
    );
  });

  return rows;
}

function applyMetricBuckets(rows, metricKey, bucketKey) {
  var positiveValues = rows
    .map(function (row) {
      return parseNumber(row[metricKey]);
    })
    .filter(function (value) {
      return value !== null && value > 0;
    });

  var highThreshold = percentile(positiveValues, 80);
  var mediumThreshold = percentile(positiveValues, 50);

  rows.forEach(function (row) {
    var value = parseNumber(row[metricKey]);

    if (value === null) {
      row[bucketKey] = 'unknown';
    } else if (value === 0) {
      row[bucketKey] = 'none';
    } else if (highThreshold !== null && value >= highThreshold) {
      row[bucketKey] = 'high';
    } else if (mediumThreshold !== null && value >= mediumThreshold) {
      row[bucketKey] = 'medium';
    } else {
      row[bucketKey] = 'low';
    }
  });
}

function applyInternalLinkBuckets(rows) {
  var values = rows
    .map(function (row) {
      return parseNumber(row.internal_link_count);
    })
    .filter(function (value) {
      return value !== null;
    });

  var highThreshold = percentile(values, 80);
  var lowThreshold = percentile(values, 30);

  rows.forEach(function (row) {
    var value = parseNumber(row.internal_link_count);

    if (value === null) {
      row.internal_link_bucket = 'unknown';
    } else if (value <= CONFIG.thresholds.VERY_LOW_UNIQUE_INLINKS) {
      row.internal_link_bucket = 'very_low';
    } else if (lowThreshold !== null && value <= lowThreshold) {
      row.internal_link_bucket = 'low';
    } else if (highThreshold !== null && value >= highThreshold) {
      row.internal_link_bucket = 'high';
    } else {
      row.internal_link_bucket = 'medium';
    }

    row.is_low_internal_link = row.internal_link_bucket === 'very_low' || row.internal_link_bucket === 'low';
    row.is_high_internal_link = row.internal_link_bucket === 'high';
  });
}

function deriveVolumeConfidence(value, minMeaningful, highConfidence) {
  if (value === null || value === undefined) return 'unknown';
  if (value === 0) return 'none';
  if (value < minMeaningful) return CONFIDENCE.LOW;
  if (value < highConfidence) return CONFIDENCE.MEDIUM;
  return CONFIDENCE.HIGH;
}

function derivePositionBucket(row) {
  var position = row.gsc_position;

  if (position === null || position === undefined) {
    row.position_bucket = 'unknown';
  } else if (position <= 3) {
    row.position_bucket = 'top_1_3';
  } else if (position <= 10) {
    row.position_bucket = 'top_4_10';
  } else if (position <= 20) {
    row.position_bucket = 'top_11_20';
  } else if (position <= 50) {
    row.position_bucket = 'top_21_50';
  } else {
    row.position_bucket = 'beyond_50';
  }

  row.is_top_3 = row.position_bucket === 'top_1_3';
  row.is_top_10 = row.position_bucket === 'top_1_3' || row.position_bucket === 'top_4_10';
  row.is_position_11_20 = row.position_bucket === 'top_11_20';
  row.is_position_21_50 = row.position_bucket === 'top_21_50';
}

function deriveCtrConfidence(row) {
  if (row.gsc_impressions === null || row.gsc_impressions < CONFIG.thresholds.MIN_MEANINGFUL_IMPRESSIONS) {
    row.ctr_confidence = CONFIDENCE.LOW;
  } else if (row.gsc_position === null || row.gsc_position > 20) {
    row.ctr_confidence = CONFIDENCE.LOW;
  } else if (
    row.gsc_impressions >= CONFIG.thresholds.HIGH_CONFIDENCE_IMPRESSIONS &&
    row.gsc_position <= 10
  ) {
    row.ctr_confidence = CONFIDENCE.HIGH;
  } else {
    row.ctr_confidence = CONFIDENCE.MEDIUM;
  }

  row.is_low_ctr_candidate = false;

  var ctr = row.gsc_ctr_computed !== null ? row.gsc_ctr_computed : row.gsc_ctr_raw;

  if (row.ctr_confidence !== CONFIDENCE.LOW && ctr !== null) {
    if (row.gsc_position <= 3 && ctr < 0.03) {
      row.is_low_ctr_candidate = true;
    } else if (row.gsc_position <= 10 && ctr < 0.01) {
      row.is_low_ctr_candidate = true;
    }
  }
}

function deriveEngagementConfidence(row) {
  if (!row.ga4_behavior_available || row.ga4_sessions === null) {
    row.engagement_confidence = CONFIDENCE.LOW;
  } else if (row.ga4_sessions < CONFIG.thresholds.MIN_MEANINGFUL_SESSIONS) {
    row.engagement_confidence = CONFIDENCE.LOW;
  } else if (row.ga4_sessions >= CONFIG.thresholds.HIGH_CONFIDENCE_SESSIONS) {
    row.engagement_confidence = CONFIDENCE.HIGH;
  } else {
    row.engagement_confidence = CONFIDENCE.MEDIUM;
  }

  row.low_engagement_candidate = false;
  row.high_engagement_signal = false;

  if (row.engagement_confidence !== CONFIDENCE.LOW && row.ga4_engagement_rate !== null) {
    row.low_engagement_candidate = row.ga4_engagement_rate < CONFIG.thresholds.LOW_ENGAGEMENT_RATE;
    row.high_engagement_signal = row.ga4_engagement_rate >= 0.6;
  }
}

function deriveDepthBucket(row) {
  if (row.crawl_depth === null || row.crawl_depth === undefined) {
    row.depth_bucket = 'unknown';
    row.crawl_depth_confidence = CONFIDENCE.LOW;
  } else if (row.crawl_depth <= 1) {
    row.depth_bucket = 'shallow';
    row.crawl_depth_confidence = CONFIDENCE.HIGH;
  } else if (row.crawl_depth <= 3) {
    row.depth_bucket = 'normal';
    row.crawl_depth_confidence = CONFIDENCE.HIGH;
  } else if (row.crawl_depth <= 5) {
    row.depth_bucket = 'deep';
    row.crawl_depth_confidence = CONFIDENCE.HIGH;
  } else {
    row.depth_bucket = 'very_deep';
    row.crawl_depth_confidence = CONFIDENCE.HIGH;
  }

  row.is_deep_url = row.depth_bucket === 'deep' || row.depth_bucket === 'very_deep';
  row.is_very_deep_url = row.depth_bucket === 'very_deep';
}

function deriveWordCountBucket(row) {
  if (row.word_count === null || row.word_count === undefined) {
    row.word_count_bucket = 'missing';
    row.low_content_signal = false;
    row.word_count_confidence = CONFIDENCE.LOW;
  } else if (row.word_count < 100) {
    row.word_count_bucket = 'very_low';
    row.low_content_signal = true;
    row.word_count_confidence = CONFIDENCE.MEDIUM;
  } else if (row.word_count < 300) {
    row.word_count_bucket = 'low';
    row.low_content_signal = true;
    row.word_count_confidence = CONFIDENCE.MEDIUM;
  } else if (row.word_count < 800) {
    row.word_count_bucket = 'medium';
    row.low_content_signal = false;
    row.word_count_confidence = CONFIDENCE.MEDIUM;
  } else {
    row.word_count_bucket = 'high';
    row.low_content_signal = false;
    row.word_count_confidence = CONFIDENCE.MEDIUM;
  }
}

function deriveResponseTimeBucket(row) {
  if (row.response_time === null || row.response_time === undefined) {
    row.response_time_bucket = 'missing';
    row.technical_speed_signal = false;
  } else if (row.response_time < 0.5) {
    row.response_time_bucket = 'fast';
    row.technical_speed_signal = false;
  } else if (row.response_time < 1.5) {
    row.response_time_bucket = 'normal';
    row.technical_speed_signal = false;
  } else if (row.response_time < 3) {
    row.response_time_bucket = 'slow';
    row.technical_speed_signal = true;
  } else {
    row.response_time_bucket = 'very_slow';
    row.technical_speed_signal = true;
  }
}