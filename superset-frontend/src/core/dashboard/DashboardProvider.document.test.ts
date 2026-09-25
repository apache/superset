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
import DashboardProvider from './DashboardProvider';

const savedDocument = () => ({
  root: {
    type: 'grid',
    layout: { columns: 24, gap: 16 },
    children: ['node_50', 'node_7'],
  },
  node_50: {
    type: 'echarts',
    layout: { colSpan: 12 },
    props: { chartType: 'bar' },
  },
  node_7: {
    type: 'filter.select',
    props: { column: 'region', scope: { targets: ['node_50'] } },
  },
});

let provider: DashboardProvider;

beforeEach(() => {
  provider = new DashboardProvider();
});

test('a constructed store is independent of the singleton', () => {
  const singleton = DashboardProvider.getInstance();
  singleton.reset();

  provider.addWidget(provider.getRoot().id, 0, { type: 'markdown' });

  expect(singleton.getRoot().children).toEqual([]);
  expect(provider.getRoot().children).toHaveLength(1);
});

test('loadDocument replaces the tree and getDocument round-trips it', () => {
  provider.addWidget(provider.getRoot().id, 0, { type: 'markdown' });

  provider.loadDocument(savedDocument());

  expect(provider.getRoot().children).toEqual(['node_50', 'node_7']);
  expect(provider.getDocument()).toEqual(savedDocument());
});

test('loadDocument rejects a document without a root', () => {
  expect(() => provider.loadDocument({ node_1: { type: 'markdown' } })).toThrow(
    'must contain a "root" node',
  );
});

test('loadDocument clears session state from the previous document', () => {
  provider.loadDocument(savedDocument());
  provider.emit('node_50', 'valueChanged', { selection: 'x' });

  provider.loadDocument(savedDocument());

  expect(provider.getValue('node_50', 'valueChanged')).toBeUndefined();
  expect(provider.getSourceIds('valueChanged')).toEqual([]);
});

test('addWidget after loadDocument never reuses a loaded id', () => {
  provider.loadDocument(savedDocument());

  const id = provider.addWidget(provider.getRoot().id, 0, { type: 'text' });

  expect(['node_50', 'node_7']).not.toContain(id);
  expect(Number(id.replace('node_', ''))).toBeGreaterThan(50);
});

test('getSourceIds lists emitting nodes still in the tree and host sources', () => {
  provider.loadDocument(savedDocument());
  provider.emit('host:region', 'valueChanged', {});
  provider.emit('node_7', 'valueChanged', {});
  provider.emit('node_gone', 'valueChanged', {});
  provider.emit('node_7', 'filterBarApply', {});

  expect(provider.getSourceIds('valueChanged').sort()).toEqual([
    'host:region',
    'node_7',
  ]);
  expect(provider.getSourceIds('filterBarApply')).toEqual(['node_7']);
});

test("getScopeTargets reads a node's authored scope", () => {
  provider.loadDocument(savedDocument());

  expect(provider.getScopeTargets('node_7')).toEqual(['node_50']);
  expect(provider.getScopeTargets('node_50')).toBeUndefined();
  expect(provider.getScopeTargets('host:region')).toBeUndefined();
});
