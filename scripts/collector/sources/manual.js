async function collectManualSources(config) {
  const items = [];

  for (const source of config.sources) {
    for (const url of source.urls) {
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

  return items;
}

module.exports = {
  collectManualSources
};
