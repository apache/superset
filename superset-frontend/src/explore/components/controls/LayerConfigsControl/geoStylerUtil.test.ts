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
import { FeatureCollection } from 'geojson';
import { SupersetTheme } from '@apache-superset/core/theme';

import {
  colTypeToGeoStylerType,
  colTypesToGeoStylerData,
  createGeoStylerContext,
  getGeoStylerLocale,
  getDefaultStyle,
} from './geoStylerUtil';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('geostyler', () => ({
  locale: {
    en_US: { name: 'en_US' },
    de_DE: { name: 'de_DE' },
    fr_FR: { name: 'fr_FR' },
  },
  GeoStylerContextInterface: {},
}));

const mockTheme = {
  colorTextBase: '#000000',
} as unknown as SupersetTheme;

// ---------------------------------------------------------------------------
// colTypeToGeoStylerType
// ---------------------------------------------------------------------------

test('colTypeToGeoStylerType maps LONGINTEGER to integer', () => {
  expect(colTypeToGeoStylerType('LONGINTEGER')).toBe('integer');
});

test('colTypeToGeoStylerType maps INTEGER to integer', () => {
  expect(colTypeToGeoStylerType('INTEGER')).toBe('integer');
});

test('colTypeToGeoStylerType maps STRING to string', () => {
  expect(colTypeToGeoStylerType('STRING')).toBe('string');
});

test('colTypeToGeoStylerType maps DATETIME to number', () => {
  expect(colTypeToGeoStylerType('DATETIME')).toBe('number');
});

test('colTypeToGeoStylerType maps DATE to number', () => {
  expect(colTypeToGeoStylerType('DATE')).toBe('number');
});

test('colTypeToGeoStylerType maps FLOAT to number', () => {
  expect(colTypeToGeoStylerType('FLOAT')).toBe('number');
});

test('colTypeToGeoStylerType maps DECIMAL to number', () => {
  expect(colTypeToGeoStylerType('DECIMAL')).toBe('number');
});

test('colTypeToGeoStylerType returns unknown types unchanged', () => {
  expect(colTypeToGeoStylerType('GEOMETRY')).toBe('GEOMETRY');
  expect(colTypeToGeoStylerType('BOOLEAN')).toBe('BOOLEAN');
  expect(colTypeToGeoStylerType('')).toBe('');
});

// ---------------------------------------------------------------------------
// colTypesToGeoStylerData
// ---------------------------------------------------------------------------

test('colTypesToGeoStylerData converts col type mapping to VectorData schema', () => {
  const result = colTypesToGeoStylerData({
    name: 'STRING',
    age: 'INTEGER',
    score: 'FLOAT',
  });
  expect(result.schema.properties).toEqual({
    name: { type: 'string' },
    age: { type: 'integer' },
    score: { type: 'number' },
  });
});

test('colTypesToGeoStylerData uses empty FeatureCollection by default', () => {
  const result = colTypesToGeoStylerData({ col: 'STRING' });
  expect(result.exampleFeatures).toEqual({
    type: 'FeatureCollection',
    features: [],
  });
});

test('colTypesToGeoStylerData uses provided FeatureCollection as exampleFeatures', () => {
  const fc: FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [0, 0] },
        properties: { col: 'value' },
      },
    ],
  };
  const result = colTypesToGeoStylerData({ col: 'STRING' }, fc);
  expect(result.exampleFeatures).toBe(fc);
});

test('colTypesToGeoStylerData handles empty col type mapping', () => {
  const result = colTypesToGeoStylerData({});
  expect(result.schema.properties).toEqual({});
});

// ---------------------------------------------------------------------------
// createGeoStylerContext
// ---------------------------------------------------------------------------

const mockLocale = { name: 'en_US' } as any;

test('createGeoStylerContext sets locale and composition', () => {
  const composition = { Rules: { disableClassification: false } };
  const ctx = createGeoStylerContext(mockLocale, undefined, composition);
  expect(ctx.locale).toBe(mockLocale);
  expect(ctx.composition).toBeDefined();
});

test('createGeoStylerContext attaches data when provided', () => {
  const data = {
    schema: { type: 'object' as const, properties: {} },
    exampleFeatures: { type: 'FeatureCollection' as const, features: [] },
  };
  const ctx = createGeoStylerContext(mockLocale, data, {});
  expect(ctx.data).toBe(data);
});

test('createGeoStylerContext omits data when undefined', () => {
  const ctx = createGeoStylerContext(mockLocale, undefined, {});
  expect(ctx.data).toBeUndefined();
});

test('createGeoStylerContext sets disableClassification to true when no features', () => {
  const data = {
    schema: { type: 'object' as const, properties: {} },
    exampleFeatures: { type: 'FeatureCollection' as const, features: [] },
  };
  const ctx = createGeoStylerContext(mockLocale, data, {});
  expect(ctx.composition?.Rules?.disableClassification).toBe(true);
});

