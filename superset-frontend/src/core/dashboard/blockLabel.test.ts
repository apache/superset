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
import { registerBuiltInBuildingBlocks } from './registerBuiltInBuildingBlocks';
import { blockLabel } from './blockLabel';

beforeAll(() => {
  registerBuiltInBuildingBlocks();
});

test('a chart is named by the title its author wrote into the option', () => {
  expect(
    blockLabel('echarts', {
      echartsOptions: { title: { text: 'Sales by Territory' } },
    }),
  ).toBe('Sales by Territory');
});

test('a chart carrying several titles is named by the first', () => {
  // ECharts takes one title or a list of them; the first is the chart's and
  // the rest annotate parts of it.
  expect(
    blockLabel('echarts', {
      echartsOptions: { title: [{ text: 'Revenue' }, { text: 'Units' }] },
    }),
  ).toBe('Revenue');
});

test('a metric tile is named by the label it displays', () => {
  expect(blockLabel('metric-tile', { label: 'Total Revenue' })).toBe(
    'Total Revenue',
  );
});

test('a tab pane is named by its own label', () => {
  expect(blockLabel('tab', { label: 'Overview' })).toBe('Overview');
});

test('a tabs block with no panes yet falls back to its registered name', () => {
  expect(blockLabel('tabs', {})).toBe('Tabs');
});

test('markdown goes unnamed — its rendered body is already its name', () => {
  // Unlike a chart's title or a tile's label, markdown's `content` is the
  // whole of what the block renders rather than a field carved out of it,
  // and its registered name ("Markdown") says only what it is, not which
  // one — worth nothing sitting right above the content itself. Both would
  // repeat what a reader is already looking at, so this returns '' rather
  // than falling back to either.
  expect(
    blockLabel('markdown', { content: '# Acme Corp\n\nGenerated November' }),
  ).toBe('');
  expect(blockLabel('markdown', {})).toBe('');
});

test('a block with no name of its own is named by what it is', () => {
  // "Table" says what a block is rather than which one it is — worth little,
  // and still better than an empty header.
  expect(blockLabel('ag-grid-table', {})).toBe('Table');
  expect(blockLabel('echarts', undefined)).toBe('ECharts');
});

test('a name of nothing but spaces is no name', () => {
  expect(
    blockLabel('echarts', { echartsOptions: { title: { text: '  ' } } }),
  ).toBe('ECharts');
});

test('a type nothing registered still says something', () => {
  // An extension's block whose registration failed, or arrived late.
  expect(blockLabel('acme-widget', undefined)).toBe('acme-widget');
});
