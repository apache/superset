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
import CalendarChartPlugin from '../src/index';
import CalHeatMap from '../src/vendor/cal-heatmap';

/**
 * The example tests in this file act as a starting point, and
 * we encourage you to build more.
 */
describe('@superset-ui/legacy-plugin-chart-calendar', () => {
  it('exists', () => {
    expect(CalendarChartPlugin).toBeDefined();
  });
});

/*
 * This test checks if the getMonthDomain functions as intended in the case that
 * a time range has a "first day of the month" selected as an end date. This is an
 * example of the original issue found at https://github.com/apache/superset/issues/21870
 */
describe('getMonthDomain filter month-day', () => {
  it('returns correct month domain for 2025-03-01 to 2025-05-01', () => {
    const getMonthDomain = (CalHeatMap as any).prototype.getMonthDomain;
    const d = new Date(Date.UTC(2025, 2, 1));
    const range = 2;
    const result = getMonthDomain(d, range);
    expect(result[0].toISOString()).toContain('2025-03-01');
    expect(result[1].toISOString()).toContain('2025-04-01');
    expect(result.length).toBe(2);
  });
});

/*
 * This test checks if the getMonthDomain functions as intended during a
 * leap year, when February has one extra day. Checks only February 2024, which
 * was a leap year. This works because if it is not a leap year, February won't have
 * 29 days, and the method "Date.UTC" would return March 1st instead.
 */
describe('getMonthDomain leap year test', () => {
  it('handles February 2024 leap year correctly', () => {
    const getMonthDomain = (CalHeatMap as any).prototype.getMonthDomain;
    const feb2024 = new Date(Date.UTC(2024, 1, 29));
    const range = 2;
    const result = getMonthDomain(feb2024, range);
    expect(result[0].toISOString()).toContain('2024-02-01');
    expect(result[1].toISOString()).toContain('2024-03-01');
    expect(result.length).toBe(2);
  });
});

/*
 * This test case checks if getMonthDomain functions as intended if the range
 * is an actual Date object. From March 1st 2025 to May 1st 2025.
 */
describe('getMonthDomain with Date object range', () => {
  it('uses Date object as range parameter', () => {
    const getMonthDomain = (CalHeatMap as any).prototype.getMonthDomain;
    const startDate = new Date(Date.UTC(2025, 2, 1));
    const endDate = new Date(Date.UTC(2025, 4, 1));
    const result = getMonthDomain(startDate, endDate);
    expect(result[0].toISOString()).toContain('2025-03-01');
    expect(result[1].toISOString()).toContain('2025-04-01');
    expect(result.length).toBe(2);
  });
});

/*
 * This test case checks if getMonthDomain functions as intended if the range
 * goes across a year. From November 1st 2024 to February 1st 2025.
 */
describe('getMonthDomain multi-year UTC handling', () => {
  it('handles multi-year ranges across year boundaries', () => {
    const getMonthDomain = (CalHeatMap as any).prototype.getMonthDomain;
    const startDate = new Date(Date.UTC(2024, 10, 1));
    const range = 4;
    const result = getMonthDomain(startDate, range);
    expect(result.length).toBe(4);
    expect(result[0].toISOString()).toContain('2024-11-01');
    expect(result[1].toISOString()).toContain('2024-12-01');
    expect(result[2].toISOString()).toContain('2025-01-01');
    expect(result[3].toISOString()).toContain('2025-02-01');
  });
});
