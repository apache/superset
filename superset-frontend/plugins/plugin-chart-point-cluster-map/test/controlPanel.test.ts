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
import type {
  ControlPanelState,
  ControlPanelConfig,
  CustomControlItem,
} from '@superset-ui/chart-controls';
import { OSM_TILE_STYLE_URL } from '@superset-ui/core/utils/mapStyles';
import controlPanel from '../src/controlPanel';

type ControlConfig = Required<CustomControlItem['config']>;

function isCustomControlItem(
  controlItem: unknown,
): controlItem is CustomControlItem & { config: ControlConfig } {
  return (
    typeof controlItem === 'object' &&
    controlItem !== null &&
    'name' in controlItem &&
    'config' in controlItem
  );
}

function getControl(
  panel: ControlPanelConfig,
  controlName: string,
): CustomControlItem & { config: ControlConfig } {
  const item = (panel.controlPanelSections || [])
    .flatMap(section => section?.controlSetRows || [])
    .flat()
    .find(
      controlItem =>
        isCustomControlItem(controlItem) && controlItem.name === controlName,
    );

  if (!isCustomControlItem(item)) {
    throw new Error(`Control "${controlName}" not found`);
  }

  return item;
}

type RendererControlConfig = ControlConfig & {
  mapStateToProps: (state: ControlPanelState) => {
    options?: unknown;
    warning?: string;
    default?: unknown;
  };
};

const setBootstrap = (conf: Record<string, unknown>) => {
  document.body.innerHTML = `<div id="app" data-bootstrap='${JSON.stringify({
    common: { conf },
  })}'></div>`;
};

const getMapRendererProps = (value?: string) =>
  (
    getControl(controlPanel, 'map_renderer').config as RendererControlConfig
  ).mapStateToProps({
    form_data: { map_renderer: value },
  } as unknown as ControlPanelState);

test('viewport controls default to empty values and rerender without query refresh', () => {
  const longitudeControl = getControl(controlPanel, 'viewport_longitude');
  const latitudeControl = getControl(controlPanel, 'viewport_latitude');
  const zoomControl = getControl(controlPanel, 'viewport_zoom');

  expect(longitudeControl.config.default).toBe('');
  expect(latitudeControl.config.default).toBe('');
  expect(zoomControl.config.default).toBe('');

  expect(longitudeControl.config.renderTrigger).toBe(true);
  expect(latitudeControl.config.renderTrigger).toBe(true);
  expect(zoomControl.config.renderTrigger).toBe(true);

  expect(longitudeControl.config.dontRefreshOnChange).toBe(true);
  expect(latitudeControl.config.dontRefreshOnChange).toBe(true);
  expect(zoomControl.config.dontRefreshOnChange).toBe(true);
});

test('opacity control rerenders immediately when changed', () => {
  const opacityControl = getControl(controlPanel, 'global_opacity');

  expect(opacityControl.config.default).toBe(1);
  expect(opacityControl.config.renderTrigger).toBe(true);
  expect(opacityControl.config.isFloat).toBe(true);
});

test('MapLibre style choices expose Streets (OSM)', () => {
  expect(
    getControl(controlPanel, 'maplibre_style').config.choices,
  ).toContainEqual([OSM_TILE_STYLE_URL, 'Streets (OSM)']);
});

test('map renderer hides Mapbox when no key exists for new selections', () => {
  setBootstrap({});

  const props = getMapRendererProps('maplibre');

  expect(props.options).toEqual([
    { value: 'maplibre', label: 'MapLibre (open-source)' },
  ]);
});

test('map renderer keeps saved Mapbox visible while disabled without a key', () => {
  setBootstrap({});

  const props = getMapRendererProps('mapbox');

  expect(props.options).toContainEqual({
    value: 'mapbox',
    label: 'Mapbox (API key required)',
    disabled: true,
  });
});

test('map renderer enables Mapbox when a key exists', () => {
  setBootstrap({ MAPBOX_API_KEY: 'pk.test' });

  const props = getMapRendererProps('maplibre');

  expect(props.options).toEqual([
    { value: 'maplibre', label: 'MapLibre (open-source)' },
    { value: 'mapbox', label: 'Mapbox (API key required)' },
  ]);
});

test('map renderer keeps the original explanatory description', () => {
  expect(getControl(controlPanel, 'map_renderer').config.description).toBe(
    'MapLibre is open-source and requires no API key. Mapbox requires MAPBOX_API_KEY to be configured on the server.',
  );
});

test('map renderer defaults to configured Mapbox when a key exists', () => {
  setBootstrap({
    DEFAULT_MAP_RENDERER: 'mapbox',
    MAPBOX_API_KEY: 'pk.test',
  });

  expect(getMapRendererProps('maplibre').default).toBe('mapbox');
});

test('map renderer falls back from configured Mapbox default without a key', () => {
  setBootstrap({ DEFAULT_MAP_RENDERER: 'mapbox' });

  expect(getMapRendererProps('maplibre').default).toBe('maplibre');
});
