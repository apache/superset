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
import { WORLD_BOUNDARY_IDS } from '../src/worldGeometry';
import { getCountry } from '../src/countries';
import transformData from '../src/transformData';

const formData = {
  entity: 'country_code',
  metric: 'sum__num',
  countryFieldtype: 'cca3',
};

test('joins country metadata the way the legacy backend did', () => {
  const rows = transformData([{ country_code: 'FRA', sum__num: 42 }], formData);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    country: 'FRA',
    code: 'FRA',
    name: 'France',
    m1: 42,
  });
  expect(typeof rows[0].latitude).toBe('number');
  expect(typeof rows[0].longitude).toBe('number');
  expect(rows[0].m2).toBeUndefined();
});

test('joins on cca2 codes case-insensitively', () => {
  const rows = transformData([{ country_code: 'fr', sum__num: 1 }], {
    ...formData,
    countryFieldtype: 'cca2',
  });
  expect(rows[0].country).toEqual('FRA');
  expect(rows[0].code).toEqual('FR');
});

test('marks unmatched countries as XXX', () => {
  const rows = transformData(
    [
      { country_code: 'NOT_A_COUNTRY', sum__num: 1 },
      { country_code: null, sum__num: 2 },
    ],
    formData,
  );
  expect(rows[0].country).toEqual('XXX');
  expect(rows[1].country).toEqual('XXX');
});

test('fills m2 from the secondary metric, or mirrors m1 when equal', () => {
  const withSecondary = transformData(
    [{ country_code: 'FRA', sum__num: 42, count: 7 }],
    { ...formData, secondaryMetric: 'count' },
  );
  expect(withSecondary[0]).toMatchObject({ m1: 42, m2: 7 });

  const mirrored = transformData([{ country_code: 'FRA', sum__num: 42 }], {
    ...formData,
    secondaryMetric: 'sum__num',
  });
  expect(mirrored[0]).toMatchObject({ m1: 42, m2: 42 });
});

test('joins by full country name', () => {
  const rows = transformData([{ country_code: 'France', sum__num: 1 }], {
    ...formData,
    countryFieldtype: 'name',
  });
  expect(rows[0].country).toEqual('FRA');
  expect(rows[0].code).toEqual('France');
});

test('typed world maps retain country and bubble metric semantics', () => {
  expect(
    transformData([{ country: 'us', sales: 10, population: 20 }], {
      entity: 'country',
      metric: 'sales',
      secondaryMetric: 'population',
      countryFieldtype: 'cca2',
      strict: true,
    })[0],
  ).toMatchObject({ country: 'USA', m1: 10, m2: 20 });
});

test.each([
  { country: 'not-a-country', sales: 10, population: 20 },
  { country: 'US', sales: null, population: 20 },
  { country: 'US', sales: 10, population: -1 },
])(
  'typed world maps reject invalid values instead of XXX placeholders',
  row => {
    expect(() =>
      transformData([row], {
        entity: 'country',
        metric: 'sales',
        secondaryMetric: 'population',
        countryFieldtype: 'cca2',
        strict: true,
        showBubbles: true,
      }),
    ).toThrow();
  },
);

test.each([-1, null, Number.NaN, 'n/a'])(
  'typed world maps without bubbles ignore an unused secondary metric %s',
  population => {
    const options = {
      entity: 'country',
      metric: 'sales',
      secondaryMetric: 'population',
      countryFieldtype: 'cca2',
      strict: true,
    };
    const row = { country: 'US', sales: 10, population };
    expect(
      transformData([row], { ...options, showBubbles: false })[0],
    ).toMatchObject({ country: 'USA', m1: 10 });
    expect(() =>
      transformData([row], { ...options, showBubbles: true }),
    ).toThrow();
  },
);

test.each(['Curaçao', 'Curacao', 'CURAÇAO'])(
  'typed world maps render diacritic-folded country name %s',
  country => {
    const data = [{ country_code: country, sum__num: 1 }];
    expect(
      transformData(data, {
        ...formData,
        countryFieldtype: 'name',
        strict: true,
        showBubbles: true,
        secondaryMetric: formData.metric,
      }),
    ).toMatchObject([{ country: 'CUW', name: 'Curacao', m1: 1 }]);
    expect(data[0].country_code).toBe(country);
  },
);

test.each([
  ['cca2', 'Áo'],
  ['cca3', 'ÁGO'],
  ['cioc', 'ÁNG'],
])(
  'typed world maps do not fold diacritics in %s codes',
  (countryFieldtype, country) => {
    expect(() =>
      transformData([{ country_code: country, sum__num: 1 }], {
        ...formData,
        countryFieldtype,
        strict: true,
      }),
    ).toThrow('Unrecognized');
  },
);

test.each(['cca2', 'cca3', 'cioc', 'name'])(
  'empty country values never resolve through %s lookup',
  countryFieldtype => {
    expect(getCountry(countryFieldtype, '')).toBeUndefined();
    const options = { ...formData, countryFieldtype };
    const records = [{ country_code: '', sum__num: 1 }];
    expect(() => transformData(records, { ...options, strict: true })).toThrow(
      'Unrecognized',
    );
    expect(transformData(records, options)[0].country).toBe('XXX');
  },
);

test('world boundary snapshots match the real imported Datamaps topology', () => {
  const Datamap = jest.requireActual<{
    prototype: {
      worldTopo: { objects: { world: { geometries: { id: string }[] } } };
    };
  }>('datamaps/dist/datamaps.all.min');
  const geometryIds = new Set(
    Datamap.prototype.worldTopo.objects.world.geometries.map(
      geometry => geometry.id,
    ),
  );
  expect(geometryIds.has('USA')).toBe(true);
  expect(geometryIds.has('SGP')).toBe(false);
  expect(WORLD_BOUNDARY_IDS).toEqual(geometryIds);
});

test('strict choropleths reject Singapore while bubbles can draw it', () => {
  const records = [{ country_code: 'SG', sum__num: 42 }];
  const options = { ...formData, countryFieldtype: 'cca2', strict: true };
  expect(() => transformData(records, options)).toThrow(
    'SGP has no world-map boundary',
  );
  expect(
    transformData(records, {
      ...options,
      showBubbles: true,
      secondaryMetric: formData.metric,
    })[0],
  ).toMatchObject({ country: 'SGP', m1: 42, m2: 42 });
  expect(transformData(records, { ...options, strict: false })[0].country).toBe(
    'SGP',
  );
});

test('saved Custom SQL entities resolve their result label', () => {
  expect(
    transformData([{ region: 'USA', sum__num: 42 }], {
      ...formData,
      entity: {
        sqlExpression: 'UPPER(country_code)',
        label: 'region',
        expressionType: 'SQL',
      },
      strict: true,
    })[0],
  ).toMatchObject({ country: 'USA', sourceValue: 'USA', m1: 42 });
});
