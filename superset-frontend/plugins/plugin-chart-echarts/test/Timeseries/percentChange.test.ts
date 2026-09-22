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
  rebaseToPercentChange,
  rebaseSeriesData,
  snapToNearestX,
} from '../../src/Timeseries/percentChange';

test('rebases each column to percent change from its first value', () => {
  const rebased = rebaseToPercentChange(
    [
      { __timestamp: 1, a: 100, b: 50 },
      { __timestamp: 2, a: 150, b: 25 },
      { __timestamp: 3, a: 200, b: null },
    ],
    '__timestamp',
  );
  expect(rebased).toEqual([
    { __timestamp: 1, a: 0, b: 0 },
    { __timestamp: 2, a: 0.5, b: -0.5 },
    { __timestamp: 3, a: 1, b: null },
  ]);
});

test('skips leading nulls when picking the baseline', () => {
  const rebased = rebaseToPercentChange(
    [
      { __timestamp: 1, a: null },
      { __timestamp: 2, a: 40 },
      { __timestamp: 3, a: 60 },
    ],
    '__timestamp',
  );
  expect(rebased[1].a).toBe(0);
  expect(rebased[2].a).toBeCloseTo(0.5);
});

test('yields nulls when the baseline is zero', () => {
  const rebased = rebaseToPercentChange(
    [
      { __timestamp: 1, a: 0 },
      { __timestamp: 2, a: 10 },
    ],
    '__timestamp',
  );
  expect(rebased.map(r => r.a)).toEqual([null, null]);
});

test('re-indexing displayed data matches rebasing raw data to that point', () => {
  // raw 100, 150, 200 rebased to first point: 0, 0.5, 1
  const displayed: [number, number][] = [
    [1, 0],
    [2, 0.5],
    [3, 1],
  ];
  // re-index to x=2 (raw 150): 100/150-1, 0, 200/150-1
  const reindexed = rebaseSeriesData(displayed, 2);
  expect(reindexed[0][1]).toBeCloseTo(100 / 150 - 1);
  expect(reindexed[1][1]).toBeCloseTo(0);
  expect(reindexed[2][1]).toBeCloseTo(200 / 150 - 1);
});

test('re-indexing to the current baseline is a no-op', () => {
  const displayed: [number, number][] = [
    [1, 0],
    [2, 0.5],
  ];
  expect(rebaseSeriesData(displayed, 1)).toEqual(displayed);
});

test('snaps to the nearest available x', () => {
  expect(snapToNearestX([10, 20, 30], 24)).toBe(20);
  expect(snapToNearestX([10, 20, 30], 26)).toBe(30);
  expect(snapToNearestX([], 5)).toBeUndefined();
});

test('validates a category-axis x instead of coercing it to a number', () => {
  // category axes report their exact (already-snapped) value on drag
  expect(snapToNearestX(['a', 'b', 'c'], 'b')).toBe('b');
  // a pixel that landed outside the axis falls back to the first category
  expect(snapToNearestX(['a', 'b', 'c'], 'unknown')).toBe('a');
});
