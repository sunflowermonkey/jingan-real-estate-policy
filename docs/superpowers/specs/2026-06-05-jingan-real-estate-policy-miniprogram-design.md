# Jing'an Real Estate Policy Mini Program Design

## Goal

Build a WeChat Mini Program that shows recent policy and interpretation content related to real estate in Jing'an District, Shanghai. The first version avoids a live backend server. A local script generates static JSON data, GitHub Pages hosts the JSON over HTTPS, and the Mini Program reads and displays it.

The first version focuses on:

- Collecting official policy pages and authoritative interpretations.
- Summarizing each collected item.
- Showing source, publication date, tags, and original URL.
- Letting the user copy or open the original link.

## Scope

In scope:

- Local, manually run collection script.
- Default data range of the most recent 90 days.
- Configurable lookback range through a local configuration file.
- Maximum of 20 collected articles per run.
- GitHub Pages-hosted static JSON.
- WeChat Mini Program list and detail views.
- Filtering by source type: all, official policy, authoritative interpretation.
- Graceful handling for empty data, failed loads, and missing summaries.

Out of scope for the first version:

- Public backend API server.
- Real-time crawling from the Mini Program.
- User login, comments, favorites, notifications, or personalization.
- Fully automated scheduled collection.
- AI-generated summaries as a required dependency.

## Architecture

The system has three independent parts.

### Local Collector

The local collector runs on the user's computer. It reads a configuration file, collects candidate content from official and authoritative sources, filters the results, generates summaries, and writes static JSON.

The collector writes:

- `data/policies.json`
- Optional logs for skipped sources, parse failures, and generated item counts.

The first version uses manual execution. The user runs the collector when they want to refresh the data, then pushes the generated files to GitHub.

### GitHub Pages

GitHub Pages hosts the generated static files over HTTPS. It does not run scraping, parsing, summary generation, or scheduled jobs.

The expected public data URL is similar to:

```text
https://<github-user>.github.io/<repo>/data/policies.json
```

This URL can later be configured as the Mini Program data source.

### WeChat Mini Program

The Mini Program fetches `policies.json`, renders the list and detail views, and provides actions for original links.

The Mini Program does not crawl third-party web pages and does not generate summaries. It only consumes the static JSON produced by the local collector.

## Configuration

The collection range is configurable in a local config file. The default is 90 days.

Example:

```json
{
  "lookbackDays": 90,
  "maxArticlesPerRun": 20,
  "regionKeywords": ["上海", "静安", "静安区"],
  "topicKeywords": [
    "住房",
    "房地产",
    "购房",
    "限购",
    "租赁",
    "物业",
    "保障房",
    "城市更新",
    "土地",
    "房贷",
    "房价",
    "价格波动",
    "房价波动"
  ]
}
```

The UI must not describe the range as configurable. It only displays the actual generated range, such as:

```text
数据范围：最近 90 天
最后更新：2026-06-05 14:30
```

## Data Model

`data/policies.json` has this shape:

```json
{
  "meta": {
    "region": "上海市静安区",
    "lookbackDays": 90,
    "generatedAt": "2026-06-05T14:30:00+08:00",
    "sourceProfile": "official_plus_authoritative"
  },
  "items": [
    {
      "id": "sha256-url-or-title",
      "title": "政策或解读标题",
      "sourceName": "上海发布",
      "sourceType": "authoritative_media",
      "publishedAt": "2026-06-01",
      "url": "https://example.com/article",
      "summary": "100-200 字摘要，说明政策要点和与静安房地产的关系。",
      "tags": ["限购", "住房", "静安相关"],
      "matchedKeywords": ["静安", "住房"],
      "relevanceScore": 0.86
    }
  ]
}
```

The collector also limits each run to `maxArticlesPerRun` items. The first version defaults to 20 items per run.

Required item fields:

- `id`
- `title`
- `sourceName`
- `sourceType`
- `publishedAt`
- `url`
- `summary`
- `tags`

