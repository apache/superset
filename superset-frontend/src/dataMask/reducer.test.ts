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

import reducer, { getInitialDataMask } from './reducer';
import {
  SET_DATA_MASK_FOR_FILTER_CHANGES_COMPLETE,
  type SetDataMaskForFilterChangesComplete,
} from './actions';
import {
  type DataMaskStateWithId,
  type Filter,
  type NativeFilterTarget,
  NativeFilterType,
} from '@superset-ui/core';

// Helper to create minimal filter for testing
const createFilter = (
  id: string,
  columnName = 'col',
  controlValues = {},
): Filter =>
  ({
    id,
    name: id,
    type: NativeFilterType.NativeFilter,
    scope: { rootPath: [], excluded: [] },
    chartsInScope: [],
    tabsInScope: [],
    controlValues,
    filterType: 'filter_select',
    targets: [{ column: { name: columnName } } as NativeFilterTarget],
    defaultDataMask: { filterState: { value: undefined } },
    cascadeParentIds: [],
    description: '',
  }) satisfies Partial<Filter> as Filter;

// Helper to create action for filter modification
const createModifyAction = (
  modifiedFilter: Filter,
  oldFilters = {},
): SetDataMaskForFilterChangesComplete => ({
  type: SET_DATA_MASK_FOR_FILTER_CHANGES_COMPLETE,
  filterChanges: {
    deleted: [],
    reordered: [],
    modified: [modifiedFilter],
  },
  filters: oldFilters,
});

test('when user edits a filter and changes targets, other filters maintain their selected values', () => {
  const initialState: DataMaskStateWithId = {
    'NATIVE_FILTER-1': {
      id: 'NATIVE_FILTER-1',
      ...getInitialDataMask('NATIVE_FILTER-1'),
      filterState: { value: ['foo'] },
    },
    'NATIVE_FILTER-2': {
      id: 'NATIVE_FILTER-2',
      ...getInitialDataMask('NATIVE_FILTER-2'),
      filterState: { value: ['bar'] },
    },
  };

  const action = createModifyAction(
    createFilter('NATIVE_FILTER-1', 'col_changed'),
  );

  const result = reducer(initialState, action);

  expect(result['NATIVE_FILTER-2']?.filterState?.value).toEqual(['bar']);
  expect(result['NATIVE_FILTER-1']?.filterState?.value).toBeUndefined();
});

test('when user edits a filter without changing targets, their selection is preserved', () => {
  const initialState: DataMaskStateWithId = {
    'NATIVE_FILTER-1': {
      id: 'NATIVE_FILTER-1',
      ...getInitialDataMask('NATIVE_FILTER-1'),
      extraFormData: { time_range: '1 year ago' },
      filterState: { value: ['foo'] },
    },
  };

  const oldFilters = {
    'NATIVE_FILTER-1': createFilter('NATIVE_FILTER-1', 'col_a', {
      enableEmptyFilter: true,
    }),
  };

  const action = createModifyAction(
    createFilter('NATIVE_FILTER-1', 'col_a', { enableEmptyFilter: true }),
    oldFilters,
  );

  const result = reducer(initialState, action);

  expect(result['NATIVE_FILTER-1']?.filterState?.value).toEqual(['foo']);
  expect(result['NATIVE_FILTER-1']?.extraFormData?.time_range).toEqual(
    '1 year ago',
  );
});
