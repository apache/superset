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

import { ChartLayer } from '../../src/components/ChartLayer';
import { ChartLayerOptions } from '../../src/types';
import '@testing-library/jest-dom';

const mockCreateChartComponent = jest.fn((..._args: unknown[]) => null);

jest.mock('../../src/util/chartUtil', () => ({
  createChartComponent: (...args: unknown[]) =>
    mockCreateChartComponent(...args),
}));
jest.mock('react-dom/client', () => ({
  createRoot: () => ({ render: jest.fn(), unmount: jest.fn() }),
}));

describe('ChartLayer', () => {
  test('creates div and loading mask', () => {
    const options: ChartLayerOptions = {
      chartVizType: 'pie',
      locale: 'en',
    };
    const chartLayer = new ChartLayer(options);

    expect(chartLayer.loadingMask).toBeDefined();
    expect(chartLayer.div).toBeDefined();
  });

  test('can remove chart elements', () => {
    const options: ChartLayerOptions = {
      chartVizType: 'pie',
      locale: 'en',
    };
    const chartLayer = new ChartLayer(options);
    chartLayer.charts = [
      {
        htmlElement: document.createElement('div'),
        root: { render: jest.fn(), unmount: jest.fn() } as any,
        coordinate: [0, 0],
        width: 100,
        height: 100,
        feature: {},
      },
    ];

    chartLayer.removeAllChartElements();
    expect(chartLayer.charts).toEqual([]);
  });
});

test('marks each chart container loading synchronously until React commits', () => {
  const options: ChartLayerOptions = {
    chartVizType: 'pie',
    locale: 'en',
    chartConfigs: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0, 0] },
          properties: {},
        },
      ],
    },
    chartSizeValues: { 1: { width: 100, height: 100 } },
  };
  const chartLayer = new ChartLayer(options);

  chartLayer.createCharts(1);

  const container = chartLayer.charts[0].htmlElement;
  expect(container).toHaveAttribute('data-superset-map-status', 'loading');
  const [, , , , , , onRenderComplete, onRenderError] =
    mockCreateChartComponent.mock.calls[0];
  expect(onRenderComplete).toEqual(expect.any(Function));
  (onRenderComplete as () => void)();
  expect(container).toHaveAttribute('data-superset-map-status', 'rendered');

  expect(onRenderError).toEqual(expect.any(Function));
  (onRenderError as () => void)();
  expect(container).toHaveAttribute('data-superset-map-status', 'error');
});
