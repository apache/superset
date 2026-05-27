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
  isNativeFilter,
  isFilterDivider,
  Filter,
  NativeFilterType,
  FilterWithDataMask,
  Divider,
  isNativeFilterWithDataMask,
  isAppliedCrossFilterType,
  isAppliedNativeFilterType,
  AppliedCrossFilterType,
  AppliedNativeFilterType,
  isChartCustomization,
  isChartCustomizationDivider,
  ChartCustomization,
  ChartCustomizationDivider,
  ChartCustomizationType,
} from '@superset-ui/core';

const filter: Filter = {
  cascadeParentIds: [],
  defaultDataMask: {},
  id: 'filter_id',
  name: 'Filter Name',
  scope: { rootPath: [], excluded: [] },
  filterType: 'filter_type',
  targets: [{}],
  controlValues: {},
  type: NativeFilterType.NativeFilter,
  description: 'Filter description.',
};

const filterWithDataMask: FilterWithDataMask = {
  ...filter,
  dataMask: { id: 'data_mask_id', filterState: { value: 'Filter value' } },
};

const filterDivider: Divider = {
  id: 'divider_id',
  type: NativeFilterType.Divider,
  title: 'Divider title',
  description: 'Divider description.',
};

const appliedCrossFilter: AppliedCrossFilterType = {
  filterType: undefined,
  targets: [1, 2],
  scope: [1, 2],
  values: null,
};

const appliedNativeFilter: AppliedNativeFilterType = {
  filterType: 'filter_select',
  scope: [1, 2],
  targets: [{}],
  values: null,
};

test('filter type guard', () => {
  expect(isNativeFilter(filter)).toBeTruthy();
  expect(isNativeFilter(filterWithDataMask)).toBeTruthy();
  expect(isNativeFilter(filterDivider)).toBeFalsy();
});

test('filter with dataMask type guard', () => {
  expect(isNativeFilterWithDataMask(filter)).toBeFalsy();
  expect(isNativeFilterWithDataMask(filterWithDataMask)).toBeTruthy();
  expect(isNativeFilterWithDataMask(filterDivider)).toBeFalsy();
});

test('filter divider type guard', () => {
  expect(isFilterDivider(filter)).toBeFalsy();
  expect(isFilterDivider(filterWithDataMask)).toBeFalsy();
  expect(isFilterDivider(filterDivider)).toBeTruthy();
});

test('applied cross filter type guard', () => {
  expect(isAppliedCrossFilterType(appliedCrossFilter)).toBeTruthy();
  expect(isAppliedCrossFilterType(appliedNativeFilter)).toBeFalsy();
});

test('applied native filter type guard', () => {
  expect(isAppliedNativeFilterType(appliedNativeFilter)).toBeTruthy();
  expect(isAppliedNativeFilterType(appliedCrossFilter)).toBeFalsy();
});

const chartCustomization: ChartCustomization = {
  id: 'custom_id',
  type: ChartCustomizationType.ChartCustomization,
  name: 'My Customization',
  filterType: 'chart_customization',
  targets: [],
  scope: { rootPath: [], excluded: [] },
  defaultDataMask: {},
  controlValues: {},
};

const chartCustomizationDivider: ChartCustomizationDivider = {
  id: 'divider_id',
  type: ChartCustomizationType.Divider,
  title: 'Divider',
  description: 'A divider',
};

test('isChartCustomization type guard', () => {
  expect(isChartCustomization(chartCustomization)).toBeTruthy();
  expect(isChartCustomization(filter)).toBeFalsy();
});

test('isChartCustomizationDivider type guard', () => {
  expect(isChartCustomizationDivider(chartCustomizationDivider)).toBeTruthy();
  expect(isChartCustomizationDivider(chartCustomization)).toBeFalsy();
});
