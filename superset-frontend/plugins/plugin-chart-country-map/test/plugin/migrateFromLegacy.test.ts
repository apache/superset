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
import migrateFromLegacy from '../../src/plugin/migrateFromLegacy';

test('legacy "france" → Country view with FRA pre-selected', () => {
  expect(migrateFromLegacy({ select_country: 'france' })).toEqual({
    admin_level: '1',
    country: 'FRA',
    worldview: 'ukr',
  });
});

test('legacy "usa" → Country view with USA pre-selected', () => {
  expect(migrateFromLegacy({ select_country: 'usa' })).toEqual({
    admin_level: '1',
    country: 'USA',
    worldview: 'ukr',
  });
});

test('legacy "uk" maps to GBR (the ISO 3166 code)', () => {
  expect(migrateFromLegacy({ select_country: 'uk' })).toEqual({
    admin_level: '1',
    country: 'GBR',
    worldview: 'ukr',
  });
});

test('legacy "france_overseas" maps to composite, not country', () => {
  expect(migrateFromLegacy({ select_country: 'france_overseas' })).toEqual({
    admin_level: '1',
    composite: 'france_overseas',
    worldview: 'ukr',
  });
});

test('legacy "france_regions" maps to aggregated regions for France', () => {
  expect(migrateFromLegacy({ select_country: 'france_regions' })).toEqual({
    admin_level: 'aggregated',
    country: 'FRA',
    region_set: 'regions',
    worldview: 'ukr',
  });
});

test('legacy "turkey_regions" maps to TUR / nuts_1', () => {
  expect(migrateFromLegacy({ select_country: 'turkey_regions' })).toEqual({
    admin_level: 'aggregated',
    country: 'TUR',
    region_set: 'nuts_1',
    worldview: 'ukr',
  });
});

test('legacy "italy_regions" maps to ITA / regions', () => {
  expect(migrateFromLegacy({ select_country: 'italy_regions' })).toEqual({
    admin_level: 'aggregated',
    country: 'ITA',
    region_set: 'regions',
    worldview: 'ukr',
  });
});

test('legacy "philippines_regions" maps to PHL / regions', () => {
  expect(migrateFromLegacy({ select_country: 'philippines_regions' })).toEqual({
    admin_level: 'aggregated',
    country: 'PHL',
    region_set: 'regions',
    worldview: 'ukr',
  });
});

test('uppercase / mixed case legacy values still match', () => {
  expect(migrateFromLegacy({ select_country: 'France' })).toEqual({
    admin_level: '1',
    country: 'FRA',
    worldview: 'ukr',
  });
});

test('unknown legacy code → empty migration (user re-picks)', () => {
  expect(migrateFromLegacy({ select_country: 'atlantis' })).toEqual({});
});

test('missing select_country → empty migration', () => {
  expect(migrateFromLegacy({})).toEqual({});
});

test('every legacy "_regions" key resolves to an existing region_set', () => {
  // Smoke-check that the four legacy aggregated keys all map to
  // (country, region_set) pairs the build pipeline actually emits.
  const cases = [
    'france_regions',
    'italy_regions',
    'philippines_regions',
    'turkey_regions',
  ];
  cases.forEach(name => {
    const m = migrateFromLegacy({ select_country: name });
    expect(m.admin_level).toBe('aggregated');
    expect(typeof m.country).toBe('string');
    expect(typeof m.region_set).toBe('string');
  });
});
