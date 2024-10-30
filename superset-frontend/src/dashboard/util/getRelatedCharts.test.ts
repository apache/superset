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
import { getRelatedCharts } from './getRelatedCharts';

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

  const result = getRelatedCharts(filters, null, slices);
  expect(result).toEqual({
    filterKey1: [1, 2, 3],
  });
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

  const result = getRelatedCharts(filters, null, slices);
  expect(result).toEqual({
    filterKey1: [1, 3],
  });
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

  const result = getRelatedCharts(filters, null, slices);
  expect(result).toEqual({
    '3': [1, 2],
  });
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

  const result = getRelatedCharts(filters, null, slices);
  expect(result).toEqual({
    '1': [2],
  });
});
