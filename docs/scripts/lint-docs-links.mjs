#!/usr/bin/env node
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * lint-docs-links — fail on bare relative internal links in markdown.
 *
 * Why this exists
 * ───────────────
 * Docusaurus's `onBrokenLinks: 'throw'` build setting only validates
 * *file-based* markdown references — links whose URL ends in `.md` or
 * `.mdx`. Those go through the file resolver, which knows how to map
 * a source file to its final URL and can flag a missing target.
 *
 * Bare relative URL paths like `[Foo](../foo)` or `[Bar](./bar)` skip
 * the file resolver entirely. Docusaurus emits them as raw `href`
 * attributes that the browser then resolves against the *current*
 * page URL. For trailing-slash routes (which is what Docusaurus uses
 * by default), `../foo` from `/section/group/page/` lands on
 * `/section/group/foo` — usually the wrong directory. The page
 * navigates client-side and 404s.
 *
 * The `build` job + `onBrokenLinks: 'throw'` cannot catch this class
 * of bug. The `linkinator` job *can* (it crawls rendered HTML) but is
 * configured `continue-on-error: true` so failures are advisory.
 *
 * This script runs at PR time as a fast, blocking source-level check.
 * It scans every `.md` and `.mdx` file under the active content
 * trees (skipping `versioned_docs/` snapshots, which are frozen
 * historical content) and fails if it finds any markdown link whose
 * URL starts with `./` or `../` and does NOT end in `.md`/`.mdx`.
 *
 * Excluded:
 *   - URLs inside fenced code blocks
 *   - URLs that point at images / static assets (`.png`, `.svg`, …)
 *   - URLs that point at non-content files (`.json`, `.yaml`, …)
 *
 * Run from `docs/`:
 *   node scripts/lint-docs-links.mjs
 *
 * Exits 0 on clean, 1 on any finding.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const docsRoot = path.join(__dirname, '..');

// Active content trees. We deliberately skip `*_versioned_docs/` —
// those are snapshots of historical content; even if they have
// pre-existing issues we don't want to rewrite history.
const ROOTS = ['docs', 'admin_docs', 'developer_docs', 'components'];

// Link target file extensions that are NOT documentation pages
// (images, data, etc.) — these are legitimately allowed to be bare
// relative paths.
const NON_DOC_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico',
  '.json', '.yaml', '.yml', '.txt', '.csv',
  '.zip', '.tar', '.gz',
  '.pdf',
  '.mp4', '.webm', '.mov',
]);

// Matches `[label](url)` where url starts with `./` or `../`.
// Multiline-safe inside a single line.
const LINK_RE = /\[[^\]\n]+?\]\((?<url>\.{1,2}\/[^)\s]+?)\)/g;

function classifyUrl(url) {
  // Strip anchor / query before extension test.
  const main = url.split('#', 1)[0].split('?', 1)[0];
  const ext = path.extname(main).toLowerCase();
  if (ext === '.md' || ext === '.mdx') return 'doc-with-ext';
  if (ext && NON_DOC_EXTENSIONS.has(ext)) return 'asset';
  return 'bare';
}

function* walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip versioned snapshots and node_modules etc.
      if (
        entry.name.startsWith('.') ||
        entry.name === 'node_modules' ||
        entry.name.endsWith('_versioned_docs') ||
        entry.name === 'versioned_docs'
      ) {
        continue;
      }
      yield* walk(full);
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
        yield full;
      }
    }
  }
}

function lintFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const findings = [];
  let inFence = false;
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    for (const m of line.matchAll(LINK_RE)) {
      const url = m.groups.url;
      if (classifyUrl(url) === 'bare') {
        findings.push({ line: i + 1, url, raw: line.trim() });
      }
    }
  }
  return findings;
}

const findings = [];
for (const root of ROOTS) {
  const abs = path.join(docsRoot, root);
  if (!fs.existsSync(abs)) continue;
  for (const file of walk(abs)) {
    const fileFindings = lintFile(file);
    for (const f of fileFindings) {
      findings.push({ file: path.relative(docsRoot, file), ...f });
    }
  }
}

if (findings.length === 0) {
  console.log('✓ lint-docs-links: no bare relative internal links found');
  process.exit(0);
}

console.error(
  `✗ lint-docs-links: found ${findings.length} bare relative internal link(s)`
);
console.error('');
console.error(
  'Bare relative links like `[X](../foo)` skip Docusaurus\'s file resolver'
);
console.error(
  'and get emitted as raw hrefs that the browser resolves against the'
);
console.error(
  'current page URL — wrong directory for trailing-slash routes. Add a'
);
console.error('`.md` (or `.mdx`) extension so the file resolver picks them up.');
console.error('');
for (const f of findings) {
  console.error(`  ${f.file}:${f.line}  ${f.url}`);
}
console.error('');
process.exit(1);
