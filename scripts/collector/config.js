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

  const discoverySources = (raw.discoverySources || []).map((source) => {
    if (!source || typeof source.name !== 'string' || source.name.trim() === '') {
      throw new Error('discoverySource.name must be a non-empty string');
    }
    if (!['official_policy', 'authoritative_media', 'research_institution'].includes(source.type)) {
      throw new Error(`unsupported discovery source type: ${source.type}`);
    }
    if (!Array.isArray(source.pages) || source.pages.some((url) => typeof url !== 'string')) {
      throw new Error('discoverySource.pages must be an array of strings');
    }
    if (!Array.isArray(source.allowedHosts) || source.allowedHosts.some((host) => typeof host !== 'string')) {
      throw new Error('discoverySource.allowedHosts must be an array of strings');
    }
    if (source.maxLinks !== undefined && (!Number.isInteger(source.maxLinks) || source.maxLinks <= 0)) {
      throw new Error('discoverySource.maxLinks must be a positive integer');
    }
    return {
      name: source.name.trim(),
      type: source.type,
      pages: source.pages,
      allowedHosts: source.allowedHosts,
      maxLinks: source.maxLinks
    };
  });

  return {
    lookbackDays: raw.lookbackDays,
    maxArticlesPerRun: raw.maxArticlesPerRun,
    regionKeywords: raw.regionKeywords.map((item) => item.trim()),
    topicKeywords: raw.topicKeywords.map((item) => item.trim()),
    sources,
    discoverySources
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
