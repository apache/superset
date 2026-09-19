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
import normalizeRegions, {
  resolveRegion,
  RegionFormat,
} from '../src/normalizeRegions';

test.each([
  ['usa', 'CA', 'abbreviation', 'US-CA'],
  ['usa', 'ca', 'abbreviation', 'US-CA'],
  ['usa', 'California', 'name', 'US-CA'],
  ['usa', 'us-ca', 'iso_3166_2', 'US-CA'],
  ['canada', 'BC', 'abbreviation', 'CA-BC'],
  ['australia', 'Victoria', 'name', 'AU-VIC'],
  ['australia', 'NSW', 'abbreviation', 'AU-NSW'],
  ['australia', 'Queensland', 'name', 'AU-QLD'],
  ['japan', 'Tokyo', 'name', 'JP-13'],
  ['japan', 'Osaka', 'name', 'JP-27'],
  ['uk', 'Isle of Wight', 'name', 'GB-IOW'],
])('normalizes %s %s in %s format', (country, value, format, expected) => {
  const data = [{ state: value, sales: 10 }];
  expect(normalizeRegions(data, 'state', country, format)).toEqual([
    { state: expected, sales: 10 },
  ]);
  expect(data[0].state).toBe(value);
});

test.each([
  'BC',
  'Victoria',
  'NSW',
  'Queensland',
  'Tokyo',
  'Osaka',
  'Isle of Wight',
  null,
  '',
  1,
])('rejects non-US value %s without blanking the map', value => {
  expect(() =>
    normalizeRegions([{ state: value }], 'state', 'usa', 'abbreviation'),
  ).toThrow();
});

test('exact matches win and ambiguous case folding fails', () => {
  const boundaries = [
    { properties: { ISO: 'A', NAME_1: 'Region' } },
    { properties: { ISO: 'B', NAME_1: 'REGION' } },
  ];
  expect(resolveRegion('Region', boundaries, 'name' as RegionFormat)).toBe('A');
  expect(() => resolveRegion('region', boundaries, 'name')).toThrow(
    'Ambiguous',
  );
});

test('duplicate normalized boundaries cannot lose or incorrectly sum aggregates', () => {
  expect(() =>
    normalizeRegions(
      [{ state: 'CA' }, { state: 'ca' }],
      'state',
      'usa',
      'abbreviation',
    ),
  ).toThrow('normalize source values before aggregation');
});

test('compact boundary identifiers match the actual GeoJSON assets', () => {
  const fs = jest.requireActual<typeof import('fs')>('fs');
  const path = jest.requireActual<typeof import('path')>('path');
  const regions =
    jest.requireActual<typeof import('../src/regions')>(
      '../src/regions',
    ).default;
  for (const [country, pairs] of Object.entries(regions)) {
    const geometry: {
      features: {
        properties: { ISO: string; NAME_1: string; NAME_2?: string };
      }[];
    } = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, `../src/countries/${country}.geojson`),
        'utf8',
      ),
    );
    const expected = new Set(
      geometry.features.map(({ properties: p }) =>
        JSON.stringify([p.ISO, p.NAME_2 || p.NAME_1]),
      ),
    );
    expect(new Set(pairs.map(pair => JSON.stringify(pair)))).toEqual(expected);
  }
});

test('bundled duplicate UK names require codes without cross-transform leakage', () => {
  expect(() =>
    normalizeRegions([{ region: 'Halton' }], 'region', 'uk', 'name'),
  ).toThrow('Ambiguous');
  expect(
    normalizeRegions([{ region: 'GB-HAL' }], 'region', 'uk', 'iso_3166_2'),
  ).toEqual([{ region: 'GB-HAL' }]);
  expect(
    normalizeRegions([{ region: 'WRL' }], 'region', 'uk', 'abbreviation'),
  ).toEqual([{ region: 'GB-WRL' }]);
  expect(
    normalizeRegions([{ region: 'ca' }], 'region', 'usa', 'abbreviation'),
  ).toEqual([{ region: 'US-CA' }]);
  expect(
    normalizeRegions([{ region: 'bc' }], 'region', 'canada', 'abbreviation'),
  ).toEqual([{ region: 'CA-BC' }]);
});
