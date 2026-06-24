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

import { NativeFilterType } from '@superset-ui/core';
import { getInitialDataMask } from 'src/dataMask/reducer';
import type { NativeFiltersFormItem } from 'src/dashboard/components/nativeFilters/FiltersConfigModal/types';
import { transformFilterForSave } from 'src/dashboard/components/nativeFilters/FiltersConfigModal/transformers';

const createTimeGrainFormInput = (
  timeGrains?: string[],
): NativeFiltersFormItem => ({
  type: NativeFilterType.NativeFilter,
  scope: {
    rootPath: ['ROOT_ID'],
    excluded: [],
  },
  name: 'Time Grain',
  filterType: 'filter_timegrain',
  dataset: {
    value: 10,
    label: 'main.dataset',
  },
  column: 'dttm',
  controlValues: {},
  requiredFirst: {},
  defaultValue: null,
  defaultDataMask: getInitialDataMask(),
  sortMetric: null,
  time_grains: timeGrains,
  description: '',
});

test('transformFilterForSave persists time_grains when a subset is selected', () => {
  const transformed = transformFilterForSave(
    'NATIVE_FILTER-subset',
    createTimeGrainFormInput(['PT1H', 'P1D', 'P1W']),
  );

  expect(transformed).toBeDefined();
  expect(transformed && 'time_grains' in transformed).toBe(true);
  expect(transformed && transformed.type).toBe(NativeFilterType.NativeFilter);
  expect(
    transformed && 'time_grains' in transformed
      ? transformed.time_grains
      : undefined,
  ).toEqual(['PT1H', 'P1D', 'P1W']);
});

test('transformFilterForSave omits time_grains from API payload when all are selected', () => {
  const transformed = transformFilterForSave(
    'NATIVE_FILTER-all',
    createTimeGrainFormInput(undefined),
  );

  expect(transformed).toBeDefined();
  expect(
    transformed && 'time_grains' in transformed
      ? transformed.time_grains
      : undefined,
  ).toBeUndefined();

  // API boundary: undefined keys are omitted from JSON payloads.
  const serialized = JSON.parse(JSON.stringify(transformed));
  expect(serialized).not.toHaveProperty('time_grains');
});

test('transformFilterForSave remains backward compatible when time_grains is missing', () => {
  const formInput = createTimeGrainFormInput();
  delete (formInput as Partial<NativeFiltersFormItem>).time_grains;

  const transformed = transformFilterForSave('NATIVE_FILTER-legacy', formInput);

  expect(transformed).toBeDefined();
  expect(
    transformed && 'time_grains' in transformed
      ? transformed.time_grains
      : undefined,
  ).toBeUndefined();

  const serialized = JSON.parse(JSON.stringify(transformed));
  expect(serialized).not.toHaveProperty('time_grains');
});

test('transformFilterForSave omits time_grains when an empty array is provided', () => {
  const transformed = transformFilterForSave(
    'NATIVE_FILTER-empty-array',
    createTimeGrainFormInput([]),
  );

  expect(transformed).toBeDefined();
  expect(
    transformed && 'time_grains' in transformed
      ? transformed.time_grains
      : undefined,
  ).toBeUndefined();

  // API boundary: empty allowlist should behave like unrestricted and be omitted.
  const serialized = JSON.parse(JSON.stringify(transformed));
  expect(serialized).not.toHaveProperty('time_grains');
});
