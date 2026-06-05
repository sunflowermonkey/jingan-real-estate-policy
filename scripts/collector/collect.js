const fs = require('node:fs');
const path = require('node:path');
const { loadConfig } = require('./config');
const { rankAndLimitItems } = require('./relevance');
const { validatePoliciesData } = require('./schema');
const { collectManualSources } = require('./sources/manual');

const DEFAULT_OUTPUT = path.join(process.cwd(), 'public', 'data', 'policies.json');

function buildPoliciesData(items, config, now) {
  return validatePoliciesData({
    meta: {
      region: '上海市静安区',
      lookbackDays: config.lookbackDays,
      generatedAt: now.toISOString(),
      sourceProfile: 'official_plus_authoritative'
    },
    items
  });
}

async function runCollector(options = {}) {
  const now = options.now || new Date();
  const config = options.config || loadConfig(options.configPath);
  const sourceItems = options.seedItems || await collectManualSources(config, { fetchImpl: options.fetchImpl });
  const items = rankAndLimitItems(sourceItems, config, now);
  const data = buildPoliciesData(items, config, now);
  const outputPath = options.outputPath || DEFAULT_OUTPUT;

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return data;
}

async function main() {
  const validateOnly = process.argv.includes('--validate-only');
  const outputPath = DEFAULT_OUTPUT;

  if (validateOnly) {
    const existing = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    validatePoliciesData(existing);
    console.log(`Validated ${outputPath}`);
    return;
  }

  const data = await runCollector({ outputPath });
  console.log(`Wrote ${data.items.length} items to ${outputPath}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  buildPoliciesData,
  runCollector
};
