function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeText(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitle(html, sourceName) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return decodeText(stripHtml(h1[1]));

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) return decodeText(stripHtml(title[1]).split(/[_|-]/)[0]);

  return `${sourceName} 待解析内容`;
}

function extractPublishedAt(text) {
  const match = text.match(/(20\d{2})[-年./](\d{1,2})[-月./](\d{1,2})/);
  if (!match) return new Date().toISOString().slice(0, 10);
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function extractSummary(text) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '暂未提取到正文摘要';

  const keywords = ['静安', '住房', '房地产', '房价', '房价波动', '租赁', '限购', '物业', '城市更新', '保障房'];
  const keywordIndex = keywords
    .map((keyword) => normalized.indexOf(keyword))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  const start = Math.max(keywordIndex || 0, 0);
  return normalized.slice(start, start + 180);
}

async function fetchArticle(url, source, fetchImpl) {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`fetch failed: ${response.status || 'unknown'}`);
  }
  const html = await response.text();
  const text = stripHtml(html);
  return {
    title: extractTitle(html, source.name),
    sourceName: source.name,
    sourceType: source.type,
    publishedAt: extractPublishedAt(text),
    url,
    summary: extractSummary(text)
  };
}

async function collectManualSources(config, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const items = [];

  for (const source of config.sources) {
    for (const url of source.urls) {
      try {
        items.push(await fetchArticle(url, source, fetchImpl));
      } catch (_error) {
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
  }

  return items;
}

module.exports = {
  collectManualSources
};
