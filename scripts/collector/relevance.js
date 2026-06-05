const { normalizeUrl, normalizeWhitespace, stableId } = require('./normalize');

function daysBetween(a, b) {
  return Math.floor((a.getTime() - b.getTime()) / 86400000);
}

function includesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function deriveTags(text) {
  const tags = [];
  if (text.includes('静安') || text.includes('静安区')) tags.push('静安相关');
  if (text.includes('限购')) tags.push('限购');
  if (text.includes('租赁')) tags.push('租赁');
  if (text.includes('物业')) tags.push('物业');
  if (text.includes('城市更新')) tags.push('城市更新');
  if (text.includes('房贷')) tags.push('房贷');
  if (text.includes('房价波动') || text.includes('价格波动') || text.includes('房价')) tags.push('房价波动');
  if (text.includes('住房') || text.includes('房地产')) tags.push('住房');
  return Array.from(new Set(tags));
}

function scoreItem(item, config, now) {
  const text = normalizeWhitespace(`${item.title} ${item.summary || ''}`);
  const published = new Date(`${item.publishedAt}T00:00:00+08:00`);
  if (Number.isNaN(published.getTime())) return null;

  const ageDays = daysBetween(now, published);
  if (ageDays < 0 || ageDays > config.lookbackDays) return null;

  const regionMatched = includesAny(text, config.regionKeywords);
  const topicMatches = config.topicKeywords.filter((keyword) => text.includes(keyword));
  if (!regionMatched || topicMatches.length === 0) return null;

  const jinganMatched = text.includes('静安') || text.includes('静安区');
  const strongTopicMatched = ['房地产', '住房', '购房', '限购', '保障房', '城市更新', '土地', '房贷', '房价', '价格波动', '房价波动']
    .some((keyword) => text.includes(keyword));
  if (!jinganMatched && !strongTopicMatched) return null;

  let score = 0.3;
  if (jinganMatched) score += 0.35;
  if (item.sourceType === 'official_policy') score += 0.2;
  score += Math.min(topicMatches.length * 0.08, 0.25);
  score += Math.max(0, (config.lookbackDays - ageDays) / config.lookbackDays) * 0.1;

  return {
    score: Math.min(Number(score.toFixed(2)), 1),
    matchedKeywords: Array.from(new Set([...config.regionKeywords, ...topicMatches].filter((keyword) => text.includes(keyword)))),
    tags: deriveTags(text)
  };
}

function rankAndLimitItems(rawItems, config, now = new Date()) {
  const seen = new Set();
  const normalized = [];

  for (const item of rawItems) {
    const url = normalizeUrl(item.url);
    if (seen.has(url)) continue;
    seen.add(url);

    const scoring = scoreItem(item, config, now);
    if (!scoring) continue;

    const title = normalizeWhitespace(item.title);
    normalized.push({
      id: stableId([url, title, item.publishedAt]),
      title,
      sourceName: normalizeWhitespace(item.sourceName),
      sourceType: item.sourceType,
      publishedAt: item.publishedAt,
      url,
      summary: normalizeWhitespace(item.summary || '暂未提取到正文摘要'),
      tags: scoring.tags,
      matchedKeywords: scoring.matchedKeywords,
      relevanceScore: scoring.score
    });
  }

  return normalized
    .sort((a, b) => b.relevanceScore - a.relevanceScore || b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, config.maxArticlesPerRun);
}

module.exports = {
  rankAndLimitItems
};
