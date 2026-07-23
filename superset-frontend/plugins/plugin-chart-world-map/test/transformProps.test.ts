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

const formData = {
  country_fieldtype: 'cca2',
  entity: 'country_code',
  metric: 'count',
  max_bubble_size: '25',
  show_bubbles: true,
  linear_color_scheme: 'schemeRdYlBu',
  color_picker: { r: 0, g: 122, b: 135, a: 1 },
  color_by: 'metric',
  color_scheme: 'supersetColors',
  slice_id: 1,
  y_axis_format: 'SMART_NUMBER',
};

function makeChartProps(
  data: Record<string, unknown>[],
  formDataOverrides: Record<string, unknown> = {},
) {
  return new ChartProps({
    width: 800,
    height: 600,
    formData: { ...formData, ...formDataOverrides },
    queriesData: [{ data }],
    datasource: { columnFormats: {}, currencyFormats: {} },
    hooks: {},
    filterState: {},
    theme: supersetTheme,
  });
}

describe('WorldMap transformProps', () => {
  test('maps v1 rows to the country/m1/m2 shape with country enrichment', () => {
    const props = transformProps(
      makeChartProps([{ country_code: 'US', count: 10 }]),
    );
    expect(props.data).toEqual([
      {
        country: 'USA',
        code: 'US',
        name: 'United States',
        latitude: expect.any(Number),
        longitude: expect.any(Number),
        m1: 10,
        m2: 10,
      },
    ]);
  });

  test('looks countries up case-insensitively', () => {
    const props = transformProps(
      makeChartProps([{ country_code: 'us', count: 3 }]),
    );
    expect(props.data[0].country).toEqual('USA');
  });

  test('supports the name field type', () => {
    const props = transformProps(
      makeChartProps([{ country_name: 'France', count: 7 }], {
        entity: 'country_name',
        country_fieldtype: 'name',
      }),
    );
    expect(props.data[0]).toEqual(
      expect.objectContaining({ country: 'FRA', code: 'France', m1: 7 }),
    );
  });

  test('reads a distinct secondary metric into m2', () => {
    const props = transformProps(
      makeChartProps([{ country_code: 'DK', count: 5, sum__population: 42 }], {
        secondary_metric: 'sum__population',
      }),
    );
    expect(props.data[0]).toEqual(
      expect.objectContaining({ country: 'DNK', m1: 5, m2: 42 }),
    );
  });

  test('falls back to m1 when the secondary metric equals the metric', () => {
    const props = transformProps(
      makeChartProps([{ country_code: 'DK', count: 5 }], {
        secondary_metric: 'count',
      }),
    );
    expect(props.data[0]).toEqual(expect.objectContaining({ m1: 5, m2: 5 }));
  });

  test('marks unmappable values with the XXX sentinel', () => {
    const props = transformProps(
      makeChartProps([{ country_code: 'ZZZZ', count: 1 }]),
    );
    expect(props.data[0]).toEqual(
      expect.objectContaining({ country: 'XXX', code: 'ZZZZ' }),
    );
  });
});
