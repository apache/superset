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
import { getColorBreakpointsBuckets, getBreakPoints } from './utils';
import { ColorBreakpointType } from './types';

describe('getColorBreakpointsBuckets', () => {
  it('returns correct buckets for multiple breakpoints', () => {
    const color_breakpoints: ColorBreakpointType[] = [
      { minValue: 0, maxValue: 10, color: { r: 255, g: 0, b: 0, a: 100 } },
      { minValue: 11, maxValue: 20, color: { r: 0, g: 255, b: 0, a: 100 } },
      { minValue: 21, maxValue: 30, color: { r: 0, g: 0, b: 255, a: 100 } },
    ];
    const result = getColorBreakpointsBuckets(color_breakpoints);
    expect(result).toEqual({
      '0 - 10': { color: [255, 0, 0], enabled: true },
      '11 - 20': { color: [0, 255, 0], enabled: true },
      '21 - 30': { color: [0, 0, 255], enabled: true },
    });
  });

  it('returns empty object if color_breakpoints is empty', () => {
    const result = getColorBreakpointsBuckets([]);
    expect(result).toEqual({});
  });

  it('returns empty object if color_breakpoints is missing', () => {
    const result = getColorBreakpointsBuckets({} as any);
    expect(result).toEqual({});
  });
});

