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

import { resolveBindings } from './resolveBindings';
import type { BindContext } from './resolveBindings';

const chartTheme = {
  background: 'transparent',
  text: {
    color: '#111',
    mutedColor: '#666',
    disabledColor: '#aaa',
    fontFamily: 'Inter',
    fontSize: 12,
  },
  axis: {
    lineColor: '#eee',
    labelColor: '#666',
    gridColor: '#eee',
    minorGridColor: '#ddd',
  },
  tooltip: { background: '#fff', color: '#111' },
  accent: '#20a7c9',
  categoricalColors: ['#1f77b4'],
  sequentialColors: [],
  getColor: (label: string) => `colour-of-${label}`,
};

const ctx: BindContext = {
  rows: [
    { country: 'Norway', sales: 10 },
    { country: 'Spain', sales: 7 },
  ],
  chartTheme,
  theme: { colorPrimary: '#legacy' } as unknown as BindContext['theme'],
};

test('binds a theme value by what it means rather than by its token name', () => {
  const out = resolveBindings(
    {
      textStyle: { color: { $bind: { source: 'theme', token: 'text.color' } } },
      marker: { $bind: { source: 'theme', token: 'accent' } },
    },
    ctx,
  );

  expect(out).toEqual({ textStyle: { color: '#111' }, marker: '#20a7c9' });
});

test('still resolves an option authored against the raw token names', () => {
  // A vocabulary change should not blank out the charts on every canvas
  // already saved against the old one.
  expect(
    resolveBindings(
      { color: { $bind: { source: 'theme', token: 'colorPrimary' } } },
      ctx,
    ),
  ).toEqual({ color: '#legacy' });
});

test('names the fields it accepts when a theme token is neither', () => {
  expect(() =>
    resolveBindings(
      { color: { $bind: { source: 'theme', token: 'colourPrimary' } } },
      ctx,
    ),
  ).toThrow(/not a chart theme field/);
});

test('does not splice a theme function in as if it were a value', () => {
  // `getColor` is a field of the chart theme and not a thing an option can
  // carry; a series is coloured by name in `applySeriesDefaults` instead.
  expect(() =>
    resolveBindings(
      { color: { $bind: { source: 'theme', token: 'getColor' } } },
      ctx,
    ),
  ).toThrow(/not a chart theme field/);
});
