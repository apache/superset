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

const reachableLayout = {
  DASHBOARD_VERSION_KEY: 'v2',
  ROOT_ID: { id: 'ROOT_ID', type: 'ROOT', children: ['GRID_ID'] },
  GRID_ID: { id: 'GRID_ID', type: 'GRID', children: ['ROW-a'] },
  'ROW-a': { id: 'ROW-a', type: 'ROW', children: ['CHART-a'] },
  'CHART-a': { id: 'CHART-a', type: 'CHART', children: [] },
  HEADER_ID: { id: 'HEADER_ID', type: 'HEADER' },
} as any;

test('returns the same layout when everything is reachable', () => {
  expect(removeUnreachableComponents(reachableLayout)).toBe(reachableLayout);
});

test('drops a detached subtree, including one that contains a cycle', () => {
  // the shape of a real corrupted dashboard: a column moved into a row nested
  // inside itself, leaving the pair pointing at each other and detached
  const layout = {
    ...reachableLayout,
    'COLUMN-orphan': {
      id: 'COLUMN-orphan',
      type: 'COLUMN',
      children: ['CHART-trapped', 'ROW-orphan'],
      parents: ['ROOT_ID', 'GRID_ID', 'ROW-a'],
    },
    'ROW-orphan': {
      id: 'ROW-orphan',
      type: 'ROW',
      children: ['COLUMN-orphan'],
      parents: ['ROOT_ID', 'GRID_ID', 'ROW-a', 'COLUMN-orphan'],
    },
    'CHART-trapped': {
      id: 'CHART-trapped',
      type: 'CHART',
      children: [],
      parents: ['ROOT_ID', 'GRID_ID', 'ROW-a', 'COLUMN-orphan'],
    },
  } as any;

  expect(Object.keys(removeUnreachableComponents(layout)).sort()).toEqual(
    Object.keys(reachableLayout).sort(),
  );
});

test('keeps the detached empty grid of a dashboard with top-level tabs', () => {
  const layout = {
    DASHBOARD_VERSION_KEY: 'v2',
    ROOT_ID: { id: 'ROOT_ID', type: 'ROOT', children: ['TABS-t'] },
    GRID_ID: { id: 'GRID_ID', type: 'GRID', children: [] },
    'TABS-t': { id: 'TABS-t', type: 'TABS', children: ['TAB-1'] },
    'TAB-1': { id: 'TAB-1', type: 'TAB', children: [] },
    HEADER_ID: { id: 'HEADER_ID', type: 'HEADER' },
  } as any;

  expect(removeUnreachableComponents(layout)).toBe(layout);
});

test('returns the layout untouched when there is no root to walk from', () => {
  const layout = { 'ROW-a': { id: 'ROW-a', type: 'ROW', children: [] } } as any;

  expect(removeUnreachableComponents(layout)).toBe(layout);
});
