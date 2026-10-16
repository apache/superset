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
import { toLonLat } from 'ol/proj';
import { supersetTheme } from '@apache-superset/core/theme';
import OlChartMap from '../../src/components/OlChartMap';
import { ChartConfig, MapViewConfigs, OlChartMapProps } from '../../src/types';

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

const renderMap = (mapView: Partial<MapViewConfigs>) => {
  const olMap = new Map({ view: new View({ center: [0, 0], zoom: 2 }) });
  const props = {
    mapId: 'ol-map',
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
    chartBackgroundColor: { r: 255, g: 255, b: 255, a: 0 },
    chartBackgroundBorderRadius: 0,
    setControlValue: jest.fn(),
    theme: supersetTheme,
  } as unknown as OlChartMapProps;
  const result = render(<OlChartMap {...props} />);
  const centerLatitude = () => toLonLat(olMap.getView().getCenter()!)[1];
  const refresh = (chartConfigs: ChartConfig) =>
    result.rerender(<OlChartMap {...props} chartConfigs={chartConfigs} />);
  return { centerLatitude, refresh };
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
