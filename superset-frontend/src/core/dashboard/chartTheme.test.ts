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
import {
  CategoricalColorNamespace,
  CategoricalScheme,
  getCategoricalSchemeRegistry,
  getSequentialSchemeRegistry,
  SequentialScheme,
} from '@superset-ui/core';
import { getChartTheme } from './chartTheme';

const theme = {
  colorText: '#111',
  colorTextSecondary: '#666',
  colorTextDisabled: '#aaa',
  colorSplit: '#eee',
  colorBorderSecondary: '#ddd',
  colorBgContainer: '#fff',
  colorPrimary: '#20a7c9',
  fontFamily: 'Inter',
  fontSize: 12,
} as unknown as Parameters<typeof getChartTheme>[0];

test('maps theme tokens onto renderer-agnostic chart fields', () => {
  const chartTheme = getChartTheme(theme);

  expect(chartTheme.text).toEqual({
    color: '#111',
    mutedColor: '#666',
    disabledColor: '#aaa',
    fontFamily: 'Inter',
    fontSize: 12,
  });
  expect(chartTheme.axis.lineColor).toBe('#eee');
  expect(chartTheme.axis.minorGridColor).toBe('#ddd');
  expect(chartTheme.tooltip).toEqual({ background: '#fff', color: '#111' });
  expect(chartTheme.accent).toBe('#20a7c9');
});

test('is transparent so a chart sits on the widget, not over it', () => {
  expect(getChartTheme(theme).background).toBe('transparent');
});

test('carries the active categorical scheme in order', () => {
  const { colors } = CategoricalColorNamespace.getScale();

  expect(getChartTheme(theme).categoricalColors).toEqual(colors);
  expect(colors.length).toBeGreaterThan(0);
});

test('exposes the registered sequential scheme for continuous colour', () => {
  const registry = getSequentialSchemeRegistry();
  registry.registerValue(
    'test_ramp',
    new SequentialScheme({
      id: 'test_ramp',
      colors: ['#fff', '#888', '#000'],
    }),
  );
  registry.setDefaultKey('test_ramp');

  // The whole reason this field exists: nothing was exposing Superset's
  // sequential schemes, so a heatmap in a widget fell back to its library's own
  // ramp — the most visible mismatch available.
  expect(getChartTheme(theme).sequentialColors).toEqual([
    '#fff',
    '#888',
    '#000',
  ]);
});

test('reports no sequential colours rather than inventing a ramp', () => {
  const registry = getSequentialSchemeRegistry();
  jest.spyOn(registry, 'get').mockReturnValue(undefined);

  // A renderer that gets nothing keeps its own default, which beats a
  // Superset-looking ramp no Superset chart actually uses.
  expect(getChartTheme(theme).sequentialColors).toEqual([]);

  jest.restoreAllMocks();
});

test('gives a label the same colour whatever order a chart lists it in', () => {
  const chartTheme = getChartTheme(theme);

  const first = chartTheme.getColor('EMEA');
  chartTheme.getColor('APAC');

  // The point of asking by name: a second chart that lists EMEA after APAC
  // still draws it in the colour the first one used.
  expect(getChartTheme(theme).getColor('EMEA')).toBe(first);
});

test('takes the canvas own scheme when it has one', () => {
  getCategoricalSchemeRegistry().registerValue(
    'test_palette',
    new CategoricalScheme({
      id: 'test_palette',
      colors: ['#010101', '#020202'],
    }),
  );

  // A canvas that picked a palette gets that palette rather than the
  // deployment default — which is what makes the Styling section's colour
  // scheme field mean anything, having been written and read by nothing.
  expect(getChartTheme(theme, 'test_palette').categoricalColors).toEqual([
    '#010101',
    '#020202',
  ]);
});
