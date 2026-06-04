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

const setBootstrap = (conf: Record<string, unknown>) => {
  document.body.innerHTML = `<div id="app" data-bootstrap='${JSON.stringify({
    common: { conf },
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

test('deck.gl map renderer disables Mapbox with an explanation when no key exists', () => {
  setBootstrap({});

  const props = getMapProviderProps('maplibre');

  expect(props.options).toEqual([
    { value: 'maplibre', label: 'MapLibre (open-source)' },
    {
      value: 'mapbox',
      label: 'Mapbox (MAPBOX_API_KEY required)',
      disabled: true,
    },
  ]);
  expect(props.warning).toBe(
    'Mapbox requires MAPBOX_API_KEY to be configured on the server.',
  );
});

test('deck.gl map renderer keeps saved Mapbox visible while disabled without a key', () => {
  setBootstrap({});

  const props = getMapProviderProps('mapbox');

  expect(props.options).toContainEqual({
    value: 'mapbox',
    label: 'Mapbox (MAPBOX_API_KEY required)',
    disabled: true,
  });
});

test('deck.gl map renderer enables Mapbox when a key exists', () => {
  setBootstrap({ MAPBOX_API_KEY: 'pk.test' });

  const props = getMapProviderProps('maplibre');

  expect(props.options).toEqual([
    { value: 'maplibre', label: 'MapLibre (open-source)' },
    { value: 'mapbox', label: 'Mapbox (API key required)' },
  ]);
  expect(props.warning).toBeUndefined();
});
