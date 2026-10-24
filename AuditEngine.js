/***************************************
 * AuditEngine.gs
 * Convert normalized rows into user-facing audit actions
 * Version: v1.2
 ***************************************/

function runBaselineAudit(normalizedRows, readiness, auditConfig) {
  var context = buildAuditContext(normalizedRows, readiness, auditConfig);
  var output = [];

  normalizedRows.forEach(function (row) {
    var result = auditUrl(row, context);
    if (result) output.push(result);
  });

  return output;
}

function buildAuditContext(normalizedRows, readiness, auditConfig) {
  return {
    rows: normalizedRows || [],
    readiness: readiness || {},
    auditConfig: auditConfig || {},
    warnings: readiness && readiness.warnings ? readiness.warnings : [],
    thresholds: CONFIG.thresholds
  };
}

function auditUrl(row, context) {
  if (shouldSkipFromMainAudit(row)) return null;

  var diagnosis =
    evaluateTechnicalBarrier(row, context) ||
    evaluateCanonicalReview(row, context) ||
    evaluateCtrOpportunity(row, context) ||
    evaluateGrowthOpportunity(row, context) ||
    evaluateInternalLinkOpportunity(row, context) ||
    evaluateEngagementIssue(row, context) ||
    evaluateContentRankingImprovement(row, context) ||
    evaluateBusinessValuePage(row, context) ||
    evaluateActivePerformer(row, context) ||
    evaluateLowValueCandidate(row, context) ||
    evaluateManualReview(row, context) ||
    evaluateInsufficientData(row, context) ||
    evaluateMonitor(row, context);

  if (!diagnosis) return null;

  return toAuditActionRow(row, diagnosis);
}

function shouldSkipFromMainAudit(row) {
  // Non-HTML resources should not appear in user-facing audit actions.
  if (row.is_html === false) return true;

  // Unknown scope should stay in output for insufficient/manual review.
  return false;
}

function toAuditActionRow(row, diagnosis) {
  return {
    URL: row.url || '',
    'Nhãn chính': diagnosis.primaryLabel || '',
    'Nhãn phụ': (diagnosis.secondaryLabels || []).slice(0, 2).join('; '),
    'Hành động đề xuất': diagnosis.action || '',
    'Ưu tiên': diagnosis.priority || PRIORITIES.P3,
    'Độ tin cậy': diagnosis.confidence || CONFIDENCE.LOW,
    'Bằng chứng': truncateText(diagnosis.evidence || '', 450),
    'Cần review thủ công': diagnosis.manualReviewRequired || YES_NO.NO,
    'Trạng thái xử lý': 'Chưa review',
    'Ghi chú': '',

    // Internal fields for debugging later. OutputWriter MVP can ignore these.
    _labelKey: diagnosis.labelKey || '',
    _actionKey: diagnosis.actionKey || '',
    _rowIndex: row.row_index
  };
}

/**
 * 1. Technical Barrier
 */
function evaluateTechnicalBarrier(row, context) {
  if (row.is_html !== true && row.audit_scope !== 'unknown') return null;

  var isNon200 = row.status_code !== null && row.status_code !== 200;

  var isNoindexOrBlocked =
    row.status_code === 200 &&
    row.is_non_indexable === true &&
    row.index_eligibility !== 'canonicalized';

  if (!isNon200 && !isNoindexOrBlocked) return null;

  var secondaryLabels = [];
  var confidence = row.status_confidence || CONFIDENCE.MEDIUM;
  var manualReview = YES_NO.YES;
  var evidenceParts = [];

  var priority = getTechnicalBarrierPriority(row);

  if (row.has_business_value) {
    secondaryLabels.push(LABELS.BUSINESS_VALUE_PAGE);
  }

  if (row.status_group === '3xx') {
    evidenceParts.push('Status ' + row.status_code);

    if (row.internal_link_count !== null) {
      evidenceParts.push('Internal links=' + row.internal_link_count);
    }

    if (row.has_organic_clicks || row.has_search_visibility) {
      evidenceParts.push('vẫn có GSC data');
    }

    evidenceParts.push('cần review redirect target và internal links');
  } else if (row.status_group === '4xx' || row.status_group === '5xx') {
    evidenceParts.push('Status ' + row.status_code);

    if (row.internal_link_count !== null) {
      evidenceParts.push('Internal links=' + row.internal_link_count);
    }

    if (row.has_organic_clicks || row.has_search_visibility) {
      evidenceParts.push('vẫn có GSC data');
    }

    evidenceParts.push('URL lỗi cần review kỹ thuật');
  } else if (isNoindexOrBlocked) {
    evidenceParts.push('Non-indexable' + (row.indexability_status ? '/' + row.indexability_status : ''));

    if (row.has_organic_clicks || row.has_search_visibility) {
      evidenceParts.push('vẫn có GSC data');
    }

    if (row.internal_link_count !== null) {
      evidenceParts.push('Internal links=' + row.internal_link_count);
    }

    evidenceParts.push('cần xác minh noindex/non-indexable có chủ đích không');
  }

  return {
    labelKey: 'technical_barrier',
    actionKey: 'technical_review_fix',
    primaryLabel: LABELS.TECHNICAL_BARRIER,
    secondaryLabels: secondaryLabels,
    action: ACTIONS.TECHNICAL_REVIEW_FIX,
    priority: priority,
    confidence: confidence,
    evidence: evidenceParts.join('; ') + '.',
    manualReviewRequired: manualReview
  };
}

