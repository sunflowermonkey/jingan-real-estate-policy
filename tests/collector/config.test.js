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
    ],
    discoverySources: [
      {
        name: '上海市政府要闻',
        type: 'authoritative_media',
        pages: ['https://example.com/news/'],
        allowedHosts: ['example.com'],
        maxLinks: 20
      }
    ]
  });

  assert.equal(config.lookbackDays, 90);
  assert.equal(config.maxArticlesPerRun, 20);
  assert.deepEqual(config.regionKeywords, ['上海', '静安', '静安区']);
  assert.equal(config.discoverySources[0].pages[0], 'https://example.com/news/');
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
