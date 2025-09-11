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

import { parseDttmToDate } from '@superset-ui/core';
import timezoneMock from 'timezone-mock';

// NOW will be set at midnight 2024-06-03 and transforme dfrom local timezone to UTC
const NOW_IN_UTC = '2024-06-03T00:00:00Z';
const NOW_UTC_IN_EUROPE = '2024-06-02T22:00:00Z'; // Same as 2024-06-03T00:00:00+02:00
const NOW_UTC_IN_PACIFIC = '2024-06-03T08:00:00Z'; // Same as 2024-06-03T00:00:00-08:00

afterEach(() => {
  timezoneMock.unregister();
  jest.useRealTimers();
});

const runTimezoneTest = (
  eval_time: string,
  now_time: string,
  timezone: any,
  expected_result: Date | null,
  endDate = false,
  computingShift = false,
) => {
  jest.setSystemTime(new Date(now_time));
  timezoneMock.register(timezone);
  expect(parseDttmToDate(eval_time, endDate, computingShift)).toEqual(
    expected_result,
  );
  timezoneMock.unregister();
};

test('should return the current date for "now"', () => {
  jest.useFakeTimers();
  runTimezoneTest(
    'now',
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    new Date('2024-06-03T00:00:00+02:00'),
  );
  runTimezoneTest('now', NOW_IN_UTC, 'UTC', new Date('2024-06-03T00:00:00Z'));
  runTimezoneTest(
    'now',
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    new Date('2024-06-03T00:00:00-08:00'),
  );
});

test('should return the current date for "today"', () => {
  jest.useFakeTimers();
  runTimezoneTest(
    'today',
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    new Date('2024-06-03T00:00:00+02:00'),
  );
  runTimezoneTest('today', NOW_IN_UTC, 'UTC', new Date('2024-06-03T00:00:00Z'));
  runTimezoneTest(
    'today',
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    new Date('2024-06-03T00:00:00-08:00'),
  );
});

test('should return the current date for "No filter"', () => {
  jest.useFakeTimers();
  runTimezoneTest(
    'No filter',
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    new Date('2024-06-03T00:00:00+02:00'),
  );
  runTimezoneTest(
    'No filter',
    NOW_IN_UTC,
    'UTC',
    new Date('2024-06-03T00:00:00Z'),
  );
  runTimezoneTest(
    'No filter',
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    new Date('2024-06-03T00:00:00-08:00'),
  );
});

test('should return the current date for an empty string', () => {
  jest.useFakeTimers();
  runTimezoneTest(
    '',
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    new Date('2024-06-03T00:00:00+02:00'),
  );
  runTimezoneTest('', NOW_IN_UTC, 'UTC', new Date('2024-06-03T00:00:00Z'));
  runTimezoneTest(
    '',
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    new Date('2024-06-03T00:00:00-08:00'),
  );
});

test('should return yesterday date for "Last day"', () => {
  jest.useFakeTimers();
  runTimezoneTest(
    'Last day',
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    new Date('2024-06-01T22:00:00Z'),
  );
  runTimezoneTest(
    'Last day',
    NOW_IN_UTC,
    'UTC',
    new Date('2024-06-02T00:00:00Z'),
  );
  runTimezoneTest(
    'Last day',
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    new Date('2024-06-02T08:00:00Z'),
  );
});

test('should return the date one week ago for "Last week"', () => {
  jest.useFakeTimers();
  runTimezoneTest(
    'Last week',
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    new Date('2024-05-26T22:00:00Z'),
  );
  runTimezoneTest(
    'Last week',
    NOW_IN_UTC,
    'UTC',
    new Date('2024-05-27T00:00:00Z'),
  );
  runTimezoneTest(
    'Last week',
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    new Date('2024-05-27T08:00:00Z'),
  );
});

test('should return the date one month ago for "Last month"', () => {
  jest.useFakeTimers();
  runTimezoneTest(
    'Last month',
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    new Date('2024-05-02T22:00:00Z'),
  );
  runTimezoneTest(
    'Last month',
    NOW_IN_UTC,
    'UTC',
    new Date('2024-05-03T00:00:00Z'),
  );
  runTimezoneTest(
    'Last month',
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    new Date('2024-05-03T08:00:00Z'),
  );
});

test('should return the date three months ago for "Last quarter"', () => {
  jest.useFakeTimers();
  runTimezoneTest(
    'Last quarter',
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    new Date('2024-03-02T22:00:00Z'),
  );
  runTimezoneTest(
    'Last quarter',
    NOW_IN_UTC,
    'UTC',
    new Date('2024-03-03T00:00:00Z'),
  );
  runTimezoneTest(
    'Last quarter',
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    new Date('2024-03-03T08:00:00Z'),
  );
});

test('should return the date one year ago for "Last year"', () => {
  jest.useFakeTimers();
  runTimezoneTest(
    'Last year',
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    new Date('2023-06-02T22:00:00Z'),
  );
  runTimezoneTest(
    'Last year',
    NOW_IN_UTC,
    'UTC',
    new Date('2023-06-03T00:00:00Z'),
  );
  runTimezoneTest(
    'Last year',
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    new Date('2023-06-03T08:00:00Z'),
  );
});

