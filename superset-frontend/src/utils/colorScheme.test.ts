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
  getLabelsColorMap,
} from '@superset-ui/core';
import {
  applyColors,
  enforceSharedLabelsColorsArray,
  getColorNamespace,
  getColorSchemeDomain,
  getDynamicLabelsColors,
  getFreshLabelsColorMapEntries,
  getFreshSharedLabels,
  getSharedLabelsColorMapEntries,
  isLabelsColorMapSynced,
  refreshLabelsColorMap,
  resetColors,
} from './colorScheme';

const registry = getCategoricalSchemeRegistry();

beforeEach(() => {
  registry.clear();
  registry.registerValue(
    'SUPERSET_DEFAULT',
    new CategoricalScheme({
      id: 'SUPERSET_DEFAULT',
      colors: ['#111111', '#222222', '#333333'],
    }),
  );
  getLabelsColorMap().reset();
  CategoricalColorNamespace.getNamespace().resetColors();
});

test('getColorNamespace falls back to the global namespace for falsy values', () => {
  expect(getColorNamespace('')).toBeUndefined();
  expect(getColorNamespace(undefined)).toBeUndefined();
  expect(getColorNamespace('custom-namespace')).toBe('custom-namespace');
});

test('enforceSharedLabelsColorsArray returns an empty array for legacy non-array values', () => {
  expect(enforceSharedLabelsColorsArray(['Alpha', 'Beta'])).toEqual([
    'Alpha',
    'Beta',
  ]);
  // the field used to be a dict keyed by label; that shape must not leak through
  expect(enforceSharedLabelsColorsArray({ Alpha: '#111111' })).toEqual([]);
  expect(enforceSharedLabelsColorsArray(undefined)).toEqual([]);
});

test('getFreshSharedLabels merges stored shared labels with labels reused across charts', () => {
  const labelsColorMap = getLabelsColorMap();
  labelsColorMap.addSlice('Alpha', '#111111', 1);
  labelsColorMap.addSlice('Alpha', '#111111', 2); // reused by a second chart
  labelsColorMap.addSlice('Beta', '#222222', 1); // used by only one chart

  const freshShared = getFreshSharedLabels(['Gamma']);

  expect(freshShared.sort()).toEqual(['Alpha', 'Gamma'].sort());
});

test('getSharedLabelsColorMapEntries keeps only the labels marked as shared', () => {
  const fullLabelsColor = { Alpha: '#111111', Beta: '#222222' };

  expect(getSharedLabelsColorMapEntries(fullLabelsColor, ['Alpha'])).toEqual({
    Alpha: '#111111',
  });
  expect(getSharedLabelsColorMapEntries(fullLabelsColor, [])).toEqual({});
});

test('getFreshLabelsColorMapEntries excludes labels overridden by custom label colors', () => {
  getLabelsColorMap().addSlice('Alpha', '#custom', 1);
  getLabelsColorMap().addSlice('Beta', '#222222', 1);

  const entries = getFreshLabelsColorMapEntries({ Alpha: '#custom' });

  expect(entries).toEqual({ Beta: '#222222' });
});

test('getDynamicLabelsColors omits the custom label color keys from the full map', () => {
  const fullLabelsColors = { Alpha: '#111111', Beta: '#222222' };

  expect(
    getDynamicLabelsColors(fullLabelsColors, { Alpha: '#custom' }),
  ).toEqual({ Beta: '#222222' });
});

test('getColorSchemeDomain returns the registered scheme, falls back to the default scheme, or [] when none is registered', () => {
  registry.registerValue(
    'scheme-a',
    new CategoricalScheme({ id: 'scheme-a', colors: ['#a1', '#a2'] }),
  );

  expect(getColorSchemeDomain('scheme-a')).toEqual(['#a1', '#a2']);

  // an unknown scheme (e.g. one removed after the dashboard was saved) falls
  // back to the default scheme
  expect(getColorSchemeDomain('does-not-exist')).toEqual([
    '#111111',
    '#222222',
    '#333333',
  ]);

  // no scheme registered at all: there is nothing to fall back to
  registry.clear();
  expect(getColorSchemeDomain('does-not-exist')).toEqual([]);
});

