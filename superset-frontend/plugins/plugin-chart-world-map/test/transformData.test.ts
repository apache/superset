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
