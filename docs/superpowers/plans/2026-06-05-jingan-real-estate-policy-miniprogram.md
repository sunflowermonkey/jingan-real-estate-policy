# Jing'an Real Estate Policy Mini Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first usable version that generates static Jing'an real estate policy summary data locally, hosts it through GitHub Pages, and displays it in a WeChat Mini Program.

**Architecture:** The local collector is a Node.js CLI that reads config, gathers candidate articles, filters and ranks them, and writes `policies.json`. GitHub Pages serves the static JSON. The Mini Program fetches that JSON, renders list/detail views, filters by source type, and provides reliable copy-link behavior.

**Tech Stack:** Node.js 20+ built-in `node:test`, native `fetch`, CommonJS scripts, static JSON, native WeChat Mini Program WXML/WXSS/JS.

---

## File Structure

- `package.json`: npm scripts for tests, validation, and collection.
- `config/collector.config.json`: local collector configuration including `lookbackDays: 90` and `maxArticlesPerRun: 20`.
- `scripts/collector/config.js`: loads and validates collector config.
- `scripts/collector/normalize.js`: URL and text normalization helpers.
- `scripts/collector/relevance.js`: keyword matching, scoring, tag derivation, sorting, and max item limiting.
- `scripts/collector/schema.js`: validates generated `policies.json`.
- `scripts/collector/collect.js`: CLI entrypoint that gathers source items and writes static JSON.
- `scripts/collector/sources/manual.js`: first-version source adapter using curated seed items and fetchable URLs.
- `tests/collector/*.test.js`: Node tests for collector behavior.
- `policies.json`: generated static data consumed by GitHub Pages and the Mini Program.
- `miniprogram/app.json`: Mini Program route config.
- `miniprogram/app.js`: global app bootstrap.
- `miniprogram/app.wxss`: global styles.
- `miniprogram/project.config.json`: WeChat Developer Tools project config.
- `miniprogram/utils/policies.js`: data loading, filtering, and formatting helpers.
- `miniprogram/pages/index/*`: list page.
- `miniprogram/pages/detail/*`: detail page.
- `docs/github-pages.md`: GitHub Pages and Mini Program domain setup notes.

---

### Task 1: Project Scripts And Collector Config

**Files:**
- Create: `package.json`
- Create: `config/collector.config.json`
- Create: `scripts/collector/config.js`
- Test: `tests/collector/config.test.js`

- [ ] **Step 1: Write the failing config tests**

Create `tests/collector/config.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateConfig } = require('../../scripts/collector/config');

test('validateConfig accepts the default collector shape', () => {
  const config = validateConfig({
    lookbackDays: 90,
    maxArticlesPerRun: 20,
    regionKeywords: ['上海', '静安', '静安区'],
    topicKeywords: ['房地产', '房价波动'],
    sources: [
      {
        name: '上海发布',
        type: 'authoritative_media',
        urls: ['https://example.com/a']
      }
    ]
  });

  assert.equal(config.lookbackDays, 90);
  assert.equal(config.maxArticlesPerRun, 20);
  assert.deepEqual(config.regionKeywords, ['上海', '静安', '静安区']);
});

test('validateConfig rejects invalid limits', () => {
  assert.throws(
    () => validateConfig({
      lookbackDays: 0,
      maxArticlesPerRun: 20,
      regionKeywords: ['上海'],
      topicKeywords: ['房地产'],
      sources: []
    }),
    /lookbackDays must be a positive integer/
  );

  assert.throws(
    () => validateConfig({
      lookbackDays: 90,
      maxArticlesPerRun: 0,
      regionKeywords: ['上海'],
      topicKeywords: ['房地产'],
      sources: []
    }),
    /maxArticlesPerRun must be a positive integer/
  );
});
```

- [ ] **Step 2: Run the config test and verify it fails**

Run:

```bash
node --test tests/collector/config.test.js
```

Expected: FAIL because `scripts/collector/config.js` does not exist.

- [ ] **Step 3: Create package scripts and default config**

Create `package.json`:

```json
{
  "name": "jingan-real-estate-policy",
  "version": "0.1.0",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "test": "node --test tests/**/*.test.js",
    "collect": "node scripts/collector/collect.js",
    "validate:data": "node scripts/collector/collect.js --validate-only"
  },
  "engines": {
    "node": ">=20"
  }
}
```

Create `config/collector.config.json`:

