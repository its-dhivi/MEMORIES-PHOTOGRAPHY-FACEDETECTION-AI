import { createHmac } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath) {
  console.error(
    'Usage: node scripts/sign-evaluation-artifact.mjs <artifact.json> [signed-output.json]',
  );
  process.exit(2);
}
const secret = process.env.EVALUATION_SIGNING_SECRET;
if (!secret || secret.length < 32) {
  console.error('EVALUATION_SIGNING_SECRET must be configured in the trusted signer environment.');
  process.exit(2);
}
const artifact = JSON.parse(readFileSync(inputPath, 'utf8'));
const required = [
  'eventId',
  'threshold',
  'modelVersion',
  'preprocessingVersion',
  'source',
  'evaluationResults',
];
const missing = required.filter((key) => artifact[key] === undefined);
if (missing.length) {
  console.error(`Missing fields: ${missing.join(', ')}`);
  process.exit(2);
}
const payload = Object.fromEntries(required.map((key) => [key, artifact[key]]));
const signature = createHmac('sha256', secret)
  .update(JSON.stringify(canonicalize(payload)))
  .digest('hex');
const destination =
  outputPath ?? join(dirname(inputPath), `${basename(inputPath, extname(inputPath))}.signed.json`);
writeFileSync(
  destination,
  `${JSON.stringify({ ...payload, evidenceSignature: signature }, null, 2)}\n`,
  {
    mode: 0o600,
  },
);
console.log(`Signed evaluation artifact written to ${destination}`);
