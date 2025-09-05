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

  it('ensures max value is included in breakpoints (issue with 38.7)', () => {
    const features = [
      { value: 3.2 },
      { value: 10.5 },
      { value: 17.8 },
      { value: 24.1 },
      { value: 31.4 },
      { value: 38.7 },
    ];

    const breakPoints = getBreakPoints(
      { break_points: [], num_buckets: '5' },
      features,
      accessor,
    );

    // The last breakpoint should be >= 38.7 to include the max value
    const lastBreakpoint = parseFloat(breakPoints[breakPoints.length - 1]);
    expect(lastBreakpoint).toBeGreaterThanOrEqual(38.7);
    expect(breakPoints.length).toBe(6); // 5 buckets = 6 breakpoints

    // First breakpoint should include the min value
    const firstBreakpoint = parseFloat(breakPoints[0]);
    expect(firstBreakpoint).toBeLessThanOrEqual(3.2);
  });

  it('handles precise decimal values correctly', () => {
    const features = [
      { value: 0.1 },
      { value: 0.5 },
      { value: 0.9 },
      { value: 1.3 },
      { value: 1.7 },
    ];

    const breakPoints = getBreakPoints(
      { break_points: [], num_buckets: '4' },
      features,
      accessor,
    );

    const firstBreakpoint = parseFloat(breakPoints[0]);
    const lastBreakpoint = parseFloat(breakPoints[breakPoints.length - 1]);

    expect(firstBreakpoint).toBeLessThanOrEqual(0.1);
    expect(lastBreakpoint).toBeGreaterThanOrEqual(1.7);
  });

  it('uses custom break points when provided', () => {
    const features = [{ value: 5 }, { value: 15 }, { value: 25 }];
    const customBreakPoints = ['0', '10', '20', '30'];

    const breakPoints = getBreakPoints(
      { break_points: customBreakPoints, num_buckets: '' },
      features,
      accessor,
    );

    expect(breakPoints).toEqual(['0', '10', '20', '30']);
  });

  it('returns empty array when features are undefined', () => {
    const breakPoints = getBreakPoints(
      { break_points: [], num_buckets: '5' },
      undefined as any,
      accessor,
    );

    expect(breakPoints).toEqual([]);
  });

  it('returns empty array when extent values are undefined', () => {
    const features = [{ value: undefined }, { value: undefined }];

    const breakPoints = getBreakPoints(
      { break_points: [], num_buckets: '5' },
      features,
      accessor,
    );

    expect(breakPoints).toEqual([]);
  });
});
