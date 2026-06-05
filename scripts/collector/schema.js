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
