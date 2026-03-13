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

import { SortSeriesType } from '@superset-ui/chart-controls';
import { mapXAxisSortToSeriesType } from '../../src/Timeseries/transformProps';

describe('mapXAxisSortToSeriesType', () => {
  test('should return SortSeriesType.Sum when xAxisSort contains "sum"', () => {
    expect(mapXAxisSortToSeriesType('sum')).toBe(SortSeriesType.Sum);
    expect(mapXAxisSortToSeriesType('Sum')).toBe(SortSeriesType.Sum);
    expect(mapXAxisSortToSeriesType('SUM')).toBe(SortSeriesType.Sum);
  });

  test('should return SortSeriesType.Avg when xAxisSort contains "avg" or "average"', () => {
    expect(mapXAxisSortToSeriesType('avg')).toBe(SortSeriesType.Avg);
    expect(mapXAxisSortToSeriesType('average')).toBe(SortSeriesType.Avg);
    expect(mapXAxisSortToSeriesType('Average')).toBe(SortSeriesType.Avg);
    expect(mapXAxisSortToSeriesType('AVG')).toBe(SortSeriesType.Avg);
  });

  test('should return SortSeriesType.Min when xAxisSort contains "min"', () => {
    expect(mapXAxisSortToSeriesType('min')).toBe(SortSeriesType.Min);
    expect(mapXAxisSortToSeriesType('Min')).toBe(SortSeriesType.Min);
    expect(mapXAxisSortToSeriesType('MIN')).toBe(SortSeriesType.Min);
  });

  test('should return SortSeriesType.Max when xAxisSort contains "max"', () => {
    expect(mapXAxisSortToSeriesType('max')).toBe(SortSeriesType.Max);
    expect(mapXAxisSortToSeriesType('Max')).toBe(SortSeriesType.Max);
    expect(mapXAxisSortToSeriesType('MAX')).toBe(SortSeriesType.Max);
  });

  test('should return SortSeriesType.Name when xAxisSort contains "name" or "category"', () => {
    expect(mapXAxisSortToSeriesType('name')).toBe(SortSeriesType.Name);
    expect(mapXAxisSortToSeriesType('Name')).toBe(SortSeriesType.Name);
    expect(mapXAxisSortToSeriesType('category')).toBe(SortSeriesType.Name);
    expect(mapXAxisSortToSeriesType('Category')).toBe(SortSeriesType.Name);
  });

  test('should return undefined when xAxisSort is undefined', () => {
    expect(mapXAxisSortToSeriesType(undefined)).toBeUndefined();
  });

  test('should return undefined when xAxisSort is an empty string', () => {
    expect(mapXAxisSortToSeriesType('')).toBeUndefined();
  });

  test('should return undefined when xAxisSort does not match any sort type', () => {
    expect(mapXAxisSortToSeriesType('metric_1')).toBeUndefined();
    expect(mapXAxisSortToSeriesType('ds')).toBeUndefined();
    expect(mapXAxisSortToSeriesType('some_column')).toBeUndefined();
  });

  test('should handle case-insensitive matching', () => {
    expect(mapXAxisSortToSeriesType('SuM')).toBe(SortSeriesType.Sum);
    expect(mapXAxisSortToSeriesType('AvG')).toBe(SortSeriesType.Avg);
    expect(mapXAxisSortToSeriesType('MiN')).toBe(SortSeriesType.Min);
    expect(mapXAxisSortToSeriesType('MaX')).toBe(SortSeriesType.Max);
    expect(mapXAxisSortToSeriesType('NaMe')).toBe(SortSeriesType.Name);
  });

  test('should prioritize sum over other matches when multiple keywords are present', () => {
    // Based on the if-else structure, sum is checked first
    expect(mapXAxisSortToSeriesType('sum_average')).toBe(SortSeriesType.Sum);
  });

  test('should prioritize avg over min/max when multiple keywords are present', () => {
    // Based on the if-else structure, avg is checked before min/max
    expect(mapXAxisSortToSeriesType('avg_min')).toBe(SortSeriesType.Avg);
  });

  test('should prioritize min over max when both keywords are present', () => {
    // Based on the if-else structure, min is checked before max
    expect(mapXAxisSortToSeriesType('min_max')).toBe(SortSeriesType.Min);
  });
});
