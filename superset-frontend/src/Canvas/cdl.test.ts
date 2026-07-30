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

import { validateCanvas } from './validator';
import { encodeToOption, resolveVars, resolveFormatters } from './resolve';
import { runActions, ActionContext } from './actions';
import { salesCanvas } from './fixtures/salesCanvas';
import { CanvasDefinition } from './types';

const clone = (): CanvasDefinition => JSON.parse(JSON.stringify(salesCanvas));

test('the demo canvas is valid', () => {
  expect(validateCanvas(salesCanvas)).toEqual({ valid: true, errors: [] });
});

test('rejects an executable string in an echarts option (no-code invariant)', () => {
  const def = clone();
  const chart = def.tree.children![2] as { option: Record<string, unknown> };
  chart.option.tooltip = { formatter: '(v) => v.toFixed(2)' };
  const result = validateCanvas(def);
  expect(result.valid).toBe(false);
  expect(
    result.errors.some(e =>
      /formatter must be a declarative object/.test(e.message),
    ),
  ).toBe(true);
});

test('rejects a reference to an undeclared variable', () => {
  const def = clone();
  const select = def.tree.children![1].children![0] as {
    bind: Record<string, string>;
  };
  select.bind.value = '$undeclared';
  const result = validateCanvas(def);
  expect(result.valid).toBe(false);
  expect(result.errors.some(e => /undeclared variable/.test(e.message))).toBe(
    true,
  );
});

test('rejects a javascript: url in openUrl', () => {
  const def = clone();
  def.tree.children![1].children![1].on = {
    // eslint-disable-next-line no-script-url
    click: [{ action: 'openUrl', url: 'javascript:alert(1)' }],
  };
  const result = validateCanvas(def);
  expect(result.valid).toBe(false);
  expect(result.errors.some(e => /http\(s\) only/.test(e.message))).toBe(true);
});

test('rejects children on a non-container node', () => {
  const def = clone();
  (def.tree.children![0] as { children: unknown[] }).children = [
    { id: 'x', type: 'Markdown', props: { text: 'nope' } },
  ];
  const result = validateCanvas(def);
  expect(result.valid).toBe(false);
  expect(result.errors.some(e => /cannot have children/.test(e.message))).toBe(
    true,
  );
});

test('accepts the Alert/Progress/Collapse/Modal nodes and modal actions', () => {
  const definition: CanvasDefinition = {
    cdlVersion: 2,
    variables: { goal: { type: 'number', default: 60, scope: 'ui' } },
    tree: {
      id: 'root',
      type: 'Column',
      children: [
        {
          id: 'a',
          type: 'Alert',
          props: { message: 'Partial year', type: 'warning' },
        },
        { id: 'p', type: 'Progress', bind: { value: '$goal' } },
        {
          id: 'c',
          type: 'Collapse',
          children: [
            {
              id: 'sec',
              type: 'Column',
              props: { label: 'Notes' },
              children: [{ id: 'm', type: 'Markdown', props: { text: 'hi' } }],
            },
          ],
        },
        {
          id: 'btn',
          type: 'Button',
          props: { label: 'Details' },
          on: { click: [{ action: 'openModal', modalId: 'dlg' }] },
        },
        {
          id: 'dlg',
          type: 'Modal',
          props: { title: 'Detail' },
          children: [{ id: 'm2', type: 'Markdown', props: { text: 'drill' } }],
        },
      ],
    },
  };
  expect(validateCanvas(definition)).toEqual({ valid: true, errors: [] });
});

test('openModal without a modalId is rejected', () => {
  const definition = {
    cdlVersion: 2,
    variables: {},
    tree: {
      id: 'b',
      type: 'Button',
      on: { click: [{ action: 'openModal' }] },
    },
  } as unknown as CanvasDefinition;
  const result = validateCanvas(definition);
  expect(result.valid).toBe(false);
  expect(result.errors.some(e => /missing "modalId"/.test(e.message))).toBe(
    true,
  );
});

test('accepts a Board with layout placement and freeform styles', () => {
  const definition: CanvasDefinition = {
    cdlVersion: 2,
    variables: {},
    tree: {
      id: 'board',
      type: 'Board',
      props: { columns: 12, rowHeight: 40 },
      children: [
        {
          id: 'bg',
          type: 'Markdown',
          props: { text: 'behind' },
          layout: { x: 0, y: 0, w: 8, h: 4 },
        },
        {
          id: 'front',
          type: 'Markdown',
          props: { text: 'over it, tilted' },
          layout: { x: 5, y: 1, w: 5, h: 3, z: 2 },
          style: { position: 'relative', transform: 'rotate(-4deg)' },
        },
      ],
    },
  };
  expect(validateCanvas(definition)).toEqual({ valid: true, errors: [] });
});

