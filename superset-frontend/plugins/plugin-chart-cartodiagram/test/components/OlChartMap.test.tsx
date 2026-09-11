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
const mockUnByKey = jest.fn();

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
jest.mock('ol/Observable', () => ({
  __esModule: true,
  ...jest.requireActual('ol/Observable'),
  unByKey: (...args: unknown[]) => mockUnByKey(...args),
}));

const store = configureStore({
  reducer: { common: () => ({ locale: 'en' }) },
});

const createMap = () => {
  const callbacks = new Map<string, () => void>();
  const listenerKeys = new Map<string, object>();
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
      const key = { event };
      listenerKeys.set(event, key);
      return key;
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
  return { callbacks, insertAt, listenerKeys, map: map as unknown as OlMap };
};

const createMockLayer = () => {
  const callbacks = new Map<string, (event?: { tile?: object }) => void>();
  const source = {
    addEventListener: jest.fn(
      (event: string, callback: (event?: { tile?: object }) => void) => {
        callbacks.set(event, callback);
      },
    ),
    removeEventListener: jest.fn(),
  };
  return {
    callbacks,
    layer: { getSource: () => source },
    source,
  };
};

const emitTileOutcome = (
  callbacks: Map<string, (event?: { tile?: object }) => void>,
  outcome: 'tileloadend' | 'tileloaderror',
) => {
  const tile = {};
  callbacks.get('tileloadstart')?.({ tile });
  callbacks.get(outcome)?.({ tile });
  return tile;
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
  act(() => callbacks.get('moveend')?.());
  act(() => callbacks.get('rendercomplete')?.());
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');
});

test.each([
  ['tileloaderror', 'tileloadend'],
  ['featuresloaderror', 'featuresloadend'],
])(
  'reports an all-failed source after %s and recovers on %s',
  async (loadErrorEvent, loadSuccessEvent) => {
    const loadStartEvent = loadErrorEvent.replace('error', 'start');
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
    expect(source.addEventListener).toHaveBeenCalledWith(
      loadStartEvent,
      expect.any(Function),
    );
    act(() => {
      if (loadErrorEvent === 'tileloaderror') {
        emitTileOutcome(sourceCallbacks, loadErrorEvent);
      } else {
        sourceCallbacks.get(loadStartEvent)?.();
        sourceCallbacks.get(loadErrorEvent)?.();
      }
    });
    act(() => mapCallbacks.get('rendercomplete')?.());

    expect(
      container.querySelector('[data-superset-map-status]'),
    ).toHaveAttribute('data-superset-map-status', 'error');

    act(() => {
      if (loadSuccessEvent === 'tileloadend') {
        emitTileOutcome(sourceCallbacks, loadSuccessEvent);
      } else {
        sourceCallbacks.get(loadStartEvent)?.();
        sourceCallbacks.get(loadSuccessEvent)?.();
      }
    });
    expect(
      container.querySelector('[data-superset-map-status]'),
    ).toHaveAttribute('data-superset-map-status', 'loading');
    act(() => mapCallbacks.get('rendercomplete')?.());
    expect(
      container.querySelector('[data-superset-map-status]'),
    ).toHaveAttribute('data-superset-map-status', 'rendered');

    act(() => {
      sourceCallbacks.get(loadStartEvent)?.(
        loadStartEvent === 'tileloadstart' ? { tile: {} } : undefined,
      );
    });
    expect(
      container.querySelector('[data-superset-map-status]'),
    ).toHaveAttribute('data-superset-map-status', 'loading');
    act(() => mapCallbacks.get('rendercomplete')?.());
    expect(
      container.querySelector('[data-superset-map-status]'),
    ).toHaveAttribute(
      'data-superset-map-status',
      loadStartEvent === 'tileloadstart' ? 'rendered' : 'error',
    );
  },
);

test.each(['tileloadstart', 'featuresloadstart'])(
  'reports an unresolved %s request on render completion',
  async loadStartEvent => {
    const { callbacks: sourceCallbacks, layer } = createMockLayer();
    mockCreateLayer.mockResolvedValue(layer);
    const { callbacks: mapCallbacks, map } = createMap();
    const { container } = render(
      <Provider store={store}>
        <OlChartMap {...buildProps(map)} />
      </Provider>,
    );

    await waitFor(() => expect(mockCreateLayer).toHaveBeenCalledTimes(1));
    act(() => {
      sourceCallbacks.get(loadStartEvent)?.(
        loadStartEvent === 'tileloadstart' ? { tile: {} } : undefined,
      );
      mapCallbacks.get('rendercomplete')?.();
    });

    expect(
      container.querySelector('[data-superset-map-status]'),
    ).toHaveAttribute('data-superset-map-status', 'error');
  },
);

