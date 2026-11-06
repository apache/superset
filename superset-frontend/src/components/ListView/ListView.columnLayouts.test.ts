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
import { readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';
import { COLUMN_LAYOUT_PRESETS } from '@superset-ui/core/components/TableCollection';

const SRC_ROOT = join(__dirname, '..', '..');

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [path]
      : [];
  });
}

// Every page that renders the shared ListView table.
const listViewPages = listSourceFiles(SRC_ROOT)
  .filter(path => !path.includes(join('components', 'ListView')))
  .map(path => ({
    path: relative(SRC_ROOT, path),
    source: readFileSync(path, 'utf8'),
  }))
  .filter(({ source }) => /<ListView<|styled\(ListView\)/.test(source));

test('finds the list view pages', () => {
  expect(listViewPages.length).toBeGreaterThanOrEqual(20);
});

test.each(listViewPages.map(({ path, source }) => [path, source]))(
  '%s sizes columns with layout presets, not legacy size tokens',
  (_path, source) => {
    // Legacy `size` tokens are fixed widths that bypass the shared presets.
    expect(source).not.toMatch(/^\s*size: '(xs|sm|md|lg|xl|xxl|xxxl)',$/m);
    // Custom min/max objects bypass the presets, and a primary name column
    // sized with one would not be frozen as the leading block.
    expect(source).not.toMatch(/^\s*layout: \{/m);

    const presets = Array.from(
      source.matchAll(/^\s*layout: '(\w+)'(?: as const)?,$/gm),
      match => match[1],
    );
    expect(presets.length).toBeGreaterThan(0);
    presets.forEach(preset =>
      expect(Object.keys(COLUMN_LAYOUT_PRESETS)).toContain(preset),
    );
    // The title is the one primary flexible column of a list.
    expect(presets.filter(preset => preset === 'title').length).toBeLessThan(2);
  },
);

test('every layout preset is used by a list view page', () => {
  const used = new Set(
    listViewPages.flatMap(({ source }) =>
      Array.from(
        source.matchAll(/^\s*layout: '(\w+)'(?: as const)?,$/gm),
        match => match[1],
      ),
    ),
  );
  expect(Object.keys(COLUMN_LAYOUT_PRESETS).filter(p => !used.has(p))).toEqual(
    [],
  );
});