```json
{
  "lookbackDays": 90,
  "maxArticlesPerRun": 20,
  "regionKeywords": ["上海", "静安", "静安区"],
  "topicKeywords": [
    "住房",
    "房地产",
    "购房",
    "限购",
    "租赁",
    "物业",
    "保障房",
    "城市更新",
    "土地",
    "房贷",
    "房价",
    "价格波动",
    "房价波动"
  ],
  "sources": [
    {
      "name": "上海发布",
      "type": "authoritative_media",
      "urls": []
    },
    {
      "name": "静安区政府",
      "type": "official_policy",
      "urls": []
    }
  ]
}
```

- [ ] **Step 4: Implement config loading and validation**

Create `scripts/collector/config.js`:

```js
const fs = require('node:fs');
const path = require('node:path');

function assertPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function assertStringArray(value, name) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || item.trim() === '')) {
    throw new Error(`${name} must be a non-empty string array`);
  }
}

function validateConfig(raw) {
  assertPositiveInteger(raw.lookbackDays, 'lookbackDays');
  assertPositiveInteger(raw.maxArticlesPerRun, 'maxArticlesPerRun');
  assertStringArray(raw.regionKeywords, 'regionKeywords');
  assertStringArray(raw.topicKeywords, 'topicKeywords');

  if (!Array.isArray(raw.sources)) {
    throw new Error('sources must be an array');
  }

  const sources = raw.sources.map((source) => {
    if (!source || typeof source.name !== 'string' || source.name.trim() === '') {
      throw new Error('source.name must be a non-empty string');
    }
    if (!['official_policy', 'authoritative_media', 'research_institution'].includes(source.type)) {
      throw new Error(`unsupported source type: ${source.type}`);
    }
    if (!Array.isArray(source.urls) || source.urls.some((url) => typeof url !== 'string')) {
      throw new Error('source.urls must be an array of strings');
    }
    return {
      name: source.name.trim(),
      type: source.type,
      urls: source.urls
    };
  });

  return {
    lookbackDays: raw.lookbackDays,
    maxArticlesPerRun: raw.maxArticlesPerRun,
    regionKeywords: raw.regionKeywords.map((item) => item.trim()),
    topicKeywords: raw.topicKeywords.map((item) => item.trim()),
    sources
  };
}

function loadConfig(configPath = path.join(process.cwd(), 'config', 'collector.config.json')) {
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return validateConfig(raw);
}

module.exports = {
  loadConfig,
  validateConfig
};
```

- [ ] **Step 5: Run the config test and verify it passes**

Run:

```bash
node --test tests/collector/config.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add package.json config/collector.config.json scripts/collector/config.js tests/collector/config.test.js
git commit -m "feat: add collector configuration"
```

---

### Task 2: Relevance Filtering, Sorting, And Article Limit

**Files:**
- Create: `scripts/collector/normalize.js`
- Create: `scripts/collector/relevance.js`
- Test: `tests/collector/relevance.test.js`

- [ ] **Step 1: Write the failing relevance tests**

Create `tests/collector/relevance.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeUrl } = require('../../scripts/collector/normalize');
const { rankAndLimitItems } = require('../../scripts/collector/relevance');

const config = {
  lookbackDays: 90,
  maxArticlesPerRun: 2,
  regionKeywords: ['上海', '静安', '静安区'],
  topicKeywords: ['房地产', '住房', '房价波动', '租赁']
};

test('normalizeUrl removes hash and common tracking params', () => {
  assert.equal(
    normalizeUrl('https://example.com/a?utm_source=x&id=1#section'),
    'https://example.com/a?id=1'
  );
});

test('rankAndLimitItems filters by date and relevance, sorts, dedupes, and limits', () => {
  const now = new Date('2026-06-05T00:00:00+08:00');
  const items = rankAndLimitItems([
    {
      title: '静安区住房租赁政策解读',
      sourceName: '静安区政府',
      sourceType: 'official_policy',
      publishedAt: '2026-05-20',
      url: 'https://example.com/a?utm_source=x',
      summary: '静安区住房租赁政策内容。'
    },
    {
      title: '上海房价波动观察',
      sourceName: '上海发布',
      sourceType: 'authoritative_media',
      publishedAt: '2026-05-18',
      url: 'https://example.com/b',
      summary: '上海房地产市场价格波动。'
    },
    {
      title: '无关新闻',
      sourceName: '其他',
      sourceType: 'authoritative_media',
      publishedAt: '2026-05-18',
      url: 'https://example.com/c',
      summary: '天气内容。'
    },
    {
      title: '过期静安房地产新闻',
      sourceName: '上海发布',
      sourceType: 'authoritative_media',
      publishedAt: '2026-01-01',
      url: 'https://example.com/d',
      summary: '静安房地产。'
    }
  ], config, now);

  assert.equal(items.length, 2);
  assert.equal(items[0].title, '静安区住房租赁政策解读');
  assert.equal(items[1].title, '上海房价波动观察');
  assert.ok(items[0].tags.includes('静安相关'));
  assert.ok(items[1].tags.includes('房价波动'));
  assert.ok(items[0].id);
  assert.equal(items[0].url, 'https://example.com/a');
});
```

