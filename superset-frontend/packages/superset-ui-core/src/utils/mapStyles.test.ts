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
  getBootstrapDataFromDocument,
  getDefaultMapRenderer,
  getMapProviderMapStyle,
  getMapboxApiKeyFromBootstrap,
  getMapRendererOptions,
  hasMapboxApiKey,
  isRasterTileTemplate,
  OSM_TILE_ATTRIBUTION,
  OSM_TILE_STYLE_URL,
  resolveMapStyle,
} from './mapStyles';

test('OSM style metadata uses the approved URL and attribution', () => {
  expect(OSM_TILE_STYLE_URL).toBe(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  );
  expect(OSM_TILE_ATTRIBUTION).toBe('© OpenStreetMap contributors');
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
  expect(hasMapboxApiKey({ common: { conf: { MAPBOX_API_KEY: '   ' } } })).toBe(
    false,
  );
  expect(
    hasMapboxApiKey({ common: { conf: { MAPBOX_API_KEY: 'pk.test' } } }),
  ).toBe(true);
});

test('bootstrap data helper parses document data safely', () => {
  document.body.innerHTML = `<div id="app" data-bootstrap='${JSON.stringify({
    common: { conf: { MAPBOX_API_KEY: 'pk.document' } },
  })}'></div>`;

  expect(getBootstrapDataFromDocument()).toEqual({
    common: { conf: { MAPBOX_API_KEY: 'pk.document' } },
  });

  document.body.innerHTML = `<div id="app" data-bootstrap='not-json'></div>`;
  expect(getBootstrapDataFromDocument()).toBeUndefined();

  document.body.innerHTML = '';
  expect(getBootstrapDataFromDocument()).toBeUndefined();
});

test('bootstrap data helper returns undefined without a document', () => {
  // jsdom defines `document` as a non-configurable global, so the SSR guard
  // cannot be exercised by deleting it. Instead, re-evaluate the function's
  // own source in a scope where `document` is shadowed with undefined. When
  // running under coverage, the source is istanbul-instrumented and references
  // its module-scoped counter, so the counter is injected to keep the guard's
  // execution attributed to mapStyles.ts.
  const source = getBootstrapDataFromDocument.toString();
  const counterName = source.match(/cov_\w+/)?.[0] ?? 'unusedCoverageCounter';
  const coverage = (globalThis as { __coverage__?: Record<string, unknown> })
    .__coverage__;
  const coverageEntry =
    coverage?.[
      Object.keys(coverage).find(file => file.endsWith('mapStyles.ts')) ?? ''
    ];
  // eslint-disable-next-line no-new-func
  const callWithoutDocument = new Function(
    counterName,
    'document',
    `return (${source})();`,
  );
  expect(callWithoutDocument(() => coverageEntry, undefined)).toBeUndefined();
});

test('renderer options enable Mapbox only when a key is available', () => {
  expect(getMapRendererOptions({ hasMapboxKey: true })).toEqual([
    { value: 'maplibre' },
    { value: 'mapbox' },
  ]);
  expect(getMapRendererOptions({ hasMapboxKey: false })).toEqual([
    { value: 'maplibre' },
  ]);
});

test('renderer options preserve saved Mapbox without API-key labels', () => {
  expect(
    getMapRendererOptions({ hasMapboxKey: false, currentValue: 'mapbox' }),
  ).toEqual([{ value: 'maplibre' }, { value: 'mapbox', disabled: true }]);
});

test('map provider style helper preserves legacy non-Mapbox styles for MapLibre', () => {
  expect(
    getMapProviderMapStyle({
      mapProvider: 'maplibre',
      maplibreStyle: undefined,
      mapboxStyle: OSM_TILE_STYLE_URL,
      legacyMapStyle: 'https://example.com/fallback-style.json',
    }),
  ).toEqual({
    mapProvider: 'maplibre',
    mapStyle: OSM_TILE_STYLE_URL,
  });
});

test('map provider style helper does not send Mapbox URLs to MapLibre', () => {
  expect(
    getMapProviderMapStyle({
      mapProvider: 'maplibre',
      mapboxStyle: 'mapbox://styles/mapbox/dark-v11',
      legacyMapStyle: 'https://example.com/fallback-style.json',
    }),
  ).toEqual({
    mapProvider: 'maplibre',
    mapStyle: 'https://example.com/fallback-style.json',
  });
});

test('map provider style helper uses Mapbox style when Mapbox is selected', () => {
  expect(
    getMapProviderMapStyle({
      mapProvider: 'mapbox',
      mapboxStyle: 'mapbox://styles/mapbox/dark-v11',
      legacyMapStyle: 'https://example.com/fallback-style.json',
    }),
  ).toEqual({
    mapProvider: 'mapbox',
    mapStyle: 'mapbox://styles/mapbox/dark-v11',
  });
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

test('OpenStreetMap subdomain raster templates receive OSM attribution', () => {
  const osmSubdomainTileUrl =
    'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const style = resolveMapStyle(
    `tile://${osmSubdomainTileUrl}`,
    'default-style.json',
  );

  expect(typeof style).toBe('object');
  if (typeof style !== 'string') {
    expect(style.sources['osm-raster-tiles'].tiles).toEqual([
      osmSubdomainTileUrl,
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

test('relative raster tile templates do not receive OSM attribution', () => {
  const relativeTileUrl = '/tiles/{z}/{x}/{y}.png';
  const style = resolveMapStyle(relativeTileUrl, 'default-style.json');

  expect(typeof style).toBe('object');
  if (typeof style !== 'string') {
    expect(style.sources['osm-raster-tiles'].tiles).toEqual([relativeTileUrl]);
    expect(style.sources['osm-raster-tiles']).not.toHaveProperty('attribution');
  }
});

test('lookalike OpenStreetMap hostnames do not receive OSM attribution', () => {
  const lookalikeTileUrl =
    'https://openstreetmap.org.example.com/{z}/{x}/{y}.png';
  const style = resolveMapStyle(
    `tile://${lookalikeTileUrl}`,
    'default-style.json',
  );

  expect(typeof style).toBe('object');
  if (typeof style !== 'string') {
    expect(style.sources['osm-raster-tiles'].tiles).toEqual([lookalikeTileUrl]);
    expect(style.sources['osm-raster-tiles']).not.toHaveProperty('attribution');
  }
});

test('relative raster tile templates do not receive OSM attribution', () => {
  // A host-relative template cannot be parsed by `new URL`, so the OSM
  // hostname check must fall through to "not OSM" rather than throw.
  const relativeTileUrl = '/local-tiles/{z}/{x}/{y}.png';
  const style = resolveMapStyle(
    `tile://${relativeTileUrl}`,
    'default-style.json',
  );

  expect(typeof style).toBe('object');
  if (typeof style !== 'string') {
    expect(style.sources['osm-raster-tiles'].tiles).toEqual([relativeTileUrl]);
    expect(style.sources['osm-raster-tiles']).not.toHaveProperty('attribution');
  }
});

test('style JSON URLs pass through without raster wrapping', () => {
  const styleUrl = 'https://example.com/styles/custom-style.json';

  expect(isRasterTileTemplate(undefined)).toBe(false);
  expect(isRasterTileTemplate(styleUrl)).toBe(false);
  expect(resolveMapStyle(styleUrl, 'default-style.json')).toBe(styleUrl);
  expect(resolveMapStyle(undefined, 'default-style.json')).toBe(
    'default-style.json',
  );
});
