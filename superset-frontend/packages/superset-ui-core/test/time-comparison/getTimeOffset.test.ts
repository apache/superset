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
import { getTimeOffset, parseDttmToDate } from '@superset-ui/core';

describe('parseDttmToDate', () => {
  it('should handle "now"', () => {
    const now = parseDttmToDate('now');
    const expected = new Date();
    expected.setUTCHours(0, 0, 0, 0);
    expect(expected).toEqual(now);
  });

  it('should handle "today" and "No filter"', () => {
    const today = parseDttmToDate('today');
    const noFilter = parseDttmToDate('No filter');
    const expected = new Date();
    expected.setUTCHours(0, 0, 0, 0);
    expect(today).toEqual(expected);
    expect(noFilter).toEqual(expected);
  });

  it('should handle relative time strings', () => {
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

  it('should handle previous calendar units', () => {
    const previousWeek = parseDttmToDate('previous calendar week');
    const previousMonth = parseDttmToDate('previous calendar month');
    const previousYear = parseDttmToDate('previous calendar year');
    let now = new Date();
    now.setUTCDate(now.getUTCDate() - (now.getUTCDay() || 7));
    now.setUTCHours(0, 0, 0, 0);
    expect(previousWeek).toEqual(now);

    now = new Date();
    now.setUTCMonth(now.getUTCMonth() - 1, 1);
    now.setUTCHours(0, 0, 0, 0);
    expect(previousMonth).toEqual(now);

    now = new Date();
    now.setUTCFullYear(now.getUTCFullYear() - 1, 0, 1);
    now.setUTCHours(0, 0, 0, 0);
    expect(previousYear).toEqual(now);
  });

  it('should handle dynamic "ago" times', () => {
    const fiveDaysAgo = parseDttmToDate('5 days ago');
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);
    now.setUTCDate(now.getUTCDate() - 5);
    expect(fiveDaysAgo).toEqual(now);
  });

  it('should parse valid moment strings', () => {
    const specificDate = new Date('2023-01-01');
    specificDate.setUTCHours(0, 0, 0, 0);
    const parsedDate = parseDttmToDate('2023-01-01');
    expect(parsedDate).toEqual(specificDate);
  });
});

describe('getTimeOffset', () => {
  it('handles custom shifts', () => {
    const shifts = ['custom'];
    const startDate = '2023-01-01';
    const timeRangeFilter = { comparator: '2023-01-03 : 2023-01-10' };

    const result = getTimeOffset(timeRangeFilter, shifts, startDate);
    expect(result).toEqual(['2 days ago']);
  });

  it('handles inherit shifts', () => {
    const shifts = ['inherit'];
    const startDate = '';
    const timeRangeFilter = { comparator: '2023-01-03 : 2023-01-10' };

    const result = getTimeOffset(timeRangeFilter, shifts, startDate);
    expect(result).toEqual(['7 days ago']);
  });

  it('handles no custom or inherit shifts', () => {
    const shifts = ['1 week ago'];
    const startDate = '';
    const timeRangeFilter = { comparator: '2023-01-03 : 2023-01-10' };

    const result = getTimeOffset(timeRangeFilter, shifts, startDate);
    expect(result).toEqual(['1 week ago']);
  });
});