/**
 * 2. Canonical / Consolidation Review
 */
function evaluateCanonicalReview(row, context) {
  var isCanonicalProblem =
    row.is_canonicalized === true ||
    row.is_cross_domain_canonical === true ||
    row.index_eligibility === 'canonicalized';

  if (!isCanonicalProblem) return null;

  var priority = PRIORITIES.P3;
  var secondaryLabels = [];
  var evidenceParts = [];

  if (row.has_business_value) {
    secondaryLabels.push(LABELS.BUSINESS_VALUE_PAGE);
    priority = PRIORITIES.P1;
  } else if (hasStrongTrafficOrVisibility(row)) {
    priority = PRIORITIES.P1;
  } else if (row.has_search_visibility || row.has_sessions || row.internal_link_count > 0) {
    priority = PRIORITIES.P2;
  }

  if (row.is_cross_domain_canonical) {
    evidenceParts.push('Cross-domain canonical detected');
  } else {
    evidenceParts.push('Canonical trỏ sang URL khác');
  }

  if (row.gsc_impressions !== null && row.gsc_impressions > 0) {
    evidenceParts.push('GSC impressions=' + row.gsc_impressions);
  }

  if (row.gsc_clicks !== null && row.gsc_clicks > 0) {
    evidenceParts.push('GSC clicks=' + row.gsc_clicks);
  }

  evidenceParts.push('cần review canonical có chủ đích không');

  return {
    labelKey: 'canonical_consolidation_review',
    actionKey: 'canonical_review',
    primaryLabel: LABELS.CANONICAL_CONSOLIDATION_REVIEW,
    secondaryLabels: secondaryLabels,
    action: ACTIONS.CANONICAL_REVIEW,
    priority: priority,
    confidence: row.canonical_confidence || CONFIDENCE.MEDIUM,
    evidence: evidenceParts.join('; ') + '.',
    manualReviewRequired: YES_NO.YES
  };
}

/**
 * 3. CTR Opportunity
 */
function evaluateCtrOpportunity(row, context) {
  if (!row.eligible_url) return null;
  if (!row.meaningful_impressions) return null;
  if (!row.is_top_10) return null;
  if (row.ctr_confidence === CONFIDENCE.LOW) return null;
  if (!row.is_low_ctr_candidate) return null;

  var secondaryLabels = [];

  if (isActivePerformer(row)) {
    secondaryLabels.push(LABELS.ACTIVE_PERFORMER);
  }

  if (row.has_business_value) {
    secondaryLabels.push(LABELS.BUSINESS_VALUE_PAGE);
  }

  var priority = row.impression_bucket === 'high' ? PRIORITIES.P1 : PRIORITIES.P2;

  var ctr = row.gsc_ctr_computed !== null ? row.gsc_ctr_computed : row.gsc_ctr_raw;

  var evidence = [
    'Position ' + formatNumberForEvidence(row.gsc_position),
    'Impressions=' + formatNumberForEvidence(row.gsc_impressions),
    'CTR=' + formatPercentForEvidence(ctr)
  ];

  if (isActivePerformer(row)) {
    evidence.push('URL đang có traffic tốt, nên tối ưu snippet cẩn thận');
  } else {
    evidence.push('top 10 nhưng CTR thấp, nên tối ưu snippet');
  }

  return {
    labelKey: 'ctr_opportunity',
    actionKey: 'optimize_snippet',
    primaryLabel: LABELS.CTR_OPPORTUNITY,
    secondaryLabels: secondaryLabels,
    action: ACTIONS.OPTIMIZE_SNIPPET,
    priority: priority,
    confidence: row.ctr_confidence || CONFIDENCE.MEDIUM,
    evidence: evidence.join('; ') + '.',
    manualReviewRequired: isActivePerformer(row) ? YES_NO.YES : YES_NO.NO
  };
}

