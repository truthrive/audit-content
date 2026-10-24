/***************************************
 * Config.gs
 * Global constants for Baseline Content Audit Tool
 ***************************************/

var CONFIG = {
  appName: 'Baseline Content Audit Tool',
  version: '1.0.0',
  timezone: 'Asia/Ho_Chi_Minh',
    drive: {
    outputFolderId: '1j_CKiReQGEM42HuW0lGIIJ1PbFqI3C8K'
  },

  limits: {
    maxRows: 20000,
    recommendedRows: 10000,
    maxFileSizeMb: 10
  },

  thresholds: {
    MIN_MEANINGFUL_IMPRESSIONS: 50,
    HIGH_CONFIDENCE_IMPRESSIONS: 200,

    MIN_MEANINGFUL_CLICKS: 10,
    HIGH_CONFIDENCE_CLICKS: 50,

    MIN_MEANINGFUL_SESSIONS: 10,
    HIGH_CONFIDENCE_SESSIONS: 50,

    LOW_ENGAGEMENT_RATE: 0.3,

    VERY_LOW_UNIQUE_INLINKS: 1,
    LOW_UNIQUE_INLINKS: 3,

    DEEP_CRAWL_DEPTH: 4,
    VERY_DEEP_CRAWL_DEPTH: 6,

    SLOW_RESPONSE_TIME: 1.5,
    VERY_SLOW_RESPONSE_TIME: 3
  }
};

var WEBSITE_TYPES = {
  GENERAL: 'general',
  ECOMMERCE: 'ecommerce',
  SERVICES: 'services',
  BLOG: 'blog',
  DIRECTORY: 'directory'
};

var EXPORT_SOURCES = {
  INTERNAL_HTML: 'internal_html',
  INTERNAL_ALL: 'internal_all',
  UNKNOWN: 'unknown'
};

var LABELS = {
  TECHNICAL_BARRIER: 'Rào cản kỹ thuật',
  BUSINESS_VALUE_PAGE: 'Trang có giá trị kinh doanh',
  ACTIVE_PERFORMER: 'Trang đang hoạt động tốt',
  GROWTH_OPPORTUNITY: 'Cơ hội tăng trưởng SEO',
  CTR_OPPORTUNITY: 'Cơ hội cải thiện CTR',
  INTERNAL_LINK_OPPORTUNITY: 'Cơ hội cải thiện Internal Link',
  CONTENT_RANKING_IMPROVEMENT: 'Cần cải thiện nội dung/ranking',
  ENGAGEMENT_ISSUE: 'Vấn đề tương tác người dùng',
  LOW_VALUE_CANDIDATE: 'Cần review giá trị thấp',
  CANONICAL_CONSOLIDATION_REVIEW: 'Cần review Canonical / gộp nội dung',
  MANUAL_REVIEW: 'Cần kiểm tra thủ công',
  INSUFFICIENT_DATA: 'Thiếu dữ liệu để kết luận',
  MONITOR: 'Theo dõi thêm'
};

var ACTIONS = {
  KEEP_PROTECT: 'Giữ và bảo vệ',
  MONITOR: 'Theo dõi thêm',
  UPDATE_REFRESH: 'Cập nhật / làm mới nội dung',
  REWRITE_EXPAND: 'Viết lại / mở rộng nội dung',
  OPTIMIZE_SNIPPET: 'Tối ưu Snippet / CTR',
  IMPROVE_INTERNAL_LINKING: 'Cải thiện Internal Link',
  TECHNICAL_REVIEW_FIX: 'Review / xử lý kỹ thuật',
  CANONICAL_REVIEW: 'Review Canonical',
  MERGE_CANDIDATE: 'Ứng viên gộp nội dung',
  NOINDEX_CANDIDATE: 'Ứng viên Noindex',
  REDIRECT_CANDIDATE: 'Ứng viên Redirect',
  DELETE_CANDIDATE: 'Ứng viên xóa',
  MANUAL_REVIEW: 'Kiểm tra thủ công'
};

var PRIORITIES = {
  P0: 'P0',
  P1: 'P1',
  P2: 'P2',
  P3: 'P3'
};

var CONFIDENCE = {
  HIGH: 'Cao',
  MEDIUM: 'Trung bình',
  LOW: 'Thấp'
};

var YES_NO = {
  YES: 'Có',
  NO: 'Không'
};

var REVIEWER_STATUS_OPTIONS = [
  'Chưa review',
  'Đã duyệt',
  'Cần kiểm tra thêm',
  'Đang xử lý',
  'Đã xử lý',
  'Từ chối'
];

var AUDIT_ACTION_COLUMNS = [
  'URL',
  'Nhãn chính',
  'Nhãn phụ',
  'Hành động đề xuất',
  'Ưu tiên',
  'Độ tin cậy',
  'Bằng chứng',
  'Cần review thủ công',
  'Trạng thái xử lý',
  'Ghi chú'
];

