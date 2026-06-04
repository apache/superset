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
  getMapboxApiKeyFromBootstrap,
  getMapRendererOptions,
  hasMapboxApiKey,
  isRasterTileTemplate,
  OSM_TILE_ATTRIBUTION,
  OSM_TILE_STYLE_CHOICE,
  OSM_TILE_STYLE_URL,
  resolveMapStyle,
} from './mapStyles';

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
    {
      value: 'mapbox',
      label: 'Mapbox (MAPBOX_API_KEY required)',
      disabled: true,
    },
  ]);
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
