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
 * Smart generator wrapper: only runs generators whose input files have changed.
 *
 * Computes a hash of each generator's input files (stories, engine specs,
 * openapi.json, and the generator scripts themselves). Compares against a
 * stored cache. Skips generators whose inputs and outputs are unchanged.
 *
 * Usage:
 *   node scripts/generate-if-changed.mjs          # smart mode (default)
 *   node scripts/generate-if-changed.mjs --force   # force regenerate all
 */

import { createHash } from 'crypto';
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOCS_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(DOCS_DIR, '..');
const CACHE_FILE = path.join(DOCS_DIR, '.docusaurus', 'generator-hashes.json');

const FORCE = process.argv.includes('--force');

// Ensure local node_modules/.bin is on PATH (needed for docusaurus CLI)
const localBin = path.join(DOCS_DIR, 'node_modules', '.bin');
process.env.PATH = `${localBin}${path.delimiter}${process.env.PATH}`;

// ---------------------------------------------------------------------------
// Generator definitions
// ---------------------------------------------------------------------------

const GENERATORS = [
  {
    name: 'superset-components',
    command: 'node scripts/generate-superset-components.mjs',
    inputs: [
      {
        type: 'glob',
        base: path.join(ROOT_DIR, 'superset-frontend/packages/superset-ui-core/src/components'),
        pattern: '**/*.stories.tsx',
      },
      {
        type: 'glob',
        base: path.join(ROOT_DIR, 'superset-frontend/packages/superset-core/src'),
        pattern: '**/*.stories.tsx',
      },
      { type: 'file', path: path.join(DOCS_DIR, 'scripts/generate-superset-components.mjs') },
      { type: 'file', path: path.join(DOCS_DIR, 'src/components/StorybookWrapper.jsx') },
    ],
    outputs: [
      path.join(DOCS_DIR, 'developer_docs/components/index.mdx'),
      path.join(DOCS_DIR, 'static/data/components.json'),
      path.join(DOCS_DIR, 'src/types/apache-superset-core/index.d.ts'),
    ],
  },
  {
    name: 'database-docs',
    command: 'node scripts/generate-database-docs.mjs',
    inputs: [
      {
        type: 'glob',
        base: path.join(ROOT_DIR, 'superset/db_engine_specs'),
        pattern: '**/*.py',
      },
      { type: 'file', path: path.join(DOCS_DIR, 'scripts/generate-database-docs.mjs') },
    ],
    outputs: [
      path.join(DOCS_DIR, 'src/data/databases.json'),
      path.join(DOCS_DIR, 'docs/databases/supported'),
    ],
  },
  {
    name: 'api-docs',
    command:
      'python3 scripts/fix-openapi-spec.py && docusaurus gen-api-docs superset && node scripts/convert-api-sidebar.mjs && node scripts/generate-api-index.mjs && node scripts/generate-api-tag-pages.mjs',
    inputs: [
      { type: 'file', path: path.join(DOCS_DIR, 'static/resources/openapi.json') },
      { type: 'file', path: path.join(DOCS_DIR, 'scripts/fix-openapi-spec.py') },
      { type: 'file', path: path.join(DOCS_DIR, 'scripts/convert-api-sidebar.mjs') },
      { type: 'file', path: path.join(DOCS_DIR, 'scripts/generate-api-index.mjs') },
      { type: 'file', path: path.join(DOCS_DIR, 'scripts/generate-api-tag-pages.mjs') },
    ],
    outputs: [
      path.join(DOCS_DIR, 'docs/api.mdx'),
    ],
  },
];

// ---------------------------------------------------------------------------
// Hashing utilities
// ---------------------------------------------------------------------------

function walkDir(dir, pattern) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const regex = globToRegex(pattern);
  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '__pycache__') continue;
        walk(fullPath);
      } else {
        // Normalize to forward slashes so glob patterns work on all platforms
        const relativePath = path.relative(dir, fullPath).split(path.sep).join('/');
        if (regex.test(relativePath)) {
          results.push(fullPath);
        }
      }
    }
  }
  walk(dir);
  return results.sort();
}