test('should return the date for "previous calendar week"', () => {
  jest.useFakeTimers();
  runTimezoneTest(
    'previous calendar week',
    '2024-06-04T22:00:00Z',
    'Etc/GMT-2',
    new Date('2024-05-26T22:00:00Z'),
  );
  runTimezoneTest(
    'previous calendar week',
    '2024-06-05T00:00:00Z',
    'UTC',
    new Date('2024-05-27T00:00:00Z'),
  );
  runTimezoneTest(
    'previous calendar week',
    '2024-06-05T08:00:00Z',
    'Etc/GMT+8',
    new Date('2024-05-27T08:00:00Z'),
  );
});

test('should return the date for "previous calendar month"', () => {
  jest.useFakeTimers();
  runTimezoneTest(
    'previous calendar month',
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    new Date('2024-04-30T22:00:00Z'),
  );
  runTimezoneTest(
    'previous calendar month',
    NOW_IN_UTC,
    'UTC',
    new Date('2024-05-01T00:00:00Z'),
  );
  runTimezoneTest(
    'previous calendar month',
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    new Date('2024-05-01T08:00:00Z'),
  );
});

test('should return the date for "previous calendar year"', () => {
  jest.useFakeTimers();
  runTimezoneTest(
    'previous calendar year',
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    new Date('2022-12-31T22:00:00Z'),
  );
  runTimezoneTest(
    'previous calendar year',
    NOW_IN_UTC,
    'UTC',
    new Date('2023-01-01T00:00:00Z'),
  );
  runTimezoneTest(
    'previous calendar year',
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    new Date('2023-01-01T08:00:00Z'),
  );
});

test('should return the date for "1 day ago"', () => {
  jest.useFakeTimers();
  runTimezoneTest(
    '1 day ago',
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    new Date('2024-06-01T22:00:00Z'),
  );
  runTimezoneTest(
    '1 day ago',
    NOW_IN_UTC,
    'UTC',
    new Date('2024-06-02T00:00:00Z'),
  );
  runTimezoneTest(
    '1 day ago',
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    new Date('2024-06-02T08:00:00Z'),
  );
});

test('should return the date for "1 week ago"', () => {
  jest.useFakeTimers();
  runTimezoneTest(
    '1 week ago',
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    new Date('2024-05-26T22:00:00Z'),
  );
  runTimezoneTest(
    '1 week ago',
    NOW_IN_UTC,
    'UTC',
    new Date('2024-05-27T00:00:00Z'),
  );
  runTimezoneTest(
    '1 week ago',
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    new Date('2024-05-27T08:00:00Z'),
  );
});

test('should return the date for "1 month ago"', () => {
  jest.useFakeTimers();
  runTimezoneTest(
    '1 month ago',
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    new Date('2024-05-02T22:00:00Z'),
  );
  runTimezoneTest(
    '1 month ago',
    NOW_IN_UTC,
    'UTC',
    new Date('2024-05-03T00:00:00Z'),
  );
  runTimezoneTest(
    '1 month ago',
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    new Date('2024-05-03T08:00:00Z'),
  );
});

test('should return the date for "1 year ago"', () => {
  jest.useFakeTimers();
  runTimezoneTest(
    '1 year ago',
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    new Date('2023-06-02T22:00:00Z'),
  );
  runTimezoneTest(
    '1 year ago',
    NOW_IN_UTC,
    'UTC',
    new Date('2023-06-03T00:00:00Z'),
  );
  runTimezoneTest(
    '1 year ago',
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    new Date('2023-06-03T08:00:00Z'),
  );
});

test('should return the date for "2024-03-09"', () => {
  jest.useFakeTimers();
  runTimezoneTest(
    '2024-03-09',
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    new Date('2024-03-08T22:00:00.000Z'),
  );
  runTimezoneTest(
    '2024-03-09',
    NOW_IN_UTC,
    'UTC',
    new Date('2024-03-09T00:00:00.000Z'),
  );
  runTimezoneTest(
    '2024-03-09',
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    new Date('2024-03-09T08:00:00.000Z'),
  );
});

test('should return the current date for "Last day" with isEndDate true', () => {
  jest.useFakeTimers();
  runTimezoneTest(
    'Last day',
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    new Date('2024-06-02T22:00:00Z'),
    true,
  );
  runTimezoneTest(
    'Last day',
    NOW_IN_UTC,
    'UTC',
    new Date('2024-06-03T00:00:00Z'),
    true,
  );
  runTimezoneTest(
    'Last day',
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    new Date('2024-06-03T08:00:00Z'),
    true,
  );
});

test('should return the current date for "Last week" with isEndDate true', () => {
  jest.useFakeTimers();
  runTimezoneTest(
    'Last week',
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    new Date('2024-06-02T22:00:00Z'),
    true,
  );
  runTimezoneTest(
    'Last week',
    NOW_IN_UTC,
    'UTC',
    new Date('2024-06-03T00:00:00Z'),
    true,
  );
  runTimezoneTest(
    'Last week',
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    new Date('2024-06-03T08:00:00Z'),
    true,
  );
});

