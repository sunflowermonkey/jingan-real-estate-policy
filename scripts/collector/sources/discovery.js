const { fetchArticle } = require('./manual');

function extractLinks(html, pageUrl, allowedHosts) {
  const links = [];
  const seen = new Set();
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = pattern.exec(html))) {
    const href = match[1];
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;

    let url;
    try {
      url = new URL(href, pageUrl);
    } catch (_error) {
      continue;
    }

    if (!['http:', 'https:'].includes(url.protocol)) continue;
    if (allowedHosts.length > 0 && !allowedHosts.includes(url.hostname)) continue;

    const normalized = url.toString();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    links.push(normalized);
  }

  return links;
}

function looksLikeArticleUrl(url) {
  return /\/20\d{6}\//.test(url) && /\.html(?:$|[?#])/.test(url);
}

async function fetchText(url, fetchImpl) {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`fetch failed: ${response.status || 'unknown'}`);
  }
  return response.text();
}

async function collectDiscoverySources(config, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const sources = config.discoverySources || [];
  const items = [];

  for (const source of sources) {
    const discovered = [];
    const seen = new Set();
    const allowedHosts = source.allowedHosts || [];

    for (const pageUrl of source.pages || []) {
      try {
        const html = await fetchText(pageUrl, fetchImpl);
        for (const url of extractLinks(html, pageUrl, allowedHosts)) {
          if (!looksLikeArticleUrl(url)) continue;
          if (seen.has(url)) continue;
          seen.add(url);
          discovered.push(url);
        }
      } catch (_error) {
        // Skip failed discovery pages so one bad source does not block collection.
      }
    }

    for (const url of discovered.slice(0, source.maxLinks || 30)) {
      try {
        items.push(await fetchArticle(url, source, fetchImpl));
      } catch (_error) {
        // Ignore detail pages that cannot be fetched or parsed.
      }
    }
  }

  return items;
}

module.exports = {
  collectDiscoverySources,
  extractLinks,
  looksLikeArticleUrl
};