test('isLabelsColorMapSynced ignores drift on custom labels but detects it elsewhere', () => {
  const stored = { Alpha: '#111111', Beta: '#222222', Custom: '#999999' };
  const freshInSync = { Alpha: '#111111', Beta: '#222222', Custom: '#000000' };
  const freshDrifted = {
    Alpha: '#111111',
    Beta: '#changed',
    Custom: '#000000',
  };

  expect(isLabelsColorMapSynced(stored, freshInSync, { Custom: '' })).toBe(
    true,
  );
  expect(isLabelsColorMapSynced(stored, freshDrifted, { Custom: '' })).toBe(
    false,
  );
});

test('resetColors wipes both the forced namespace colors and the labels color map', () => {
  const namespace = 'ns-reset';
  CategoricalColorNamespace.getNamespace(namespace).setColor(
    'Alpha',
    '#custom',
  );
  getLabelsColorMap().addSlice('Alpha', '#abcabc', 1);

  resetColors(namespace);

  expect(CategoricalColorNamespace.getNamespace(namespace).forcedItems).toEqual(
    {},
  );
  expect(getLabelsColorMap().getColorMap().size).toBe(0);
  expect(getLabelsColorMap().chartsLabelsMap.size).toBe(0);
});

test('refreshLabelsColorMap lets a dashboard-level scheme override a chart own scheme', () => {
  const namespace = 'ns-scheme-precedence';
  registry.registerValue(
    'chart-scheme',
    new CategoricalScheme({ id: 'chart-scheme', colors: ['#chartcolor'] }),
  );
  registry.registerValue(
    'dashboard-scheme',
    new CategoricalScheme({ id: 'dashboard-scheme', colors: ['#dashcolor'] }),
  );
  const labelsColorMap = getLabelsColorMap();
  labelsColorMap.addSlice('Alpha', '#ignored', 1, 'chart-scheme');
  labelsColorMap.setOwnColorScheme(1, 'chart-scheme');

  // a dashboard-level scheme wins over the chart's own scheme
  refreshLabelsColorMap(namespace, 'dashboard-scheme');
  expect(labelsColorMap.getColorMap().get('Alpha')).toBe('#dashcolor');

  // once no dashboard scheme is set, the chart falls back to its own scheme
  refreshLabelsColorMap(namespace, undefined);
  expect(labelsColorMap.getColorMap().get('Alpha')).toBe('#chartcolor');
});

test('applyColors always lets custom label_colors win over shared label colors', () => {
  const namespace = 'ns-custom-over-shared';
  const metadata = {
    color_namespace: namespace,
    map_label_colors: { Alpha: '#111111', Beta: '#222222' },
    shared_label_colors: ['Alpha', 'Beta'],
    label_colors: { Alpha: '#custom' },
  };

  applyColors(metadata, false, false, true);

  const { forcedItems } = CategoricalColorNamespace.getNamespace(namespace);
  expect(forcedItems.Alpha).toBe('#custom');
  expect(forcedItems.Beta).toBe('#222222');
});

test('applyColors with the shared flag only applies colors for shared labels', () => {
  const namespace = 'ns-shared-only';
  const metadata = {
    color_namespace: namespace,
    map_label_colors: { Alpha: '#111111', Gamma: '#333333' },
    shared_label_colors: ['Alpha'],
  };

  applyColors(metadata, false, false, true);

  const { forcedItems } = CategoricalColorNamespace.getNamespace(namespace);
  expect(forcedItems.Alpha).toBe('#111111');
  expect(forcedItems.Gamma).toBeUndefined();
});

test('applyColors with a fresh label list only resets the targeted labels', () => {
  const namespace = 'ns-fresh-array';
  const categoricalNamespace =
    CategoricalColorNamespace.getNamespace(namespace);
  categoricalNamespace.setColor('A', '#oldA');
  categoricalNamespace.setColor('B', '#oldB');

  const metadata = { color_namespace: namespace };
  applyColors(metadata, ['A'], false, false);

  const { forcedItems } = categoricalNamespace;
  expect(forcedItems.A).toBeUndefined();
  expect(forcedItems.B).toBe('#oldB');
});