var HEADER_ALIASES = {
  url: [
    'Address',
    'URL',
    'Url'
  ],

  status_code: [
    'Status Code'
  ],

  status: [
    'Status'
  ],

  content_type: [
    'Content Type'
  ],

  indexability: [
    'Indexability'
  ],

  indexability_status: [
    'Indexability Status'
  ],

  canonical: [
    'Canonical Link Element 1',
    'Canonical',
    'Canonical URL'
  ],

  gsc_clicks: [
    'Clicks',
    'GSC Clicks'
  ],

  gsc_impressions: [
    'Impressions',
    'GSC Impressions'
  ],

  gsc_ctr_raw: [
    'CTR',
    'GSC CTR'
  ],

  gsc_position: [
    'Position',
    'Average Position',
    'GSC Position'
  ],

  ga4_sessions: [
    'GA4 Sessions',
    'Sessions'
  ],

  ga4_views: [
    'GA4 Views',
    'Views'
  ],

  ga4_engaged_sessions: [
    'GA4 Engaged sessions',
    'GA4 Engaged Sessions',
    'Engaged Sessions'
  ],

  ga4_engagement_rate: [
    'GA4 Engagement rate',
    'GA4 Engagement Rate',
    'Engagement Rate'
  ],

  ga4_conversions: [
    'GA4 Conversions',
    'Conversions',
    'Key Events',
    'GA4 Key Events'
  ],

  ga4_event_count: [
    'GA4 Event count',
    'GA4 Event Count',
    'Event Count'
  ],

  ga4_total_revenue: [
    'GA4 Total revenue',
    'GA4 Total Revenue',
    'Total Revenue',
    'Revenue'
  ],

  inlinks: [
    'Inlinks'
  ],

  unique_inlinks: [
    'Unique Inlinks'
  ],

  outlinks: [
    'Outlinks'
  ],

  unique_outlinks: [
    'Unique Outlinks'
  ],

  crawl_depth: [
    'Crawl Depth'
  ],

  word_count: [
    'Word Count'
  ],

  title: [
    'Title 1',
    'Title'
  ],

  title_length: [
    'Title 1 Length',
    'Title Length'
  ],

  meta_description: [
    'Meta Description 1',
    'Meta Description'
  ],

  meta_description_length: [
    'Meta Description 1 Length',
    'Meta Description Length'
  ],

  h1: [
    'H1-1',
    'H1'
  ],

  h1_length: [
    'H1-1 Length',
    'H1 Length'
  ],

  response_time: [
    'Response Time'
  ]
};

var CRITICAL_FIELDS = [
  'url',
  'status_code'
];

var RECOMMENDED_FIELDS = [
  'content_type',
  'indexability',
  'indexability_status',
  'canonical',
  'gsc_clicks',
  'gsc_impressions',
  'gsc_position',
  'ga4_sessions',
  'ga4_conversions',
  'unique_inlinks',
  'crawl_depth'
];

var DEFAULT_PATTERNS = {
  protected: {
    general: [],
    services: [
      '/dich-vu/',
      '/service/',
      '/services/',
      '/bao-gia/',
      '/lien-he/',
      '/contact/',
      '/tu-van/',
      '/dat-lich/',
      '/booking/',
      '/du-an/',
      '/case-study/'
    ],
    ecommerce: [
      '/san-pham/',
      '/product/',
      '/products/',
      '/danh-muc/',
      '/category/',
      '/collections/',
      '/brand/'
    ],
    blog: [
      '/blog/',
      '/tin-tuc/',
      '/news/',
      '/article/'
    ],
    directory: [
      '/listing/',
      '/vendor/',
      '/nha-cung-cap/',
      '/dia-diem/',
      '/category/',
      '/location/'
    ]
  },

  excluded: {
    general: [
      '/wp-admin/',
      '/wp-json/',
      '/feed/'
    ],
    services: [
      '/wp-admin/',
      '/wp-json/',
      '/feed/',
      '/thank-you/',
      '/cam-on/',
      '/login/',
      '/account/'
    ],
    ecommerce: [
      '/wp-admin/',
      '/wp-json/',
      '/feed/',
      '/cart/',
      '/checkout/',
      '/thank-you/',
      '/order-success/',
      '/login/',
      '/account/'
    ],
    blog: [
      '/wp-admin/',
      '/wp-json/',
      '/feed/',
      '/login/',
      '/account/'
    ],
    directory: [
      '/wp-admin/',
      '/wp-json/',
      '/feed/',
      '/login/',
      '/account/'
    ]
  },

  review: {
    general: [
      '/tag/',
      '/search/',
      '/filter/',
      '/author/',
      '/page/'
    ],
    services: [
      '/tag/',
      '/search/',
      '/filter/',
      '/author/',
      '/page/'
    ],
    ecommerce: [
      '/tag/',
      '/search/',
      '/filter/',
      '/author/',
      '/page/',
      '?sort=',
      '?filter=',
      '?orderby='
    ],
    blog: [
      '/tag/',
      '/author/',
      '/archive/',
      '/page/',
      '/search/'
    ],
    directory: [
      '/tag/',
      '/search/',
      '/filter/',
      '/author/',
      '/page/',
      '?sort=',
      '?filter='
    ]
  }
};