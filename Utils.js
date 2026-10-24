/***************************************
 * Utils.gs
 * Shared helper functions
 ***************************************/

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function safeString(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function normalizeHeaderText(value) {
  return safeString(value)
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeComparableText(value) {
  return normalizeHeaderText(value).toLowerCase();
}

function truncateText(text, maxLength) {
  var str = safeString(text);
  if (!maxLength || str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + '…';
}

function parseNumber(value) {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    if (isNaN(value)) return null;
    return value;
  }

  var raw = String(value).trim();

  if (raw === '') return null;

  raw = raw
    .replace(/\s/g, '')
    .replace(/%/g, '')
    .replace(/[^\d.,\-]/g, '');

  if (raw === '' || raw === '-' || raw === '.' || raw === ',') return null;

  var hasComma = raw.indexOf(',') !== -1;
  var hasDot = raw.indexOf('.') !== -1;

  if (hasComma && hasDot) {
    var lastComma = raw.lastIndexOf(',');
    var lastDot = raw.lastIndexOf('.');

    if (lastComma > lastDot) {
      raw = raw.replace(/\./g, '').replace(',', '.');
    } else {
      raw = raw.replace(/,/g, '');
    }
  } else if (hasComma && !hasDot) {
    if (/^-?\d{1,3}(,\d{3})+$/.test(raw)) {
      raw = raw.replace(/,/g, '');
    } else {
      raw = raw.replace(',', '.');
    }
  }

  var parsed = Number(raw);
  return isNaN(parsed) ? null : parsed;
}

function parsePercent(value) {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    if (isNaN(value)) return null;
    return value > 1 ? value / 100 : value;
  }

  var raw = String(value).trim();
  if (raw === '') return null;

  var hasPercentSign = raw.indexOf('%') !== -1;
  var num = parseNumber(raw);

  if (num === null) return null;

  if (hasPercentSign) return num / 100;

  return num > 1 ? num / 100 : num;
}

function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined) return false;

  var str = String(value).trim().toLowerCase();

  return ['true', 'yes', 'y', '1', 'có'].indexOf(str) !== -1;
}

function normalizeUrl(url) {
  if (isBlank(url)) return '';

  var str = String(url).trim();

  str = str.replace(/^"+|"+$/g, '');

  return str;
}

