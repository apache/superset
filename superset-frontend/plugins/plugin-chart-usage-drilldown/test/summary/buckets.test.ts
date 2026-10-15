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
  autoBucketSize,
  DAY_MS,
  groupSlots,
  HOUR_MS,
  parseBucketSizes,
  pickStep,
  series,
} from '../../src/summary/buckets';

const SEP_21 = Date.UTC(2026, 8, 21);
const day = (n: number) => SEP_21 + n * DAY_MS;
const hour = (n: number) => SEP_21 + n * HOUR_MS;

test('series fills the requested range, including slots without rows', () => {
  const data = [
    { created_at: day(0) + 5 * HOUR_MS, calls: 5 },
    { created_at: day(0) + 9 * HOUR_MS, calls: 1 },
    { created_at: day(2), calls: 7 },
  ];
  expect(series(data, 'created_at', 'calls', DAY_MS, day(0), day(4))).toEqual([
    { start: day(0), value: 6 },
    { start: day(1), value: 0 },
    { start: day(2), value: 7 },
    { start: day(3), value: 0 },
  ]);
});

test('series falls back to the range of the data', () => {
  const data = [
    { created_at: day(1), calls: 2 },
    { created_at: day(3), calls: 4 },
    { created_at: null, calls: 9 },
  ];
  expect(series(data, 'created_at', 'calls', DAY_MS)).toEqual([
    { start: day(1), value: 2 },
    { start: day(2), value: 0 },
    { start: day(3), value: 4 },
  ]);
  expect(series([], 'created_at', 'calls', DAY_MS)).toEqual([]);
});

test('series by hour starts exactly where the time filter starts', () => {
  const data = [
    { created_at: hour(5), calls: 1 }, // 05:20-06:00 -> first bar
    { created_at: hour(6), calls: 3 }, // mostly 06:20-07:20 -> second bar
    { created_at: hour(8), calls: 2 }, // 08:00-08:20 -> last bar
  ];
  const from = hour(5) + 20 * 60 * 1000; // 05:20
  const to = hour(8) + 20 * 60 * 1000; // 08:20, "Last 3 hours"
  expect(series(data, 'created_at', 'calls', HOUR_MS, from, to)).toEqual([
    { start: from, value: 1 },
    { start: from + HOUR_MS, value: 3 },
    { start: from + 2 * HOUR_MS, value: 2 },
  ]);
});

test('a rolling 7-day range gives exactly 7 daily slots', () => {
  const from = day(0) + 18 * HOUR_MS + 41 * 60 * 1000; // Sep 21, 18:41
  const to = from + 7 * DAY_MS;
  const data = [
    { created_at: day(0) + 18 * HOUR_MS, calls: 1 }, // first bar
    { created_at: day(1) + 17 * HOUR_MS, calls: 2 }, // still the first bar
    { created_at: day(1) + 19 * HOUR_MS, calls: 4 }, // second bar
    { created_at: day(7) + 18 * HOUR_MS, calls: 8 }, // last bar
  ];
  const slots = series(data, 'created_at', 'calls', DAY_MS, from, to);
  expect(slots).toHaveLength(7);
  expect(slots[0]).toEqual({ start: from, value: 3 });
  expect(slots[1]).toEqual({ start: from + DAY_MS, value: 4 });
  expect(slots[6]).toEqual({ start: from + 6 * DAY_MS, value: 8 });
});

test('a rolling 24-hour range gives exactly 24 hourly slots', () => {
  const from = hour(5) + 41 * 60 * 1000;
  expect(
    series([], 'created_at', 'calls', HOUR_MS, from, from + DAY_MS),
  ).toHaveLength(24);
});

test('pickStep is hourly for ranges up to 2 days, daily otherwise', () => {
  expect(pickStep([], 'created_at', hour(0), hour(3))).toBe(HOUR_MS);
  expect(pickStep([], 'created_at', day(0), day(2))).toBe(HOUR_MS);
  expect(pickStep([], 'created_at', day(0), day(91))).toBe(DAY_MS);
  const data = [{ created_at: day(0) }, { created_at: day(30) }];
  expect(pickStep(data, 'created_at')).toBe(DAY_MS);
  expect(pickStep([{ created_at: hour(4) }], 'created_at')).toBe(HOUR_MS);
  expect(pickStep([], 'created_at')).toBe(DAY_MS);
});

test('groupSlots sums consecutive slots; the last bucket may be shorter', () => {
  const days = [1, 2, 3, 4, 5, 6, 7].map((value, i) => ({
    start: day(i),
    value,
  }));
  expect(groupSlots(days, 3, DAY_MS)).toEqual([
    { start: day(0), end: day(3), value: 6 },
    { start: day(3), end: day(6), value: 15 },
    { start: day(6), end: day(7), value: 7 },
  ]);
  expect(groupSlots(days, 1, DAY_MS)).toHaveLength(7);
});

test('parseBucketSizes keeps positive whole numbers', () => {
  expect(parseBucketSizes('1, 3')).toEqual([1, 3]);
  expect(parseBucketSizes('1, 7, 7, x, -2, 1.5')).toEqual([1, 7]);
  expect(parseBucketSizes('')).toEqual([1]);
  expect(parseBucketSizes(undefined)).toEqual([1]);
});

test('autoBucketSize picks the smallest size with at most 60 bars', () => {
  expect(autoBucketSize(7, [1, 3, 7])).toBe(1);
  expect(autoBucketSize(274, [1, 3, 7])).toBe(7);
  expect(autoBucketSize(1009, [7, 1, 3])).toBe(7);
  expect(autoBucketSize(1009, [1, 3, 7, 30])).toBe(30);
});
