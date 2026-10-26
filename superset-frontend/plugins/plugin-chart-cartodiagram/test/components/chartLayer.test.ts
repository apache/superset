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

import { ChartProps } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import { ChartLayer } from '../../src/components/ChartLayer';
import { ChartLayerOptions } from '../../src/types';

jest.mock('react-dom/client', () => ({
  createRoot: jest.fn(() => ({ render: jest.fn(), unmount: jest.fn() })),
}));

test('transforms on creation and resize but not unchanged-size updates', () => {
  const chartTransformer = jest.fn(({ width, height }: ChartProps) => ({
    width,
    height,
  }));
  const layer = new ChartLayer({
    chartVizType: 'pie',
    chartTransformer,
    locale: 'en',
    theme: supersetTheme,
    chartSizeValues: {
      1: { width: 200, height: 200 },
      2: { width: 400, height: 300 },
    },
    chartConfigs: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0, 0] },
          properties: { queriesData: [{ data: [{ value: 1 }] }] },
        },
      ],
    },
  });

  layer.createCharts(1);
  expect(chartTransformer).toHaveBeenLastCalledWith(
    expect.objectContaining({ width: 200, height: 200 }),
  );
  layer.updateCharts(1);
  expect(chartTransformer).toHaveBeenCalledTimes(1);
  layer.updateCharts(2);
  expect(chartTransformer).toHaveBeenLastCalledWith(
    expect.objectContaining({ width: 400, height: 300 }),
  );
  expect(chartTransformer).toHaveBeenCalledTimes(2);
  expect(layer.charts[0].feature.properties).not.toHaveProperty('width');

  layer.updateCharts(3);
  expect(layer.charts[0].root.render).toHaveBeenLastCalledWith(null);
  expect(chartTransformer).toHaveBeenCalledTimes(2);
  layer.updateCharts(1);
  expect(chartTransformer).toHaveBeenCalledTimes(3);
  layer.removeAllChartElements();
});

test('renders a chart when dimensions become available after creation', () => {
  const chartTransformer = jest.fn(() => ({}));
  const layer = new ChartLayer({
    chartVizType: 'echarts_timeseries_bar',
    chartTransformer,
    locale: 'en',
    theme: supersetTheme,
    chartSizeValues: { 1: { width: 200, height: 100 } },
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
  });
  layer.createCharts(0);
  expect(chartTransformer).not.toHaveBeenCalled();
  layer.updateCharts(1);
  expect(chartTransformer).toHaveBeenCalledWith(
    expect.objectContaining({ width: 200, height: 100 }),
  );
  layer.removeAllChartElements();
});

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
        feature: {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0, 0] },
          properties: {},
        },
      },
    ];

    chartLayer.removeAllChartElements();
    expect(chartLayer.charts).toEqual([]);
  });
});
