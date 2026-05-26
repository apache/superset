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
import {
  featureKey,
  featureName,
  filterFeatures,
  resolveColors,
} from '../src/CountryMap';

// Minimal Feature factory — only the fields the helpers actually read.
type FeatureProps = Record<string, unknown>;
const mk = (properties: FeatureProps): any => ({
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: [] },
  properties,
});

// ---- featureKey -----------------------------------------------------------

test('featureKey prefers iso_3166_2 (Admin 1 identifier)', () => {
  expect(featureKey(mk({ iso_3166_2: 'FR-75', adm0_a3: 'FRA' }))).toBe('FR-75');
});

test('featureKey falls back to adm0_a3 when iso_3166_2 missing (Admin 0)', () => {
  expect(featureKey(mk({ adm0_a3: 'FRA' }))).toBe('FRA');
});

test('featureKey returns empty string when neither id is present', () => {
  expect(featureKey(mk({ name: 'Atlantis' }))).toBe('');
});

test('featureKey tolerates missing properties object', () => {
  const f: any = { type: 'Feature', geometry: { type: 'Polygon' } };
  expect(featureKey(f)).toBe('');
});

// ---- featureName ----------------------------------------------------------

test('featureName returns localized NE name when available', () => {
  const f = mk({ name: 'France', name_fr: 'France', name_zh: '法国' });
  expect(featureName(f, 'zh')).toBe('法国');
  expect(featureName(f, 'fr')).toBe('France');
});

test('featureName falls back to generic name when language code missing', () => {
  const f = mk({ name: 'Atlantis' });
  expect(featureName(f, 'zh')).toBe('Atlantis');
});

test('featureName lowercases the language code before lookup', () => {
  // NE properties are name_zh / name_fr, never name_ZH; renderer must
  // normalize so an `en-US` style language code still resolves cleanly.
  const f = mk({ name: 'France', name_fr: 'France' });
  expect(featureName(f, 'FR')).toBe('France');
});

test('featureName returns empty string when nothing matches and no fallback', () => {
  expect(featureName(mk({}), 'en')).toBe('');
});

// ---- filterFeatures -------------------------------------------------------

const fra = mk({ adm0_a3: 'FRA', iso_3166_2: 'FR-75' });
const paris = mk({ iso_3166_2: 'FR-75C' });
const guadeloupe = mk({ iso_3166_2: 'FR-971', _flying: true });
const martinique = mk({ iso_3166_2: 'FR-972', _flying: true });
const allFeatures = [fra, paris, guadeloupe, martinique];

test('filterFeatures with empty includes/excludes keeps everything when flying is shown', () => {
  expect(filterFeatures(allFeatures, [], [], true)).toHaveLength(4);
});

test('filterFeatures drops _flying-tagged features when toggle is off', () => {
  // Regression: when the user unchecks "Show flying islands", the two
  // repositioned DROMs should disappear and the projection auto-refits
  // to mainland France only.
  const kept = filterFeatures(allFeatures, [], [], false);
  expect(kept).toHaveLength(2);
  expect(kept).toEqual(expect.arrayContaining([fra, paris]));
});

test('filterFeatures with non-empty includes keeps ONLY listed features', () => {
  const kept = filterFeatures(allFeatures, ['FR-75'], [], true);
  expect(kept).toEqual([fra]);
});

test('filterFeatures with excludes drops listed features', () => {
  const kept = filterFeatures(allFeatures, [], ['FR-971'], true);
  expect(kept).toHaveLength(3);
  expect(kept).not.toContain(guadeloupe);
});

test('filterFeatures excludes win over includes for the same key', () => {
  const kept = filterFeatures(allFeatures, ['FR-75'], ['FR-75'], true);
  expect(kept).toEqual([]);
});

test('filterFeatures composes includes + excludes + flying-islands toggle', () => {
  // include FR-75 + FR-972, exclude FR-972, drop flying-islands → only FR-75
  const kept = filterFeatures(
    allFeatures,
    ['FR-75', 'FR-972'],
    ['FR-972'],
    false,
  );
  expect(kept).toEqual([fra]);
});

// ---- resolveColors --------------------------------------------------------

const ALL_COLOR_KEYS = [
  'fillFallback',
  'schemeFallback',
  'hoverFallback',
  'stroke',
  'tooltipBg',
  'tooltipFg',
  'errorFg',
  'loadingFg',
] as const;

test('resolveColors returns a non-empty string for every key when theme is empty', () => {
  // Regression for the "everything is black" bug: on themes that don't
  // expose a given antd token, the renderer was passing `undefined` to
  // setAttribute('fill', ...) and SVG fell back to default black.
  // Every color must resolve to *something* paintable.
  const colors = resolveColors({}) as Record<string, string>;
  ALL_COLOR_KEYS.forEach(key => {
    expect(typeof colors[key]).toBe('string');
    expect(colors[key].length).toBeGreaterThan(0);
    expect(colors[key]).not.toBe('undefined');
  });
});

test('resolveColors uses theme tokens when present', () => {
  const colors = resolveColors({
    colorFillTertiary: '#abcdef',
    colorBorder: '#123456',
  });
  expect(colors.fillFallback).toBe('#abcdef');
  expect(colors.stroke).toBe('#123456');
  // Unset keys still get their fallback.
  expect(colors.tooltipBg).toBe('rgba(0, 0, 0, 0.85)');
});

test('resolveColors falls back when theme returns empty string (not just undefined)', () => {
  // Some theme implementations zero out unset tokens to '' rather than
  // deleting the key. `''` is falsy so the fallback should still kick in.
  const colors = resolveColors({ colorFillTertiary: '', colorBorder: '' });
  expect(colors.fillFallback).toBe('#f0f0f0');
  expect(colors.stroke).toBe('#ffffff');
});
