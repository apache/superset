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
import removeUnreachableComponents from 'src/dashboard/util/removeUnreachableComponents';
import type { DashboardComponent } from 'src/dashboard/types';

type Layout = Record<string, DashboardComponent>;

const component = (
  id: string,
  type: string,
  children: string[] = [],
  extra: Partial<DashboardComponent> = {},
): DashboardComponent => ({ id, type, children, meta: {}, ...extra });

// DASHBOARD_VERSION_KEY is a plain string in real position data
const withVersionKey = (layout: Layout): Layout =>
  ({ DASHBOARD_VERSION_KEY: 'v2', ...layout }) as unknown as Layout;

const reachableLayout = (): Layout =>
  withVersionKey({
    ROOT_ID: component('ROOT_ID', 'ROOT', ['GRID_ID']),
    GRID_ID: component('GRID_ID', 'GRID', ['ROW-a']),
    'ROW-a': component('ROW-a', 'ROW', ['CHART-a']),
    'CHART-a': component('CHART-a', 'CHART', [], { meta: { chartId: 1 } }),
    HEADER_ID: component('HEADER_ID', 'HEADER'),
  });

// the shape of a real corrupted dashboard: a column moved into a row nested
// inside itself, leaving the pair pointing at each other and detached
const trappedComponents = (chartMeta: DashboardComponent['meta']): Layout => ({
  'COLUMN-orphan': component(
    'COLUMN-orphan',
    'COLUMN',
    ['CHART-trapped', 'ROW-orphan'],
    { parents: ['ROOT_ID', 'GRID_ID', 'ROW-a'] },
  ),
  'ROW-orphan': component('ROW-orphan', 'ROW', ['COLUMN-orphan'], {
    parents: ['ROOT_ID', 'GRID_ID', 'ROW-a', 'COLUMN-orphan'],
  }),
  'CHART-trapped': component('CHART-trapped', 'CHART', [], {
    parents: ['ROOT_ID', 'GRID_ID', 'ROW-a', 'COLUMN-orphan'],
    meta: chartMeta,
  }),
});

test('returns the same layout when everything is reachable', () => {
  const layout = reachableLayout();
  expect(removeUnreachableComponents(layout)).toBe(layout);
});

test('drops a detached subtree, including one that contains a cycle', () => {
  const layout = { ...reachableLayout(), ...trappedComponents({}) };

  expect(Object.keys(removeUnreachableComponents(layout)).sort()).toEqual(
    Object.keys(reachableLayout()).sort(),
  );
});

test('reattaches a detached chart to the grid, keeping its id and meta', () => {
  const layout = {
    ...reachableLayout(),
    ...trappedComponents({ chartId: 2, width: 4 }),
  };

  const repaired = removeUnreachableComponents(layout);

  expect(repaired['COLUMN-orphan']).toBeUndefined();
  expect(repaired['ROW-orphan']).toBeUndefined();
  const [, newRowId] = repaired.GRID_ID.children;
  expect(repaired[newRowId]).toMatchObject({
    type: 'ROW',
    children: ['CHART-trapped'],
    parents: ['ROOT_ID', 'GRID_ID'],
  });
  expect(repaired['CHART-trapped']).toMatchObject({
    parents: ['ROOT_ID', 'GRID_ID', newRowId],
    meta: { chartId: 2, width: 4 },
  });
  expect(layout.GRID_ID.children).toEqual(['ROW-a']);
});