function parseUrlParts(url) {
  url = normalizeUrl(url);

  if (!url) {
    return {
      url: '',
      protocol: '',
      domain: '',
      path: '',
      query: '',
      hash: ''
    };
  }

  try {
    var parsed = new URL(url);

    return {
      url: parsed.href,
      protocol: parsed.protocol.replace(':', ''),
      domain: parsed.hostname.toLowerCase(),
      path: parsed.pathname || '/',
      query: parsed.search ? parsed.search.substring(1) : '',
      hash: parsed.hash ? parsed.hash.substring(1) : ''
    };
  } catch (err) {
    var stripped = url.replace(/^https?:\/\//i, '');
    var parts = stripped.split('/');
    var domain = parts[0] ? parts[0].toLowerCase() : '';
    var path = parts.length > 1 ? '/' + parts.slice(1).join('/') : '/';

    path = path.split('#')[0];

    var query = '';
    if (path.indexOf('?') !== -1) {
      query = path.split('?')[1] || '';
      path = path.split('?')[0] || '/';
    }

    return {
      url: url,
      protocol: '',
      domain: domain,
      path: path || '/',
      query: query,
      hash: ''
    };
  }
}

function extractDomain(url) {
  return parseUrlParts(url).domain;
}

function extractPath(url) {
  return parseUrlParts(url).path;
}

function buildUrlKey(url) {
  var parts = parseUrlParts(url);

  if (!parts.domain && !parts.path) return '';

  var path = parts.path || '/';

  if (path.length > 1) {
    path = path.replace(/\/+$/, '');
  }

  return parts.domain + path.toLowerCase();
}

function normalizePath(path) {
  if (isBlank(path)) return '/';

  var p = String(path).trim();

  if (p.charAt(0) !== '/') p = '/' + p;

  if (p.length > 1) {
    p = p.replace(/\/+$/, '');
  }

  return p.toLowerCase();
}

function formatDateTime(date) {
  return Utilities.formatDate(
    date,
    CONFIG.timezone || Session.getScriptTimeZone(),
    'yyyy-MM-dd HH:mm:ss'
  );
}

function formatDateKey(date) {
  return Utilities.formatDate(
    date,
    CONFIG.timezone || Session.getScriptTimeZone(),
    'yyyyMMdd_HHmmss'
  );
}

function nowString() {
  return formatDateTime(new Date());
}

function sanitizeProjectName(name) {
  var str = safeString(name).trim();

  if (!str) return 'Untitled Project';

  return str
    .replace(/[\\\/\?\*\[\]\:]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function safeGet(obj, key, fallback) {
  if (!obj || !Object.prototype.hasOwnProperty.call(obj, key)) {
    return fallback;
  }

  var value = obj[key];

  if (value === undefined || value === null) {
    return fallback;
  }

  return value;
}

function uniqueValues(values) {
  var seen = {};
  var output = [];

  values.forEach(function (value) {
    var key = String(value);
    if (!seen[key]) {
      seen[key] = true;
      output.push(value);
    }
  });

  return output;
}

function countBy(rows, key) {
  var result = {};

  rows.forEach(function (row) {
    var value = typeof key === 'function' ? key(row) : row[key];
    value = isBlank(value) ? '(blank)' : String(value);

    if (!result[value]) result[value] = 0;
    result[value]++;
  });

  return result;
}

function percentile(values, p) {
  var nums = values
    .map(parseNumber)
    .filter(function (v) {
      return v !== null && !isNaN(v);
    })
    .sort(function (a, b) {
      return a - b;
    });

  if (!nums.length) return null;

  if (p <= 0) return nums[0];
  if (p >= 100) return nums[nums.length - 1];

  var index = (p / 100) * (nums.length - 1);
  var lower = Math.floor(index);
  var upper = Math.ceil(index);
  var weight = index - lower;

  if (upper >= nums.length) return nums[lower];

  return nums[lower] * (1 - weight) + nums[upper] * weight;
}

function inArray(value, arr) {
  return arr.indexOf(value) !== -1;
}

function splitLinesToArray(value) {
  if (isBlank(value)) return [];

  if (Array.isArray(value)) {
    return value
      .map(function (item) {
        return String(item).trim();
      })
      .filter(function (item) {
        return item !== '';
      });
  }

  return String(value)
    .split(/\r?\n|,/)
    .map(function (item) {
      return item.trim();
    })
    .filter(function (item) {
      return item !== '';
    });
}

function normalizePattern(pattern) {
  if (isBlank(pattern)) return '';

  var p = String(pattern).trim();

  if (p.indexOf('?') === 0) return p.toLowerCase();

  if (p.charAt(0) !== '/') p = '/' + p;

  return p.toLowerCase();
}

function normalizePatternList(patterns) {
  return splitLinesToArray(patterns)
    .map(normalizePattern)
    .filter(function (p) {
      return p !== '';
    });
}

function pathMatchesPatterns(pathOrUrl, patterns) {
  if (!patterns || !patterns.length) return false;

  var parts = parseUrlParts(pathOrUrl);
  var haystack = ((parts.path || '') + (parts.query ? '?' + parts.query : '')).toLowerCase();

  return patterns.some(function (pattern) {
    var p = normalizePattern(pattern);
    if (!p) return false;

    return haystack.indexOf(p) !== -1;
  });
}

function mergeArraysUnique() {
  var combined = [];

  for (var i = 0; i < arguments.length; i++) {
    var arr = arguments[i] || [];
    arr.forEach(function (item) {
      if (combined.indexOf(item) === -1) {
        combined.push(item);
      }
    });
  }

  return combined;
}