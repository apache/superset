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
import { AxisType } from '@superset-ui/core';
import {
  buildTimeseriesDrillFilters,
  getCategoryAxisValue,
} from '../../src/Timeseries/drillFilters';
import { OrientationType } from '../../src/Timeseries/types';

test('a category-series click builds a filter keyed to the x-axis column', () => {
  const filters = buildTimeseriesDrillFilters({
    componentType: 'series',
    data: ['2021-01-01', 42],
    name: '2021-01-01',
    xAxisType: AxisType.Category,
    xAxisLabel: 'ds',
    orientation: OrientationType.Vertical,
  });

  expect(filters).toHaveLength(1);
  expect(filters[0]).toMatchObject({
    col: 'ds',
    op: '==',
    val: '2021-01-01',
  });
});

test('a click on a non-series component (e.g. axis label) does not drill', () => {
  const filters = buildTimeseriesDrillFilters({
    componentType: 'xAxis',
    data: ['2021-01-01', 42],
    name: '2021-01-01',
    xAxisType: AxisType.Category,
    xAxisLabel: 'ds',
  });

  expect(filters).toEqual([]);
});

test('horizontal orientation reads the category value from the second tuple index', () => {
  const filters = buildTimeseriesDrillFilters({
    componentType: 'series',
    // Horizontal bars hold the metric first, the category second.
    data: [42, 'Texas'],
    name: undefined,
    xAxisType: AxisType.Category,
    xAxisLabel: 'region',
    orientation: OrientationType.Horizontal,
  });

  expect(filters).toHaveLength(1);
  expect(filters[0]).toMatchObject({ col: 'region', val: 'Texas' });
});

test('a non-category (time) x-axis drills on the event name', () => {
  const filters = buildTimeseriesDrillFilters({
    componentType: 'series',
    data: undefined,
    name: 1609459200000,
    xAxisType: AxisType.Time,
    xAxisLabel: '__timestamp',
  });

  expect(filters).toHaveLength(1);
  expect(filters[0]).toMatchObject({ col: '__timestamp', val: 1609459200000 });
});

test('a series click with no resolvable value yields no filter', () => {
  const filters = buildTimeseriesDrillFilters({
    componentType: 'series',
    data: undefined,
    name: undefined,
    xAxisType: AxisType.Category,
    xAxisLabel: 'ds',
  });

  expect(filters).toEqual([]);
});

test('the label is formatted via formatSeriesName (numeric formatting, not raw)', () => {
  const filters = buildTimeseriesDrillFilters({
    componentType: 'series',
    data: [1234.5],
    name: 1234.5,
    xAxisType: AxisType.Category,
    xAxisLabel: 'value',
    numberFormat: ',d',
  });

  expect(filters[0].val).toBe(1234.5);
  // formatSeriesName applies the number formatter to the numeric value, so the
  // label is not the raw String(1234.5) value.
  expect(filters[0].formattedVal).not.toBe('1234.5');
});

test('getCategoryAxisValue falls back to the event name when data is unavailable', () => {
  expect(getCategoryAxisValue(undefined, 'USA')).toBe('USA');
  expect(getCategoryAxisValue(['USA'], undefined)).toBe('USA');
  expect(
    getCategoryAxisValue([42, 'USA'], undefined, OrientationType.Horizontal),
  ).toBe('USA');
  expect(getCategoryAxisValue(undefined, undefined)).toBeUndefined();
});
