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
  DatasourceType,
  Filter,
  NativeFilterType,
} from '@superset-ui/core';
import { DatasourcesState } from '../types';
import { getRelatedCharts } from './getRelatedCharts';

const slices = {
  '1': { datasource: 'ds1', slice_id: 1 },
  '2': { datasource: 'ds2', slice_id: 2 },
  '3': { datasource: 'ds1', slice_id: 3 },
} as any;

const datasources: DatasourcesState = {
  ds1: {
    uid: 'ds1',
    datasource_name: 'ds1',
    table_name: 'table1',
    description: '',
    id: 100,
    columns: [{ column_name: 'column1' }, { column_name: 'column2' }],
    column_names: ['column1', 'column2'],
    column_types: [],
    type: DatasourceType.Table,
    metrics: [],
    column_formats: {},
    currency_formats: {},
    verbose_map: {},
    main_dttm_col: '',
    filter_select_enabled: true,
  },
  ds2: {
    uid: 'ds2',
    datasource_name: 'ds2',
    table_name: 'table2',
    description: '',
    id: 200,
    columns: [{ column_name: 'column3' }, { column_name: 'column4' }],
    column_names: ['column3', 'column4'],
    column_types: [],
    type: DatasourceType.Table,
    metrics: [],
    column_formats: {},
    currency_formats: {},
    verbose_map: {},
    main_dttm_col: '',
    filter_select_enabled: true,
  },
};

test('Return chart ids matching the dataset id with native filter', () => {
  const filters = {
    filterKey1: {
      filterType: 'filter_select',
      chartsInScope: [1, 2],
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

  const result = getRelatedCharts(filters, null, slices, datasources);
  expect(result).toEqual({
    filterKey1: [1],
  });
});

test('Return chart ids matching the dataset id with cross filter', () => {
  const filters = {
    '3': {
      filterType: undefined,
      scope: [1, 2],
      targets: [],
      values: null,
    } as AppliedCrossFilterType,
  };

  const result = getRelatedCharts(filters, null, slices, datasources);
  expect(result).toEqual({
    '3': [1],
  });
});

test('Return chart ids matching the column name with native filter', () => {
  const filters = {
    filterKey1: {
      filterType: 'filter_select',
      chartsInScope: [1, 2],
      scope: {
        excluded: [],
        rootPath: [],
      },
      targets: [
        {
          column: { name: 'column3' },
          datasetId: 999,
        },
      ],
      type: NativeFilterType.NativeFilter,
    } as unknown as Filter,
  };

  const result = getRelatedCharts(filters, null, slices, datasources);
  expect(result).toEqual({
    filterKey1: [2],
  });
});

test('Return chart ids matching the column name with cross filter', () => {
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

  const result = getRelatedCharts(filters, null, slices, datasources);
  expect(result).toEqual({
    '1': [2],
  });
});

test('Return chart ids when column display name matches with native filter', () => {
  const filters = {
    filterKey1: {
      filterType: 'filter_select',
      chartsInScope: [1, 2],
      scope: {
        excluded: [],
        rootPath: [],
      },
      targets: [
        {
          column: { name: 'column4', displayName: 'column4' },
          datasetId: 999,
        },
      ],
      type: NativeFilterType.NativeFilter,
    } as unknown as Filter,
  };

  const result = getRelatedCharts(filters, null, slices, datasources);
  expect(result).toEqual({
    filterKey1: [2],
  });
});

test('Return chart ids when column display name matches with cross filter', () => {
  const filters = {
    '1': {
      filterType: undefined,
      scope: [1, 2],
      targets: [],
      values: {
        filters: [{ col: 'column4' }],
      },
    } as AppliedCrossFilterType,
  };

  const result = getRelatedCharts(filters, null, slices, datasources);
  expect(result).toEqual({
    '1': [2],
  });
});

test('Return scope when filterType is not filter_select', () => {
  const filters = {
    filterKey1: {
      filterType: 'filter_time',
      chartsInScope: [3, 4],
    } as Filter,
  };

  const result = getRelatedCharts(filters, null, slices, datasources);
  expect(result).toEqual({
    filterKey1: [3, 4],
  });
});

test('Return an empty array if no matching charts found with native filter', () => {
  const filters = {
    filterKey1: {
      filterType: 'filter_select',
      chartsInScope: [1, 2],
      scope: {
        excluded: [],
        rootPath: [],
      },
      targets: [
        {
          column: { name: 'nonexistent_column' },
          datasetId: 300,
        },
      ],
      type: NativeFilterType.NativeFilter,
    } as unknown as Filter,
  };

  const result = getRelatedCharts(filters, null, slices, datasources);
  expect(result).toEqual({
    filterKey1: [],
  });
});

test('Return an empty array if no matching charts found with cross filter', () => {
  const filters = {
    '1': {
      filterType: undefined,
      scope: [1, 2],
      targets: [],
      values: {
        filters: [{ col: 'nonexistent_column' }],
      },
    } as AppliedCrossFilterType,
  };

  const result = getRelatedCharts(filters, null, slices, datasources);
  expect(result).toEqual({
    '1': [],
  });
});