test('should return the current date for "Last quarter" with isEndDate true', () => {
  jest.useFakeTimers();
  runTimezoneTest(
    'Last quarter',
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    new Date('2024-06-02T22:00:00Z'),
    true,
  );
  runTimezoneTest(
    'Last quarter',
    NOW_IN_UTC,
    'UTC',
    new Date('2024-06-03T00:00:00Z'),
    true,
  );
  runTimezoneTest(
    'Last quarter',
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    new Date('2024-06-03T08:00:00Z'),
    true,
  );
});

test('should return the current date for "Last year" with isEndDate true', () => {
  jest.useFakeTimers();
  runTimezoneTest(
    'Last year',
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    new Date('2024-06-02T22:00:00Z'),
    true,
  );
  runTimezoneTest(
    'Last year',
    NOW_IN_UTC,
    'UTC',
    new Date('2024-06-03T00:00:00Z'),
    true,
  );
  runTimezoneTest(
    'Last year',
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    new Date('2024-06-03T08:00:00Z'),
    true,
  );
});

test('should return the date for "previous calendar week" with isEndDate true', () => {
  jest.useFakeTimers();
  runTimezoneTest(
    'previous calendar week',
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    new Date('2024-06-02T22:00:00Z'),
    true,
  );
  runTimezoneTest(
    'previous calendar week',
    NOW_IN_UTC,
    'UTC',
    new Date('2024-06-03T00:00:00Z'),
    true,
  );
  runTimezoneTest(
    'previous calendar week',
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    new Date('2024-06-03T08:00:00Z'),
    true,
  );
});

test('should return the date for "previous calendar month" with isEndDate true', () => {
  jest.useFakeTimers();
  runTimezoneTest(
    'previous calendar month',
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    new Date('2024-05-31T22:00:00Z'),
    true,
  );
  runTimezoneTest(
    'previous calendar month',
    NOW_IN_UTC,
    'UTC',
    new Date('2024-06-01T00:00:00Z'),
    true,
  );
  runTimezoneTest(
    'previous calendar month',
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    new Date('2024-06-01T08:00:00Z'),
    true,
  );
});

test('should return the date for "previous calendar year" with isEndDate true', () => {
  jest.useFakeTimers();
  runTimezoneTest(
    'previous calendar year',
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    new Date('2023-12-31T22:00:00Z'),
    true,
  );
  runTimezoneTest(
    'previous calendar year',
    NOW_IN_UTC,
    'UTC',
    new Date('2024-01-01T00:00:00Z'),
    true,
  );
  runTimezoneTest(
    'previous calendar year',
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    new Date('2024-01-01T08:00:00Z'),
    true,
  );
});

test('should return the date for "2024" with parts.length === 1', () => {
  jest.useFakeTimers();
  runTimezoneTest(
    '2024',
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    new Date('2023-12-31T22:00:00.000Z'),
  );
  runTimezoneTest('2024', NOW_IN_UTC, 'UTC', new Date('2024-01-01T00:00:00Z'));
  runTimezoneTest(
    '2024',
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    new Date('2023-12-31T08:00:00.000Z'),
  );
});

test('should return the date for "2024-03" with parts.length === 2', () => {
  jest.useFakeTimers();
  runTimezoneTest(
    '2024-03',
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    new Date('2024-02-29T22:00:00.000Z'),
  );
  runTimezoneTest(
    '2024-03',
    NOW_IN_UTC,
    'UTC',
    new Date('2024-03-01T00:00:00Z'),
  );
  runTimezoneTest(
    '2024-03',
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    new Date('2024-02-29T08:00:00.000Z'),
  );
});

test('should return the date for "2024-03-06" with parts.length === 3', () => {
  jest.useFakeTimers();
  runTimezoneTest(
    '2024-03-06',
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    new Date('2024-03-05T22:00:00.000Z'),
  );
  runTimezoneTest(
    '2024-03-06',
    NOW_IN_UTC,
    'UTC',
    new Date('2024-03-06T00:00:00.000Z'),
  );
  runTimezoneTest(
    '2024-03-06',
    NOW_UTC_IN_PACIFIC,
    'Etc/GMT+8',
    new Date('2024-03-06T08:00:00.000Z'),
  );
});

test('should return the date for "2024-03-06" with computingShifts true', () => {
  jest.useFakeTimers();
  const expectedDate = new Date('2024-03-06T22:00:00Z');
  expectedDate.setHours(-expectedDate.getTimezoneOffset() / 60, 0, 0, 0);
  runTimezoneTest(
    '2024-03-06',
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    expectedDate,
    false,
    true,
  );
});

test('should return the date for "2024-03-06" with computingShifts true and isEndDate true', () => {
  jest.useFakeTimers();
  const expectedDate = new Date('2024-03-06T22:00:00Z');
  expectedDate.setHours(-expectedDate.getTimezoneOffset() / 60, 0, 0, 0);
  runTimezoneTest(
    '2024-03-06',
    NOW_UTC_IN_EUROPE,
    'Etc/GMT-2',
    expectedDate,
    true,
    true,
  );
});
