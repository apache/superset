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
import { render, fireEvent } from '@testing-library/react';
import d3 from 'd3';
import { ChartProps } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import ReactCountryMap from '../src/ReactCountryMap';
import transformProps from '../src/transformProps';
import fs from 'fs';
import path from 'path';

interface RegionFeature {
  properties: { ISO: string };
}

const usa: { features: RegionFeature[] } = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../src/countries/usa.geojson'), 'utf8'),
);

test('typed state codes render real boundary paths and cross-filter original values', () => {
  const loader = d3 as unknown as {
    json: (
      url: string,
      callback: (error: Error | null, data: unknown) => void,
    ) => void;
  };
  const json = jest
    .spyOn(loader, 'json')
    .mockImplementation((_url, callback) => {
      callback(null, usa);
    });
  const setDataMask = jest.fn();
  try {
    const props = transformProps(
      new ChartProps({
        theme: supersetTheme,
        width: 800,
        height: 600,
        formData: {
          entity: 'state',
          metric: 'sales',
          select_country: 'usa',
          region_format: 'abbreviation',
          linear_color_scheme: 'schemeBlues',
        },
        queriesData: [{ data: [{ state: 'CA', sales: 10 }] }],
        datasource: { currencyFormats: {}, columnFormats: {} },
        hooks: { setDataMask },
        emitCrossFilters: true,
      }),
    );
    const { container } = render(<ReactCountryMap {...props} />);
    const regions = container.querySelectorAll<SVGPathElement>('path.region');
    expect(regions).toHaveLength(usa.features.length);
    const california = [...regions].find(
      path =>
        (d3.select(path).datum() as RegionFeature).properties.ISO === 'US-CA',
    );
    expect(california).toBeDefined();
    expect(california?.getAttribute('d')?.length).toBeGreaterThan(100);
    expect(california?.style.fill).toMatch(/^(rgb|#)/);
    expect(california?.style.fill).not.toBe('rgb(217, 217, 217)');
    if (california) {
      fireEvent.mouseDown(california);
      fireEvent.click(california);
    }
    expect(setDataMask).toHaveBeenCalledWith(
      expect.objectContaining({
        extraFormData: { filters: [{ col: 'state', op: 'IN', val: ['CA'] }] },
      }),
    );
  } finally {
    json.mockRestore();
  }
});
