import { readFileSync } from 'node:fs';

const required = [
  'DATABASE_URL',
  'REDIS_URL',
  'S3_ACCESS_KEY',
  'S3_SECRET_KEY',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'COOKIE_SECRET',
  'PASSWORD_RESET_PEPPER',
  'AI_INTERNAL_TOKEN',
  'WEB_ORIGIN',
];
const env = Object.fromEntries(
  readFileSync(process.argv[2] ?? '.env', 'utf8')
    .split(String.fromCharCode(10))
    .map((line) => line.trimEnd())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);
const missing = required.filter((name) => !env[name]);
const placeholders = required.filter((name) => /replace-with|change-me/i.test(env[name] ?? ''));
if (missing.length || placeholders.length) {
  if (missing.length) console.error(`Missing: ${missing.join(', ')}`);
  if (placeholders.length) console.error(`Replace placeholder values: ${placeholders.join(', ')}`);
  process.exit(1);
}
console.log('Environment file contains required non-placeholder values.');
