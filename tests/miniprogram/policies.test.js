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
