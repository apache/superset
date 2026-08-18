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
  };
  formatDate(date: Date, format: string | FunctionalDateFormat): string;
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
