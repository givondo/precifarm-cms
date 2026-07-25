/**
 * Verify Daraja OAuth with MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET in .env
 *   node scripts/test-mpesa-auth.mjs
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env');

function loadEnv() {
  try {
    const text = readFileSync(envPath, 'utf8');
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i === -1) continue;
      const key = t.slice(0, i).trim();
      const val = t.slice(i + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    console.error('No .env found at', envPath);
    process.exit(1);
  }
}

loadEnv();

const key = process.env.MPESA_CONSUMER_KEY;
const secret = process.env.MPESA_CONSUMER_SECRET;
const env = process.env.MPESA_ENVIRONMENT ?? 'sandbox';

if (!key || !secret) {
  console.error('Set MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET in .env');
  process.exit(1);
}

for (const env of [process.env.MPESA_ENVIRONMENT ?? 'sandbox', 'production']) {
  const base =
    env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';

  const res = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`,
    },
  });

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }

  if (res.ok && body.access_token) {
    console.log(`✓ Daraja OAuth OK (${env})`);
    console.log('  token length:', body.access_token.length);
    process.exit(0);
  }

  console.error(`✗ OAuth failed (${env}):`, res.status, body.errorMessage ?? body.error ?? body);
}

process.exit(1);
