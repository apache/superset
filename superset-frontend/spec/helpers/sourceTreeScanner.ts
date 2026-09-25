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
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve, sep } from 'path';

const DEFAULT_ROOTS = ['src', 'packages/superset-ui-core/src'];

const ALWAYS_SKIP_SEGMENTS = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '__mocks__',
  'cypress-base',
  'playwright',
]);

const ALWAYS_SKIP_SUFFIXES = [
  '.test.ts',
  '.test.tsx',
  '.stories.ts',
  '.stories.tsx',
];

const SOURCE_EXTENSIONS = ['.ts', '.tsx'];

export interface ScanOptions {
  /** Workspace-relative directories to scan. Defaults to the source tree. */
  roots?: string[];
  /** Extra path segments to skip on top of {@link ALWAYS_SKIP_SEGMENTS}. */
  ignoreSegments?: string[];
  /** Regex run against each line of each file. */
  pattern: RegExp;
  /** Workspace-relative paths (forward slashes) exempt from this scan. */
  allowlist?: string[];
}

export interface ScanHit {
  /** Workspace-relative path with forward slashes. */
  file: string;
  /** 1-based line number. */
  line: number;
  /** The text of the matching line, trimmed. */
  text: string;
  /** The substring captured by `pattern`. */
  match: string;
}

// __dirname resolves to <workspace>/spec/helpers regardless of cwd.
const WORKSPACE_ROOT = resolve(__dirname, '..', '..');

function isSourceFile(name: string): boolean {
  return (
    SOURCE_EXTENSIONS.some(ext => name.endsWith(ext)) &&
    !ALWAYS_SKIP_SUFFIXES.some(suffix => name.endsWith(suffix))
  );
}

function walk(directory: string, ignoreSegments: Set<string>): string[] {
  const found: string[] = [];

  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return found;
  }

  for (const entry of entries) {
    if (ignoreSegments.has(entry.name)) continue;
    const absolute = join(directory, entry.name);

    if (entry.isDirectory()) {
      found.push(...walk(absolute, ignoreSegments));
    } else if (entry.isFile() && isSourceFile(entry.name)) {
      found.push(absolute);
    }
  }

  return found;
}

function toForwardSlashes(path: string): string {
  return sep === '/' ? path : path.split(sep).join('/');
}

/**
 * Line-by-line regex scan over the source tree. Returns one {@link ScanHit}
 * per matching line. Textual (not AST-based) — false positives on string
 * literals should be fixed by tightening the regex.
 */
export function scanSource(options: ScanOptions): ScanHit[] {
  const {
    roots = DEFAULT_ROOTS,
    ignoreSegments = [],
    pattern,
    allowlist = [],
  } = options;

  const ignoreSet = new Set([...ALWAYS_SKIP_SEGMENTS, ...ignoreSegments]);
  const allowSet = new Set(allowlist);
  const hits: ScanHit[] = [];

  const seen = new Set<string>();
  for (const root of roots) {
    const absoluteRoot = resolve(WORKSPACE_ROOT, root);
    let stat;
    try {
      stat = statSync(absoluteRoot);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;

    for (const absoluteFile of walk(absoluteRoot, ignoreSet)) {
      if (seen.has(absoluteFile)) continue;
      seen.add(absoluteFile);

      const relativePath = toForwardSlashes(
        relative(WORKSPACE_ROOT, absoluteFile),
      );
      if (allowSet.has(relativePath)) continue;

      const contents = readFileSync(absoluteFile, 'utf8');
      const lines = contents.split('\n');

      // Reuse the regex per file. Without the `g` flag, `.exec` ignores
      // lastIndex, so recompiling per-line was wasted allocation.
      const lineRegex = pattern.flags.includes('g')
        ? new RegExp(pattern.source, pattern.flags.replace('g', ''))
        : pattern;

      for (let index = 0; index < lines.length; index += 1) {
        const lineText = lines[index];
        const match = lineRegex.exec(lineText);
        if (match) {
          hits.push({
            file: relativePath,
            line: index + 1,
            text: lineText.trim(),
            match: match[0],
          });
        }
      }
    }
  }

  return hits;
}

/** Format hits as a multi-line failure message: `  file:line — text`. */
export function formatHits(hits: ScanHit[], header: string): string {
  if (hits.length === 0) return header;
  const lines = hits
    .slice(0, 50)
    .map(hit => `  ${hit.file}:${hit.line} — ${hit.text}`);
  const overflow =
    hits.length > 50 ? `\n  ... and ${hits.length - 50} more` : '';
  return `${header}\n${lines.join('\n')}${overflow}`;
}

/** Throw with a formatted message if `hits` is non-empty. */
export function expectNoHits(hits: ScanHit[], header: string): void {
  if (hits.length > 0) {
    throw new Error(formatHits(hits, header));
  }
}
