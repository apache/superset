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
import { supersetTheme } from '@apache-superset/core/theme';
import { ChartProps } from '@superset-ui/core';
import transformProps from '../src/transformProps';

test('joins country metadata from camelized chart props form data', () => {
  const chartProps = new ChartProps({
    width: 800,
    height: 600,
    datasource: { columnFormats: {}, currencyFormats: {}, verboseMap: {} },
    theme: supersetTheme,
    hooks: {},
    filterState: {},
    formData: {
      entity: 'country_code',
      country_fieldtype: 'cca3',
      metric: 'sum__num',
      secondary_metric: 'count',
      max_bubble_size: '25',
      color_picker: { r: 0, g: 122, b: 135, a: 1 },
      show_bubbles: true,
    },
    queriesData: [{ data: [{ country_code: 'FRA', sum__num: 42, count: 7 }] }],
  });
  const { data } = transformProps(chartProps) as {
    data: Record<string, unknown>[];
  };
  expect(data[0]).toMatchObject({
    country: 'FRA',
    name: 'France',
    m1: 42,
    m2: 7,
  });
});

test('passes through pre-shaped legacy payloads', () => {
  const legacyRow = {
    country: 'FRA',
    m1: 42,
    name: 'France',
    latitude: 46,
    longitude: 2,
  };
  const chartProps = new ChartProps({
    width: 800,
    height: 600,
    datasource: { columnFormats: {}, currencyFormats: {}, verboseMap: {} },
    theme: supersetTheme,
    hooks: {},
    filterState: {},
    formData: {
      entity: 'country_code',
      country_fieldtype: 'cca3',
      metric: 'sum__num',
      color_picker: { r: 0, g: 122, b: 135, a: 1 },
    },
    queriesData: [{ data: [legacyRow] }],
  });
  const { data } = transformProps(chartProps) as {
    data: Record<string, unknown>[];
  };
  expect(data).toEqual([legacyRow]);
});