test('reattaches detached markdown to a row and a header to the grid', () => {
  const layout = {
    ...reachableLayout(),
    'COLUMN-orphan': component('COLUMN-orphan', 'COLUMN', [
      'HEADER-trapped',
      'MARKDOWN-trapped',
      'ROW-orphan',
    ]),
    'ROW-orphan': component('ROW-orphan', 'ROW', ['COLUMN-orphan']),
    'HEADER-trapped': component('HEADER-trapped', 'HEADER', [], {
      meta: { text: 'Section title' },
    }),
    'MARKDOWN-trapped': component('MARKDOWN-trapped', 'MARKDOWN', [], {
      meta: { code: '# Notes', width: 4 },
    }),
  };

  const repaired = removeUnreachableComponents(layout);

  expect(repaired['COLUMN-orphan']).toBeUndefined();
  expect(repaired['ROW-orphan']).toBeUndefined();
  const newRowId = repaired.GRID_ID.children[2];
  // a header is not a valid row child, so it sits directly in the grid
  expect(repaired.GRID_ID.children).toEqual([
    'ROW-a',
    'HEADER-trapped',
    newRowId,
  ]);
  expect(repaired['HEADER-trapped']).toMatchObject({
    parents: ['ROOT_ID', 'GRID_ID'],
    meta: { text: 'Section title' },
  });
  expect(repaired[newRowId]).toMatchObject({
    type: 'ROW',
    children: ['MARKDOWN-trapped'],
  });
  expect(repaired['MARKDOWN-trapped']).toMatchObject({
    parents: ['ROOT_ID', 'GRID_ID', newRowId],
    meta: { code: '# Notes', width: 4 },
  });
});

test('reattaches a detached chart to the first tab of top-level tabs', () => {
  const layout = withVersionKey({
    ROOT_ID: component('ROOT_ID', 'ROOT', ['TABS-t']),
    GRID_ID: component('GRID_ID', 'GRID'),
    'TABS-t': component('TABS-t', 'TABS', ['TAB-1', 'TAB-2']),
    'TAB-1': component('TAB-1', 'TAB'),
    'TAB-2': component('TAB-2', 'TAB'),
    'CHART-trapped': component('CHART-trapped', 'CHART', [], {
      meta: { chartId: 2 },
    }),
  });

  const repaired = removeUnreachableComponents(layout);

  const [newRowId] = repaired['TAB-1'].children;
  expect(repaired['CHART-trapped'].parents).toEqual([
    'ROOT_ID',
    'TABS-t',
    'TAB-1',
    newRowId,
  ]);
});

test('does not duplicate a detached chart that is also placed reachably', () => {
  const layout = { ...reachableLayout(), ...trappedComponents({ chartId: 1 }) };

  const repaired = removeUnreachableComponents(layout);

  expect(repaired['CHART-trapped']).toBeUndefined();
  expect(repaired.GRID_ID.children).toEqual(['ROW-a']);
});

test('keeps the detached empty grid of a dashboard with top-level tabs', () => {
  const layout = withVersionKey({
    ROOT_ID: component('ROOT_ID', 'ROOT', ['TABS-t']),
    GRID_ID: component('GRID_ID', 'GRID'),
    'TABS-t': component('TABS-t', 'TABS', ['TAB-1']),
    'TAB-1': component('TAB-1', 'TAB'),
    HEADER_ID: component('HEADER_ID', 'HEADER'),
  });

  expect(removeUnreachableComponents(layout)).toBe(layout);
});

test('clears the children of a detached grid when dropping them', () => {
  const layout = withVersionKey({
    ROOT_ID: component('ROOT_ID', 'ROOT', ['TABS-t']),
    GRID_ID: component('GRID_ID', 'GRID', ['ROW-stale']),
    'ROW-stale': component('ROW-stale', 'ROW'),
    'TABS-t': component('TABS-t', 'TABS', ['TAB-1']),
    'TAB-1': component('TAB-1', 'TAB'),
  });

  const repaired = removeUnreachableComponents(layout);

  expect(repaired['ROW-stale']).toBeUndefined();
  expect(repaired.GRID_ID.children).toEqual([]);
  expect(layout.GRID_ID.children).toEqual(['ROW-stale']);
});

test('returns the layout untouched when there is no root to walk from', () => {
  const layout: Layout = { 'ROW-a': component('ROW-a', 'ROW') };

  expect(removeUnreachableComponents(layout)).toBe(layout);
});

test('leaves the layout untouched when root children is not an array', () => {
  const layout = reachableLayout();
  layout.ROOT_ID = {
    ...layout.ROOT_ID,
    children: { 0: 'GRID_ID' } as unknown as string[],
  };

  expect(removeUnreachableComponents(layout)).toBe(layout);
});

test('tolerates non-array children below the root', () => {
  const layout = reachableLayout();
  layout['ROW-a'] = {
    ...layout['ROW-a'],
    children: 'CHART-a' as unknown as string[],
  };

  expect(() => removeUnreachableComponents(layout)).not.toThrow();
});
