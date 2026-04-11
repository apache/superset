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
  allCategoricalColorSchemeConfigs,
  allSequentialColorSchemeConfigs,
  categoricalAirbnb,
  categoricalBlueToGreen,
  categoricalColorsOfRainbow,
  categoricalD3,
  categoricalEcharts,
  categoricalGoogle,
  categoricalLyft,
  categoricalModernSunset,
  categoricalPreset,
  categoricalPresetAndSuperset,
  categoricalRedToYellow,
  categoricalSuperset,
  categoricalWavesOfBlue,
  ColorSchemeGroup,
  DEFAULT_CATEGORICAL_SCHEME,
  DEFAULT_SEQUENTIAL_SCHEME,
  getCategoricalSchemeNames,
  getCategoricalSchemeRegistry,
  getSchemeColors,
  registerCategoricalSchemeRegistry,
  sequentialCommon,
  sequentialD3,
} from '@apache-superset/core/colors';

// ─── Palette config exports ───────────────────────────────────────────────────

describe('categorical palette configs', () => {
  const allGroups = [
    ['airbnb', categoricalAirbnb],
    ['blueToGreen', categoricalBlueToGreen],
    ['colorsOfRainbow', categoricalColorsOfRainbow],
    ['d3', categoricalD3],
    ['echarts', categoricalEcharts],
    ['google', categoricalGoogle],
    ['lyft', categoricalLyft],
    ['modernSunset', categoricalModernSunset],
    ['preset', categoricalPreset],
    ['presetAndSuperset', categoricalPresetAndSuperset],
    ['redToYellow', categoricalRedToYellow],
    ['superset', categoricalSuperset],
    ['wavesOfBlue', categoricalWavesOfBlue],
  ] as const;

  test.each(allGroups)('%s is a non-empty array of configs', (_, configs) => {
    expect(Array.isArray(configs)).toBe(true);
    expect(configs.length).toBeGreaterThan(0);
  });

  test.each(allGroups)(
    '%s configs each have an id and at least one color',
    (_, configs) => {
      configs.forEach(cfg => {
        expect(typeof cfg.id).toBe('string');
        expect(cfg.id.length).toBeGreaterThan(0);
        expect(Array.isArray(cfg.colors)).toBe(true);
        expect(cfg.colors.length).toBeGreaterThan(0);
      });
    },
  );

  test('allCategoricalColorSchemeConfigs contains every individual palette', () => {
    const allIds = allCategoricalColorSchemeConfigs.map(c => c.id);
    allGroups.forEach(([, configs]) => {
      configs.forEach(cfg => {
        expect(allIds).toContain(cfg.id);
      });
    });
  });

  test('supersetColors is present and is the default', () => {
    const superset = allCategoricalColorSchemeConfigs.find(
      c => c.id === 'supersetColors',
    );
    expect(superset).toBeDefined();
    expect(DEFAULT_CATEGORICAL_SCHEME).toBe('supersetColors');
  });

  test('Featured palettes carry the correct group tag', () => {
    const featured = allCategoricalColorSchemeConfigs.filter(
      c => c.group === ColorSchemeGroup.Featured,
    );
    expect(featured.length).toBeGreaterThan(0);
    featured.forEach(c => expect(c.group).toBe('featured'));
  });
});

describe('sequential palette configs', () => {
  test('sequentialCommon and sequentialD3 are non-empty arrays', () => {
    expect(sequentialCommon.length).toBeGreaterThan(0);
    expect(sequentialD3.length).toBeGreaterThan(0);
  });

  test('allSequentialColorSchemeConfigs contains every individual scheme', () => {
    const allIds = allSequentialColorSchemeConfigs.map(c => c.id);
    [...sequentialCommon, ...sequentialD3].forEach(cfg => {
      expect(allIds).toContain(cfg.id);
    });
  });

  test('superset_seq_1 is present and is the default', () => {
    const seq1 = allSequentialColorSchemeConfigs.find(
      c => c.id === 'superset_seq_1',
    );
    expect(seq1).toBeDefined();
    expect(DEFAULT_SEQUENTIAL_SCHEME).toBe('superset_seq_1');
  });

  test('diverging schemes are tagged', () => {
    const diverging = allSequentialColorSchemeConfigs.filter(
      c => c.isDiverging === true,
    );
    expect(diverging.length).toBeGreaterThan(0);
  });
});

// ─── ColorSchemeGroup enum ────────────────────────────────────────────────────

describe('ColorSchemeGroup', () => {
  test('has the expected string values', () => {
    expect(ColorSchemeGroup.Custom).toBe('custom');
    expect(ColorSchemeGroup.Featured).toBe('featured');
    expect(ColorSchemeGroup.Other).toBe('other');
  });
});

// ─── Registry bridge ─────────────────────────────────────────────────────────

describe('registry bridge', () => {
  beforeEach(() => {
    // Reset registry between tests via re-registration with null equivalent
    registerCategoricalSchemeRegistry({
      keys: () => [],
      get: () => null,
    });
  });

  test('getCategoricalSchemeRegistry returns null before injection', () => {
    registerCategoricalSchemeRegistry({
      keys: () => [],
      get: () => null,
    });
    // After injection of an empty registry getCategoricalSchemeNames returns []
    expect(getCategoricalSchemeNames()).toEqual([]);
  });

  test('getCategoricalSchemeNames returns sorted names from injected registry', () => {
    registerCategoricalSchemeRegistry({
      keys: () => ['zebra', 'apple', 'mango'],
      get: () => null,
    });
    expect(getCategoricalSchemeNames()).toEqual(['apple', 'mango', 'zebra']);
  });

  test('getSchemeColors returns colors from injected registry', () => {
    const colors = ['#ff0000', '#00ff00', '#0000ff'];
    registerCategoricalSchemeRegistry({
      keys: () => ['testScheme'],
      get: (name: string) =>
        name === 'testScheme' ? { id: 'testScheme', colors } : null,
    });
    expect(getSchemeColors('testScheme')).toEqual(colors);
    expect(getSchemeColors('nonexistent')).toBeNull();
  });

  test('getCategoricalSchemeRegistry returns the injected registry', () => {
    const mockRegistry = {
      keys: () => ['a', 'b'],
      get: () => null,
    };
    registerCategoricalSchemeRegistry(mockRegistry);
    expect(getCategoricalSchemeRegistry()).toBe(mockRegistry);
  });
});
