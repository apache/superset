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
import transformData from '../src/transformData';

const jan1 = Date.UTC(2024, 0, 1); // 1704067200000
const jan2 = Date.UTC(2024, 0, 2);

test('keys per-metric values by unix seconds like the legacy backend', () => {
  const { data, start } = transformData(
    [
      { __timestamp: jan1, sum__num: 10 },
      { __timestamp: jan2, sum__num: 20 },
    ],
    ['sum__num'],
    jan1,
    Date.UTC(2024, 11, 31),
    'month',
    'day',
  );
  expect(data.sum__num).toEqual({
    '1704067200': 10,
    '1704153600': 20,
  });
  expect(start).toEqual(jan1);
});

test('throws when time bounds are missing', () => {
  expect(() =>
    transformData([], ['sum__num'], null, jan1, 'month', 'day'),
  ).toThrow('time bounds');
});

test.each([
  ['year', Date.UTC(2022, 5, 15), Date.UTC(2024, 1, 1), 3],
  // Jan 15 -> Apr 10 touches Jan, Feb, Mar and Apr
  ['month', Date.UTC(2024, 0, 15), Date.UTC(2024, 3, 10), 4],
  ['day', jan1, Date.UTC(2024, 0, 8, 12), 8],
  ['hour', jan1, Date.UTC(2024, 0, 1, 5, 30), 6],
])('computes the %s domain range', (domain, start, end, expected) => {
  const { range } = transformData(
    [],
    ['m'],
    start as number,
    end as number,
    domain as string,
    'day',
  );
  expect(range).toEqual(expected);
});

const utc = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): number => Date.UTC(year, month - 1, day, hour, minute);

// Epoch-ms bounds are UTC, and `to_dttm` is an exclusive upper bound
// (`from_dttm <= col < to_dttm`). The domain range must equal the number of
// calendar blocks (months, or Monday-start weeks like cal-heatmap) that the
// bounds touch.
test.each([
  // 1 whole month + 30 days; the final partial month (Nov) must be drawn
  ['60-day range ending mid month', utc(2026, 9, 20), utc(2026, 11, 19), 3],
  [
    'range ending exactly on a month boundary',
    utc(2026, 9, 1),
    utc(2026, 11, 1),
    2,
  ],
  [
    'fractional end just above a month boundary includes that month',
    utc(2026, 9, 1),
    utc(2026, 11, 1) + 0.5,
    3,
  ],
  [
    'fractional end just below a month boundary adds no block',
    utc(2026, 9, 1),
    utc(2026, 11, 1) - 0.5,
    2,
  ],
  ['range crossing a year boundary', utc(2024, 11, 15), utc(2026, 2, 10), 16],
  ['whole months plus a partial month', utc(2024, 1, 1), utc(2024, 3, 15), 3],
  ['month-end clamped start', utc(2024, 1, 31), utc(2024, 3, 1), 2],
])('month domain counts calendar months touched: %s', (_name, from, to, n) => {
  const { range } = transformData([], ['m'], from, to, 'month', 'day');
  expect(range).toEqual(n);
});

test.each([
  // Saturday -> Monday 9 days later touches 3 Monday-start weeks
  ['Saturday to a Monday afternoon', utc(2026, 9, 19), utc(2026, 9, 28, 12), 3],
  [
    'Saturday to the Monday 2 days later',
    utc(2026, 9, 19),
    utc(2026, 9, 21, 12),
    2,
  ],
  [
    'Sunday belongs to the previous Monday-start week',
    utc(2026, 9, 20),
    utc(2026, 9, 21, 12),
    2,
  ],
  ['range spanning several months', utc(2024, 1, 1), utc(2024, 3, 20), 12],
  ['range of more than a year', utc(2024, 1, 1), utc(2025, 3, 5), 62],
  [
    'exclusive end on the next week start adds no block',
    utc(2026, 9, 19),
    utc(2026, 9, 28),
    2,
  ],
  [
    'fractional end just above a week start includes that week',
    utc(2026, 9, 19),
    utc(2026, 9, 28) + 0.5,
    3,
  ],
  [
    'fractional end just below a week start adds no block',
    utc(2026, 9, 19),
    utc(2026, 9, 28) - 0.5,
    2,
  ],
  [
    'Monday to the Wednesday of the next week',
    utc(2026, 9, 14),
    utc(2026, 9, 23),
    2,
  ],
])(
  'week domain counts Monday-start weeks touched: %s',
  (_name, from, to, n) => {
    const { range } = transformData([], ['m'], from, to, 'week', 'day');
    expect(range).toEqual(n);
  },
);