/**
 * 4. Growth Opportunity
 */
function evaluateGrowthOpportunity(row, context) {
  if (!row.eligible_url) return null;
  if (!row.meaningful_impressions) return null;
  if (row.position_bucket !== 'top_11_20') return null;

  var secondaryLabels = [];
  var action = ACTIONS.UPDATE_REFRESH;
  var actionKey = 'update_refresh';

  if (row.is_low_internal_link) {
    secondaryLabels.push(LABELS.INTERNAL_LINK_OPPORTUNITY);
    action = ACTIONS.IMPROVE_INTERNAL_LINKING;
    actionKey = 'improve_internal_linking';
  }

  if (row.has_business_value) {
    secondaryLabels.push(LABELS.BUSINESS_VALUE_PAGE);
  } else if (isActivePerformer(row)) {
    secondaryLabels.push(LABELS.ACTIVE_PERFORMER);
  }

  var priority = row.impression_bucket === 'high' ? PRIORITIES.P1 : PRIORITIES.P2;
  var confidence = row.impression_bucket === 'high' ? CONFIDENCE.HIGH : CONFIDENCE.MEDIUM;

  var evidence = [
    'Position ' + formatNumberForEvidence(row.gsc_position),
    'Impressions=' + formatNumberForEvidence(row.gsc_impressions)
  ];

  if (row.is_low_internal_link) {
    evidence.push('Internal links thấp=' + row.internal_link_count);
    evidence.push('có cơ hội tăng trưởng nếu cải thiện Internal Link');
  } else {
    evidence.push('có ranking potential rõ');
  }

  return {
    labelKey: 'growth_opportunity',
    actionKey: actionKey,
    primaryLabel: LABELS.GROWTH_OPPORTUNITY,
    secondaryLabels: secondaryLabels,
    action: action,
    priority: priority,
    confidence: confidence,
    evidence: evidence.join('; ') + '.',
    manualReviewRequired: row.has_business_value ? YES_NO.YES : YES_NO.NO
  };
}

/**
 * 5. Internal Link Opportunity
 * v1.2: siết lại, không trigger mạnh chỉ vì position top 10 với impressions quá thấp.
 */
