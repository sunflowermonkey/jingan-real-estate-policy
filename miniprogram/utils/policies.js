function pad(value) {
  return String(value).padStart(2, '0');
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatMetaLine(meta) {
  const range = `数据范围：最近 ${meta.lookbackDays} 天`;
  const updated = formatDateTime(meta.generatedAt);
  return updated ? `${range}｜最后更新：${updated}` : range;
}

function filterPolicies(items, sourceType) {
  if (!Array.isArray(items)) return [];
  if (!sourceType || sourceType === 'all') return items;
  return items.filter((item) => item.sourceType === sourceType);
}

function findPolicyById(items, id) {
  return (Array.isArray(items) ? items : []).find((item) => item.id === id) || null;
}

function sourceTypeLabel(sourceType) {
  if (sourceType === 'official_policy') return '官方政策';
  if (sourceType === 'authoritative_media') return '权威解读';
  if (sourceType === 'research_institution') return '机构解读';
  return '其他';
}

module.exports = {
  filterPolicies,
  findPolicyById,
  formatMetaLine,
  sourceTypeLabel
};
