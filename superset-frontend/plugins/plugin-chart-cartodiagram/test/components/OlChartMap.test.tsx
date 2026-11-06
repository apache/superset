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
import { render } from '@testing-library/react';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import { fromLonLat, toLonLat } from 'ol/proj';
import { supersetTheme } from '@apache-superset/core/theme';
import OlChartMap from '../../src/components/OlChartMap';
import { ChartLayer } from '../../src/components/ChartLayer';
import {
  ChartConfig,
  MapMaxExtentConfigs,
  MapViewConfigs,
  OlChartMapProps,
} from '../../src/types';

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: () => 'en',
}));

const chartConfigsAt = (coordinates: [number, number][]): ChartConfig => ({
  type: 'FeatureCollection',
  features: coordinates.map(point => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: point },
    properties: {},
  })),
});

const SAN_FRANCISCO = chartConfigsAt([
  [-122.45, 37.75],
  [-122.4, 37.8],
]);
const LONDON = chartConfigsAt([
  [-0.15, 51.48],
  [-0.1, 51.52],
]);

const renderMap = (
  mapView: Partial<MapViewConfigs>,
  mapMaxExtent: Partial<MapMaxExtentConfigs> = {},
) => {
  const olMap = new Map({ view: new View({ center: [0, 0], zoom: 2 }) });
  const setControlValue = jest.fn();
  const props = {
    olMap,
    width: 400,
    height: 300,
    chartConfigs: SAN_FRANCISCO,
    chartVizType: 'pie',
    chartSize: {
      type: 'FIXED',
      configs: { zoom: 2, width: 20, height: 20 },
      values: {},
    },
    layerConfigs: [],
    mapView: {
      mode: 'FIT_DATA',
      zoom: 2,
      latitude: 0,
      longitude: 0,
      fixedZoom: 2,
      fixedLatitude: 0,
      fixedLongitude: 0,
      ...mapView,
    },
    mapMaxExtent: {
      extentMode: 'NONE',
      maxX: 0,
      maxY: 0,
      minX: 0,
      minY: 0,
      fixedMaxX: undefined,
      fixedMaxY: undefined,
      fixedMinX: undefined,
      fixedMinY: undefined,
      ...mapMaxExtent,
    },
    minZoom: 0,
    maxZoom: 28,
    chartBackgroundColor: { r: 255, g: 255, b: 255, a: 0 },
    chartBackgroundBorderRadius: 0,
    setControlValue,
    theme: supersetTheme,
  } as unknown as OlChartMapProps;
  const result = render(<OlChartMap {...props} />);
  const centerLatitude = () => toLonLat(olMap.getView().getCenter()!)[1];
  const centerLonLat = () => toLonLat(olMap.getView().getCenter()!);
  const refresh = (chartConfigs: ChartConfig) =>
    result.rerender(<OlChartMap {...props} chartConfigs={chartConfigs} />);
  const changeMapMaxExtent = (extent: Partial<MapMaxExtentConfigs>) =>
    result.rerender(
      <OlChartMap
        {...props}
        mapMaxExtent={{ ...props.mapMaxExtent, ...extent }}
      />,
    );
  return {
    olMap,
    setControlValue,
    unmount: result.unmount,
    centerLatitude,
    centerLonLat,
    refresh,
    changeMapMaxExtent,
  };
};

test('refits to the charts of a refreshed response in FIT_DATA mode', () => {
  const { centerLatitude, refresh } = renderMap({ mode: 'FIT_DATA' });
  expect(centerLatitude()).toBeCloseTo(37.775, 1);

  // An auto-refresh keeps the chart mounted and passes the new rows in.
  refresh(LONDON);

  expect(centerLatitude()).toBeCloseTo(51.5, 1);
});

test('keeps the fixed view of a CUSTOM map view when the data changes', () => {
  const { centerLatitude, refresh } = renderMap({
    mode: 'CUSTOM',
    fixedLatitude: 10,
    fixedLongitude: 20,
  });
  expect(centerLatitude()).toBeCloseTo(10);

  refresh(LONDON);

  expect(centerLatitude()).toBeCloseTo(10);
});

test('constrains panning to CUSTOM max extent bounds given in degrees', () => {
  // Asymmetric bounds, so swapped or unconverted coordinates are caught.
  const { olMap, centerLonLat, changeMapMaxExtent } = renderMap(
    {
      mode: 'CUSTOM',
      fixedLongitude: 11,
      fixedLatitude: 41,
      fixedZoom: 10,
    },
    {
      extentMode: 'CUSTOM',
      fixedMinX: 10,
      fixedMinY: 40,
      fixedMaxX: 12,
      fixedMaxY: 42,
    },
  );
  // jsdom has no layout, so the map needs an explicit size.
  olMap.setSize([400, 300]);
  const outside = fromLonLat([50, 60]);

  olMap.getView().setCenter(outside);

  const [lonBounded, latBounded] = centerLonLat();
  expect(lonBounded).toBeGreaterThanOrEqual(10);
  expect(lonBounded).toBeLessThanOrEqual(12);
  expect(latBounded).toBeGreaterThanOrEqual(40);
  expect(latBounded).toBeLessThanOrEqual(42);

  changeMapMaxExtent({ extentMode: 'NONE' });
  olMap.getView().setCenter(outside);

  const [lonFree, latFree] = centerLonLat();
  expect(lonFree).toBeCloseTo(50);
  expect(latFree).toBeCloseTo(60);
});

test('detaches the map and unmounts the charts when the component unmounts', () => {
  const { olMap, unmount } = renderMap({ mode: 'FIT_DATA' });
  const chartLayer = olMap
    .getLayers()
    .getArray()
    .find(layer => layer instanceof ChartLayer) as ChartLayer;
  const removeCharts = jest.spyOn(chartLayer, 'removeAllChartElements');
  expect(olMap.getTarget()).toBeDefined();

  unmount();

  expect(olMap.getTarget()).toBeUndefined();
  expect(removeCharts).toHaveBeenCalled();
});

test('syncs the controls on moveend, also after the view was replaced', () => {
  const { olMap, setControlValue } = renderMap({ mode: 'FIT_DATA' });
  // jsdom has no layout, so the map needs an explicit size.
  olMap.setSize([400, 300]);
  setControlValue.mockClear();

  olMap.setView(new View({ center: fromLonLat([20, 10]), zoom: 5 }));
  olMap.dispatchEvent('moveend');

  const mapViewCall = setControlValue.mock.calls.find(
    ([name]) => name === 'map_view',
  );
  expect(mapViewCall?.[1].latitude).toBeCloseTo(10);
  expect(mapViewCall?.[1].longitude).toBeCloseTo(20);
  expect(setControlValue).toHaveBeenCalledWith(
    'map_max_extent',
    expect.anything(),
  );
  expect(setControlValue).toHaveBeenCalledWith(
    'chart_size',
    expect.objectContaining({
      configs: expect.objectContaining({ zoom: 5 }),
    }),
  );
});
