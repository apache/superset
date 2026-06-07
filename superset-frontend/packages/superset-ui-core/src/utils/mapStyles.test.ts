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
  getDefaultMapRenderer,
  getMapboxApiKeyFromBootstrap,
  getMapRendererOptions,
  hasMapboxApiKey,
  isRasterTileTemplate,
  OSM_TILE_ATTRIBUTION,
  OSM_TILE_STYLE_CHOICE,
  OSM_TILE_STYLE_URL,
  resolveMapStyle,
} from './mapStyles';

test('map renderer and OSM style labels are localizable', async () => {
  jest.resetModules();
  jest.doMock('@apache-superset/core/translation', () => ({
    t: (label: string) => `translated:${label}`,
  }));

  const {
    getMapRendererOptions: getTranslatedMapRendererOptions,
    OSM_TILE_STYLE_CHOICE: translatedOsmTileStyleChoice,
    OSM_TILE_STYLE_URL: translatedOsmTileStyleUrl,
    OSM_TILE_ATTRIBUTION: translatedOsmTileAttribution,
  } = await import('./mapStyles');

  expect(translatedOsmTileStyleChoice).toEqual({
    value: translatedOsmTileStyleUrl,
    label: 'translated:Streets (OSM)',
    attribution: translatedOsmTileAttribution,
  });
  expect(getTranslatedMapRendererOptions({ hasMapboxKey: true })).toEqual([
    { value: 'maplibre', label: 'translated:MapLibre (open-source)' },
    { value: 'mapbox', label: 'translated:Mapbox (API key required)' },
  ]);
  expect(getTranslatedMapRendererOptions({ hasMapboxKey: false })).toEqual([
    { value: 'maplibre', label: 'translated:MapLibre (open-source)' },
  ]);

  jest.dontMock('@apache-superset/core/translation');
  jest.resetModules();
});

test('OSM style choice uses the approved label, URL, and attribution', () => {
  expect(OSM_TILE_STYLE_CHOICE).toEqual({
    value: OSM_TILE_STYLE_URL,
    label: 'Streets (OSM)',
    attribution: OSM_TILE_ATTRIBUTION,
  });
});

test('Mapbox key helpers report absence and presence from bootstrap data', () => {
  expect(getMapboxApiKeyFromBootstrap({ common: { conf: {} } })).toBe('');
  expect(hasMapboxApiKey({ common: { conf: {} } })).toBe(false);
  expect(
    getMapboxApiKeyFromBootstrap({
      common: { conf: { MAPBOX_API_KEY: 'pk.test' } },
    }),
  ).toBe('pk.test');
  expect(
    getMapboxApiKeyFromBootstrap({
      common: { conf: { MAPBOX_API_KEY: '  pk.test  ' } },
    }),
  ).toBe('pk.test');
  expect(
    hasMapboxApiKey({ common: { conf: { MAPBOX_API_KEY: '   ' } } }),
  ).toBe(false);
  expect(
    hasMapboxApiKey({ common: { conf: { MAPBOX_API_KEY: 'pk.test' } } }),
  ).toBe(true);
});

test('renderer options enable Mapbox only when a key is available', () => {
  expect(getMapRendererOptions({ hasMapboxKey: true })).toEqual([
    { value: 'maplibre', label: 'MapLibre (open-source)' },
    { value: 'mapbox', label: 'Mapbox (API key required)' },
  ]);
  expect(getMapRendererOptions({ hasMapboxKey: false })).toEqual([
    { value: 'maplibre', label: 'MapLibre (open-source)' },
  ]);
});

test('renderer options preserve saved Mapbox without API-key labels', () => {
  expect(
    getMapRendererOptions({ hasMapboxKey: false, currentValue: 'mapbox' }),
  ).toEqual([
    { value: 'maplibre', label: 'MapLibre (open-source)' },
    { value: 'mapbox', label: 'Mapbox (API key required)', disabled: true },
  ]);
});

test('default renderer uses configured Mapbox only when a key is available', () => {
  expect(
    getDefaultMapRenderer({
      common: {
        conf: {
          DEFAULT_MAP_RENDERER: 'mapbox',
          MAPBOX_API_KEY: 'pk.test',
        },
      },
    }),
  ).toBe('mapbox');
  expect(
    getDefaultMapRenderer({
      common: { conf: { DEFAULT_MAP_RENDERER: 'mapbox' } },
    }),
  ).toBe('maplibre');
  expect(
    getDefaultMapRenderer({
      common: {
        conf: {
          DEFAULT_MAP_RENDERER: 'invalid',
          MAPBOX_API_KEY: 'pk.test',
        },
      },
    }),
  ).toBe('maplibre');
});

test('raster tile templates resolve to MapLibre raster style objects with attribution', () => {
  const style = resolveMapStyle(OSM_TILE_STYLE_URL, 'default-style.json');

  expect(style).toEqual({
    version: 8,
    sources: {
      'osm-raster-tiles': {
        type: 'raster',
        tiles: [OSM_TILE_STYLE_URL],
        tileSize: 256,
        attribution: OSM_TILE_ATTRIBUTION,
      },
    },
    layers: [
      {
        id: 'osm-raster-layer',
        type: 'raster',
        source: 'osm-raster-tiles',
        minzoom: 0,
        maxzoom: 22,
      },
    ],
  });
});

test('tile protocol raster templates are unwrapped before style resolution', () => {
  const style = resolveMapStyle(
    `tile://${OSM_TILE_STYLE_URL}`,
    'default-style.json',
  );

  expect(typeof style).toBe('object');
  if (typeof style !== 'string') {
    expect(style.sources['osm-raster-tiles'].tiles).toEqual([
      OSM_TILE_STYLE_URL,
    ]);
    expect(style.sources['osm-raster-tiles'].attribution).toBe(
      OSM_TILE_ATTRIBUTION,
    );
  }
});

test('custom raster tile templates do not receive OSM attribution', () => {
  const customTileUrl = 'https://tiles.example.com/{z}/{x}/{y}.png';
  const style = resolveMapStyle(
    `tile://${customTileUrl}`,
    'default-style.json',
  );

  expect(typeof style).toBe('object');
  if (typeof style !== 'string') {
    expect(style.sources['osm-raster-tiles'].tiles).toEqual([customTileUrl]);
    expect(style.sources['osm-raster-tiles']).not.toHaveProperty('attribution');
  }
});

test('style JSON URLs pass through without raster wrapping', () => {
  const styleUrl = 'https://example.com/styles/custom-style.json';

  expect(isRasterTileTemplate(styleUrl)).toBe(false);
  expect(resolveMapStyle(styleUrl, 'default-style.json')).toBe(styleUrl);
  expect(resolveMapStyle(undefined, 'default-style.json')).toBe(
    'default-style.json',
  );
});