function evaluateInternalLinkOpportunity(row, context) {
  if (!row.eligible_url) return null;
  if (!row.is_low_internal_link) return null;
  if (!hasInternalLinkOpportunityPotential(row)) return null;

  var secondaryLabels = [];

  if (row.has_business_value) {
    secondaryLabels.push(LABELS.BUSINESS_VALUE_PAGE);
  } else if (isActivePerformer(row)) {
    secondaryLabels.push(LABELS.ACTIVE_PERFORMER);
  } else if (
    (row.position_bucket === 'top_4_10' || row.position_bucket === 'top_11_20') &&
    row.gsc_impressions !== null &&
    row.gsc_impressions >= CONFIG.thresholds.MIN_MEANINGFUL_IMPRESSIONS
  ) {
    secondaryLabels.push(LABELS.GROWTH_OPPORTUNITY);
  }

  var priority = PRIORITIES.P2;

  if (
    row.has_business_value ||
    row.gsc_impressions >= CONFIG.thresholds.HIGH_CONFIDENCE_IMPRESSIONS ||
    row.click_volume_confidence === CONFIDENCE.HIGH ||
    row.session_volume_confidence === CONFIDENCE.HIGH
  ) {
    priority = PRIORITIES.P1;
  }

  var confidence = row.internal_link_confidence || CONFIDENCE.MEDIUM;

  if (
    row.gsc_impressions !== null &&
    row.gsc_impressions < CONFIG.thresholds.MIN_MEANINGFUL_IMPRESSIONS &&
    !row.has_organic_clicks &&
    !row.has_business_value
  ) {
    confidence = CONFIDENCE.MEDIUM;
    priority = PRIORITIES.P3;
  }

  var evidence = [];

  if (row.internal_link_count !== null) {
    evidence.push('Internal links=' + row.internal_link_count);
  }

  if (row.gsc_position !== null) {
    evidence.push('Position ' + formatNumberForEvidence(row.gsc_position));
  }

  if (row.gsc_impressions !== null) {
    evidence.push('Impressions=' + formatNumberForEvidence(row.gsc_impressions));
  }

  if (row.has_business_value) {
    evidence.push('URL có business value nhưng internal support yếu');
  } else {
    evidence.push('URL có potential nhưng internal support yếu');
  }

  return {
    labelKey: 'internal_link_opportunity',
    actionKey: 'improve_internal_linking',
    primaryLabel: LABELS.INTERNAL_LINK_OPPORTUNITY,
    secondaryLabels: secondaryLabels,
    action: ACTIONS.IMPROVE_INTERNAL_LINKING,
    priority: priority,
    confidence: confidence,
    evidence: evidence.join('; ') + '.',
    manualReviewRequired: row.has_business_value ? YES_NO.YES : YES_NO.NO
  };
}

/**
 * 6. Engagement Issue
 */
function evaluateEngagementIssue(row, context) {
  if (!row.eligible_url) return null;
  if (!row.low_engagement_candidate) return null;
  if (row.engagement_confidence === CONFIDENCE.LOW) return null;
  if (row.has_business_value) return null;
  if (row.protected_pattern || row.excluded_pattern) return null;

  var priority = row.ga4_sessions >= CONFIG.thresholds.HIGH_CONFIDENCE_SESSIONS
    ? PRIORITIES.P1
    : PRIORITIES.P2;

  var evidence = [
    'Sessions=' + formatNumberForEvidence(row.ga4_sessions),
    'Engagement Rate=' + formatPercentForEvidence(row.ga4_engagement_rate),
    'no conversion detected',
    'cần review intent/UX/content satisfaction'
  ];

  return {
    labelKey: 'engagement_issue',
    actionKey: 'update_refresh',
    primaryLabel: LABELS.ENGAGEMENT_ISSUE,
    secondaryLabels: [],
    action: ACTIONS.UPDATE_REFRESH,
    priority: priority,
    confidence: row.engagement_confidence || CONFIDENCE.MEDIUM,
    evidence: evidence.join('; ') + '.',
    manualReviewRequired: YES_NO.YES
  };
}

/**
 * 7. Content / Ranking Improvement
 */
function evaluateContentRankingImprovement(row, context) {
  if (!row.eligible_url) return null;
  if (!row.meaningful_impressions) return null;
  if (row.position_bucket !== 'top_21_50') return null;

  var secondaryLabels = [];

  if (row.low_content_signal) {
    secondaryLabels.push('Tín hiệu nội dung thấp');
  }

  if (row.is_low_internal_link) {
    secondaryLabels.push(LABELS.INTERNAL_LINK_OPPORTUNITY);
  }

  var priority = row.impression_bucket === 'high' ? PRIORITIES.P1 : PRIORITIES.P2;

  var evidence = [
    'Position ' + formatNumberForEvidence(row.gsc_position),
    'Impressions=' + formatNumberForEvidence(row.gsc_impressions),
    'ranking ngoài top 20'
  ];

  if (row.low_content_signal) {
    evidence.push('Word Count=' + row.word_count);
  }

  evidence.push('cần review intent/content coverage');

  return {
    labelKey: 'content_ranking_improvement',
    actionKey: 'update_refresh',
    primaryLabel: LABELS.CONTENT_RANKING_IMPROVEMENT,
    secondaryLabels: secondaryLabels,
    action: ACTIONS.UPDATE_REFRESH,
    priority: priority,
    confidence: row.impression_bucket === 'high' ? CONFIDENCE.HIGH : CONFIDENCE.MEDIUM,
    evidence: evidence.join('; ') + '.',
    manualReviewRequired: YES_NO.YES
  };
}

