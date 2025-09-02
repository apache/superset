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
  getSparklineTextWidth,
  isValidBoundValue,
  getDataBounds,
  createYScaleConfig,
  transformChartData,
} from './sparklineHelpers';

describe('sparklineHelpers', () => {
  describe('getSparklineTextWidth', () => {
    test('should return a positive number for text width', () => {
      const result = getSparklineTextWidth('123.45');

      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
    });

    test('should handle empty string', () => {
      const result = getSparklineTextWidth('');
      expect(result).toBeGreaterThan(0);
    });
  });

  describe('isValidBoundValue', () => {
    test('should return true for valid numbers', () => {
      expect(isValidBoundValue(0)).toBe(true);
      expect(isValidBoundValue(123)).toBe(true);
      expect(isValidBoundValue(-45)).toBe(true);
      expect(isValidBoundValue(0.5)).toBe(true);
    });

    test('should return false for invalid values', () => {
      expect(isValidBoundValue(null as any)).toBe(false);
      expect(isValidBoundValue(undefined)).toBe(false);
      expect(isValidBoundValue('')).toBe(false);
      expect(isValidBoundValue(NaN)).toBe(false);
      expect(isValidBoundValue('string')).toBe(false);
    });
  });

  describe('getDataBounds', () => {
    test('should return correct min and max for valid data', () => {
      const data = [10, 5, 20, 15];
      const [min, max] = getDataBounds(data);

      expect(min).toBe(5);
      expect(max).toBe(20);
    });

    test('should handle single value', () => {
      const data = [42];
      const [min, max] = getDataBounds(data);

      expect(min).toBe(42);
      expect(max).toBe(42);
    });

    test('should return [0, 0] for empty data', () => {
      const data: number[] = [];
      const [min, max] = getDataBounds(data);

      expect(min).toBe(0);
      expect(max).toBe(0);
    });

    test('should handle negative numbers', () => {
      const data = [-10, -5, -20];
      const [min, max] = getDataBounds(data);

      expect(min).toBe(-20);
      expect(max).toBe(-5);
    });
  });

  describe('createYScaleConfig', () => {
    test('should use data bounds when no axis bounds provided', () => {
      const validData = [10, 20, 30];
      const result = createYScaleConfig(validData);

      expect(result.min).toBe(10);
      expect(result.max).toBe(30);
      expect(result.yScaleConfig.domain).toEqual([10, 30]);
      expect(result.yScaleConfig.zero).toBe(false);
    });

    test('should use provided bounds when valid', () => {
      const validData = [10, 20, 30];
      const result = createYScaleConfig(validData, [0, 50]);

      expect(result.min).toBe(0);
      expect(result.max).toBe(50);
      expect(result.yScaleConfig.domain).toEqual([0, 50]);
      expect(result.yScaleConfig.zero).toBe(true);
    });

    test('should mix data and provided bounds', () => {
      const validData = [10, 20, 30];
      const result = createYScaleConfig(validData, [5, undefined]);

      expect(result.min).toBe(5);
      expect(result.max).toBe(30); // Uses data max
      expect(result.yScaleConfig.domain).toEqual([5, 30]);
    });

    test('should handle empty data', () => {
      const validData: number[] = [];
      const result = createYScaleConfig(validData);

      expect(result.min).toBe(0);
      expect(result.max).toBe(0);
      expect(result.yScaleConfig.domain).toEqual([0, 0]);
    });

    test('should set zero=true for negative min bound', () => {
      const validData = [10, 20];
      const result = createYScaleConfig(validData, [-5, undefined]);

      expect(result.yScaleConfig.zero).toBe(true);
    });

    test('should set zero=false for positive min bound', () => {
      const validData = [10, 20];
      const result = createYScaleConfig(validData, [5, undefined]);

      expect(result.yScaleConfig.zero).toBe(false);
    });
  });

  describe('transformChartData', () => {
    test('should transform data with indices', () => {
      const data = [10, 20, 30];
      const result = transformChartData(data);

      expect(result).toEqual([
        { x: 0, y: 10 },
        { x: 1, y: 20 },
        { x: 2, y: 30 },
      ]);
    });

    test('should handle null values', () => {
      const data = [10, null, 30];
      const result = transformChartData(data);

      expect(result).toEqual([
        { x: 0, y: 10 },
        { x: 1, y: 0 },
        { x: 2, y: 30 },
      ]);
    });

    test('should handle empty array', () => {
      const data: Array<number | null> = [];
      const result = transformChartData(data);

      expect(result).toEqual([]);
    });

    test('should handle mixed null and number values', () => {
      const data = [null, 10, null, null, 20];
      const result = transformChartData(data);

      expect(result).toEqual([
        { x: 0, y: 0 },
        { x: 1, y: 10 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 4, y: 20 },
      ]);
    });
  });
});
