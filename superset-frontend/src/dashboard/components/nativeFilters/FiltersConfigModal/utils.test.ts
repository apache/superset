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
  isDivider,
  transformDividerId,
  isNativeFilterDivider,
  isChartCustomizationDivider,
  getItemType,
  getItemTypeInfo,
  NATIVE_FILTER_DIVIDER_PREFIX,
  CHART_CUSTOMIZATION_DIVIDER_PREFIX,
  NATIVE_FILTER_PREFIX,
  CHART_CUSTOMIZATION_PREFIX,
} from './utils';
import { NativeFilterType, ChartCustomizationType } from '@superset-ui/core';

test('isDivider returns true for native filter dividers', () => {
  const dividerId = `${NATIVE_FILTER_DIVIDER_PREFIX}abc123`;
  expect(isDivider(dividerId)).toBe(true);
});

test('isDivider returns true for chart customization dividers', () => {
  const dividerId = `${CHART_CUSTOMIZATION_DIVIDER_PREFIX}xyz789`;
  expect(isDivider(dividerId)).toBe(true);
});

test('isDivider returns false for regular filter IDs', () => {
  const filterId = `${NATIVE_FILTER_PREFIX}abc123`;
  expect(isDivider(filterId)).toBe(false);
});

test('isDivider returns false for regular customization IDs', () => {
  const customizationId = `${CHART_CUSTOMIZATION_PREFIX}xyz789`;
  expect(isDivider(customizationId)).toBe(false);
});

test('isDivider returns false for unrelated strings', () => {
  expect(isDivider('random-string')).toBe(false);
  expect(isDivider('')).toBe(false);
});

test('transformDividerId converts filter divider to customization divider', () => {
  const filterDividerId = `${NATIVE_FILTER_DIVIDER_PREFIX}abc123`;
  const result = transformDividerId(filterDividerId, 'customization');
  expect(result).toBe(`${CHART_CUSTOMIZATION_DIVIDER_PREFIX}abc123`);
});

test('transformDividerId converts customization divider to filter divider', () => {
  const customizationDividerId = `${CHART_CUSTOMIZATION_DIVIDER_PREFIX}xyz789`;
  const result = transformDividerId(customizationDividerId, 'filter');
  expect(result).toBe(`${NATIVE_FILTER_DIVIDER_PREFIX}xyz789`);
});

test('transformDividerId preserves hash when transforming', () => {
  const originalHash = 'uniqueHash123';
  const filterDividerId = `${NATIVE_FILTER_DIVIDER_PREFIX}${originalHash}`;
  const customizationResult = transformDividerId(
    filterDividerId,
    'customization',
  );
  expect(customizationResult).toBe(
    `${CHART_CUSTOMIZATION_DIVIDER_PREFIX}${originalHash}`,
  );

  const backToFilter = transformDividerId(customizationResult, 'filter');
  expect(backToFilter).toBe(filterDividerId);
});

test('isNativeFilterDivider correctly identifies native filter dividers', () => {
  const dividerId = `${NATIVE_FILTER_DIVIDER_PREFIX}abc123`;
  expect(isNativeFilterDivider(dividerId)).toBe(true);

  const customizationDividerId = `${CHART_CUSTOMIZATION_DIVIDER_PREFIX}xyz789`;
  expect(isNativeFilterDivider(customizationDividerId)).toBe(false);
});

test('isChartCustomizationDivider correctly identifies customization dividers', () => {
  const dividerId = `${CHART_CUSTOMIZATION_DIVIDER_PREFIX}xyz789`;
  expect(isChartCustomizationDivider(dividerId)).toBe(true);

  const filterDividerId = `${NATIVE_FILTER_DIVIDER_PREFIX}abc123`;
  expect(isChartCustomizationDivider(filterDividerId)).toBe(false);
});

test('getItemType returns filter for native filter IDs', () => {
  const filterId = `${NATIVE_FILTER_PREFIX}abc123`;
  expect(getItemType(filterId)).toBe('filter');
});

test('getItemType returns filter for native filter divider IDs', () => {
  const dividerId = `${NATIVE_FILTER_DIVIDER_PREFIX}abc123`;
  expect(getItemType(dividerId)).toBe('filter');
});

test('getItemType returns customization for chart customization IDs', () => {
  const customizationId = `${CHART_CUSTOMIZATION_PREFIX}xyz789`;
  expect(getItemType(customizationId)).toBe('customization');
});

test('getItemType returns customization for chart customization divider IDs', () => {
  const dividerId = `${CHART_CUSTOMIZATION_DIVIDER_PREFIX}xyz789`;
  expect(getItemType(dividerId)).toBe('customization');
});

test('getItemType throws error for unknown ID types', () => {
  expect(() => getItemType('unknown-id')).toThrow(
    'Unknown item type for id: unknown-id',
  );
});

test('getItemTypeInfo returns correct info for filter type', () => {
  const info = getItemTypeInfo('filter');
  expect(info.dividerPrefix).toBe(NATIVE_FILTER_DIVIDER_PREFIX);
  expect(info.dividerType).toBe(NativeFilterType.Divider);
  expect(info.itemTypeName).toBe('filter');
});

test('getItemTypeInfo returns correct info for customization type', () => {
  const info = getItemTypeInfo('customization');
  expect(info.dividerPrefix).toBe(CHART_CUSTOMIZATION_DIVIDER_PREFIX);
  expect(info.dividerType).toBe(ChartCustomizationType.Divider);
  expect(info.itemTypeName).toBe('customization');
});