describe('getBreakPoints', () => {
  const accessor = (d: any) => d.value;

  describe('automatic breakpoint generation', () => {
    it('generates correct number of breakpoints for given buckets', () => {
      const features = [{ value: 0 }, { value: 50 }, { value: 100 }];

      const breakPoints = getBreakPoints(
        { break_points: [], num_buckets: '5' },
        features,
        accessor,
      );

      expect(breakPoints).toHaveLength(6); // n buckets = n+1 breakpoints
      expect(breakPoints.every(bp => typeof bp === 'string')).toBe(true);
    });

    it('ensures data range is fully covered', () => {
      // Test various data ranges to ensure min/max are always included
      const testCases = [
        { data: [0, 100], buckets: 5 },
        { data: [0.1, 99.9], buckets: 4 },
        { data: [-50, 50], buckets: 10 },
        { data: [3.2, 38.7], buckets: 5 }, // Original max bug case
        { data: [3.14, 100], buckets: 5 }, // Min rounding bug case (3.14 -> 3)
        { data: [2.345, 10], buckets: 4 }, // Min rounding bug case (2.345 -> 2.35)
        { data: [0.0001, 0.0009], buckets: 3 }, // Very small numbers
        { data: [1000000, 9000000], buckets: 8 }, // Large numbers
      ];

      testCases.forEach(({ data, buckets }) => {
        const [min, max] = data;
        const features = [{ value: min }, { value: max }];

        const breakPoints = getBreakPoints(
          { break_points: [], num_buckets: String(buckets) },
          features,
          accessor,
        );

        const firstBp = parseFloat(breakPoints[0]);
        const lastBp = parseFloat(breakPoints[breakPoints.length - 1]);

        // Critical: min and max must be within the breakpoint range
        expect(firstBp).toBeLessThanOrEqual(min);
        expect(lastBp).toBeGreaterThanOrEqual(max);
        expect(breakPoints).toHaveLength(buckets + 1);
      });
    });

    it('handles uniform distribution correctly', () => {
      const features = [
        { value: 0 },
        { value: 25 },
        { value: 50 },
        { value: 75 },
        { value: 100 },
      ];

      const breakPoints = getBreakPoints(
        { break_points: [], num_buckets: '4' },
        features,
        accessor,
      );

      // Check that breakpoints are evenly spaced
      const numericBreakPoints = breakPoints.map(parseFloat);
      const deltas = [];
      for (let i = 1; i < numericBreakPoints.length; i += 1) {
        deltas.push(numericBreakPoints[i] - numericBreakPoints[i - 1]);
      }

      // All deltas should be approximately equal
      const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      deltas.forEach(delta => {
        expect(delta).toBeCloseTo(avgDelta, 1);
      });
    });

    it('handles single value datasets', () => {
      const features = [{ value: 42 }, { value: 42 }, { value: 42 }];

      const breakPoints = getBreakPoints(
        { break_points: [], num_buckets: '5' },
        features,
        accessor,
      );

      const firstBp = parseFloat(breakPoints[0]);
      const lastBp = parseFloat(breakPoints[breakPoints.length - 1]);

      expect(firstBp).toBeLessThanOrEqual(42);
      expect(lastBp).toBeGreaterThanOrEqual(42);
    });

    it('preserves appropriate precision for different scales', () => {
      const testCases = [
        { data: [0, 1], expectedMaxPrecision: 1 }, // 0.0, 0.2, 0.4...
        { data: [0, 0.1], expectedMaxPrecision: 2 }, // 0.00, 0.02...
        { data: [0, 0.01], expectedMaxPrecision: 3 }, // 0.000, 0.002...
        { data: [0, 1000], expectedMaxPrecision: 0 }, // 0, 200, 400...
      ];

      testCases.forEach(({ data, expectedMaxPrecision }) => {
        const [min, max] = data;
        const features = [{ value: min }, { value: max }];

        const breakPoints = getBreakPoints(
          { break_points: [], num_buckets: '5' },
          features,
          accessor,
        );

        breakPoints.forEach(bp => {
          const decimalPlaces = (bp.split('.')[1] || '').length;
          expect(decimalPlaces).toBeLessThanOrEqual(expectedMaxPrecision);
        });
      });
    });

    it('handles negative values correctly', () => {
      const features = [
        { value: -100 },
        { value: -50 },
        { value: 0 },
        { value: 50 },
        { value: 100 },
      ];

      const breakPoints = getBreakPoints(
        { break_points: [], num_buckets: '5' },
        features,
        accessor,
      );

      const numericBreakPoints = breakPoints.map(parseFloat);
      expect(numericBreakPoints[0]).toBeLessThanOrEqual(-100);
      expect(
        numericBreakPoints[numericBreakPoints.length - 1],
      ).toBeGreaterThanOrEqual(100);

      // Verify ascending order
      for (let i = 1; i < numericBreakPoints.length; i += 1) {
        expect(numericBreakPoints[i]).toBeGreaterThan(
          numericBreakPoints[i - 1],
        );
      }
    });

    it('handles mixed integer and decimal values', () => {
      const features = [
        { value: 1 },
        { value: 2.5 },
        { value: 3.7 },
        { value: 5 },
        { value: 8.2 },
      ];

      const breakPoints = getBreakPoints(
        { break_points: [], num_buckets: '4' },
        features,
        accessor,
      );

      const firstBp = parseFloat(breakPoints[0]);
      const lastBp = parseFloat(breakPoints[breakPoints.length - 1]);

      expect(firstBp).toBeLessThanOrEqual(1);
      expect(lastBp).toBeGreaterThanOrEqual(8.2);
    });

    it('uses floor/ceil for boundary breakpoints to ensure inclusion', () => {
      // Test that Math.floor and Math.ceil are used for boundaries
      // This ensures all data points fall within the breakpoint range

      const testCases = [
        { minValue: 3.14, maxValue: 100, buckets: 5 },
        { minValue: 2.345, maxValue: 10.678, buckets: 4 },
        { minValue: 1.67, maxValue: 5.33, buckets: 3 },
        { minValue: 0.123, maxValue: 0.987, buckets: 5 },
      ];

      testCases.forEach(({ minValue, maxValue, buckets }) => {
        const features = [{ value: minValue }, { value: maxValue }];

        const breakPoints = getBreakPoints(
          { break_points: [], num_buckets: String(buckets) },
          features,
          accessor,
        );

        const firstBp = parseFloat(breakPoints[0]);
        const lastBp = parseFloat(breakPoints[breakPoints.length - 1]);

        // First breakpoint should be floored (always <= minValue)
        expect(firstBp).toBeLessThanOrEqual(minValue);

        // Last breakpoint should be ceiled (always >= maxValue)
        expect(lastBp).toBeGreaterThanOrEqual(maxValue);

        // All values should be within range
        expect(minValue).toBeGreaterThanOrEqual(firstBp);
        expect(maxValue).toBeLessThanOrEqual(lastBp);
      });
    });

    it('prevents minimum value exclusion edge case', () => {
      // Specific edge case test for minimum value exclusion
      // Tests the exact scenario where rounding would exclude the min value

      const features = [
        { value: 3.14 }, // This would round to 3 at precision 0
        { value: 50 },
        { value: 100 },
      ];

      const breakPoints = getBreakPoints(
        { break_points: [], num_buckets: '5' },
        features,
        accessor,
      );

      const firstBp = parseFloat(breakPoints[0]);

      // The first breakpoint must be <= 3.14 (floor behavior)
      expect(firstBp).toBeLessThanOrEqual(3.14);

      // Verify that 3.14 is not excluded
      expect(3.14).toBeGreaterThanOrEqual(firstBp);

      // The first breakpoint should be a clean floor value
      expect(breakPoints[0]).toMatch(/^3(\.0*)?$/);
    });

    it('prevents maximum value exclusion edge case', () => {
      // Specific edge case test for maximum value exclusion
      // Tests the exact scenario where rounding would exclude the max value

      const features = [
        { value: 0 },
        { value: 20 },
        { value: 38.7 }, // Original bug case
      ];

      const breakPoints = getBreakPoints(
        { break_points: [], num_buckets: '5' },
        features,
        accessor,
      );

      const lastBp = parseFloat(breakPoints[breakPoints.length - 1]);

      // The last breakpoint must be >= 38.7 (ceil behavior)
      expect(lastBp).toBeGreaterThanOrEqual(38.7);

      // Verify that 38.7 is not excluded
      expect(38.7).toBeLessThanOrEqual(lastBp);

      // The last breakpoint should be a clean ceil value
      expect(breakPoints[breakPoints.length - 1]).toMatch(/^39(\.0*)?$/);
    });
  });

  describe('custom breakpoints', () => {
    it('uses custom breakpoints when provided', () => {
      const features = [{ value: 5 }, { value: 15 }, { value: 25 }];
      const customBreakPoints = ['0', '10', '20', '30', '40'];

      const breakPoints = getBreakPoints(
        { break_points: customBreakPoints, num_buckets: '' },
        features,
        accessor,
      );

      expect(breakPoints).toEqual(['0', '10', '20', '30', '40']);
    });

    it('sorts custom breakpoints in ascending order', () => {
      const features = [{ value: 5 }];
      const customBreakPoints = ['30', '10', '0', '20'];

      const breakPoints = getBreakPoints(
        { break_points: customBreakPoints, num_buckets: '' },
        features,
        accessor,
      );

      expect(breakPoints).toEqual(['0', '10', '20', '30']);
    });

    it('ignores num_buckets when custom breakpoints are provided', () => {
      const features = [{ value: 5 }];
      const customBreakPoints = ['0', '50', '100'];

      const breakPoints = getBreakPoints(
        { break_points: customBreakPoints, num_buckets: '10' }, // num_buckets should be ignored
        features,
        accessor,
      );

      expect(breakPoints).toEqual(['0', '50', '100']);
      expect(breakPoints).toHaveLength(3); // not 11
    });
  });

  describe('edge cases and error handling', () => {
    it('returns empty array when features are undefined', () => {
      const breakPoints = getBreakPoints(
        { break_points: [], num_buckets: '5' },
        undefined as any,
        accessor,
      );

      expect(breakPoints).toEqual([]);
    });

    it('returns empty array when features is null', () => {
      const breakPoints = getBreakPoints(
        { break_points: [], num_buckets: '5' },
        null as any,
        accessor,
      );

      expect(breakPoints).toEqual([]);
    });

    it('returns empty array when all values are undefined', () => {
      const features = [
        { value: undefined },
        { value: undefined },
        { value: undefined },
      ];

      const breakPoints = getBreakPoints(
        { break_points: [], num_buckets: '5' },
        features,
        accessor,
      );

      expect(breakPoints).toEqual([]);
    });

    it('handles empty features array', () => {
      const breakPoints = getBreakPoints(
        { break_points: [], num_buckets: '5' },
        [],
        accessor,
      );

      expect(breakPoints).toEqual([]);
    });

    it('handles string values that can be parsed as numbers', () => {
      const features = [
        { value: '10.5' },
        { value: '20.3' },
        { value: '30.7' },
      ];

      const breakPoints = getBreakPoints(
        { break_points: [], num_buckets: '3' },
        features,
        (d: any) =>
          typeof d.value === 'string' ? parseFloat(d.value) : d.value,
      );

      const firstBp = parseFloat(breakPoints[0]);
      const lastBp = parseFloat(breakPoints[breakPoints.length - 1]);

      expect(firstBp).toBeLessThanOrEqual(10.5);
      expect(lastBp).toBeGreaterThanOrEqual(30.7);
    });

    it('uses default number of buckets when not specified', () => {
      const features = [{ value: 0 }, { value: 100 }];

      const breakPoints = getBreakPoints(
        { break_points: [], num_buckets: '' },
        features,
        accessor,
      );

      // Should use DEFAULT_NUM_BUCKETS (10)
      expect(breakPoints).toHaveLength(11); // 10 buckets = 11 breakpoints
    });

    it('handles Infinity and -Infinity values', () => {
      const features = [
        { value: -Infinity },
        { value: 0 },
        { value: Infinity },
      ];

      const breakPoints = getBreakPoints(
        { break_points: [], num_buckets: '5' },
        features,
        accessor,
      );

      // Should return empty array when Infinity values are present
      expect(breakPoints).toEqual([]);
    });
  });

  describe('breakpoint boundaries validation', () => {
    it('ensures no data points fall outside breakpoint range', () => {
      // Generate random test data
      const generateRandomData = (count: number, min: number, max: number) => {
        const data = [];
        for (let i = 0; i < count; i += 1) {
          data.push({ value: Math.random() * (max - min) + min });
        }
        return data;
      };

      // Test with various random datasets
      for (let i = 0; i < 10; i += 1) {
        const features = generateRandomData(20, -1000, 1000);
        const minValue = Math.min(...features.map(f => f.value));
        const maxValue = Math.max(...features.map(f => f.value));

        const breakPoints = getBreakPoints(
          { break_points: [], num_buckets: '5' },
          features,
          accessor,
        );

        const firstBp = parseFloat(breakPoints[0]);
        const lastBp = parseFloat(breakPoints[breakPoints.length - 1]);

        // Every data point should fall within the breakpoint range
        features.forEach(feature => {
          expect(feature.value).toBeGreaterThanOrEqual(firstBp);
          expect(feature.value).toBeLessThanOrEqual(lastBp);
        });

        // The range should be as tight as possible while including all data
        expect(firstBp).toBeLessThanOrEqual(minValue);
        expect(lastBp).toBeGreaterThanOrEqual(maxValue);
      }
    });
  });
});
