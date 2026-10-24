/***************************************
 * WebApp.gs
 * Build audit config from UI payload + UI options
 ***************************************/

function buildAuditConfig(payload) {
  var websiteType = payload.websiteType || WEBSITE_TYPES.GENERAL;
  var exportSource = payload.exportSource || EXPORT_SOURCES.UNKNOWN;

  var userProtectedPatterns = normalizePatternList(payload.protectedPatterns || '');

  var defaultExcludedPatterns = getDefaultPatterns('excluded', websiteType);
  var defaultReviewPatterns = getDefaultPatterns('review', websiteType);

  return {
    auditId: 'AUDIT_' + formatDateKey(new Date()),
    projectName: sanitizeProjectName(payload.projectName || 'Untitled Project'),
    websiteType: websiteType,
    exportSource: exportSource,

    // User custom protected patterns only.
    // Default protected patterns are applied in Normalizer via applyPatternFlags().
    protectedPatterns: userProtectedPatterns,

    excludedPatterns: defaultExcludedPatterns,
    reviewPatterns: defaultReviewPatterns,

    thresholds: CONFIG.thresholds,
    createdAt: nowString(),
    fileName: payload.fileName || ''
  };
}

function getUiOptions() {
  return {
    appName: CONFIG.appName,
    version: CONFIG.version,
    auditEngineVersion: CONFIG.auditEngineVersion || '1.2',

    websiteTypes: [
      {
        value: WEBSITE_TYPES.GENERAL,
        label: 'Tổng hợp / Khác',
        description: 'Dùng cho website chưa xác định rõ loại hình. Tool chỉ áp dụng guardrail cơ bản.'
      },
      {
        value: WEBSITE_TYPES.ECOMMERCE,
        label: 'Ecommerce',
        description: 'Phù hợp với website có product/category/cart/checkout/filter. Tool sẽ cẩn trọng hơn với product/category và URL filter/search.'
      },
      {
        value: WEBSITE_TYPES.SERVICES,
        label: 'Dịch vụ / Local Business',
        description: 'Phù hợp với website dịch vụ, local business, lead-gen. Tool sẽ bảo vệ các URL như /dich-vu/, /bao-gia/, /lien-he/.'
      },
      {
        value: WEBSITE_TYPES.BLOG,
        label: 'Blog / Publisher',
        description: 'Phù hợp với site nội dung, tin tức, blog. Tool sẽ cẩn trọng hơn với tag/author/archive/page.'
      },
      {
        value: WEBSITE_TYPES.DIRECTORY,
        label: 'Directory / Marketplace',
        description: 'Phù hợp với directory/listing/marketplace. Tool sẽ cẩn trọng hơn với listing/vendor/location/filter.'
      }
    ],

    exportSources: [
      {
        value: EXPORT_SOURCES.INTERNAL_HTML,
        label: 'Internal > HTML',
        description: 'File đã được lọc HTML từ Screaming Frog.'
      },
      {
        value: EXPORT_SOURCES.INTERNAL_ALL,
        label: 'Internal > All',
        description: 'File có thể chứa cả image/css/js/pdf. Tool sẽ tự lọc HTML bằng Content Type.'
      },
      {
        value: EXPORT_SOURCES.UNKNOWN,
        label: 'Không chắc',
        description: 'Tool sẽ cố gắng nhận diện scope từ Content Type. Nếu thiếu Content Type, confidence sẽ thấp hơn.'
      }
    ],

    defaultPatterns: {
      protected: DEFAULT_PATTERNS.protected,
      excluded: DEFAULT_PATTERNS.excluded,
      review: DEFAULT_PATTERNS.review
    },

    limits: {
      maxFileSizeMb: CONFIG.limits.maxFileSizeMb,
      recommendedRows: CONFIG.limits.recommendedRows,
      maxRows: CONFIG.limits.maxRows
    },

    requiredFields: [
      'Address',
      'Status Code'
    ],

    recommendedFields: [
      'Content Type',
      'Indexability',
      'Indexability Status',
      'Canonical Link Element 1',
      'Clicks',
      'Impressions',
      'CTR',
      'Position',
      'GA4 Sessions',
      'GA4 Engagement Rate',
      'GA4 Conversions / Key Events',
      'Unique Inlinks',
      'Crawl Depth',
      'Word Count',
      'Response Time'
    ]
  };
}