/**
 * 8. Business Value Page
 */
function evaluateBusinessValuePage(row, context) {
  if (!row.has_business_value) return null;

  var evidence = [];

  if (row.ga4_conversions !== null && row.ga4_conversions > 0) {
    evidence.push('GA4 Conversions=' + row.ga4_conversions);
  }

  if (row.ga4_total_revenue !== null && row.ga4_total_revenue > 0) {
    evidence.push('Revenue=' + row.ga4_total_revenue);
  }

  evidence.push('URL có business value, không đưa vào nhóm giá trị thấp');

  return {
    labelKey: 'business_value_page',
    actionKey: 'keep_protect',
    primaryLabel: LABELS.BUSINESS_VALUE_PAGE,
    secondaryLabels: [],
    action: ACTIONS.KEEP_PROTECT,
    priority: PRIORITIES.P2,
    confidence: row.business_value_confidence || CONFIDENCE.HIGH,
    evidence: evidence.join('; ') + '.',
    manualReviewRequired: YES_NO.NO
  };
}

/**
 * 9. Active Performer
 * v1.2: thêm fallback Top 10 + meaningful impressions + clicks > 0.
 */
function evaluateActivePerformer(row, context) {
  if (!row.eligible_url) return null;
  if (!isActivePerformer(row)) return null;

  var evidence = [];

  if (row.gsc_position !== null && row.is_top_10) {
    evidence.push('Position top 10');
  }

  if (row.gsc_clicks !== null) {
    evidence.push('Clicks=' + formatNumberForEvidence(row.gsc_clicks));
  }

  if (row.gsc_impressions !== null) {
    evidence.push('Impressions=' + formatNumberForEvidence(row.gsc_impressions));
  }

  if (row.ga4_sessions !== null) {
    evidence.push('Sessions=' + formatNumberForEvidence(row.ga4_sessions));
  }

  evidence.push('URL eligible và đang có performance tốt');

  return {
    labelKey: 'active_performer',
    actionKey: 'keep_protect',
    primaryLabel: LABELS.ACTIVE_PERFORMER,
    secondaryLabels: [],
    action: ACTIONS.KEEP_PROTECT,
    priority: PRIORITIES.P3,
    confidence: getActivePerformerConfidence(row),
    evidence: evidence.join('; ') + '.',
    manualReviewRequired: YES_NO.NO
  };
}

/**
 * 10. Low Value Candidate
 */
function evaluateLowValueCandidate(row, context) {
  if (!row.eligible_url) return null;

  if (row.protected_pattern || row.review_pattern || row.excluded_pattern) return null;
  if (row.has_business_value) return null;

  if (!row.gsc_data_available) return null;
  if (!row.ga4_behavior_available) return null;
  if (!row.ga4_business_value_available) return null;

  var gscWeak = isZeroOrLow(row.gsc_impressions, row.impression_bucket) &&
    isZeroOrLow(row.gsc_clicks, row.click_bucket);

  var ga4Weak = isZeroOrLow(row.ga4_sessions, row.session_bucket);

  var businessWeak = row.business_value_status === 'no_value_detected';

  var internalWeak = row.internal_link_bucket === 'very_low' || row.internal_link_bucket === 'low';

  if (!(gscWeak && ga4Weak && businessWeak && internalWeak)) return null;

  var evidence = [
    formatWeakMetric('Clicks', row.gsc_clicks),
    formatWeakMetric('Impressions', row.gsc_impressions),
    formatWeakMetric('Sessions', row.ga4_sessions),
    'Internal links thấp',
    'không thuộc protected pattern'
  ];

  return {
    labelKey: 'low_value_candidate',
    actionKey: 'manual_review',
    primaryLabel: LABELS.LOW_VALUE_CANDIDATE,
    secondaryLabels: [],
    action: ACTIONS.MANUAL_REVIEW,
    priority: PRIORITIES.P2,
    confidence: CONFIDENCE.MEDIUM,
    evidence: evidence.join('; ') + ' → cần review trước khi Noindex/Gộp/Xóa.',
    manualReviewRequired: YES_NO.YES
  };
}

