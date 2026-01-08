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
  Filter,
  NativeFilterType,
} from '@superset-ui/core';
import { ChartCustomizationItem } from 'src/dashboard/components/nativeFilters/ChartCustomization/types';
import {
  getRelatedCharts,
  getAffectedChartIdsFromCustomizations,
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

const slicesWithMultipleDatasets = {
  '1': { datasource: '100__table', slice_id: 1 },
  '2': { datasource: '100__table', slice_id: 2 },
  '3': { datasource: '200__table', slice_id: 3 },
  '4': { datasource: '200__table', slice_id: 4 },
  '5': { datasource: '300__table', slice_id: 5 },
} as any;

test('Returns empty array for empty customizations', () => {
  const customizations: ChartCustomizationItem[] = [];
  const result = getAffectedChartIdsFromCustomizations(
    customizations,
    slicesWithMultipleDatasets,
  );
  expect(result).toEqual([]);
});

test('Returns chart ID when customization has specific chartId', () => {
  const customizations: ChartCustomizationItem[] = [
    {
      id: 'custom1',
      chartId: 1,
      customization: {
        name: 'Custom 1',
        dataset: null,
        column: null,
      },
    },
  ];
  const result = getAffectedChartIdsFromCustomizations(
    customizations,
    slicesWithMultipleDatasets,
  );
  expect(result).toEqual([1]);
});

test('Returns all charts matching dataset when customization has dataset', () => {
  const customizations: ChartCustomizationItem[] = [
    {
      id: 'custom1',
      customization: {
        name: 'Custom 1',
        dataset: '100',
        column: 'column1',
      },
    },
  ];
  const result = getAffectedChartIdsFromCustomizations(
    customizations,
    slicesWithMultipleDatasets,
  );
  expect(result).toEqual([1, 2]);
});

test('Returns empty array when customization has no chartId and no dataset', () => {
  const customizations: ChartCustomizationItem[] = [
    {
      id: 'custom1',
      customization: {
        name: 'Custom 1',
        dataset: null,
        column: null,
      },
    },
  ];
  const result = getAffectedChartIdsFromCustomizations(
    customizations,
    slicesWithMultipleDatasets,
  );
  expect(result).toEqual([]);
});

test('Returns unique chart IDs when multiple customizations affect same charts', () => {
  const customizations: ChartCustomizationItem[] = [
    {
      id: 'custom1',
      chartId: 1,
      customization: {
        name: 'Custom 1',
        dataset: null,
        column: null,
      },
    },
    {
      id: 'custom2',
      customization: {
        name: 'Custom 2',
        dataset: '100',
        column: 'column1',
      },
    },
    {
      id: 'custom3',
      chartId: 1,
      customization: {
        name: 'Custom 3',
        dataset: null,
        column: null,
      },
    },
  ];
  const result = getAffectedChartIdsFromCustomizations(
    customizations,
    slicesWithMultipleDatasets,
  );
  expect(result).toEqual([1, 2]);
});

test('Returns charts from multiple different datasets', () => {
  const customizations: ChartCustomizationItem[] = [
    {
      id: 'custom1',
      customization: {
        name: 'Custom 1',
        dataset: '100',
        column: 'column1',
      },
    },
    {
      id: 'custom2',
      customization: {
        name: 'Custom 2',
        dataset: '200',
        column: 'column2',
      },
    },
  ];
  const result = getAffectedChartIdsFromCustomizations(
    customizations,
    slicesWithMultipleDatasets,
  );
  expect(result).toEqual([1, 2, 3, 4]);
});

test('Handles mixed customizations with chartId and dataset', () => {
  const customizations: ChartCustomizationItem[] = [
    {
      id: 'custom1',
      chartId: 5,
      customization: {
        name: 'Custom 1',
        dataset: null,
        column: null,
      },
    },
    {
      id: 'custom2',
      customization: {
        name: 'Custom 2',
        dataset: '100',
        column: 'column1',
      },
    },
  ];
  const result = getAffectedChartIdsFromCustomizations(
    customizations,
    slicesWithMultipleDatasets,
  );
  expect(result).toEqual([5, 1, 2]);
});

test('Handles dataset as number', () => {
  const customizations: ChartCustomizationItem[] = [
    {
      id: 'custom1',
      customization: {
        name: 'Custom 1',
        dataset: 100,
        column: 'column1',
      },
    },
  ];
  const result = getAffectedChartIdsFromCustomizations(
    customizations,
    slicesWithMultipleDatasets,
  );
  expect(result).toEqual([1, 2]);
});

test('Handles dataset as DatasetReference object', () => {
  const customizations: ChartCustomizationItem[] = [
    {
      id: 'custom1',
      customization: {
        name: 'Custom 1',
        dataset: { value: 100 },
        column: 'column1',
      },
    },
  ];
  const result = getAffectedChartIdsFromCustomizations(
    customizations,
    slicesWithMultipleDatasets,
  );
  expect(result).toEqual([1, 2]);
});

test('Filters out slices without datasource', () => {
  const slicesWithMissingDatasource = {
    '1': { datasource: '100__table', slice_id: 1 },
    '2': { datasource: null, slice_id: 2 },
    '3': { slice_id: 3 },
  } as any;

  const customizations: ChartCustomizationItem[] = [
    {
      id: 'custom1',
      customization: {
        name: 'Custom 1',
        dataset: '100',
        column: 'column1',
      },
    },
  ];
  const result = getAffectedChartIdsFromCustomizations(
    customizations,
    slicesWithMissingDatasource,
  );
  expect(result).toEqual([1]);
});

test('Handles dataset with double underscore format correctly', () => {
  const customizations: ChartCustomizationItem[] = [
    {
      id: 'custom1',
      customization: {
        name: 'Custom 1',
        dataset: '100',
        column: 'column1',
      },
    },
  ];
  const result = getAffectedChartIdsFromCustomizations(
    customizations,
    slicesWithMultipleDatasets,
  );
  expect(result).toEqual([1, 2]);
});
