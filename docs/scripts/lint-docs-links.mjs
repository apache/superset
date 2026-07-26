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
 * lint-docs-links — source-level checks for internal markdown links.
 *
 * Catches three failure modes that combine to break SPA navigation in
 * a Docusaurus build:
 *
 *   1. BARE             — `[X](../foo)` with no extension. Skips
 *                         Docusaurus's file resolver entirely. Emitted
 *                         as a raw href and resolved by the browser
 *                         against the current page URL — usually the
 *                         wrong directory for trailing-slash routes.
 *                         `onBrokenLinks: 'throw'` cannot catch this.
 *
 *   2. MISSING_TARGET   — `[X](./gone.md)` with an extension, but no
 *                         file at that path. The Docusaurus build
 *                         catches this too (via
 *                         `onBrokenMarkdownLinks: 'throw'`) but only
 *                         after a multi-minute build. This script
 *                         flags it in ~1s.
 *
 *   3. WRONG_EXTENSION  — `[X](./foo.md)` where the file is actually
 *                         `foo.mdx` (or vice versa). Same end result
 *                         as MISSING_TARGET, but the fix is one
 *                         character — so we report it as its own
 *                         category with the actual extension on disk.
 *
 * Skips: fenced code blocks, asset-style targets (.png/.json/etc.),
 * external URLs, in-page anchors, and the `versioned_docs/`
 * snapshots (those are frozen historical content).
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

const ROOTS = ['docs', 'admin_docs', 'developer_docs', 'components'];

const NON_DOC_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico',
  '.json', '.yaml', '.yml', '.txt', '.csv',
  '.zip', '.tar', '.gz',
  '.pdf',
  '.mp4', '.webm', '.mov',
]);

const LINK_RE = /\[[^\]\n]+?\]\((?<url>\.{1,2}\/[^)\s]+?)\)/g;

/**
 * Classify a single markdown link from a source file.
 * Returns one of: ok / bare / asset / missing-target / wrong-extension.
 */
function classifyLink(sourceFile, url) {
  const stripped = url.split('#', 1)[0].split('?', 1)[0];
  const ext = path.extname(stripped).toLowerCase();

  // Non-doc assets — legit bare extensions, leave alone.
  if (ext && NON_DOC_EXTENSIONS.has(ext)) {
    return { kind: 'asset' };
  }

  // Anything that doesn't end in .md/.mdx is a bare relative URL.
  if (ext !== '.md' && ext !== '.mdx') {
    return { kind: 'bare' };
  }

  // Has a .md/.mdx extension — make sure the target exists.
  const target = path.normalize(path.join(path.dirname(sourceFile), stripped));
  if (fs.existsSync(target)) {
    return { kind: 'ok' };
  }

  // Target doesn't exist — check if the OTHER extension does.
  const otherExt = ext === '.md' ? '.mdx' : '.md';
  const otherTarget = target.slice(0, -ext.length) + otherExt;
  if (fs.existsSync(otherTarget)) {
    return { kind: 'wrong-extension', actualExt: otherExt };
  }

  return { kind: 'missing-target' };
}

function* walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
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
      const result = classifyLink(file, url);
      if (result.kind !== 'ok' && result.kind !== 'asset') {
        findings.push({ line: i + 1, url, ...result });
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
    for (const f of lintFile(file)) {
      findings.push({ file: path.relative(docsRoot, file), ...f });
    }
  }
}

if (findings.length === 0) {
  console.log('✓ lint-docs-links: no broken internal links found');
  process.exit(0);
}

// Group by kind for readable output.
const groups = {
  bare: [],
  'wrong-extension': [],
  'missing-target': [],
};
for (const f of findings) {
  groups[f.kind].push(f);
}

console.error(
  `✗ lint-docs-links: found ${findings.length} broken internal link(s)`
);
console.error('');

if (groups.bare.length) {
  console.error(
    `  ${groups.bare.length} bare relative link(s) (no .md/.mdx extension)`
  );
  console.error(
    "  Docusaurus's file resolver skips these; the browser resolves them"
  );
  console.error(
    '  against the current page URL — wrong directory for trailing-slash routes.'
  );
  console.error('  Add the extension so the file resolver picks them up.');
  console.error('');
  for (const f of groups.bare) {
    console.error(`    ${f.file}:${f.line}  ${f.url}`);
  }
  console.error('');
}

if (groups['wrong-extension'].length) {
  console.error(
    `  ${groups['wrong-extension'].length} wrong-extension link(s) (.md vs .mdx mismatch)`
  );
  console.error('  The target file exists with the other extension on disk.');
  console.error('');
  for (const f of groups['wrong-extension']) {
    console.error(
      `    ${f.file}:${f.line}  ${f.url}  →  use ${f.actualExt}`
    );
  }
  console.error('');
}

if (groups['missing-target'].length) {
  console.error(
    `  ${groups['missing-target'].length} missing-target link(s) (file doesn't exist)`
  );
  console.error('');
  for (const f of groups['missing-target']) {
    console.error(`    ${f.file}:${f.line}  ${f.url}`);
  }
  console.error('');
}

process.exit(1);
