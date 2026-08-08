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
import { Filter, NativeFilterType } from '@superset-ui/core';
import { NativeFiltersFormItem } from '../types';
import { transformFilterForSave } from './filterTransformer';

const baseFormItem = {
  type: NativeFilterType.NativeFilter,
  scope: { rootPath: ['ROOT_ID'], excluded: [] },
  controlValues: {},
  requiredFirst: {},
  defaultValue: null,
  defaultDataMask: { filterState: {}, extraFormData: {} },
  sortMetric: null,
  description: '',
  // form-only fields that must never leak into the saved filter
  defaultValueQueriesData: null,
} as unknown as NativeFiltersFormItem;

test('serializes a dataset-less filter (filter_time) into a full Filter', () => {
  // A ``filter_time`` filter has no dataset/column controls, so its form item
  // carries neither a ``dataset`` nor a ``targets`` key. It must still be
  // transformed like any other native filter rather than persisted verbatim.
  const formItem: NativeFiltersFormItem = {
    ...baseFormItem,
    name: 'Time Range',
    filterType: 'filter_time',
    dependencies: ['NATIVE_FILTER-parent'],
  };

  const result = transformFilterForSave(
    'NATIVE_FILTER-abc',
    formItem,
  ) as Filter;

  // Keys the bug used to strip are present and well-formed.
  expect(result.targets).toEqual([{}]);
  expect(result.defaultDataMask).toBeDefined();
  expect(result.cascadeParentIds).toEqual(['NATIVE_FILTER-parent']);

  // Form-only keys must not leak into the persisted config.
  expect(result).not.toHaveProperty('defaultValueQueriesData');
  expect(result).not.toHaveProperty('dependencies');
  // Empty requiredFirst collapses to undefined instead of the raw form object.
  expect(result.requiredFirst).toBeUndefined();

  expect(result.name).toBe('Time Range');
  expect(result.filterType).toBe('filter_time');
});

test('serializes a dataset-backed filter (filter_select) into a full Filter', () => {
  const formItem: NativeFiltersFormItem = {
    ...baseFormItem,
    name: 'Region',
    filterType: 'filter_select',
    dataset: { value: 42, label: 'sales' },
    column: 'region',
    dependencies: [],
  };

  const result = transformFilterForSave(
    'NATIVE_FILTER-def',
    formItem,
  ) as Filter;

  expect(result.targets).toEqual([
    { datasetId: 42, column: { name: 'region' } },
  ]);
  expect(result.defaultDataMask).toBeDefined();
  expect(result.cascadeParentIds).toEqual([]);
  expect(result).not.toHaveProperty('defaultValueQueriesData');
});

test('passes an already-saved Filter through untouched (aside from trimming)', () => {
  // Values coming from the stored filter config map (e.g. cascade-parent
  // cleanup) already carry a ``targets`` array and must be preserved as-is.
  const savedFilter: Filter = {
    id: 'NATIVE_FILTER-ghi',
    name: 'Time Range',
    filterType: 'filter_time',
    type: NativeFilterType.NativeFilter,
    targets: [{}],
    defaultDataMask: { filterState: {}, extraFormData: {} },
    cascadeParentIds: ['NATIVE_FILTER-parent'],
    controlValues: {},
    scope: { rootPath: ['ROOT_ID'], excluded: [] },
    description: '  needs trim  ',
    chartsInScope: [1, 2],
    tabsInScope: ['TAB-1'],
  };

  const result = transformFilterForSave(
    'NATIVE_FILTER-ghi',
    savedFilter,
  ) as Filter;

  expect(result.targets).toEqual([{}]);
  expect(result.cascadeParentIds).toEqual(['NATIVE_FILTER-parent']);
  expect(result.chartsInScope).toEqual([1, 2]);
  expect(result.tabsInScope).toEqual(['TAB-1']);
  expect(result.description).toBe('needs trim');
});
