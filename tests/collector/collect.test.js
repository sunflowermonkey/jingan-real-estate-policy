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
