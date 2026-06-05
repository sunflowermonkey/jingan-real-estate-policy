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
    /item.id must be a non-empty string/
  );
});