- [ ] **Step 2: Run relevance tests and verify they fail**

Run:

```bash
node --test tests/collector/relevance.test.js
```

Expected: FAIL because collector relevance modules do not exist.

- [ ] **Step 3: Implement normalization helpers**

Create `scripts/collector/normalize.js`:

```js
const crypto = require('node:crypto');

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'spm'
]);

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeUrl(value) {
  const url = new URL(value);
  url.hash = '';
  for (const key of Array.from(url.searchParams.keys())) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  return url.toString();
}

function stableId(parts) {
  return crypto.createHash('sha256').update(parts.filter(Boolean).join('|')).digest('hex').slice(0, 16);
}

module.exports = {
  normalizeWhitespace,
  normalizeUrl,
  stableId
};
```

- [ ] **Step 4: Implement relevance ranking and article limit**

Create `scripts/collector/relevance.js`:

```js
const { normalizeUrl, normalizeWhitespace, stableId } = require('./normalize');

function daysBetween(a, b) {
  return Math.floor((a.getTime() - b.getTime()) / 86400000);
}

function includesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function deriveTags(text) {
  const tags = [];
  if (text.includes('静安') || text.includes('静安区')) tags.push('静安相关');
  if (text.includes('限购')) tags.push('限购');
  if (text.includes('租赁')) tags.push('租赁');
  if (text.includes('物业')) tags.push('物业');
  if (text.includes('城市更新')) tags.push('城市更新');
  if (text.includes('房贷')) tags.push('房贷');
  if (text.includes('房价波动') || text.includes('价格波动') || text.includes('房价')) tags.push('房价波动');
  if (text.includes('住房') || text.includes('房地产')) tags.push('住房');
  return Array.from(new Set(tags));
}

function scoreItem(item, config, now) {
  const text = normalizeWhitespace(`${item.title} ${item.summary || ''}`);
  const published = new Date(`${item.publishedAt}T00:00:00+08:00`);
  if (Number.isNaN(published.getTime())) return null;

  const ageDays = daysBetween(now, published);
  if (ageDays < 0 || ageDays > config.lookbackDays) return null;

  const regionMatched = includesAny(text, config.regionKeywords);
  const topicMatches = config.topicKeywords.filter((keyword) => text.includes(keyword));
  if (!regionMatched || topicMatches.length === 0) return null;

  let score = 0.3;
  if (text.includes('静安') || text.includes('静安区')) score += 0.35;
  if (item.sourceType === 'official_policy') score += 0.2;
  score += Math.min(topicMatches.length * 0.08, 0.25);
  score += Math.max(0, (config.lookbackDays - ageDays) / config.lookbackDays) * 0.1;

  return {
    score: Math.min(Number(score.toFixed(2)), 1),
    matchedKeywords: Array.from(new Set([...config.regionKeywords, ...topicMatches].filter((keyword) => text.includes(keyword)))),
    tags: deriveTags(text)
  };
}

function rankAndLimitItems(rawItems, config, now = new Date()) {
  const seen = new Set();
  const normalized = [];

  for (const item of rawItems) {
    const url = normalizeUrl(item.url);
    if (seen.has(url)) continue;
    seen.add(url);

    const scoring = scoreItem(item, config, now);
    if (!scoring) continue;

    const title = normalizeWhitespace(item.title);
    normalized.push({
      id: stableId([url, title, item.publishedAt]),
      title,
      sourceName: normalizeWhitespace(item.sourceName),
      sourceType: item.sourceType,
      publishedAt: item.publishedAt,
      url,
      summary: normalizeWhitespace(item.summary || '暂未提取到正文摘要'),
      tags: scoring.tags,
      matchedKeywords: scoring.matchedKeywords,
      relevanceScore: scoring.score
    });
  }

  return normalized
    .sort((a, b) => b.relevanceScore - a.relevanceScore || b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, config.maxArticlesPerRun);
}

module.exports = {
  rankAndLimitItems
};
```

- [ ] **Step 5: Run relevance tests and verify they pass**

Run:

```bash
node --test tests/collector/relevance.test.js
```

Expected: PASS.

