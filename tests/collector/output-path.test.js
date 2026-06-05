const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { DEFAULT_OUTPUT } = require('../../scripts/collector/collect');

test('collector default output matches GitHub Pages data URL path', () => {
  assert.equal(DEFAULT_OUTPUT, path.join(process.cwd(), 'policies.json'));
});
