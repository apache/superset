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
    default?: unknown;
  };
};

const getMapProviderProps = (value?: string) =>
  (mapProvider.config as MapProviderControlConfig).mapStateToProps({
    form_data: { map_renderer: value },
  } as unknown as ControlPanelState);

type MapLibreStyleControlConfig = typeof maplibreStyle.config & {
  mapStateToProps: () => {
    choices: unknown;
    default: unknown;
  };
};

const getMapLibreStyleProps = () =>
  (maplibreStyle.config as MapLibreStyleControlConfig).mapStateToProps();

test('deck.gl MapLibre style choices expose Streets (OSM)', () => {
  expect(maplibreStyle.config.choices).toContainEqual([
    OSM_TILE_STYLE_URL,
    'Streets (OSM)',
  ]);
});

test('deck.gl map renderer hides Mapbox when no key exists for new selections', () => {
  setBootstrap({ conf: {} });

  const props = getMapProviderProps('maplibre');

  expect(props.options).toEqual([
    { value: 'maplibre', label: 'MapLibre (open-source)' },
  ]);
});

test('deck.gl map renderer keeps saved Mapbox visible while disabled without a key', () => {
  setBootstrap({ conf: {} });

  const props = getMapProviderProps('mapbox');

  expect(props.options).toContainEqual({
    value: 'mapbox',
    label: 'Mapbox (API key required)',
    disabled: true,
  });
});

test('deck.gl map renderer enables Mapbox when a key exists', () => {
  setBootstrap({ conf: { MAPBOX_API_KEY: 'pk.test' } });

  const props = getMapProviderProps('maplibre');

  expect(props.options).toEqual([
    { value: 'maplibre', label: 'MapLibre (open-source)' },
    { value: 'mapbox', label: 'Mapbox (API key required)' },
  ]);
});

test('deck.gl map renderer keeps the original explanatory description', () => {
  expect(mapProvider.config.description).toBe(
    'Select the map tile provider. MapLibre is open-source and requires no API key. Mapbox requires MAPBOX_API_KEY to be configured in Superset.',
  );
});

test('deck.gl map renderer defaults to configured Mapbox when a key exists', () => {
  setBootstrap({
    conf: { DEFAULT_MAP_RENDERER: 'mapbox', MAPBOX_API_KEY: 'pk.test' },
  });

  expect(getMapProviderProps('maplibre').default).toBe('mapbox');
});

test('deck.gl map renderer falls back from configured Mapbox default without a key', () => {
  setBootstrap({ conf: { DEFAULT_MAP_RENDERER: 'mapbox' } });

  expect(getMapProviderProps('maplibre').default).toBe('maplibre');
});

test('deck.gl map style falls back to default tiles for empty overrides', () => {
  setBootstrap({ deckglTiles: [] });

  const props = getMapLibreStyleProps();

  expect(props.choices).toContainEqual([OSM_TILE_STYLE_URL, 'Streets (OSM)']);
  expect(props.default).toBe(
    'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  );
});

test('deck.gl map style falls back to default tiles for malformed overrides', () => {
  setBootstrap({
    deckglTiles: [
      ['https://tiles.example.com/{z}/{x}/{y}.png'],
      ['https://tiles.example.com/{z}/{x}/{y}.png', 'Custom', 'Extra'],
      ['', 'Empty URL'],
    ],
  });

  const props = getMapLibreStyleProps();

  expect(props.choices).toContainEqual([OSM_TILE_STYLE_URL, 'Streets (OSM)']);
  expect(props.default).toBe(
    'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  );
});

test('deck.gl map style accepts well-formed tile overrides', () => {
  setBootstrap({
    deckglTiles: [['https://tiles.example.com/style.json', 'Custom']],
  });

  const props = getMapLibreStyleProps();

  expect(props.choices).toEqual([
    ['https://tiles.example.com/style.json', 'Custom'],
  ]);
  expect(props.default).toBe('https://tiles.example.com/style.json');
});