test('createGeoStylerContext sets disableClassification to false when features exist', () => {
  const data = {
    schema: { type: 'object' as const, properties: {} },
    exampleFeatures: {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [0, 0] },
          properties: {},
        },
      ],
    },
  };
  const ctx = createGeoStylerContext(mockLocale, data, {});
  expect(ctx.composition?.Rules?.disableClassification).toBe(false);
});

test('createGeoStylerContext creates Rules object when not in composition', () => {
  const ctx = createGeoStylerContext(mockLocale, undefined, {});
  expect(ctx.composition?.Rules).toBeDefined();
});

test('createGeoStylerContext preserves existing composition properties', () => {
  const composition = {
    RuleGenerator: { someOption: true },
  } as any;
  const ctx = createGeoStylerContext(mockLocale, undefined, composition);
  expect((ctx.composition as any)?.RuleGenerator?.someOption).toBe(true);
});

// ---------------------------------------------------------------------------
// getGeoStylerLocale
// ---------------------------------------------------------------------------

test('getGeoStylerLocale returns exact locale match', () => {
  const result = getGeoStylerLocale('en_US');
  expect(result).toEqual({ name: 'en_US' });
});

test('getGeoStylerLocale matches by language prefix', () => {
  // 'de' should match 'de_DE'
  const result = getGeoStylerLocale('de');
  expect(result).toEqual({ name: 'de_DE' });
});

test('getGeoStylerLocale falls back to en_US when no match', () => {
  const result = getGeoStylerLocale('zh');
  expect(result).toEqual({ name: 'en_US' });
});

// ---------------------------------------------------------------------------
// getDefaultStyle
// ---------------------------------------------------------------------------

test('getDefaultStyle returns style with correct name and rule name', () => {
  const style = getDefaultStyle([], 'My Style', 'My Rule', mockTheme);
  expect(style.name).toBe('My Style');
  expect(style.rules[0].name).toBe('My Rule');
});

test('getDefaultStyle returns no symbolizers for empty geomTypes', () => {
  const style = getDefaultStyle([], 'style', 'rule', mockTheme);
  expect(style.rules[0].symbolizers).toHaveLength(0);
});

test('getDefaultStyle returns Fill symbolizer for Polygon', () => {
  const style = getDefaultStyle(['Polygon'], 'style', 'rule', mockTheme);
  expect(style.rules[0].symbolizers).toHaveLength(1);
  expect(style.rules[0].symbolizers[0]).toMatchObject({
    kind: 'Fill',
    color: '#000000',
  });
});

test('getDefaultStyle returns Fill symbolizer for MultiPolygon', () => {
  const style = getDefaultStyle(['MultiPolygon'], 'style', 'rule', mockTheme);
  expect(style.rules[0].symbolizers[0]).toMatchObject({ kind: 'Fill' });
});

test('getDefaultStyle returns Line symbolizer with width 2 for LineString', () => {
  const style = getDefaultStyle(['LineString'], 'style', 'rule', mockTheme);
  expect(style.rules[0].symbolizers).toHaveLength(1);
  expect(style.rules[0].symbolizers[0]).toMatchObject({
    kind: 'Line',
    color: '#000000',
    width: 2,
  });
});

test('getDefaultStyle returns Line symbolizer for MultiLineString', () => {
  const style = getDefaultStyle(
    ['MultiLineString'],
    'style',
    'rule',
    mockTheme,
  );
  expect(style.rules[0].symbolizers[0]).toMatchObject({ kind: 'Line' });
});

test('getDefaultStyle returns Mark circle symbolizer for Point', () => {
  const style = getDefaultStyle(['Point'], 'style', 'rule', mockTheme);
  expect(style.rules[0].symbolizers).toHaveLength(1);
  expect(style.rules[0].symbolizers[0]).toMatchObject({
    kind: 'Mark',
    wellKnownName: 'circle',
    color: '#000000',
  });
});

test('getDefaultStyle returns Mark circle symbolizer for MultiPoint', () => {
  const style = getDefaultStyle(['MultiPoint'], 'style', 'rule', mockTheme);
  expect(style.rules[0].symbolizers[0]).toMatchObject({
    kind: 'Mark',
    wellKnownName: 'circle',
  });
});

test('getDefaultStyle returns multiple symbolizers for mixed geometry types', () => {
  const style = getDefaultStyle(
    ['Polygon', 'LineString', 'Point'],
    'style',
    'rule',
    mockTheme,
  );
  const { symbolizers } = style.rules[0];
  expect(symbolizers).toHaveLength(3);
  expect(symbolizers[0]).toMatchObject({ kind: 'Fill' });
  expect(symbolizers[1]).toMatchObject({ kind: 'Line' });
  expect(symbolizers[2]).toMatchObject({ kind: 'Mark' });
});

test('getDefaultStyle uses undefined geomTypes default (no symbolizers)', () => {
  const style = getDefaultStyle(undefined, 'style', 'rule', mockTheme);
  expect(style.rules[0].symbolizers).toHaveLength(0);
});