test('does not let one successful source mask another all-failed source', async () => {
  const first = createMockLayer();
  const second = createMockLayer();
  mockCreateLayer
    .mockResolvedValueOnce(first.layer)
    .mockResolvedValueOnce(second.layer);
  const { callbacks, map } = createMap();
  const props = buildProps(map);
  const { container } = render(
    <Provider store={store}>
      <OlChartMap
        {...props}
        layerConfigs={[
          props.layerConfigs[0],
          { ...props.layerConfigs[0], title: 'second' },
        ]}
      />
    </Provider>,
  );

  await waitFor(() => expect(mockCreateLayer).toHaveBeenCalledTimes(2));
  act(() => {
    emitTileOutcome(first.callbacks, 'tileloadend');
    emitTileOutcome(second.callbacks, 'tileloaderror');
    callbacks.get('rendercomplete')?.();
  });
  expect(container.querySelector('[data-superset-map-status]')).toHaveAttribute(
    'data-superset-map-status',
    'error',
  );

  act(() => emitTileOutcome(second.callbacks, 'tileloadend'));
  expect(container.querySelector('[data-superset-map-status]')).toHaveAttribute(
    'data-superset-map-status',
    'loading',
  );
  act(() => callbacks.get('rendercomplete')?.());
  expect(container.querySelector('[data-superset-map-status]')).toHaveAttribute(
    'data-superset-map-status',
    'rendered',
  );
});

test('does not reuse source success after the map viewport moves', async () => {
  const { callbacks: sourceCallbacks, layer } = createMockLayer();
  mockCreateLayer.mockResolvedValue(layer);
  const { callbacks: mapCallbacks, map } = createMap();
  const { container } = render(
    <Provider store={store}>
      <OlChartMap {...buildProps(map)} />
    </Provider>,
  );

  await waitFor(() => expect(mockCreateLayer).toHaveBeenCalledTimes(1));
  act(() => {
    emitTileOutcome(sourceCallbacks, 'tileloadend');
    mapCallbacks.get('rendercomplete')?.();
  });
  expect(container.querySelector('[data-superset-map-status]')).toHaveAttribute(
    'data-superset-map-status',
    'rendered',
  );

  act(() => {
    mapCallbacks.get('movestart')?.();
    emitTileOutcome(sourceCallbacks, 'tileloaderror');
    mapCallbacks.get('moveend')?.();
    mapCallbacks.get('rendercomplete')?.();
  });
  expect(container.querySelector('[data-superset-map-status]')).toHaveAttribute(
    'data-superset-map-status',
    'error',
  );
});

test('carries an unrecovered source failure across a viewport render', async () => {
  const { callbacks: sourceCallbacks, layer } = createMockLayer();
  mockCreateLayer.mockResolvedValue(layer);
  const { callbacks: mapCallbacks, map } = createMap();
  const { container } = render(
    <Provider store={store}>
      <OlChartMap {...buildProps(map)} />
    </Provider>,
  );
  const mapHost = container.querySelector('[data-superset-map-status]');

  await waitFor(() => expect(mockCreateLayer).toHaveBeenCalledTimes(1));
  act(() => {
    emitTileOutcome(sourceCallbacks, 'tileloaderror');
    mapCallbacks.get('rendercomplete')?.();
  });
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');

  act(() => {
    mapCallbacks.get('movestart')?.();
    mapCallbacks.get('moveend')?.();
    mapCallbacks.get('rendercomplete')?.();
  });
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');
});

test('retains painted tile success when the same source reloads', async () => {
  const { callbacks: sourceCallbacks, layer } = createMockLayer();
  mockCreateLayer.mockResolvedValue(layer);
  const { callbacks: mapCallbacks, map } = createMap();
  const { container } = render(
    <Provider store={store}>
      <OlChartMap {...buildProps(map)} />
    </Provider>,
  );
  const mapHost = container.querySelector('[data-superset-map-status]');

  await waitFor(() => expect(mockCreateLayer).toHaveBeenCalledTimes(1));
  act(() => {
    emitTileOutcome(sourceCallbacks, 'tileloadend');
    mapCallbacks.get('rendercomplete')?.();
  });
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');

  act(() => {
    emitTileOutcome(sourceCallbacks, 'tileloaderror');
    mapCallbacks.get('rendercomplete')?.();
  });
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');
});