/**
 * 11. Manual Review
 * v1.2: protected URL không còn rơi vào Monitor nếu không có data rõ.
 */
function evaluateManualReview(row, context) {
  if (row.excluded_pattern) {
    return {
      labelKey: 'manual_review',
      actionKey: 'manual_review',
      primaryLabel: LABELS.MANUAL_REVIEW,
      secondaryLabels: [],
      action: ACTIONS.MANUAL_REVIEW,
      priority: PRIORITIES.P3,
      confidence: CONFIDENCE.MEDIUM,
      evidence: 'URL thuộc excluded/utility pattern → không chạy Growth/CTR/Content Improvement, cần xác minh scope nếu muốn xử lý.',
      manualReviewRequired: YES_NO.YES
    };
  }

  if (row.review_pattern) {
    return {
      labelKey: 'manual_review',
      actionKey: 'manual_review',
      primaryLabel: LABELS.MANUAL_REVIEW,
      secondaryLabels: [],
      action: ACTIONS.MANUAL_REVIEW,
      priority: hasStrongTrafficOrVisibility(row) ? PRIORITIES.P2 : PRIORITIES.P3,
      confidence: CONFIDENCE.MEDIUM,
      evidence: 'URL thuộc review pattern; cần kiểm tra thủ công trước khi Noindex/Canonical/Gộp/Xóa.',
      manualReviewRequired: YES_NO.YES
    };
  }

  if (row.protected_pattern && !hasValueOrPotential(row)) {
    return {
      labelKey: 'manual_review',
      actionKey: 'manual_review',
      primaryLabel: LABELS.MANUAL_REVIEW,
      secondaryLabels: [],
      action: ACTIONS.MANUAL_REVIEW,
      priority: PRIORITIES.P3,
      confidence: CONFIDENCE.LOW,
      evidence: 'URL thuộc protected pattern; business value có thể chưa được tracking trong GA4 → cần kiểm tra thủ công trước khi đánh giá thấp.',
      manualReviewRequired: YES_NO.YES
    };
  }

  if (row.ga4_sessions !== null && row.ga4_sessions > 0 && (!row.gsc_clicks || row.gsc_clicks === 0)) {
    return {
      labelKey: 'manual_review',
      actionKey: 'manual_review',
      primaryLabel: LABELS.MANUAL_REVIEW,
      secondaryLabels: [],
      action: ACTIONS.MANUAL_REVIEW,
      priority: PRIORITIES.P3,
      confidence: CONFIDENCE.MEDIUM,
      evidence: 'GA4 sessions có nhưng GSC clicks thấp/không có → cần kiểm tra traffic source hoặc GA4/GSC mapping.',
      manualReviewRequired: YES_NO.YES
    };
  }

  return null;
}

/**
 * 12. Insufficient Data
 */
function evaluateInsufficientData(row, context) {
  var missing = [];

  if (!row.gsc_data_available) missing.push('GSC');
  if (!row.ga4_behavior_available) missing.push('GA4 Sessions');
  if (!row.ga4_business_value_available) missing.push('GA4 Conversions/Revenue');
  if (!row.indexability_available) missing.push('Indexability');

  if (!missing.length) return null;

  // Avoid over-labeling rows as insufficient if they already have action signals.
  if (row.eligible_url && missing.length <= 1 && hasValueOrPotential(row)) return null;

  return {
    labelKey: 'insufficient_data',
    actionKey: 'manual_review',
    primaryLabel: LABELS.INSUFFICIENT_DATA,
    secondaryLabels: [],
    action: ACTIONS.MANUAL_REVIEW,
    priority: missing.length >= 2 ? PRIORITIES.P2 : PRIORITIES.P3,
    confidence: CONFIDENCE.LOW,
    evidence: 'Thiếu data: ' + missing.join(', ') + ' → chưa đủ cơ sở kết luận chắc.',
    manualReviewRequired: YES_NO.YES
  };
}

/**
 * 13. Monitor
 */
function evaluateMonitor(row, context) {
  if (row.is_html !== true) return null;

  return {
    labelKey: 'monitor',
    actionKey: 'monitor',
    primaryLabel: LABELS.MONITOR,
    secondaryLabels: [],
    action: ACTIONS.MONITOR,
    priority: PRIORITIES.P3,
    confidence: CONFIDENCE.LOW,
    evidence: 'Chưa có issue/opportunity đủ rõ trong data hiện tại → theo dõi thêm.',
    manualReviewRequired: YES_NO.NO
  };
}

