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

test('should handle "now"', () => {
  const now = parseDttmToDate('now');
  const expected = new Date();
  expected.setUTCHours(0, 0, 0, 0);
  expect(expected).toEqual(now);
});

test('should handle "today" and "No filter"', () => {
  const today = parseDttmToDate('today');
  const noFilter = parseDttmToDate('No filter');
  const expected = new Date();
  expected.setUTCHours(0, 0, 0, 0);
  expect(today).toEqual(expected);
  expect(noFilter).toEqual(expected);
});

test('should handle relative time strings', () => {
  const lastWeek = parseDttmToDate('Last week');
  const lastMonth = parseDttmToDate('Last month');
  const lastQuarter = parseDttmToDate('Last quarter');
  const lastYear = parseDttmToDate('Last year');
  let now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  now.setUTCDate(now.getUTCDate() - 7);
  expect(lastWeek).toEqual(now);

  now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  now.setUTCMonth(now.getUTCMonth() - 1);
  now.setUTCDate(1);
  expect(lastMonth).toEqual(now);

  now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  now.setUTCMonth(now.getUTCMonth() - 3);
  now.setUTCDate(1);
  expect(lastQuarter).toEqual(now);

  now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  now.setUTCFullYear(now.getUTCFullYear() - 1);
  now.setUTCDate(1);
  expect(lastYear).toEqual(now);
});

test('should handle previous calendar units', () => {
  let now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  now.setUTCDate(now.getUTCDate() - now.getUTCDay());
  const previousWeek = parseDttmToDate('previous calendar week');
  expect(previousWeek).toEqual(now);

  now = new Date();
  now.setUTCMonth(now.getUTCMonth() - 1, 1);
  now.setUTCHours(0, 0, 0, 0);
  const previousMonth = parseDttmToDate('previous calendar month');
  expect(previousMonth).toEqual(now);

  now = new Date();
  now.setUTCFullYear(now.getUTCFullYear() - 1, 0, 1);
  now.setUTCHours(0, 0, 0, 0);
  const previousYear = parseDttmToDate('previous calendar year');
  expect(previousYear).toEqual(now);
});

test('should handle dynamic "ago" times', () => {
  const fiveDaysAgo = parseDttmToDate('5 days ago');
  const fiveDayAgo = parseDttmToDate('5 day ago');
  let now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  now.setUTCDate(now.getUTCDate() - 5);
  expect(fiveDaysAgo).toEqual(now);
  expect(fiveDayAgo).toEqual(now);

  const weeksAgo = parseDttmToDate('7 weeks ago');
  const weekAgo = parseDttmToDate('7 week ago');
  now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  now.setUTCDate(now.getUTCDate() - 7 * 7);
  expect(weeksAgo).toEqual(now);
  expect(weekAgo).toEqual(now);

  const fiveMonthsAgo = parseDttmToDate('5 months ago');
  const fiveMonthAgo = parseDttmToDate('5 month ago');
  now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  now.setUTCMonth(now.getUTCMonth() - 5);
  expect(fiveMonthsAgo).toEqual(now);
  expect(fiveMonthAgo).toEqual(now);

  const fiveYearsAgo = parseDttmToDate('5 years ago');
  const fiveYearAgo = parseDttmToDate('5 year ago');
  now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  now.setUTCFullYear(now.getUTCFullYear() - 5);
  expect(fiveYearsAgo).toEqual(now);
  expect(fiveYearAgo).toEqual(now);

  // default case
  const fiveHoursAgo = parseDttmToDate('5 hours ago');
  now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  expect(fiveHoursAgo).toEqual(now);
});

test('should parse valid moment strings', () => {
  const specificDate = new Date('2023-01-01');
  specificDate.setUTCHours(0, 0, 0, 0);
  const parsedDate = parseDttmToDate('2023-01-01');
  expect(parsedDate).toEqual(specificDate);
});