- [ ] **Step 6: Run all tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add scripts/collector/normalize.js scripts/collector/relevance.js tests/collector/relevance.test.js
git commit -m "feat: add policy relevance ranking"
```

---

### Task 3: Data Schema Validation And Collector CLI

**Files:**
- Create: `scripts/collector/schema.js`
- Create: `scripts/collector/sources/manual.js`
- Create: `scripts/collector/collect.js`
- Create: `policies.json`
- Test: `tests/collector/schema.test.js`
- Test: `tests/collector/collect.test.js`

- [ ] **Step 1: Write schema tests**

Create `tests/collector/schema.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePoliciesData } = require('../../scripts/collector/schema');

test('validatePoliciesData accepts valid generated data', () => {
  assert.doesNotThrow(() => validatePoliciesData({
    meta: {
      region: '上海市静安区',
      lookbackDays: 90,
      generatedAt: '2026-06-05T14:30:00+08:00',
      sourceProfile: 'official_plus_authoritative'
    },
    items: [
      {
        id: 'abc',
        title: '静安住房政策',
        sourceName: '静安区政府',
        sourceType: 'official_policy',
        publishedAt: '2026-06-01',
        url: 'https://example.com/a',
        summary: '政策摘要。',
        tags: ['静安相关'],
        matchedKeywords: ['静安', '住房'],
        relevanceScore: 0.9
      }
    ]
  }));
});

test('validatePoliciesData rejects missing required item fields', () => {
  assert.throws(
    () => validatePoliciesData({
      meta: {
        region: '上海市静安区',
        lookbackDays: 90,
        generatedAt: '2026-06-05T14:30:00+08:00',
        sourceProfile: 'official_plus_authoritative'
      },
      items: [{ title: 'missing fields' }]
    }),
    /item.url must be a non-empty string/
  );
});
```

- [ ] **Step 2: Write collector CLI test**

Create `tests/collector/collect.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runCollector } = require('../../scripts/collector/collect');

test('runCollector writes valid limited static JSON', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jingan-policy-'));
  const outputPath = path.join(tmp, 'policies.json');
  const data = await runCollector({
    now: new Date('2026-06-05T00:00:00+08:00'),
    outputPath,
    config: {
      lookbackDays: 90,
      maxArticlesPerRun: 1,
      regionKeywords: ['上海', '静安', '静安区'],
      topicKeywords: ['房地产', '住房', '房价波动'],
      sources: []
    },
    seedItems: [
      {
        title: '静安区住房政策解读',
        sourceName: '静安区政府',
        sourceType: 'official_policy',
        publishedAt: '2026-06-01',
        url: 'https://example.com/a',
        summary: '静安区住房房地产政策摘要。'
      },
      {
        title: '上海房价波动观察',
        sourceName: '上海发布',
        sourceType: 'authoritative_media',
        publishedAt: '2026-06-02',
        url: 'https://example.com/b',
        summary: '上海房地产价格波动摘要。'
      }
    ]
  });

  assert.equal(data.meta.lookbackDays, 90);
  assert.equal(data.items.length, 1);
  assert.ok(fs.existsSync(outputPath));
});
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```bash
node --test tests/collector/schema.test.js tests/collector/collect.test.js
```

Expected: FAIL because schema and collector modules do not exist.

- [ ] **Step 4: Implement schema validation**

Create `scripts/collector/schema.js`:

```js
function assertString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} must be a non-empty string`);
  }
}

function assertNumber(value, name) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`${name} must be a number`);
  }
}