Recommended `sourceType` values:

- `official_policy`
- `authoritative_media`
- `research_institution`

## Collection Rules

Sources:

- Official policy and government sources should be preferred.
- Authoritative media and institution interpretation sources are allowed.
- Unknown, low-quality, or unverifiable sources should be excluded from the first version.

Time filtering:

- Include items published within the configured `lookbackDays`.
- The first version defaults to 90 days.

Quantity limit:

- Limit each collector run to the configured `maxArticlesPerRun`.
- The first version defaults to 20 items.
- Apply relevance sorting before the limit so the final JSON keeps the most relevant official and authoritative items.

Region filtering:

- Prefer items that mention Jing'an or Jing'an District.
- Shanghai-wide real estate policies can be retained when they affect Jing'an housing, purchase, rental, property, land, or urban renewal topics.

Topic filtering:

- Housing.
- Real estate.
- Home purchase.
- Purchase restrictions.
- Rental.
- Property management.
- Affordable housing.
- Urban renewal.
- Land.
- Mortgage and housing credit.
- Housing price and housing price fluctuation.

Deduplication:

- Normalize URLs and derive stable IDs from URL or title/source/date.
- Keep one item for the same original page.

Summaries:

- The first version can use rule-based summaries.
- If body extraction succeeds, summarize the relevant leading paragraphs and policy points.
- If body extraction fails, keep the item and set the summary to `暂未提取到正文摘要`.
- AI summaries can be added later as an optional module.

## Mini Program UI

### Home Page

The home page shows:

- Title: `静安房产政策速览`.
- Data range and last update time.
- Filters: all, official policy, authoritative interpretation.
- Cards with title, source, date, source type, tags, and summary preview.

The first version keeps the UI lightweight. Search and advanced tag filters can be added later.

### Detail Page

The detail page shows:

- Full title.
- Source name.
- Publication date.
- Tags.
- Full summary.
- Original URL actions.

Original URL behavior:

- Prefer copying the link reliably.
- If a link can be opened through Mini Program-compatible web behavior, offer an open action.
- If direct opening is unavailable, show copy-link behavior only.

## Error Handling

Data load failure:

- Show `数据暂时无法加载，请稍后重试`.

Empty data:

- Show `最近 {lookbackDays} 天暂无匹配内容`, using the actual `meta.lookbackDays` value.

Missing summary:

- Show `暂未提取到正文摘要`.

Source crawl or parse failure:

- Skip the failed source.
- Log the source and reason.
- Continue generating JSON from other sources.

Invalid JSON:

- Collector validation fails before publishing.
- Mini Program displays the data load failure state.

## Testing

Collector checks:

- Reads `lookbackDays` from config.
- Reads `maxArticlesPerRun` from config.
- Outputs valid JSON.
- Ensures all required item fields exist.
- Filters items outside the configured time range.
- Outputs no more than the configured item limit.
- Produces valid empty-state JSON when no items match.

Static data checks:

- `data/policies.json` can be opened in a browser.
- `meta.generatedAt` and `meta.lookbackDays` exist.
- JSON is valid and encoded as UTF-8.

Mini Program checks:

- Loads GitHub Pages JSON.
- Renders list and detail views.
- Filters official policy and authoritative interpretation items.
- Handles empty, loading, and failure states.
- Copies original links.

## Release Path

Development:

- Run the collector locally.
- Test with local or GitHub Pages JSON.
- Use WeChat Developer Tools for Mini Program testing.

Friend testing:

- Upload an experience version.
- Add selected friends as experience members.
- Test with GitHub Pages data URL configured.

Public release:

- Configure the GitHub Pages domain as an allowed request domain in the Mini Program backend.
- Submit the Mini Program for review.
- Release after approval.

## Future Enhancements

- GitHub Actions scheduled collection.
- AI summary generation.
- Search and tag filters.
- Source health report.
- Data freshness warning when `generatedAt` is too old.
- Optional H5 fallback page hosted on GitHub Pages.
