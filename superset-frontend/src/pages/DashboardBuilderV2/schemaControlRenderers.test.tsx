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
import { loadDatasetOptions } from 'src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigForm/DatasetSelect';
import {
  columnOptions,
  disallowsAdhocMetrics,
  isUnrepresentableMetric,
  loadDatasetOnlyOptions,
  metricOptions,
  resolveDatasetPick,
  seriesDefaults,
  toDatasetSelectValue,
} from './schemaControlRenderers';

jest.mock(
  'src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigForm/DatasetSelect',
  () => ({
    ...jest.requireActual(
      'src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigForm/DatasetSelect',
    ),
    loadDatasetOptions: jest.fn(),
  }),
);

const mockedLoadDatasetOptions = loadDatasetOptions as jest.MockedFunction<
  typeof loadDatasetOptions
>;

beforeEach(() => {
  mockedLoadDatasetOptions.mockReset();
});

test('columnOptions filters by x-column-types when given', () => {
  const metadata = {
    columns: [
      { name: 'region', type: 1, verboseName: 'Region' },
      { name: 'sales', type: 0, verboseName: 'Sales' },
    ],
    metrics: [],
  };
  expect(columnOptions(metadata, ['numeric']).map(o => o.value)).toEqual([
    'sales',
  ]);
});

test('columnOptions returns every column when no x-column-types hint is given', () => {
  const metadata = {
    columns: [
      { name: 'region', type: 1, verboseName: 'Region' },
      { name: 'sales', type: 0, verboseName: 'Sales' },
    ],
    metrics: [],
  };
  expect(columnOptions(metadata, undefined).map(o => o.value)).toEqual([
    'region',
    'sales',
  ]);
});

test('columnOptions returns an empty list when metadata has not loaded yet', () => {
  expect(columnOptions(null, undefined)).toEqual([]);
});

test("metricOptions lists the dataset's saved metrics by verbose name", () => {
  const metadata = {
    columns: [],
    metrics: [{ name: 'count', verboseName: 'Count' }],
  };
  expect(metricOptions(metadata).map(o => o.value)).toEqual(['count']);
});

test('isUnrepresentableMetric is false for a saved-metric-name string', () => {
  expect(isUnrepresentableMetric('count')).toBe(false);
});

test('isUnrepresentableMetric is false for a structurally valid ad-hoc metric object', () => {
  expect(
    isUnrepresentableMetric({ expressionType: 'SIMPLE', aggregate: 'SUM' }),
  ).toBe(false);
  expect(
    isUnrepresentableMetric({
      expressionType: 'SQL',
      sqlExpression: 'COUNT(*)',
    }),
  ).toBe(false);
});

test('isUnrepresentableMetric is true for a value that is neither a string nor metric-shaped', () => {
  expect(isUnrepresentableMetric(42)).toBe(true);
  expect(isUnrepresentableMetric(null)).toBe(true);
  expect(isUnrepresentableMetric(['not', 'a', 'metric'])).toBe(true);
  expect(isUnrepresentableMetric({ unrelated: 'shape' })).toBe(true);
});

test('disallowsAdhocMetrics is false when metadata has no extra JSON', () => {
  expect(disallowsAdhocMetrics({ columns: [], metrics: [] })).toBe(false);
});

test('disallowsAdhocMetrics reads the dataset extra JSON flag', () => {
  expect(
    disallowsAdhocMetrics({
      columns: [],
      metrics: [],
      extra: '{"disallow_adhoc_metrics": true}',
    }),
  ).toBe(true);
  expect(
    disallowsAdhocMetrics({
      columns: [],
      metrics: [],
      extra: '{"disallow_adhoc_metrics": false}',
    }),
  ).toBe(false);
});

test('disallowsAdhocMetrics fails open (false) on malformed extra JSON', () => {
  expect(
    disallowsAdhocMetrics({ columns: [], metrics: [], extra: 'not json' }),
  ).toBe(false);
});

test('toDatasetSelectValue is undefined when no dataset is bound', () => {
  expect(toDatasetSelectValue(undefined, undefined, false)).toBeUndefined();
});

test('toDatasetSelectValue uses the resolved table name as the label', () => {
  expect(toDatasetSelectValue(3, 'sales', false)).toEqual({
    label: 'sales',
    value: 3,
  });
});

test('toDatasetSelectValue returns the bare id while the name is not yet resolved, not a stale labeled value', () => {
  expect(toDatasetSelectValue(3, undefined, false)).toBe(3);
});