function assertArray(value, name) {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array`);
  }
}

function validatePoliciesData(data) {
  if (!data || typeof data !== 'object') throw new Error('data must be an object');
  if (!data.meta || typeof data.meta !== 'object') throw new Error('meta must be an object');
  assertString(data.meta.region, 'meta.region');
  assertNumber(data.meta.lookbackDays, 'meta.lookbackDays');
  assertString(data.meta.generatedAt, 'meta.generatedAt');
  assertString(data.meta.sourceProfile, 'meta.sourceProfile');
  assertArray(data.items, 'items');

  for (const item of data.items) {
    assertString(item.id, 'item.id');
    assertString(item.title, 'item.title');
    assertString(item.sourceName, 'item.sourceName');
    assertString(item.sourceType, 'item.sourceType');
    assertString(item.publishedAt, 'item.publishedAt');
    assertString(item.url, 'item.url');
    assertString(item.summary, 'item.summary');
    assertArray(item.tags, 'item.tags');
    assertArray(item.matchedKeywords, 'item.matchedKeywords');
    assertNumber(item.relevanceScore, 'item.relevanceScore');
  }

  return data;
}

module.exports = {
  validatePoliciesData
};
```

- [ ] **Step 5: Implement manual source adapter**

Create `scripts/collector/sources/manual.js`:

```js
async function collectManualSources(config) {
  const items = [];

  for (const source of config.sources) {
    for (const url of source.urls) {
      items.push({
        title: `${source.name} 待解析内容`,
        sourceName: source.name,
        sourceType: source.type,
        publishedAt: new Date().toISOString().slice(0, 10),
        url,
        summary: '暂未提取到正文摘要'
      });
    }
  }

  return items;
}

module.exports = {
  collectManualSources
};
```

- [ ] **Step 6: Implement collector CLI**

Create `scripts/collector/collect.js`:

```js
const fs = require('node:fs');
const path = require('node:path');
const { loadConfig } = require('./config');
const { rankAndLimitItems } = require('./relevance');
const { validatePoliciesData } = require('./schema');
const { collectManualSources } = require('./sources/manual');

const DEFAULT_OUTPUT = path.join(process.cwd(), 'policies.json');

function buildPoliciesData(items, config, now) {
  return validatePoliciesData({
    meta: {
      region: '上海市静安区',
      lookbackDays: config.lookbackDays,
      generatedAt: now.toISOString(),
      sourceProfile: 'official_plus_authoritative'
    },
    items
  });
}

async function runCollector(options = {}) {
  const now = options.now || new Date();
  const config = options.config || loadConfig(options.configPath);
  const sourceItems = options.seedItems || await collectManualSources(config);
  const items = rankAndLimitItems(sourceItems, config, now);
  const data = buildPoliciesData(items, config, now);
  const outputPath = options.outputPath || DEFAULT_OUTPUT;

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return data;
}

async function main() {
  const validateOnly = process.argv.includes('--validate-only');
  const outputPath = DEFAULT_OUTPUT;

  if (validateOnly) {
    const existing = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    validatePoliciesData(existing);
    console.log(`Validated ${outputPath}`);
    return;
  }

  const data = await runCollector({ outputPath });
  console.log(`Wrote ${data.items.length} items to ${outputPath}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  buildPoliciesData,
  runCollector
};
```

- [ ] **Step 7: Add initial generated JSON**

Create `policies.json`:

```json
{
  "meta": {
    "region": "上海市静安区",
    "lookbackDays": 90,
    "generatedAt": "2026-06-05T00:00:00.000Z",
    "sourceProfile": "official_plus_authoritative"
  },
  "items": []
}
```

- [ ] **Step 8: Run tests and validation**

Run:

```bash
npm test
npm run validate:data
```

Expected: PASS and `Validated /Users/weijia/codexWorkspace/toyProject/policies.json`.

- [ ] **Step 9: Commit**

Run:

```bash
git add scripts/collector/schema.js scripts/collector/sources/manual.js scripts/collector/collect.js tests/collector/schema.test.js tests/collector/collect.test.js policies.json
git commit -m "feat: generate static policy data"
```

---

### Task 4: Mini Program Data Utilities

**Files:**
- Create: `miniprogram/utils/policies.js`
- Test: `tests/miniprogram/policies.test.js`

- [ ] **Step 1: Write Mini Program utility tests**

Create `tests/miniprogram/policies.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  formatMetaLine,
  filterPolicies,
  findPolicyById
} = require('../../miniprogram/utils/policies');

const data = {
  meta: {
    lookbackDays: 90,
    generatedAt: '2026-06-05T06:30:00.000Z'
  },
  items: [
    { id: 'a', sourceType: 'official_policy', title: '官方政策' },
    { id: 'b', sourceType: 'authoritative_media', title: '权威解读' }
  ]
};

test('formatMetaLine renders actual data range and update time', () => {
  assert.match(formatMetaLine(data.meta), /数据范围：最近 90 天/);
  assert.match(formatMetaLine(data.meta), /最后更新：/);
});

test('filterPolicies supports all and source type filters', () => {
  assert.equal(filterPolicies(data.items, 'all').length, 2);
  assert.deepEqual(filterPolicies(data.items, 'official_policy').map((item) => item.id), ['a']);
});

