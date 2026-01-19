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
import { SET_DATA_MASK_FOR_FILTER_CHANGES_COMPLETE } from './actions';
import type {
  DataMaskStateWithId,
  Filter,
  Filters,
  DataMask,
} from '@superset-ui/core';

function makeFilter(
  id: string,
  opts: Partial<Filter> & { targets?: any } = {},
): Filter {
  return {
    id,
    name: id,
    type: 'NATIVE_FILTER',
    scope: [],
    chartsInScope: [],
    tabsInScope: [],
    controlValues: {},
    filterType: 'filter_select',
    targets: opts.targets ?? [{ column: { name: 'col' } }],
    defaultDataMask: { filterState: { value: undefined } } as DataMask,
    ...opts,
  } as unknown as Filter;
}

test('dataMask reducer: preserves other native filters when one is modified (targets changed)', () => {
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
  } as unknown as DataMaskStateWithId;

  const oldFilters: Filters = {
    'NATIVE_FILTER-1': makeFilter('NATIVE_FILTER-1', {
      targets: [{ column: { name: 'col_a' } }],
      defaultDataMask: {
        filterState: { value: undefined },
      } as unknown as DataMask,
    }),
    'NATIVE_FILTER-2': makeFilter('NATIVE_FILTER-2', {
      targets: [{ column: { name: 'col_b' } }],
      defaultDataMask: {
        filterState: { value: undefined },
      } as unknown as DataMask,
    }),
  } as unknown as Filters;

  const action = {
    type: SET_DATA_MASK_FOR_FILTER_CHANGES_COMPLETE,
    filterChanges: {
      added: [],
      deleted: [],
      modified: [
        makeFilter('NATIVE_FILTER-1', {
          targets: [{ column: { name: 'col_changed' } }], // targets changed
          defaultDataMask: { filterState: { value: undefined } } as DataMask,
        }),
      ],
    },
    filters: oldFilters,
  } as any;

  const next = reducer(initialState, action);

  // Filter 2 should be preserved entirely
  expect(next['NATIVE_FILTER-2']?.filterState?.value).toEqual(['bar']);

  // Filter 1 should be reset to default (undefined)
  expect(next['NATIVE_FILTER-1']?.filterState?.value).toBeUndefined();
});

test('dataMask reducer: preserves modified filter state when targets unchanged and allow-empty', () => {
  const initialState: DataMaskStateWithId = {
    'NATIVE_FILTER-1': {
      id: 'NATIVE_FILTER-1',
      ...getInitialDataMask('NATIVE_FILTER-1'),
      extraFormData: { append_form_data: { since: '1 year ago' } },
      filterState: { value: ['foo'] },
    },
  } as unknown as DataMaskStateWithId;

  const oldFilters: Filters = {
    'NATIVE_FILTER-1': makeFilter('NATIVE_FILTER-1', {
      targets: [{ column: { name: 'col_a' } }],
      controlValues: { enableEmptyFilter: true },
      defaultDataMask: { filterState: { value: undefined } } as DataMask,
    }),
  } as unknown as Filters;

  const action = {
    type: SET_DATA_MASK_FOR_FILTER_CHANGES_COMPLETE,
    filterChanges: {
      added: [],
      deleted: [],
      modified: [
        makeFilter('NATIVE_FILTER-1', {
          targets: [{ column: { name: 'col_a' } }], // targets unchanged
          controlValues: { enableEmptyFilter: true },
          defaultDataMask: { filterState: { value: undefined } } as DataMask,
        }),
      ],
    },
    filters: oldFilters,
  } as any;

  const next = reducer(initialState, action);

  // Filter 1 keeps its state
  expect(next['NATIVE_FILTER-1']?.filterState?.value).toEqual(['foo']);
  expect(
    (next['NATIVE_FILTER-1'] as any)?.extraFormData?.append_form_data?.since,
  ).toEqual('1 year ago');
});
