const test = require('node:test');
const assert = require('node:assert/strict');
const { collectManualSources } = require('../../scripts/collector/sources/manual');

test('collectManualSources fetches manual article URLs and extracts metadata', async () => {
  const html = `
    <html>
      <head><title>上海静安住房收购置换政策解读_测试来源</title></head>
      <body>
        <h1>上海静安住房收购置换政策解读</h1>
        <p>发布时间：2026-05-20</p>
        <p>静安区推进住房收购置换，增加保障性租赁住房供应，改善居民住房条件。</p>
      </body>
    </html>
  `;
  const fetchImpl = async () => ({
    ok: true,
    text: async () => html
  });

  const items = await collectManualSources({
    sources: [
      {
        name: '测试来源',
        type: 'authoritative_media',
        urls: ['https://example.com/article']
      }
    ]
  }, { fetchImpl });

  assert.equal(items.length, 1);
  assert.equal(items[0].title, '上海静安住房收购置换政策解读');
  assert.equal(items[0].publishedAt, '2026-05-20');
  assert.match(items[0].summary, /保障性租赁住房/);
});