/***************************************
 * Helper functions for AuditEngine
 ***************************************/

function isActivePerformer(row) {
  if (row.eligible_url !== true) return false;

  if (
    row.click_bucket === 'high' ||
    row.click_volume_confidence === CONFIDENCE.HIGH ||
    row.session_bucket === 'high' ||
    row.session_volume_confidence === CONFIDENCE.HIGH
  ) {
    return true;
  }

  // v1.2 fallback:
  // Top 10 + meaningful impressions + có clicks
  // không nên bị rơi vào "Theo dõi thêm".
  if (
    row.is_top_10 === true &&
    row.gsc_impressions !== null &&
    row.gsc_impressions >= CONFIG.thresholds.MIN_MEANINGFUL_IMPRESSIONS &&
    row.gsc_clicks !== null &&
    row.gsc_clicks > 0
  ) {
    return true;
  }

  return false;
}

function getActivePerformerConfidence(row) {
  if (
    row.click_volume_confidence === CONFIDENCE.HIGH ||
    row.session_volume_confidence === CONFIDENCE.HIGH ||
    (
      row.is_top_10 === true &&
      row.gsc_impressions !== null &&
      row.gsc_impressions >= CONFIG.thresholds.HIGH_CONFIDENCE_IMPRESSIONS &&
      row.gsc_clicks !== null &&
      row.gsc_clicks > 0
    )
  ) {
    return CONFIDENCE.HIGH;
  }

  return CONFIDENCE.MEDIUM;
}

function hasStrongTrafficOrVisibility(row) {
  return (
    row.impression_bucket === 'high' ||
    row.click_bucket === 'high' ||
    row.session_bucket === 'high' ||
    row.click_volume_confidence === CONFIDENCE.HIGH ||
    row.session_volume_confidence === CONFIDENCE.HIGH ||
    row.has_business_value === true ||
    (
      row.gsc_impressions !== null &&
      row.gsc_impressions >= CONFIG.thresholds.HIGH_CONFIDENCE_IMPRESSIONS
    ) ||
    (
      row.gsc_clicks !== null &&
      row.gsc_clicks >= CONFIG.thresholds.MIN_MEANINGFUL_CLICKS
    )
  );
}

function hasValueOrPotential(row) {
  return (
    row.has_business_value === true ||
    row.meaningful_impressions === true ||
    row.has_organic_clicks === true ||
    hasMeaningfulSessionSignal(row) ||
    (
      (row.position_bucket === 'top_4_10' || row.position_bucket === 'top_11_20') &&
      row.gsc_impressions !== null &&
      row.gsc_impressions >= CONFIG.thresholds.MIN_MEANINGFUL_IMPRESSIONS
    )
  );
}

function hasMeaningfulSessionSignal(row) {
  return (
    row.ga4_sessions !== null &&
    row.ga4_sessions >= CONFIG.thresholds.MIN_MEANINGFUL_SESSIONS
  );
}

function hasInternalLinkOpportunityPotential(row) {
  if (row.has_business_value === true) return true;

  if (
    row.gsc_impressions !== null &&
    row.gsc_impressions >= CONFIG.thresholds.MIN_MEANINGFUL_IMPRESSIONS
  ) {
    return true;
  }

  if (
    row.gsc_clicks !== null &&
    row.gsc_clicks >= CONFIG.thresholds.MIN_MEANINGFUL_CLICKS
  ) {
    return true;
  }

  if (hasMeaningfulSessionSignal(row)) {
    return true;
  }

  return false;
}

function getTechnicalBarrierPriority(row) {
  if (row.has_business_value) {
    return PRIORITIES.P0;
  }

  if (
    row.gsc_clicks !== null &&
    row.gsc_clicks > 0
  ) {
    return PRIORITIES.P1;
  }

  if (
    row.gsc_impressions !== null &&
    row.gsc_impressions >= CONFIG.thresholds.HIGH_CONFIDENCE_IMPRESSIONS
  ) {
    return PRIORITIES.P1;
  }

  if (
    row.internal_link_count !== null &&
    row.internal_link_count >= 100
  ) {
    return PRIORITIES.P2;
  }

  if (
    row.internal_link_count !== null &&
    row.internal_link_count >= 50
  ) {
    return PRIORITIES.P2;
  }

  if (row.protected_pattern) {
    return PRIORITIES.P2;
  }

  return PRIORITIES.P3;
}