test('findPolicyById returns a matching item', () => {
  assert.equal(findPolicyById(data.items, 'b').title, '权威解读');
  assert.equal(findPolicyById(data.items, 'missing'), null);
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
node --test tests/miniprogram/policies.test.js
```

Expected: FAIL because `miniprogram/utils/policies.js` does not exist.

- [ ] **Step 3: Implement data utility helpers**

Create `miniprogram/utils/policies.js`:

```js
function pad(value) {
  return String(value).padStart(2, '0');
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatMetaLine(meta) {
  const range = `数据范围：最近 ${meta.lookbackDays} 天`;
  const updated = formatDateTime(meta.generatedAt);
  return updated ? `${range}｜最后更新：${updated}` : range;
}

function filterPolicies(items, sourceType) {
  if (!Array.isArray(items)) return [];
  if (!sourceType || sourceType === 'all') return items;
  return items.filter((item) => item.sourceType === sourceType);
}

function findPolicyById(items, id) {
  return (Array.isArray(items) ? items : []).find((item) => item.id === id) || null;
}

function sourceTypeLabel(sourceType) {
  if (sourceType === 'official_policy') return '官方政策';
  if (sourceType === 'authoritative_media') return '权威解读';
  if (sourceType === 'research_institution') return '机构解读';
  return '其他';
}

module.exports = {
  filterPolicies,
  findPolicyById,
  formatMetaLine,
  sourceTypeLabel
};
```

- [ ] **Step 4: Run utility tests and all tests**

Run:

```bash
node --test tests/miniprogram/policies.test.js
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add miniprogram/utils/policies.js tests/miniprogram/policies.test.js
git commit -m "feat: add mini program policy utilities"
```

---

### Task 5: Mini Program Shell, List Page, And Detail Page

**Files:**
- Create: `miniprogram/app.js`
- Create: `miniprogram/app.json`
- Create: `miniprogram/app.wxss`
- Create: `miniprogram/project.config.json`
- Create: `miniprogram/pages/index/index.js`
- Create: `miniprogram/pages/index/index.json`
- Create: `miniprogram/pages/index/index.wxml`
- Create: `miniprogram/pages/index/index.wxss`
- Create: `miniprogram/pages/detail/detail.js`
- Create: `miniprogram/pages/detail/detail.json`
- Create: `miniprogram/pages/detail/detail.wxml`
- Create: `miniprogram/pages/detail/detail.wxss`

- [ ] **Step 1: Create Mini Program app config**

Create `miniprogram/app.json`:

```json
{
  "pages": [
    "pages/index/index",
    "pages/detail/detail"
  ],
  "window": {
    "navigationBarTitleText": "静安房产政策速览",
    "navigationBarBackgroundColor": "#0f766e",
    "navigationBarTextStyle": "white",
    "backgroundColor": "#f6f8fa"
  },
  "style": "v2",
  "sitemapLocation": "sitemap.json"
}
```

Create `miniprogram/app.js`:

```js
App({
  globalData: {
    policiesData: null
  }
});
```

Create `miniprogram/project.config.json`:

```json
{
  "appid": "touristappid",
  "projectname": "jingan-real-estate-policy",
  "setting": {
    "urlCheck": false,
    "es6": true,
    "minified": true
  },
  "compileType": "miniprogram"
}
```

Create `miniprogram/app.wxss`:

```css
page {
  background: #f6f8fa;
  color: #0f172a;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
}

.muted {
  color: #64748b;
}
```

- [ ] **Step 2: Create index page logic**

Create `miniprogram/pages/index/index.js`:

```js
const { filterPolicies, formatMetaLine, sourceTypeLabel } = require('../../utils/policies');

const DATA_URL = 'https://sunflowermonkey.github.io/jingan-real-estate-policy/policies.json';

Page({
  data: {
    loading: true,
    error: '',
    metaLine: '',
    lookbackDays: 90,
    activeFilter: 'all',
    filters: [
      { key: 'all', label: '全部' },
      { key: 'official_policy', label: '官方政策' },
      { key: 'authoritative_media', label: '权威解读' }
    ],
    items: [],
    visibleItems: []
  },

  onLoad() {
    this.loadPolicies();
  },

  loadPolicies() {
    wx.request({
      url: DATA_URL,
      success: (response) => {
        const data = response.data || {};
        const items = Array.isArray(data.items) ? data.items.map((item) => ({
          ...item,
          sourceTypeText: sourceTypeLabel(item.sourceType)
        })) : [];
        getApp().globalData.policiesData = { meta: data.meta, items };
        this.setData({
          loading: false,
          error: '',
          metaLine: data.meta ? formatMetaLine(data.meta) : '',
          lookbackDays: data.meta && data.meta.lookbackDays ? data.meta.lookbackDays : 90,
          items,
          visibleItems: filterPolicies(items, this.data.activeFilter)
        });
      },
      fail: () => {
        this.setData({
          loading: false,
          error: '数据暂时无法加载，请稍后重试'
        });
      }
    });
  },

  onFilterTap(event) {
    const activeFilter = event.currentTarget.dataset.filter;
    this.setData({
      activeFilter,
      visibleItems: filterPolicies(this.data.items, activeFilter)
    });
  },

  onItemTap(event) {
    wx.navigateTo({
      url: `/pages/detail/detail?id=${event.currentTarget.dataset.id}`
    });
  }
});
```

- [ ] **Step 3: Create index page markup and styles**

Create `miniprogram/pages/index/index.json`:

```json
{
  "navigationBarTitleText": "静安房产政策速览"
}
```

Create `miniprogram/pages/index/index.wxml`:

```xml
<view class="page">
  <view class="header">
    <view class="title">静安房产政策速览</view>
    <view class="meta muted">{{metaLine}}</view>
  </view>

  <view class="filters">
    <block wx:for="{{filters}}" wx:key="key">
      <button
        class="filter {{activeFilter === item.key ? 'active' : ''}}"
        bindtap="onFilterTap"
        data-filter="{{item.key}}"
      >{{item.label}}</button>
    </block>
  </view>

  <view wx:if="{{loading}}" class="state">加载中...</view>
  <view wx:elif="{{error}}" class="state">{{error}}</view>
  <view wx:elif="{{visibleItems.length === 0}}" class="state">最近 {{lookbackDays}} 天暂无匹配内容</view>

  <view wx:else class="list">
    <view wx:for="{{visibleItems}}" wx:key="id" class="card" bindtap="onItemTap" data-id="{{item.id}}">
      <view class="card-title">{{item.title}}</view>
      <view class="card-meta muted">{{item.sourceName}} · {{item.publishedAt}} · {{item.sourceTypeText}}</view>
      <view class="summary">{{item.summary}}</view>
      <view class="tags">
        <text wx:for="{{item.tags}}" wx:key="*this" class="tag">{{item}}</text>
      </view>
    </view>
  </view>
</view>
```

Create `miniprogram/pages/index/index.wxss`:

```css
.page {
  padding: 24rpx;
}

.header {
  margin-bottom: 20rpx;
}

.title {
  font-size: 40rpx;
  font-weight: 700;
  margin-bottom: 8rpx;
}

.meta {
  font-size: 24rpx;
}

.filters {
  display: flex;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.filter {
  margin: 0;
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
  background: #e2e8f0;
  color: #334155;
  font-size: 24rpx;
  line-height: 1.4;
}

.filter.active {
  background: #0f766e;
  color: #ffffff;
}

.state {
  padding: 72rpx 20rpx;
  text-align: center;
  color: #64748b;
}

.card {
  background: #ffffff;
  border: 1rpx solid #e2e8f0;
  border-radius: 12rpx;
  padding: 22rpx;
  margin-bottom: 18rpx;
}

.card-title {
  font-size: 31rpx;
  font-weight: 700;
  line-height: 1.45;
}

.card-meta {
  font-size: 23rpx;
  margin: 10rpx 0;
}

.summary {
  color: #334155;
  font-size: 26rpx;
  line-height: 1.55;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 14rpx;
}

.tag {
  background: #ecfeff;
  color: #155e75;
  border-radius: 8rpx;
  padding: 5rpx 10rpx;
  font-size: 22rpx;
}
```

- [ ] **Step 4: Create detail page**

Create `miniprogram/pages/detail/detail.js`:

```js
const { findPolicyById, sourceTypeLabel } = require('../../utils/policies');

Page({
  data: {
    item: null,
    sourceTypeText: '',
    error: ''
  },

  onLoad(query) {
    const data = getApp().globalData.policiesData;
    const item = data ? findPolicyById(data.items, query.id) : null;
    if (!item) {
      this.setData({ error: '未找到该内容' });
      return;
    }
    this.setData({
      item,
      sourceTypeText: sourceTypeLabel(item.sourceType)
    });
  },

  onCopyLink() {
    if (!this.data.item || !this.data.item.url) return;
    wx.setClipboardData({
      data: this.data.item.url
    });
  }
});
```

Create `miniprogram/pages/detail/detail.json`:

```json
{
  "navigationBarTitleText": "政策详情"
}
```

Create `miniprogram/pages/detail/detail.wxml`:

```xml
<view class="page">
  <view wx:if="{{error}}" class="state">{{error}}</view>

  <view wx:else class="detail">
    <view class="title">{{item.title}}</view>
    <view class="meta muted">{{item.sourceName}} · {{item.publishedAt}} · {{sourceTypeText}}</view>
    <view class="tags">
      <text wx:for="{{item.tags}}" wx:key="*this" class="tag">{{item}}</text>
    </view>
    <view class="summary">{{item.summary}}</view>
    <button class="copy" bindtap="onCopyLink">复制原文链接</button>
  </view>
</view>
```

Create `miniprogram/pages/detail/detail.wxss`:

```css
.page {
  padding: 28rpx;
}

.title {
  font-size: 38rpx;
  font-weight: 700;
  line-height: 1.45;
}

.meta {
  font-size: 24rpx;
  margin: 14rpx 0;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin: 18rpx 0;
}

.tag {
  background: #ecfeff;
  color: #155e75;
  border-radius: 8rpx;
  padding: 5rpx 10rpx;
  font-size: 22rpx;
}

.summary {
  background: #ffffff;
  border: 1rpx solid #e2e8f0;
  border-radius: 12rpx;
  color: #334155;
  font-size: 28rpx;
  line-height: 1.7;
  padding: 24rpx;
}

.copy {
  margin-top: 28rpx;
  background: #0f766e;
  color: #ffffff;
}

.state {
  padding: 72rpx 20rpx;
  text-align: center;
  color: #64748b;
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 6: Open in WeChat Developer Tools manually**

Open `miniprogram/` as the project root in WeChat Developer Tools.

Expected:

- Home page loads.
- Empty state shows `最近 90 天暂无匹配内容` when JSON has no items.
- No layout text overlaps on mobile preview.

- [ ] **Step 7: Commit**

Run:

```bash
git add miniprogram
git commit -m "feat: add mini program policy viewer"
```

---

### Task 6: GitHub Pages Documentation And Verification

**Files:**
- Create: `docs/github-pages.md`
- Modify: `README.md`

- [ ] **Step 1: Document GitHub Pages setup**

Create `docs/github-pages.md`:

```md
# GitHub Pages Setup

This project uses GitHub Pages to host static generated data for the WeChat Mini Program.

## Enable Pages

1. Open the GitHub repository.
2. Go to `Settings`.
3. Open `Pages`.
4. Set `Build and deployment` to `Deploy from a branch`.
5. Select branch `main`.
6. Select folder `/root`.
7. Save.

The expected data URL is:

```text
https://sunflowermonkey.github.io/jingan-real-estate-policy/policies.json
```

## Update Data

Run locally:

```bash
npm run collect
npm run validate:data
git add policies.json
git commit -m "data: update policy summaries"
git push
```

GitHub Pages will publish the updated JSON after the push.

## WeChat Mini Program Domain

For experience or public release builds, configure this request domain in the WeChat Mini Program backend:

```text
https://sunflowermonkey.github.io
```

During local development in WeChat Developer Tools, URL checks can be disabled for testing.
```

- [ ] **Step 2: Update README**

Modify `README.md` to:

```md
# Jing'an Real Estate Policy

Static policy summary data and Mini Program assets for a Jing'an District real estate policy tracker.

## Current Status

The project is in design and setup stage. The first version uses:

- A local collector script.
- GitHub Pages-hosted static JSON.
- A WeChat Mini Program frontend.

## Useful Commands

```bash
npm test
npm run collect
npm run validate:data
```

## Data URL

After GitHub Pages is enabled:

```text
https://sunflowermonkey.github.io/jingan-real-estate-policy/policies.json
```

## Docs

- Design spec: `docs/superpowers/specs/2026-06-05-jingan-real-estate-policy-miniprogram-design.md`
- GitHub Pages setup: `docs/github-pages.md`
```

- [ ] **Step 3: Run final checks**

Run:

```bash
npm test
npm run validate:data
git status --short
```

Expected:

- Tests pass.
- Data validation passes.
- Only README/docs changes are pending before commit.

- [ ] **Step 4: Commit**

Run:

```bash
git add README.md docs/github-pages.md
git commit -m "docs: add github pages setup"
```

---

## Self-Review

Spec coverage:

- Local manual collector: Tasks 1-3.
- Default 90-day range and configurable `lookbackDays`: Tasks 1-3.
- Maximum 20 articles per run and relevance-before-limit behavior: Task 2.
- Official and authoritative source data model: Tasks 1 and 3.
- GitHub Pages static JSON: Tasks 3 and 6.
- Mini Program list, detail, filters, copy link, empty/failure states: Tasks 4 and 5.
- Testing for config, schema, relevance, limits, utilities, and data validation: Tasks 1-6.

Placeholder scan:

- No task contains unresolved placeholder markers or unspecified error handling.
- Each code step includes concrete code and paths.

Type consistency:

- Collector fields use `lookbackDays`, `maxArticlesPerRun`, `sourceType`, `publishedAt`, `relevanceScore`.
- Mini Program helpers consume the same `items` and `meta` shapes generated by the collector.

Known manual verification:

- WeChat Developer Tools validation is manual because this repository cannot run the official Mini Program simulator in automated tests.
