const { readFileSync } = require('fs');
const { join } = require('path');

const p = join(__dirname, '../deploy/deployment-outputs.json');
const raw = readFileSync(p, 'utf8');
const parsed = JSON.parse(raw);

const stage = process.env.NEXT_PUBLIC_ENVIRONMENT || process.env.STAGE || 'dev';
console.log('Stage:', stage);

const cctStack = parsed.stages?.[stage]?.stacks?.CardCountingTrainer;
console.log('Stack found:', !!cctStack);
console.log('Outputs count:', cctStack?.outputs?.length);

const outputs = cctStack.outputs.map((o) => ({
  key: o.OutputKey,
  value: o.OutputValue,
  exportName: o.ExportName,
}));

console.log('\nAll outputs:');
outputs.forEach(o => {
  console.log(`  ${o.key}: ${o.value}`);
  console.log(`    Export: ${o.exportName}`);
});

const appName = 'cardcountingtrainer';
const find = (suffix) => {
  const candidates = [`${appName}-${stage}-${suffix}`.toLowerCase()];
  console.log('\nLooking for suffix:', suffix);
  console.log('Candidates:', candidates);

  for (const c of candidates) {
    const hit = outputs.find((o) => (o.exportName || '').toLowerCase() === c);
    if (hit) {
      console.log('✓ Found by export name:', hit.exportName, '=', hit.value);
      return hit.value;
    }
  }

  // Try key suffix match
  const byKeySuffix = outputs.find((o) =>
    (o.key || '').toLowerCase().endsWith(suffix.toLowerCase())
  );
  if (byKeySuffix) {
    console.log('✓ Found by key suffix:', byKeySuffix.key, '=', byKeySuffix.value);
    return byKeySuffix.value;
  }

  console.log('✗ Not found');
  return '';
};

console.log('\n=== Results ===');
console.log('NEXT_PUBLIC_USER_POOL_ID:', find('user-pool-id'));
console.log('NEXT_PUBLIC_USER_POOL_CLIENT_ID:', find('user-pool-client-id'));
console.log('NEXT_PUBLIC_GRAPHQL_URL:', find('api-url'));
