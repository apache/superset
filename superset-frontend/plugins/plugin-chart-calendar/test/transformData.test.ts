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
import transformData, { calendarDelta } from '../src/transformData';

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
  // Jan 15 -> Apr 10 is 2 whole months + 26 days => 2 + 1
  ['month', Date.UTC(2024, 0, 15), Date.UTC(2024, 3, 10), 3],
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

test('computes week ranges with relativedelta semantics', () => {
  // 2024-01-01 -> 2024-03-20: 2 full months + 19 days => weeks = 2
  const { range } = transformData(
    [],
    ['m'],
    Date.UTC(2024, 0, 1),
    Date.UTC(2024, 2, 20),
    'week',
    'day',
  );
  expect(range).toEqual(0 * 53 + 2 + 1);
});

test('calendarDelta matches dateutil for month-end clamping', () => {
  // Jan 31 -> Feb 29 is a full month in dateutil terms (clamped day)
  expect(
    calendarDelta(
      new Date(Date.UTC(2024, 0, 31)),
      new Date(Date.UTC(2024, 1, 29)),
    ),
  ).toEqual({
    years: 0,
    months: 1,
    weeks: 0,
  });
});
