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
import { configure } from '@apache-superset/core/translation';
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

test('bundled UK names resolve without cross-transform leakage', () => {
  expect(
    normalizeRegions([{ region: 'Halton' }], 'region', 'uk', 'name'),
  ).toEqual([{ region: 'GB-HAL' }]);
  expect(
    normalizeRegions([{ region: 'Wirral' }], 'region', 'uk', 'name'),
  ).toEqual([{ region: 'GB-WRL' }]);
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

test.each([
  ['Cá', 'abbreviation'],
  ['US-CÁ', 'iso_3166_2'],
])('does not fold diacritics in region code %s', (value, format) => {
  expect(() =>
    normalizeRegions([{ state: value }], 'state', 'usa', format),
  ).toThrow('Unrecognized');
});

test.each(['Kōchi', 'Kochi', 'kōchi'])(
  'folds diacritics in region name %s',
  value => {
    expect(
      normalizeRegions([{ state: value }], 'state', 'japan', 'name'),
    ).toEqual([{ state: 'JP-39' }]);
  },
);

const frenchErrors = {
  'Geographic values must be nonempty strings of at most 500 characters': [
    'Les valeurs géographiques doivent être des chaînes non vides de 500 caractères au maximum',
  ],
  'Unrecognized region %s; choose the matching country/region format or explicitly filter the dataset.':
    [
      'Région inconnue %s ; choisissez le pays/format correspondant ou filtrez les données.',
    ],
  'Ambiguous region %s; choose the matching country/region format or explicitly filter the dataset.':
    [
      'Région ambiguë %s ; choisissez le pays/format correspondant ou filtrez les données.',
    ],
  'Unsupported country or region_format for typed geographic chart': [
    'Pays ou format de région non pris en charge pour ce graphique géographique',
  ],
  'Multiple result rows resolve to %s; normalize source values before aggregation.':
    [
      'Plusieurs lignes correspondent à %s ; normalisez les valeurs avant agrégation.',
    ],
};

test.each([
  {
    name: 'unrecognized region',
    run: () =>
      normalizeRegions([{ state: 'BC' }], 'state', 'usa', 'abbreviation'),
    message:
      'Région inconnue "BC" ; choisissez le pays/format correspondant ou filtrez les données.',
  },
  {
    name: 'duplicate normalized region',
    run: () =>
      normalizeRegions(
        [{ state: 'CA' }, { state: 'ca' }],
        'state',
        'usa',
        'abbreviation',
      ),
    message:
      'Plusieurs lignes correspondent à US-CA ; normalisez les valeurs avant agrégation.',
  },
  {
    name: 'unsupported format',
    run: () => normalizeRegions([], 'state', 'usa', 'unknown'),
    message:
      frenchErrors[
        'Unsupported country or region_format for typed geographic chart'
      ][0],
  },
  {
    name: 'unsupported country',
    run: () => normalizeRegions([], 'state', 'unknown', 'abbreviation'),
    message:
      frenchErrors[
        'Unsupported country or region_format for typed geographic chart'
      ][0],
  },
  {
    name: 'invalid value',
    run: () =>
      normalizeRegions([{ state: null }], 'state', 'usa', 'abbreviation'),
    message:
      frenchErrors[
        'Geographic values must be nonempty strings of at most 500 characters'
      ][0],
  },
  {
    name: 'ambiguous region',
    run: () =>
      resolveRegion(
        'region',
        [
          { properties: { ISO: 'A', NAME_1: 'Region' } },
          { properties: { ISO: 'B', NAME_1: 'REGION' } },
        ],
        'name',
      ),
    message:
      'Région ambiguë "region" ; choisissez le pays/format correspondant ou filtrez les données.',
  },
])('localizes $name in a French Explore session', ({ run, message }) => {
  configure({
    languagePack: {
      domain: 'superset',
      locale_data: {
        superset: {
          '': {
            domain: 'superset',
            lang: 'fr',
            plural_forms: 'nplurals=2; plural=(n != 1)',
          },
          ...frenchErrors,
        },
      },
    },
  });
  try {
    expect(run).toThrow(message);
  } finally {
    configure();
  }
});
