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
  'EVALUATION_SIGNING_SECRET',
  'WEB_ORIGIN',
];
const production = process.argv.includes('--production');
const file = process.argv.slice(2).find((argument) => !argument.startsWith('--')) ?? '.env';
const env = Object.fromEntries(
  readFileSync(file, 'utf8')
    .split(String.fromCharCode(10))
    .map((line) => line.trimEnd())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);
if (process.env.EVALUATION_SIGNING_SECRET) {
  env.EVALUATION_SIGNING_SECRET = process.env.EVALUATION_SIGNING_SECRET;
}
const missing = required.filter((name) => !env[name]);
const placeholders = required.filter((name) => /replace-with|change-me/i.test(env[name] ?? ''));
const errors = [];
if (production) {
  if (env.NODE_ENV !== 'production') errors.push('NODE_ENV must be production');
  if (env.SWAGGER_ENABLED !== 'false') errors.push('SWAGGER_ENABLED must be false');
  for (const name of [
    'WEB_ORIGIN',
    'PUBLIC_APP_URL',
    'NEXT_PUBLIC_API_URL',
    'S3_PUBLIC_ENDPOINT',
  ]) {
    try {
      if (new URL(env[name]).protocol !== 'https:') errors.push(`${name} must use HTTPS`);
    } catch {
      errors.push(`${name} must be a valid HTTPS URL`);
    }
  }
  const secrets = [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'COOKIE_SECRET',
    'PASSWORD_RESET_PEPPER',
    'AI_INTERNAL_TOKEN',
    'EVALUATION_SIGNING_SECRET',
  ];
  for (const name of secrets) {
    if ((env[name] ?? '').length < 32) errors.push(`${name} must have at least 32 characters`);
  }
  if (new Set(secrets.map((name) => env[name])).size !== secrets.length) {
    errors.push('Application secrets must have distinct values');
  }
}
if (missing.length || placeholders.length || errors.length) {
  if (missing.length) console.error(`Missing: ${missing.join(', ')}`);
  if (placeholders.length) console.error(`Replace placeholder values: ${placeholders.join(', ')}`);
  for (const error of errors) console.error(error);
  process.exit(1);
}
console.log(`${production ? 'Production' : 'Environment'} configuration checks passed.`);
