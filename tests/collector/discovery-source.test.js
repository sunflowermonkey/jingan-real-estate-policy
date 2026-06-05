const test = require('node:test');
const assert = require('node:assert/strict');
const { collectDiscoverySources } = require('../../scripts/collector/sources/discovery');

test('collectDiscoverySources discovers article links from configured pages', async () => {
  const pages = new Map([
    ['https://example.com/news/', `
      <html>
        <body>
          <a href="/20260520/article-a.html">静安区住房政策解读</a>
          <a href="https://other.example.com/skip.html">外部链接</a>
          <a href="/20260521/article-b.html">上海房价波动观察</a>
          <a href="/index.html">栏目首页</a>
        </body>
      </html>
    `],
    ['https://example.com/20260520/article-a.html', `
      <html>
        <head><title>静安区住房政策解读</title></head>
        <body><h1>静安区住房政策解读</h1><p>2026-05-20</p><p>静安区住房租赁和房地产政策内容。</p></body>
      </html>
    `],
    ['https://example.com/20260521/article-b.html', `
      <html>
        <head><title>上海房价波动观察</title></head>
        <body><h1>上海房价波动观察</h1><p>2026-05-21</p><p>上海房地产价格波动和住房市场内容。</p></body>
      </html>
    `]
  ]);
  const fetchImpl = async (url) => ({
    ok: true,
    text: async () => pages.get(url)
  });

  const items = await collectDiscoverySources({
    discoverySources: [
      {
        name: '测试栏目',
        type: 'authoritative_media',
        pages: ['https://example.com/news/'],
        allowedHosts: ['example.com']
      }
    ]
  }, { fetchImpl });

  assert.equal(items.length, 2);
  assert.deepEqual(items.map((item) => item.title), ['静安区住房政策解读', '上海房价波动观察']);
  assert.deepEqual(items.map((item) => item.url), [
    'https://example.com/20260520/article-a.html',
    'https://example.com/20260521/article-b.html'
  ]);
});
