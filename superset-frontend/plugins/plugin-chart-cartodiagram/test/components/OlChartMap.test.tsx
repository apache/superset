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
import { act, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import type OlMap from 'ol/Map';
import { supersetTheme } from '@apache-superset/core/theme';
import { OlChartMap } from '../../src/components/OlChartMap';
import type { OlChartMapProps } from '../../src/types';

const mockCreateLayer = jest.fn();
const mockFitMapToCharts = jest.fn();

jest.mock('../../src/util/layerUtil', () => ({
  createLayer: (...args: unknown[]) => mockCreateLayer(...args),
}));
jest.mock('../../src/util/mapUtil', () => ({
  fitMapToCharts: (...args: unknown[]) => mockFitMapToCharts(...args),
}));
jest.mock('../../src/components/ChartLayer', () => ({
  ChartLayer: class {
    chartVizType: string;

    chartConfigs: unknown;

    constructor(options: { chartVizType: string; chartConfigs: unknown }) {
      this.chartVizType = options.chartVizType;
      this.chartConfigs = options.chartConfigs;
    }

    getExtent() {
      return undefined;
    }

    removeAllChartElements() {}

    setChartVizType(chartVizType: string) {
      this.chartVizType = chartVizType;
    }

    setChartConfig(chartConfigs: unknown) {
      this.chartConfigs = chartConfigs;
    }

    setChartBackgroundBorderRadius() {}

    setChartBackgroundCssColor() {}

    setChartSizeValues() {}

    changed() {}
  },
}));

const store = configureStore({
  reducer: { common: () => ({ locale: 'en' }) },
});

const createMap = () => {
  const callbacks = new Map<string, () => void>();
  const layers: object[] = [];
  const insertAt = jest.fn((index: number, layer: object) =>
    layers.splice(index, 0, layer),
  );
  const layerCollection = {
    getArray: () => layers,
    forEach: (callback: (layer: object) => void) => layers.forEach(callback),
    insertAt,
  };
  const view = {
    fit: jest.fn(),
    getCenter: jest.fn(() => [0, 0]),
    getZoom: jest.fn(() => 1),
    on: jest.fn(() => ({})),
  };
  const map = {
    addLayer: jest.fn((layer: object) => layers.push(layer)),
    getInteractions: jest.fn(() => ({ forEach: jest.fn() })),
    getLayers: jest.fn(() => layerCollection),
    getView: jest.fn(() => view),
    on: jest.fn((event: string, callback: () => void) => {
      callbacks.set(event, callback);
      return {};
    }),
    removeLayer: jest.fn((layer: object) => {
      const index = layers.indexOf(layer);
      if (index >= 0) {
        layers.splice(index, 1);
      }
    }),
    render: jest.fn(),
    setTarget: jest.fn(),
    updateSize: jest.fn(),
  };
  return { callbacks, insertAt, map: map as unknown as OlMap };
};

const createMockLayer = () => {
  const callbacks = new Map<string, () => void>();
  const source = {
    addEventListener: jest.fn((event: string, callback: () => void) => {
      callbacks.set(event, callback);
    }),
    removeEventListener: jest.fn(),
  };
  return {
    callbacks,
    layer: { getSource: () => source },
    source,
  };
};

const buildProps = (olMap: OlMap): OlChartMapProps => ({
  chartBackgroundBorderRadius: 0,
  chartBackgroundColor: { r: 255, g: 255, b: 255, a: 1 },
  chartConfigs: { type: 'FeatureCollection', features: [] },
  chartSize: {
    type: 'FIXED',
    configs: { zoom: 1, width: 100, height: 100 },
    values: { 1: { width: 100, height: 100 } },
  },
  chartVizType: 'pie',
  data: [],
  geomColumn: 'geometry',
  height: 600,
  layerConfigs: [
    {
      title: 'base',
      type: 'XYZ',
      url: 'https://example.test/{z}/{x}/{y}.png',
    },
  ],
  mapId: 'map',
  mapView: {
    mode: 'FIT_DATA',
    zoom: 1,
    latitude: 0,
    longitude: 0,
    fixedZoom: 1,
    fixedLatitude: 0,
    fixedLongitude: 0,
  },
  olMap,
  selectedChart: 'pie',
  setControlValue: jest.fn(),
  theme: supersetTheme,
  width: 800,
});

beforeEach(() => {
  jest.clearAllMocks();
});

test('requires layer creation and a later OpenLayers rendercomplete event', async () => {
  const { layer } = createMockLayer();
  let resolveLayer: (resolvedLayer: object) => void = () => {};
  mockCreateLayer.mockImplementation(
    () =>
      new Promise<object>(resolve => {
        resolveLayer = resolve;
      }),
  );
  const { callbacks, map } = createMap();
  const { container } = render(
    <Provider store={store}>
      <OlChartMap {...buildProps(map)} />
    </Provider>,
  );
  const mapHost = container.querySelector('[data-superset-map-status]');
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');

  act(() => callbacks.get('rendercomplete')?.());
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');

  await act(async () => resolveLayer(layer));
  await waitFor(() => expect(mockCreateLayer).toHaveBeenCalledTimes(1));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');

  act(() => callbacks.get('rendercomplete')?.());
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');

  act(() => callbacks.get('movestart')?.());
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');
  act(() => callbacks.get('rendercomplete')?.());
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');
});

test.each(['tileloaderror', 'featuresloaderror'])(
  'stays loading after a source %s event even if rendering completes',
  async loadErrorEvent => {
    const { callbacks: sourceCallbacks, layer, source } = createMockLayer();
    mockCreateLayer.mockResolvedValue(layer);
    const { callbacks: mapCallbacks, map } = createMap();
    const { container } = render(
      <Provider store={store}>
        <OlChartMap {...buildProps(map)} />
      </Provider>,
    );

    await waitFor(() =>
      expect(source.addEventListener).toHaveBeenCalledWith(
        loadErrorEvent,
        expect.any(Function),
      ),
    );
    act(() => sourceCallbacks.get(loadErrorEvent)?.());
    act(() => mapCallbacks.get('rendercomplete')?.());

    expect(
      container.querySelector('[data-superset-map-status]'),
    ).toHaveAttribute('data-superset-map-status', 'loading');
  },
);

test('does not mark an OpenLayers map complete when a configured layer fails', async () => {
  mockCreateLayer.mockResolvedValue(undefined);
  const { callbacks, map } = createMap();
  const { container } = render(
    <Provider store={store}>
      <OlChartMap {...buildProps(map)} />
    </Provider>,
  );

  await waitFor(() => expect(mockCreateLayer).toHaveBeenCalledTimes(1));
  act(() => callbacks.get('rendercomplete')?.());

  expect(container.querySelector('[data-superset-map-status]')).toHaveAttribute(
    'data-superset-map-status',
    'loading',
  );
});

test('ignores a stale layer promise after layer configuration changes', async () => {
  const staleLayer = { id: 'stale', getSource: () => null };
  const currentLayer = { id: 'current', getSource: () => null };
  let resolveStaleLayer: (layer: object) => void = () => {};
  mockCreateLayer.mockImplementation((config: { title: string }) =>
    config.title === 'stale'
      ? new Promise<object>(resolve => {
          resolveStaleLayer = resolve;
        })
      : Promise.resolve(currentLayer),
  );
  const { callbacks, insertAt, map } = createMap();
  const initialProps = buildProps(map);
  const { container, rerender } = render(
    <Provider store={store}>
      <OlChartMap
        {...initialProps}
        layerConfigs={[{ ...initialProps.layerConfigs[0], title: 'stale' }]}
      />
    </Provider>,
  );

  rerender(
    <Provider store={store}>
      <OlChartMap
        {...initialProps}
        layerConfigs={[{ ...initialProps.layerConfigs[0], title: 'current' }]}
      />
    </Provider>,
  );
  await waitFor(() => expect(insertAt).toHaveBeenCalledWith(0, currentLayer));
  act(() => callbacks.get('rendercomplete')?.());
  expect(container.querySelector('[data-superset-map-status]')).toHaveAttribute(
    'data-superset-map-status',
    'rendered',
  );

  await act(async () => resolveStaleLayer(staleLayer));
  expect(insertAt).not.toHaveBeenCalledWith(0, staleLayer);
  expect(container.querySelector('[data-superset-map-status]')).toHaveAttribute(
    'data-superset-map-status',
    'rendered',
  );
});
