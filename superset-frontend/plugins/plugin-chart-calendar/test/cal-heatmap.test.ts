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

import CalHeatMapImport from '../src/vendor/cal-heatmap';

type DateFormatter = (date: Date, format: string) => string;
type FunctionalDateFormat = (date: Date) => string;

interface CalHeatMapInstance {
  options: {
    dateFormatter: DateFormatter | null;
    timeFormatter: (t: number) => string;
    valueFormatter: (v: number) => string;
    domain: string;
    subDomain: string;
    weekStartOnMonday: boolean;
  };
  formatDate(date: Date, format: string | FunctionalDateFormat): string;
  tip: { html(): (d: { t: number; v: number }) => string };
  legendTip: { html(): (d: number) => string };
  positionSubDomainX(d: { t: number; i: number }): number;
  getSubDomain(date: Date): Date[];
}

const CalHeatMap = CalHeatMapImport as unknown as new () => CalHeatMapInstance;

test('CalHeatMap delegates string date formats to the configured formatter', () => {
  const calendar = new CalHeatMap();
  const date = new Date(2024, 0, 1);
  const dateFormatter = jest.fn<string, [Date, string]>(() => 'Январь');
  calendar.options.dateFormatter = dateFormatter;

  expect(calendar.formatDate(date, '%B')).toBe('Январь');
  expect(dateFormatter).toHaveBeenCalledWith(date, '%B');
});

test('CalHeatMap preserves functional formatters over the configured formatter', () => {
  const calendar = new CalHeatMap();
  const date = new Date(2024, 0, 1);
  const dateFormatter = jest.fn<string, [Date, string]>(() => 'localized');
  const functionalFormat = jest.fn<string, [Date]>(() => 'custom');
  calendar.options.dateFormatter = dateFormatter;

  expect(calendar.formatDate(date, functionalFormat)).toBe('custom');
  expect(functionalFormat).toHaveBeenCalledWith(date);
  expect(dateFormatter).not.toHaveBeenCalled();
});

test('CalHeatMap keeps the D3 formatter fallback', () => {
  const calendar = new CalHeatMap();
  const date = new Date(2024, 0, 1);

  expect(calendar.formatDate(date, '%B')).toBe('January');
});

test('cell tooltip HTML escapes creator-controlled formatter output', () => {
  // Regression test: the tip's .html() callback is assigned to the
  // tooltip node via innerHTML (d3-tip), so formatter output must be
  // escaped before it's returned.
  const calendar = new CalHeatMap();
  calendar.options.timeFormatter = () => '<img src=x onerror=alert(1)>';
  calendar.options.valueFormatter = () => '<svg onload=alert(2)>';

  const html = calendar.tip.html()({ t: 0, v: 1 });

  expect(html).not.toContain('<img');
  expect(html).not.toContain('<svg');
  expect(html).toContain('&lt;img');
  expect(html).toContain('&lt;svg');
});

test('legend tooltip HTML escapes creator-controlled formatter output', () => {
  const calendar = new CalHeatMap();
  calendar.options.valueFormatter = () => '<img src=x onerror=alert(1)>';

  const html = calendar.legendTip.html()(1);

  expect(html).not.toContain('<img');
  expect(html).toContain('&lt;img');
});

function positionsForMonthBlock(
  calendar: CalHeatMapInstance,
  monthStart: Date,
): number[] {
  // Mirrors how _init()/loadNewDomains() build a block's subdomain
  // list: each cell's render position is derived from its index within
  // that specific block's own cell list, not from the cell's own date.
  return calendar
    .getSubDomain(monthStart)
    .map((date, i) => calendar.positionSubDomainX({ t: date.getTime(), i }));
}

test('Month/Week domain gives every cell in a block a distinct, non-negative position', () => {
  // Regression test: a month block also renders the tail (or head) of
  // an adjacent month's week. Positioning must be relative to the
  // block being drawn, not to the cell date's own calendar month, or a
  // borrowed cell collides with one of the block's own cells and hides
  // its value.
  const calendar = new CalHeatMap();
  calendar.options.domain = 'month';
  calendar.options.subDomain = 'week';
  calendar.options.weekStartOnMonday = true;

  // May 2026 borrows 2026-04-27 as its first cell; May's own last week
  // (2026-05-25) must not resolve to the same on-screen column.
  const mayPositions = positionsForMonthBlock(calendar, new Date(2026, 4, 1));
  expect(new Set(mayPositions).size).toBe(mayPositions.length);

  // June 2026's 1st falls on a Monday (the week-start day), so the
  // block has no borrowed cell. Its own first week must stay within
  // the block instead of resolving to a negative position.
  const junePositions = positionsForMonthBlock(calendar, new Date(2026, 5, 1));
  expect(Math.min(...junePositions)).toBeGreaterThanOrEqual(0);
});
