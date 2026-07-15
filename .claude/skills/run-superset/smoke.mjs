#!/usr/bin/env node
// Apache Superset — Playwright browser driver
// Run from repo root:
//   node .claude/skills/run-superset/smoke.mjs
//
// Requires playwright installed in superset-frontend/:
//   cd superset-frontend && npx playwright install chromium

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir } from 'fs/promises';
import * as readline from 'readline/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..', '..');

// Load playwright from superset-frontend's node_modules
const require = createRequire(join(repoRoot, 'superset-frontend', 'package.json'));
const { chromium } = require('playwright');

// Port 9000 is the webpack dev server (hot reload, live edits).
// CSP must be disabled in docker/pythonpath_dev/superset_config_docker.py (TALISMAN_ENABLED = False).
const BASE_URL = process.env.SUPERSET_URL || 'http://localhost:9000';
const API_URL  = 'http://localhost:8088'; // API always on Flask directly
const SHOTS    = process.env.SHOTS_DIR || '/tmp/superset-shots';

await mkdir(SHOTS, { recursive: true });

// ── Prompt helpers ─────────────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask  = (q)          => rl.question(`  ${q}`);
const askSecret = async (q) => {
  process.stdout.write(`  ${q}`);
  process.stdin.setRawMode?.(true);
  let val = '';
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  await new Promise(res => {
    process.stdin.on('data', function handler(ch) {
      ch = ch.toString();
      if (ch === '\n' || ch === '\r' || ch === '') {
        process.stdin.removeListener('data', handler);
        process.stdin.setRawMode?.(false);
        process.stdout.write('\n');
        res();
      } else if (ch === '') {
        val = val.slice(0, -1);
      } else {
        val += ch;
      }
    });
  });
  return val;
};

// ── Prompt for database config ──────────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════════╗');
console.log('║        Apache Superset — Browser         ║');
console.log('╚══════════════════════════════════════════╝\n');

console.log('Database connection (press Enter to skip and configure via UI later):\n');
const DB_HOST  = await ask('RDS endpoint (e.g. mydb.xxxxx.us-east-1.rds.amazonaws.com) [skip]: ');
let dbConfig = null;

if (DB_HOST.trim()) {
  const DB_PORT  = (await ask('Port [5432]: ')).trim() || '5432';
  const DB_NAME  = (await ask('Database name: ')).trim();
  const DB_USER  = (await ask('Username: ')).trim();
  const DB_PASS  = await askSecret('Password: ');
  const DB_LABEL = (await ask('Display name in Superset [My Database]: ')).trim() || 'My Database';
  const DB_SSL   = (await ask('Require SSL? (y/n) [y]: ')).trim().toLowerCase();
  const sslMode  = DB_SSL === 'n' ? '' : '?sslmode=require';
  dbConfig = { host: DB_HOST.trim(), port: DB_PORT, name: DB_NAME, user: DB_USER,
               pass: DB_PASS, label: DB_LABEL, sslMode };
}

rl.close();

// ── Add database via API (before opening browser) ──────────────────────────────
if (dbConfig) {
  console.log('\nConnecting database via API...');
  try {
    const loginRes = await fetch(`${API_URL}/api/v1/security/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin', provider: 'db' }),
    });
    const { access_token: token } = await loginRes.json();

    const csrfRes = await fetch(`${API_URL}/api/v1/security/csrf_token/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { result: csrf } = await csrfRes.json();

    const uri = `postgresql://${dbConfig.user}:${dbConfig.pass}@${dbConfig.host}:${dbConfig.port}/${dbConfig.name}${dbConfig.sslMode}`;

    const dbRes = await fetch(`${API_URL}/api/v1/database/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-CSRFToken': csrf,
        Referer: `${API_URL}/`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        database_name: dbConfig.label,
        sqlalchemy_uri: uri,
        expose_in_sqllab: true,
      }),
    });

    const dbJson = await dbRes.json();
    if (dbJson?.result?.id || dbJson?.id) {
      console.log(`  ✅ Database "${dbConfig.label}" connected successfully`);
    } else {
      console.warn(`  ⚠️  API response unexpected — check manually in the UI`);
      console.warn(`      ${JSON.stringify(dbJson).substring(0, 200)}`);
    }
  } catch (err) {
    console.warn(`  ⚠️  Could not connect database automatically: ${err.message}`);
    console.warn(`      Add it manually: Settings → Database Connections → + Database`);
    console.warn(`      URI: postgresql://${dbConfig.user}:****@${dbConfig.host}:${dbConfig.port}/${dbConfig.name}${dbConfig.sslMode}`);
  }
}

// ── Launch browser ─────────────────────────────────────────────────────────────
console.log(`\nOpening browser at ${BASE_URL} ...\n`);

const browser = await chromium.launch({ headless: false, slowMo: 300 });
const ctx  = await browser.newContext();
const page = await ctx.newPage();
page.setDefaultTimeout(30000);

try {
  // ── 1. Login page ─────────────────────────────────────────────────────────────
  console.log('Step 1/4  Loading login page...');
  await page.goto(`${BASE_URL}/login/`);
  await page.waitForSelector('input#username', { timeout: 20000 });
  await page.screenshot({ path: join(SHOTS, '01-login.png') });
  console.log('          ✅ Login page rendered');

  // ── 2. Login ──────────────────────────────────────────────────────────────────
  console.log('Step 2/4  Logging in as admin...');
  await page.fill('input#username', 'admin');
  await page.fill('input#password', 'admin');
  await page.screenshot({ path: join(SHOTS, '02-credentials.png') });
  await page.click('button[type="submit"]');
  await page.waitForURL(/welcome/);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: join(SHOTS, '03-welcome.png') });
  console.log('          ✅ Logged in — welcome page loaded');

  // ── 3. Dashboard list ─────────────────────────────────────────────────────────
  console.log('Step 3/4  Checking dashboard list...');
  await page.goto(`${BASE_URL}/dashboard/list/`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: join(SHOTS, '04-dashboards.png') });
  console.log('          ✅ Dashboard list accessible');

  // ── 4. Database connections ───────────────────────────────────────────────────
  console.log('Step 4/4  Checking database connections...');
  await page.goto(`${BASE_URL}/databaseview/list/`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: join(SHOTS, '05-database-connections.png') });
  console.log('          ✅ Database connections page accessible');

  console.log(`\n✅ All checks passed. Screenshots → ${SHOTS}/`);
  console.log('\n   Browser staying open — press Ctrl+C to close.');
  await new Promise(() => {}); // keep browser open
} catch (err) {
  await page.screenshot({ path: join(SHOTS, 'error.png') }).catch(() => {});
  console.error(`\n❌ Failed: ${err.message}`);
  console.error(`   Screenshot: ${SHOTS}/error.png`);
  process.exit(1);
}