test('ignores a late tile completion from an earlier viewport', async () => {
  const { callbacks: sourceCallbacks, layer } = createMockLayer();
  mockCreateLayer.mockResolvedValue(layer);
  const { callbacks: mapCallbacks, map } = createMap();
  const { container } = render(
    <Provider store={store}>
      <OlChartMap {...buildProps(map)} />
    </Provider>,
  );
  const mapHost = container.querySelector('[data-superset-map-status]');

  await waitFor(() => expect(mockCreateLayer).toHaveBeenCalledTimes(1));
  const oldTile = {};
  const currentTile = {};
  act(() => {
    sourceCallbacks.get('tileloadstart')?.({ tile: oldTile });
    mapCallbacks.get('movestart')?.();
    sourceCallbacks.get('tileloadstart')?.({ tile: currentTile });
    sourceCallbacks.get('tileloaderror')?.({ tile: currentTile });
    mapCallbacks.get('moveend')?.();
    sourceCallbacks.get('tileloadend')?.({ tile: oldTile });
    mapCallbacks.get('rendercomplete')?.();
  });

  expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');
});

test('carries a pending tile into the final viewport and records its late error', async () => {
  const { callbacks: sourceCallbacks, layer } = createMockLayer();
  mockCreateLayer.mockResolvedValue(layer);
  const { callbacks: mapCallbacks, map } = createMap();
  const { container } = render(
    <Provider store={store}>
      <OlChartMap {...buildProps(map)} />
    </Provider>,
  );
  const mapHost = container.querySelector('[data-superset-map-status]');

  await waitFor(() => expect(mockCreateLayer).toHaveBeenCalledTimes(1));
  const tile = {};
  act(() => {
    sourceCallbacks.get('tileloadstart')?.({ tile });
    mapCallbacks.get('movestart')?.();
    mapCallbacks.get('moveend')?.();
    sourceCallbacks.get('tileloaderror')?.({ tile });
    mapCallbacks.get('rendercomplete')?.();
  });

  expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');
});

test('does not let intermediate success erase a failure at move end', async () => {
  const { callbacks: sourceCallbacks, layer } = createMockLayer();
  mockCreateLayer.mockResolvedValue(layer);
  const { callbacks: mapCallbacks, map } = createMap();
  const { container } = render(
    <Provider store={store}>
      <OlChartMap {...buildProps(map)} />
    </Provider>,
  );
  const mapHost = container.querySelector('[data-superset-map-status]');

  await waitFor(() => expect(mockCreateLayer).toHaveBeenCalledTimes(1));
  act(() => {
    mapCallbacks.get('movestart')?.();
    emitTileOutcome(sourceCallbacks, 'tileloadend');
    emitTileOutcome(sourceCallbacks, 'tileloaderror');
    mapCallbacks.get('moveend')?.();
    mapCallbacks.get('rendercomplete')?.();
  });

  expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');
});

test('does not let rebased success mask a final viewport failure', async () => {
  const { callbacks: sourceCallbacks, layer } = createMockLayer();
  mockCreateLayer.mockResolvedValue(layer);
  const { callbacks: mapCallbacks, map } = createMap();
  const { container } = render(
    <Provider store={store}>
      <OlChartMap {...buildProps(map)} />
    </Provider>,
  );
  const mapHost = container.querySelector('[data-superset-map-status]');

  await waitFor(() => expect(mockCreateLayer).toHaveBeenCalledTimes(1));
  const rebasedTile = {};
  act(() => {
    sourceCallbacks.get('tileloadstart')?.({ tile: rebasedTile });
    mapCallbacks.get('movestart')?.();
    mapCallbacks.get('moveend')?.();
    emitTileOutcome(sourceCallbacks, 'tileloaderror');
    sourceCallbacks.get('tileloadend')?.({ tile: rebasedTile });
    mapCallbacks.get('rendercomplete')?.();
  });

  expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');
});