test('toDatasetSelectValue composite-encodes the value when Semantic Layers is on, matching how loadDatasetOptions encodes its own options', () => {
  expect(toDatasetSelectValue(3, 'sales', true)).toEqual({
    label: 'sales',
    value: 'ds:3',
  });
});

test('toDatasetSelectValue composite-encodes the bare id too, independent of whether the label has resolved', () => {
  expect(toDatasetSelectValue(3, undefined, true)).toBe('ds:3');
});

test('resolveDatasetPick passes a plain numeric value through unchanged', () => {
  expect(resolveDatasetPick(3)).toBe(3);
});

test('resolveDatasetPick decodes a composite dataset id', () => {
  expect(resolveDatasetPick('ds:3')).toBe(3);
});

test('resolveDatasetPick rejects a semantic view — datasetId has no way to represent one', () => {
  expect(resolveDatasetPick('sv:3')).toBeUndefined();
});

test('resolveDatasetPick passes undefined through (nothing picked)', () => {
  expect(resolveDatasetPick(undefined)).toBeUndefined();
});

test('loadDatasetOnlyOptions returns a page as-is once it has surviving datasets', async () => {
  mockedLoadDatasetOptions.mockResolvedValueOnce({
    data: [
      { label: 'sales', value: 'ds:1', table_name: 'sales', kind: 'dataset' },
    ],
    totalCount: 1,
  });
  const result = await loadDatasetOnlyOptions('', 0, 25);
  expect(result).toEqual({
    data: [
      { label: 'sales', value: 'ds:1', table_name: 'sales', kind: 'dataset' },
    ],
    totalCount: 1,
  });
  expect(mockedLoadDatasetOptions).toHaveBeenCalledTimes(1);
});

test('loadDatasetOnlyOptions pages forward internally past a page that filters down to empty', async () => {
  mockedLoadDatasetOptions
    .mockResolvedValueOnce({
      data: [
        {
          label: 'view',
          value: 'sv:1',
          table_name: 'view',
          kind: 'semantic_view',
        },
      ],
      totalCount: 3,
    })
    .mockResolvedValueOnce({
      data: [
        { label: 'sales', value: 'ds:2', table_name: 'sales', kind: 'dataset' },
      ],
      totalCount: 3,
    });
  const result = await loadDatasetOnlyOptions('', 0, 1);
  expect(result).toEqual({
    data: [
      { label: 'sales', value: 'ds:2', table_name: 'sales', kind: 'dataset' },
    ],
    totalCount: 3,
  });
  expect(mockedLoadDatasetOptions).toHaveBeenCalledTimes(2);
  expect(mockedLoadDatasetOptions).toHaveBeenNthCalledWith(1, '', 0, 1);
  expect(mockedLoadDatasetOptions).toHaveBeenNthCalledWith(2, '', 1, 1);
});

test('loadDatasetOnlyOptions stops once the underlying result set itself runs out, even if still empty', async () => {
  mockedLoadDatasetOptions.mockResolvedValueOnce({
    data: [
      {
        label: 'view',
        value: 'sv:1',
        table_name: 'view',
        kind: 'semantic_view',
      },
    ],
    totalCount: 1,
  });
  const result = await loadDatasetOnlyOptions('', 0, 1);
  expect(result).toEqual({ data: [], totalCount: 1 });
  expect(mockedLoadDatasetOptions).toHaveBeenCalledTimes(1);
});

test("seriesDefaults reads a not-yet-customized entry's own palette-defaulted color and size", () => {
  expect(
    seriesDefaults(
      {
        properties: {
          color: { default: '#3498db' },
          sizeScale: { default: 1 },
        },
      },
      '#000000',
    ),
  ).toEqual({ color: '#3498db', sizeScale: 1 });
});

test('seriesDefaults reads whatever fields the entry schema declares, nothing hard-coded', () => {
  expect(
    seriesDefaults(
      {
        properties: {
          visible: { default: true },
          displayName: { default: '' },
        },
      },
      '#000000',
    ),
  ).toEqual({ visible: true, displayName: '' });
});

test('seriesDefaults falls back to the given color only when the entry schema declares a color field', () => {
  expect(seriesDefaults({ properties: { color: {} } }, '#123456')).toEqual({
    color: '#123456',
  });
});

test('seriesDefaults returns an empty object when there is no entry schema at all', () => {
  expect(seriesDefaults(undefined, '#123456')).toEqual({});
});
