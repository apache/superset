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
  AppliedCrossFilterType,
  ChartCustomization,
  ChartCustomizationType,
  DatasourceType,
  Filter,
  NativeFilterType,
} from '@superset-ui/core';
import {
  getRelatedCharts,
  getRelatedChartsForChartCustomization,
} from './getRelatedCharts';

const slices = {
  '1': { datasource: 'ds1', slice_id: 1 },
  '2': { datasource: 'ds2', slice_id: 2 },
  '3': { datasource: 'ds1', slice_id: 3 },
} as any;

test('Return all chart ids in global scope with native filters', () => {
  const filters = {
    filterKey1: {
      filterType: 'filter_select',
      chartsInScope: [1, 2, 3],
      scope: {
        excluded: [],
        rootPath: [],
      },
      targets: [
        {
          column: { name: 'column1' },
          datasetId: 100,
        },
      ],
      type: NativeFilterType.NativeFilter,
    } as unknown as Filter,
  };

  const result = getRelatedCharts('filterKey1', filters.filterKey1, slices);
  expect(result).toEqual([1, 2, 3]);
});

test('Return only chart ids in specific scope with native filters', () => {
  const filters = {
    filterKey1: {
      filterType: 'filter_select',
      chartsInScope: [1, 3],
      scope: {
        excluded: [],
        rootPath: [],
      },
      targets: [
        {
          column: { name: 'column1' },
          datasetId: 100,
        },
      ],
      type: NativeFilterType.NativeFilter,
    } as unknown as Filter,
  };

  const result = getRelatedCharts('filterKey1', filters.filterKey1, slices);
  expect(result).toEqual([1, 3]);
});

test('Return all chart ids with cross filter in global scope', () => {
  const filters = {
    '3': {
      filterType: undefined,
      scope: [1, 2, 3],
      targets: [],
      values: null,
    } as AppliedCrossFilterType,
  };

  const result = getRelatedCharts('3', filters['3'], slices);
  expect(result).toEqual([1, 2]);
});

test('Return only chart ids in specific scope with cross filter', () => {
  const filters = {
    '1': {
      filterType: undefined,
      scope: [1, 2],
      targets: [],
      values: {
        filters: [{ col: 'column3' }],
      },
    } as AppliedCrossFilterType,
  };

  const result = getRelatedCharts('1', filters['1'], slices);
  expect(result).toEqual([2]);
});

test('getRelatedChartsForChartCustomization disambiguates by datasource type', () => {
  // Tables and semantic views have independent ID spaces, so dataset id ``1``
  // can refer to either. The customization here targets semantic view 1 and
  // must NOT match the table-1 chart even though their numeric IDs collide.
  const mixedSlices = {
    '10': { form_data: { datasource: '1__table' }, slice_id: 10 },
    '11': { form_data: { datasource: '1__semantic_view' }, slice_id: 11 },
    '12': { form_data: { datasource: '2__table' }, slice_id: 12 },
  } as any;

  const customization = {
    id: 'cust1',
    type: ChartCustomizationType.ChartCustomization,
    name: 'cust',
    filterType: 'filter_select',
    targets: [
      {
        datasetId: 1,
        datasourceType: DatasourceType.SemanticView,
        column: { name: 'col1' },
      },
    ],
    scope: { rootPath: [], excluded: [] },
    defaultDataMask: {},
    controlValues: {},
  } as unknown as ChartCustomization;

  expect(
    getRelatedChartsForChartCustomization(customization, mixedSlices),
  ).toEqual([11]);
});

test('getRelatedChartsForChartCustomization falls back to ID match when type is absent', () => {
  // Legacy customizations persisted before semantic views shipped don't
  // carry ``datasourceType``. We keep the ID-only behavior for those rather
  // than silently dropping matches.
  const mixedSlices = {
    '10': { form_data: { datasource: '1__table' }, slice_id: 10 },
    '11': { form_data: { datasource: '1__semantic_view' }, slice_id: 11 },
  } as any;

  const customization = {
    id: 'cust1',
    type: ChartCustomizationType.ChartCustomization,
    name: 'cust',
    filterType: 'filter_select',
    targets: [{ datasetId: 1, column: { name: 'col1' } }],
    scope: { rootPath: [], excluded: [] },
    defaultDataMask: {},
    controlValues: {},
  } as unknown as ChartCustomization;

  expect(
    getRelatedChartsForChartCustomization(customization, mixedSlices).sort(),
  ).toEqual([10, 11]);
});

test('getRelatedCharts returns empty array when the filter is undefined', () => {
  // A native filter can transiently disappear from the redux map (e.g. right
  // after saving a chart customization) while it is still hovered/focused.
  // Guard against reading .scope on undefined so the dashboard doesn't crash.
  expect(getRelatedCharts('missing', undefined, slices)).toEqual([]);
});