function isZeroOrLow(value, bucket) {
  if (value === null || value === undefined) return false;
  if (value === 0) return true;
  return bucket === 'none' || bucket === 'low';
}

function formatWeakMetric(label, value) {
  if (value === null || value === undefined) return label + '=unknown';
  return label + '=' + value;
}

function formatNumberForEvidence(value) {
  if (value === null || value === undefined) return 'unknown';

  var num = Number(value);
  if (isNaN(num)) return String(value);

  if (Math.abs(num) >= 1000) {
    return Math.round(num).toLocaleString('en-US');
  }

  if (Math.abs(num) < 10 && num % 1 !== 0) {
    return Math.round(num * 100) / 100;
  }

  return Math.round(num * 10) / 10;
}

function formatPercentForEvidence(value) {
  if (value === null || value === undefined) return 'unknown';

  var num = Number(value);
  if (isNaN(num)) return String(value);

  return (Math.round(num * 10000) / 100) + '%';
}

/**
 * Test AuditEngine v1.2 after replacing full AuditEngine.gs
 */
function runAuditEngineV12Test() {
  var sampleCsv = [
    'Address,Content Type,Status Code,Indexability,Indexability Status,Canonical Link Element 1,Clicks,Impressions,CTR,Position,GA4 Sessions,GA4 Conversions,Unique Inlinks,Crawl Depth,Word Count,Response Time',
    'https://example.com/cong-nhom-duc/,text/html,200,Indexable,,https://example.com/cong-nhom-duc/,97,10490,0.9%,8.96,120,0,20,2,1200,0.7',
    'https://example.com/ban-ghe-nhom-duc/,text/html,200,Indexable,,https://example.com/ban-ghe-nhom-duc/,10,1047,0.9%,16.59,12,0,4,3,800,0.8',
    'https://example.com/tranh-nhom-duc/,text/html,200,Indexable,,https://example.com/tranh-nhom-duc/,19,404,4.7%,3.84,15,0,30,2,1000,0.9',
    'https://example.com/product-low-imp/,text/html,200,Indexable,,https://example.com/product-low-imp/,0,2,0%,5.5,0,0,1,4,300,0.9',
    'https://example.com/lien-he/,text/html,200,Indexable,,https://example.com/lien-he/,0,0,0%,0,0,0,10,1,200,0.7',
    'https://example.com/tin-tuc/,text/html,200,Non-Indexable,Noindex,https://example.com/tin-tuc/,0,0,0%,0,3,0,207,1,500,1.2',
    'https://example.com/2026/04/09/,text/html,301,Non-Indexable,Redirected,https://example.com/,0,0,0%,0,0,0,73,1,0,0.5',
    'https://example.com/image.jpg,image/jpeg,200,,,,0,0,,0,0,0,0,0,0,0.2'
  ].join('\n');

  var parsed = parseCsvFile(sampleCsv);
  var headerMap = buildHeaderMap(parsed.headers);
  validateCriticalHeaders(headerMap);

  var auditConfig = {
    projectName: 'AuditEngine v1.2 Test',
    websiteType: WEBSITE_TYPES.SERVICES,
    exportSource: EXPORT_SOURCES.INTERNAL_ALL,
    protectedPatterns: ['/lien-he/'],
    excludedPatterns: [],
    reviewPatterns: [],
    thresholds: CONFIG.thresholds,
    createdAt: nowString()
  };

  var normalizedRows = normalizeRows(parsed.rows, headerMap, auditConfig);
  normalizedRows = deriveBuckets(normalizedRows, auditConfig);

  var readiness = runDataReadiness(normalizedRows, headerMap, auditConfig);
  var auditRows = runBaselineAudit(normalizedRows, readiness, auditConfig);

  Logger.log('Audit rows: ' + auditRows.length);
  Logger.log(JSON.stringify(auditRows, null, 2));

  return auditRows;
}