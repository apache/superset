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

import { ControlPanelState } from '@superset-ui/chart-controls';
import { OSM_TILE_STYLE_URL } from '@superset-ui/core/utils/mapStyles';
import { mapProvider, maplibreStyle } from './Shared_DeckGL';

const setBootstrap = ({
  conf = {},
  deckglTiles,
}: {
  conf?: Record<string, unknown>;
  deckglTiles?: unknown;
}) => {
  document.body.innerHTML = `<div id="app" data-bootstrap='${JSON.stringify({
    common: {
      conf,
      ...(deckglTiles === undefined ? {} : { deckgl_tiles: deckglTiles }),
    },
  })}'></div>`;
};

type MapProviderControlConfig = typeof mapProvider.config & {
  mapStateToProps: (state: ControlPanelState) => {
    options?: unknown;
    warning?: string;
  };
};

const getMapProviderProps = (value?: string) =>
  (mapProvider.config as MapProviderControlConfig).mapStateToProps({
    form_data: { map_renderer: value },
  } as unknown as ControlPanelState);

test('deck.gl MapLibre style choices expose Streets (OSM)', () => {
  expect(maplibreStyle.config.choices).toContainEqual([
    OSM_TILE_STYLE_URL,
    'Streets (OSM)',
  ]);
});

test('deck.gl map renderer hides Mapbox when no key exists for new selections', () => {
  setBootstrap({ conf: {} });

  const props = getMapProviderProps('maplibre');

  expect(props.options).toEqual([{ value: 'maplibre', label: 'MapLibre' }]);
});

test('deck.gl map renderer keeps saved Mapbox visible while disabled without a key', () => {
  setBootstrap({ conf: {} });

  const props = getMapProviderProps('mapbox');

  expect(props.options).toContainEqual({
    value: 'mapbox',
    label: 'Mapbox',
    disabled: true,
  });
});

test('deck.gl map renderer enables Mapbox when a key exists', () => {
  setBootstrap({ conf: { MAPBOX_API_KEY: 'pk.test' } });

  const props = getMapProviderProps('maplibre');

  expect(props.options).toEqual([
    { value: 'maplibre', label: 'MapLibre' },
    { value: 'mapbox', label: 'Mapbox' },
  ]);
});

test('deck.gl map renderer defaults to configured Mapbox when a key exists', async () => {
  jest.resetModules();
  setBootstrap({
    conf: { DEFAULT_MAP_RENDERER: 'mapbox', MAPBOX_API_KEY: 'pk.test' },
  });

  const { mapProvider: mapProviderWithMapboxDefault } =
    await import('./Shared_DeckGL');

  expect(mapProviderWithMapboxDefault.config.default).toBe('mapbox');
});

test('deck.gl map renderer falls back from configured Mapbox default without a key', async () => {
  jest.resetModules();
  setBootstrap({ conf: { DEFAULT_MAP_RENDERER: 'mapbox' } });

  const { mapProvider: mapProviderWithoutKey } =
    await import('./Shared_DeckGL');

  expect(mapProviderWithoutKey.config.default).toBe('maplibre');
});

test('deck.gl map style falls back to default tiles for empty overrides', async () => {
  jest.resetModules();
  setBootstrap({ deckglTiles: [] });

  const { maplibreStyle: maplibreStyleWithEmptyOverride } =
    await import('./Shared_DeckGL');

  expect(maplibreStyleWithEmptyOverride.config.choices).toContainEqual([
    OSM_TILE_STYLE_URL,
    'Streets (OSM)',
  ]);
  expect(maplibreStyleWithEmptyOverride.config.default).toBe(
    'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  );
});

test('deck.gl map style falls back to default tiles for malformed overrides', async () => {
  jest.resetModules();
  setBootstrap({
    deckglTiles: [
      ['https://tiles.example.com/{z}/{x}/{y}.png'],
      ['https://tiles.example.com/{z}/{x}/{y}.png', 'Custom', 'Extra'],
      ['', 'Empty URL'],
    ],
  });

  const { maplibreStyle: maplibreStyleWithMalformedOverride } =
    await import('./Shared_DeckGL');

  expect(maplibreStyleWithMalformedOverride.config.choices).toContainEqual([
    OSM_TILE_STYLE_URL,
    'Streets (OSM)',
  ]);
  expect(maplibreStyleWithMalformedOverride.config.default).toBe(
    'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  );
});

test('deck.gl map style accepts well-formed tile overrides', async () => {
  jest.resetModules();
  setBootstrap({
    deckglTiles: [['https://tiles.example.com/style.json', 'Custom']],
  });

  const { maplibreStyle: maplibreStyleWithCustomOverride } =
    await import('./Shared_DeckGL');

  expect(maplibreStyleWithCustomOverride.config.choices).toEqual([
    ['https://tiles.example.com/style.json', 'Custom'],
  ]);
  expect(maplibreStyleWithCustomOverride.config.default).toBe(
    'https://tiles.example.com/style.json',
  );
});
