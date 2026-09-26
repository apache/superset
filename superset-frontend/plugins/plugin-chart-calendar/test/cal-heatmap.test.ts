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
  };
  formatDate(date: Date, format: string | FunctionalDateFormat): string;
  tip: { html(): (d: { t: number; v: number }) => string };
  legendTip: { html(): (d: number) => string };
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