test('keeps a feature failure when an older feature request succeeds late', async () => {
  const { callbacks: sourceCallbacks, layer } = createMockLayer();
  mockCreateLayer.mockResolvedValue(layer);
  const { callbacks: mapCallbacks, map } = createMap();
  const { container } = render(
    <Provider store={store}>
      <OlChartMap {...buildProps(map)} />
    </Provider>,
  );
  const mapHost = container.querySelector('[data-superset-map-status]');

  await waitFor(() => expect(mockCreateLayer).toHaveBeenCalledTimes(1));
  act(() => {
    sourceCallbacks.get('featuresloadstart')?.();
    mapCallbacks.get('movestart')?.();
    sourceCallbacks.get('featuresloadstart')?.();
    sourceCallbacks.get('featuresloaderror')?.();
    mapCallbacks.get('moveend')?.();
    sourceCallbacks.get('featuresloadend')?.();
    mapCallbacks.get('rendercomplete')?.();
  });

  expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');
});

test('recovers a feature failure only after a fresh request completes', async () => {
  const { callbacks: sourceCallbacks, layer } = createMockLayer();
  mockCreateLayer.mockResolvedValue(layer);
  const { callbacks: mapCallbacks, map } = createMap();
  const { container } = render(
    <Provider store={store}>
      <OlChartMap {...buildProps(map)} />
    </Provider>,
  );
  const mapHost = container.querySelector('[data-superset-map-status]');

  await waitFor(() => expect(mockCreateLayer).toHaveBeenCalledTimes(1));
  act(() => {
    sourceCallbacks.get('featuresloadstart')?.();
    sourceCallbacks.get('featuresloaderror')?.();
    mapCallbacks.get('rendercomplete')?.();
  });
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');

  act(() => {
    sourceCallbacks.get('featuresloadstart')?.();
    sourceCallbacks.get('featuresloadend')?.();
    mapCallbacks.get('rendercomplete')?.();
  });
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');
});

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
    'error',
  );
});

test('removes every source outcome listener on unmount', async () => {
  const { layer, source } = createMockLayer();
  mockCreateLayer.mockResolvedValue(layer);
  const { map } = createMap();
  const { unmount } = render(
    <Provider store={store}>
      <OlChartMap {...buildProps(map)} />
    </Provider>,
  );
  await waitFor(() => expect(mockCreateLayer).toHaveBeenCalledTimes(1));

  unmount();

  for (const event of [
    'tileloadstart',
    'featuresloadstart',
    'tileloaderror',
    'featuresloaderror',
    'tileloadend',
    'featuresloadend',
  ]) {
    expect(source.removeEventListener).toHaveBeenCalledWith(
      event,
      expect.any(Function),
    );
  }
});

test('removes map completion and movement listeners on unmount', async () => {
  const { layer } = createMockLayer();
  mockCreateLayer.mockResolvedValue(layer);
  const { listenerKeys, map } = createMap();
  const { unmount } = render(
    <Provider store={store}>
      <OlChartMap {...buildProps(map)} />
    </Provider>,
  );
  await waitFor(() => expect(mockCreateLayer).toHaveBeenCalledTimes(1));

  unmount();

  expect(mockUnByKey).toHaveBeenCalledWith(
    expect.arrayContaining([
      listenerKeys.get('rendercomplete'),
      listenerKeys.get('movestart'),
      listenerKeys.get('moveend'),
    ]),
  );
});

test('ignores source events after its layer configuration is replaced', async () => {
  const stale = createMockLayer();
  const current = createMockLayer();
  mockCreateLayer
    .mockResolvedValueOnce(stale.layer)
    .mockResolvedValueOnce(current.layer);
  const { callbacks: mapCallbacks, map } = createMap();
  const initialProps = buildProps(map);
  const { container, rerender } = render(
    <Provider store={store}>
      <OlChartMap {...initialProps} />
    </Provider>,
  );
  await waitFor(() => expect(stale.source.addEventListener).toHaveBeenCalled());

  rerender(
    <Provider store={store}>
      <OlChartMap
        {...initialProps}
        layerConfigs={[
          { ...initialProps.layerConfigs[0], title: 'replacement' },
        ]}
      />
    </Provider>,
  );
  await waitFor(() =>
    expect(current.source.addEventListener).toHaveBeenCalled(),
  );
  act(() => {
    emitTileOutcome(current.callbacks, 'tileloadend');
    mapCallbacks.get('rendercomplete')?.();
  });
  const mapHost = container.querySelector('[data-superset-map-status]');
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');

  act(() => emitTileOutcome(stale.callbacks, 'tileloaderror'));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');
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
