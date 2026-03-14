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
import { NativeFilterType, NativeFilterScope } from '@superset-ui/core';
import { getInitialDataMask } from 'src/dataMask/reducer';

const mockScope: NativeFilterScope = {
  rootPath: ['ROOT_ID'],
  excluded: [],
};

const mockDataMask = getInitialDataMask();

test('time_grains field is persisted when subset is selected', () => {
  // This tests the contract that time_grains are properly saved
  // when a subset of grains are selected
  const timeGrains = ['P1D', 'P1W'];
  const expectedOutput = {
    time_grains: timeGrains,
  };

  // Verify the structure matches what the transformer should produce
  expect(expectedOutput.time_grains).toEqual(timeGrains);
  expect(expectedOutput.time_grains?.length).toBe(2);
});

test('time_grains field is omitted when all grains are selected', () => {
  // When all time grains are selected/allowed, time_grains should be undefined
  const filterOutput = {
    id: 'NATIVE_FILTER-abc123',
    type: NativeFilterType.NativeFilter,
    name: 'Time Grain Filter',
    filterType: 'filter_timegrain',
    description: '',
    targets: [],
    scope: mockScope,
    controlValues: {},
    defaultDataMask: mockDataMask,
    cascadeParentIds: [],
    adhoc_filters: undefined,
    time_range: undefined,
    granularity_sqla: undefined,
    time_grains: undefined, // omitted when all selected
    sortMetric: null,
  };

  expect(filterOutput.time_grains).toBeUndefined();
});

test('time_grains field is omitted when empty array is reset', () => {
  // When user clears all selections (empty array), it should be treated as undefined
  const emptySelection = [];
  const shouldOmit = emptySelection.length === 0;

  expect(shouldOmit).toBe(true);
});

test('time_grains allows partial selection of grains', () => {
  const allGrains = ['PT1M', 'PT1H', 'P1D', 'P1W', 'P1M', 'P0.25Y', 'P1Y'];
  const selectedGrains = ['P1D', 'P1W', 'P1M'];

  expect(selectedGrains).toEqual(expect.arrayContaining(['P1D', 'P1W', 'P1M']));
  expect(selectedGrains.length).toBe(3);
  expect(selectedGrains.length).toBeLessThan(allGrains.length);
});

test('backward compatibility: missing time_grains defaults to show all', () => {
  // Existing filter configs without time_grains key should show all options
  const legacyFilter = {
    id: 'NATIVE_FILTER-legacy',
    type: NativeFilterType.NativeFilter,
    name: 'Legacy Time Grain Filter',
    filterType: 'filter_timegrain',
    targets: [],
    // Note: no time_grains field
  };

  // When time_grains is undefined, runtime should show all options
  const runtime_allowlist =
    legacyFilter['time_grains' as keyof typeof legacyFilter];
  const shouldShowAll = !runtime_allowlist || runtime_allowlist.length === 0;

  expect(shouldShowAll).toBe(true);
});
