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
  parseTimeRatio,
  transformTimeRatioData,
  transformRegularData,
  transformSparklineData,
  parseSparklineDimensions,
  validateYAxisBounds,
} from './sparklineDataUtils';

const mockEntries = [
  { time: '2023-01-01', sales: 100 },
  { time: '2023-01-02', sales: 200 },
  { time: '2023-01-03', sales: 300 },
  { time: '2023-01-04', sales: 400 },
];

describe('sparklineDataUtils', () => {
  test('parseTimeRatio should parse string values', () => {
    expect(parseTimeRatio('5')).toBe(5);
    expect(parseTimeRatio('10')).toBe(10);
  });

  test('parseTimeRatio should pass through number values', () => {
    expect(parseTimeRatio(5)).toBe(5);
    expect(parseTimeRatio(10)).toBe(10);
  });

  test('transformTimeRatioData should calculate ratios correctly', () => {
    const result = transformTimeRatioData(mockEntries, 'sales', 1);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe(2); // 200/100
    expect(result[1]).toBe(1.5); // 300/200
    expect(result[2]).toBeCloseTo(1.33, 2); // 400/300
  });

  test('transformTimeRatioData should handle zero values', () => {
    const entriesWithZero = [
      { time: '2023-01-01', sales: 0 },
      { time: '2023-01-02', sales: 200 },
    ];

    const result = transformTimeRatioData(entriesWithZero, 'sales', 1);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeNull();
  });

  test('transformRegularData should map values directly', () => {
    const result = transformRegularData(mockEntries, 'sales');

    expect(result).toEqual([100, 200, 300, 400]);
  });

  test('transformSparklineData should use time ratio when configured', () => {
    const column = { key: 'test', timeRatio: 2 };
    const result = transformSparklineData('sales', column, mockEntries);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(3);
    expect(result[1]).toBe(2);
  });

  test('transformSparklineData should use regular data when no time ratio', () => {
    const column = { key: 'test' };
    const result = transformSparklineData('sales', column, mockEntries);

    expect(result).toEqual([100, 200, 300, 400]);
  });

  test('transformSparklineData should handle string time ratio', () => {
    const column = { key: 'test', timeRatio: '1' };
    const result = transformSparklineData('sales', column, mockEntries);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe(2); // 200/100
  });

  test('parseSparklineDimensions should use provided values', () => {
    const column = { key: 'test', width: '400', height: '100' };
    const result = parseSparklineDimensions(column);

    expect(result).toEqual({ width: 400, height: 100 });
  });

  test('parseSparklineDimensions should use default values', () => {
    const column = { key: 'test' };
    const result = parseSparklineDimensions(column);

    expect(result).toEqual({ width: 300, height: 50 });
  });

  test('validateYAxisBounds should return valid bounds', () => {
    const bounds = [0, 100];
    const result = validateYAxisBounds(bounds);

    expect(result).toEqual([0, 100]);
  });

  test('validateYAxisBounds should return default for invalid bounds', () => {
    expect(validateYAxisBounds([0])).toEqual([undefined, undefined]);
    expect(validateYAxisBounds('invalid')).toEqual([undefined, undefined]);
    expect(validateYAxisBounds(null)).toEqual([undefined, undefined]);
  });
});