test('rejects a malformed Board layout', () => {
  const definition = {
    cdlVersion: 2,
    variables: {},
    tree: {
      id: 'board',
      type: 'Board',
      children: [
        {
          id: 'x',
          type: 'Markdown',
          props: { text: 'a' },
          layout: { x: 0, y: 0, w: 0, h: 'tall' },
        },
      ],
    },
  } as unknown as CanvasDefinition;
  const result = validateCanvas(definition);
  expect(result.valid).toBe(false);
  expect(result.errors.some(e => /w must be at least 1/.test(e.message))).toBe(
    true,
  );
  expect(result.errors.some(e => /h must be a number/.test(e.message))).toBe(
    true,
  );
});

test('resolveVars substitutes $var references deeply', () => {
  const resolved = resolveVars(
    { filters: [{ col: 'region', val: '$region' }], keep: 1 },
    { region: 'EMEA' },
  );
  expect(resolved).toEqual({
    filters: [{ col: 'region', val: 'EMEA' }],
    keep: 1,
  });
});

test('encodeToOption maps query results onto series data', () => {
  const option = encodeToOption(
    { series: [{ type: 'bar' }] },
    { x: 'month', y: 'sales' },
    {
      columns: ['month', 'sales'],
      records: [
        { month: 'Jan', sales: 10 },
        { month: 'Feb', sales: 20 },
      ],
    },
  );
  expect(option.xAxis).toEqual({ type: 'category', data: ['Jan', 'Feb'] });
  expect(option.series).toEqual([
    { type: 'bar', name: 'sales', data: [10, 20] },
  ]);
});

test('encodeToOption shapes pie data as name/value and drops axes', () => {
  const option = encodeToOption(
    { series: [{ type: 'pie' }] },
    { x: 'genre', y: 'sales' },
    {
      columns: ['genre', 'sales'],
      records: [
        { genre: 'Action', sales: 5 },
        { genre: 'Sports', sales: 7 },
      ],
    },
  );
  expect(option.series).toEqual([
    {
      type: 'pie',
      name: 'sales',
      data: [
        { name: 'Action', value: 5 },
        { name: 'Sports', value: 7 },
      ],
    },
  ]);
  expect(option.xAxis).toBeUndefined();
});

test('encodeToOption shapes scatter data as [x, y, label] pairs', () => {
  const option = encodeToOption(
    { series: [{ type: 'scatter' }] },
    { x: 'publisher', y: ['na', 'eu'] },
    {
      columns: ['publisher', 'na', 'eu'],
      records: [{ publisher: 'Nintendo', na: 1, eu: 2 }],
    },
  );
  const series = option.series as Array<{ data: unknown[] }>;
  expect(series[0].data).toEqual([[1, 2, 'Nintendo']]);
});

test('encodeToOption builds radar indicators from categories', () => {
  const option = encodeToOption(
    { series: [{ type: 'radar' }] },
    { x: 'genre', y: 'sales' },
    {
      columns: ['genre', 'sales'],
      records: [
        { genre: 'Action', sales: 5 },
        { genre: 'Sports', sales: 9 },
      ],
    },
  );
  const radar = option.radar as { indicator: Array<{ name: string }> };
  expect(radar.indicator.map(i => i.name)).toEqual(['Action', 'Sports']);
  const series = option.series as Array<{ data: Array<{ value: number[] }> }>;
  expect(series[0].data[0].value).toEqual([5, 9]);
});

test('resolveFormatters turns a declarative spec into a function', () => {
  const resolved = resolveFormatters({
    tooltip: { valueFormatter: { kind: 'currency', currency: 'USD' } },
  }) as { tooltip: { valueFormatter: (v: unknown) => string } };
  const fn = resolved.tooltip.valueFormatter;
  expect(typeof fn).toBe('function');
  expect(fn(1000)).toMatch(/\$1,000/);
});

test('runActions dispatches setVariable with the event value', () => {
  const writes: Array<[string, unknown]> = [];
  const ctx: ActionContext = {
    vars: {},
    setVariable: (name, value) => writes.push([name, value]),
    applyFilter: () => {},
    crossFilter: () => {},
    clearFilters: () => {},
    navigateTab: () => {},
    setModalOpen: () => {},
    refresh: () => {},
    eventValue: 'EMEA',
  };
  runActions([{ action: 'setVariable', name: 'region', value: '$event' }], ctx);
  expect(writes).toEqual([['region', 'EMEA']]);
});