function globToRegex(pattern) {
  // Simple glob-to-regex: ** matches any path, * matches anything except /
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '<<<GLOBSTAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<GLOBSTAR>>>/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function hashFile(filePath) {
  if (!fs.existsSync(filePath)) return 'missing';
  const stat = fs.statSync(filePath);
  // Use mtime + size for speed (avoids reading file contents)
  return `${stat.mtimeMs}:${stat.size}`;
}

function computeInputHash(inputs) {
  const hash = createHash('md5');
  for (const input of inputs) {
    if (input.type === 'file') {
      hash.update(`file:${input.path}:${hashFile(input.path)}\n`);
    } else if (input.type === 'glob') {
      const files = walkDir(input.base, input.pattern);
      hash.update(`glob:${input.base}:${input.pattern}:count=${files.length}\n`);
      for (const file of files) {
        hash.update(`  ${path.relative(input.base, file)}:${hashFile(file)}\n`);
      }
    }
  }
  return hash.digest('hex');
}

function outputsExist(outputs) {
  return outputs.every((p) => fs.existsSync(p));
}

// ---------------------------------------------------------------------------
// Cache management
// ---------------------------------------------------------------------------

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    }
  } catch {
    // Corrupted cache — start fresh
  }
  return {};
}

function saveCache(cache) {
  const dir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const cache = loadCache();
  const updatedCache = { ...cache };
  let skipped = 0;
  let ran = 0;

  // First pass: determine which generators need to run
  // Run independent generators (superset-components, database-docs) in
  // parallel, then api-docs sequentially (it depends on docusaurus CLI
  // being available, not on other generators).

  const independent = GENERATORS.filter((g) => g.name !== 'api-docs');
  const sequential = GENERATORS.filter((g) => g.name === 'api-docs');

  // Check and run independent generators in parallel
  const parallelPromises = independent.map((gen) => {
    const currentHash = computeInputHash(gen.inputs);
    const cachedHash = cache[gen.name];
    const hasOutputs = outputsExist(gen.outputs);

    if (!FORCE && currentHash === cachedHash && hasOutputs) {
      console.log(`  ✓ ${gen.name} — no changes, skipping`);
      skipped++;
      return Promise.resolve();
    }

    const reason = FORCE
      ? 'forced'
      : !hasOutputs
        ? 'output missing'
        : 'inputs changed';
    console.log(`  ↻ ${gen.name} — ${reason}, regenerating...`);
    ran++;

    return new Promise((resolve, reject) => {
      const child = spawn('sh', ['-c', gen.command], {
        cwd: DOCS_DIR,
        stdio: 'inherit',
        env: process.env,
      });
      child.on('close', (code) => {
        if (code === 0) {
          updatedCache[gen.name] = currentHash;
          resolve();
        } else {
          console.error(`  ✗ ${gen.name} failed (exit ${code})`);
          reject(new Error(`${gen.name} failed with exit code ${code}`));
        }
      });
      child.on('error', (err) => {
        console.error(`  ✗ ${gen.name} failed to start`);
        reject(err);
      });
    });
  });

  await Promise.all(parallelPromises);

  // Run sequential generators (api-docs)
  for (const gen of sequential) {
    const currentHash = computeInputHash(gen.inputs);
    const cachedHash = cache[gen.name];
    const hasOutputs = outputsExist(gen.outputs);

    if (!FORCE && currentHash === cachedHash && hasOutputs) {
      console.log(`  ✓ ${gen.name} — no changes, skipping`);
      skipped++;
      continue;
    }

    const reason = FORCE
      ? 'forced'
      : !hasOutputs
        ? 'output missing'
        : 'inputs changed';
    console.log(`  ↻ ${gen.name} — ${reason}, regenerating...`);
    ran++;

    try {
      execSync(gen.command, {
        cwd: DOCS_DIR,
        stdio: 'inherit',
        timeout: 300_000,
      });
      updatedCache[gen.name] = currentHash;
    } catch (err) {
      console.error(`  ✗ ${gen.name} failed`);
      throw err;
    }
  }

  saveCache(updatedCache);

  if (ran === 0) {
    console.log(`\nAll ${skipped} generators up-to-date — nothing to do!\n`);
  } else {
    console.log(`\nDone: ${ran} regenerated, ${skipped} skipped.\n`);
  }
}

console.log('Checking generators for changes...\n');
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
