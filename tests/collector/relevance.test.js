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
