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

import { supersetTheme } from '@apache-superset/core/theme';
import { ChartProps } from '@superset-ui/core';
import { ChartConfig, ChartConfigFeature } from '../../src/types';
import {
  createChartComponent,
  isChartConfigEqual,
  simplifyConfig,
} from '../../src/util/chartUtil';

test('transforms original chart inputs with the current render dimensions', () => {
  const feature: ChartConfigFeature = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [0, 0] },
    properties: { width: null, height: null, queriesData: [] },
  };
  const transformer = jest.fn(({ width, height }: ChartProps) => ({
    echartOptions: { series: [{ center: [width / 2, height / 2] }] },
  }));

  const initial = createChartComponent(
    'pie',
    feature,
    200,
    200,
    supersetTheme,
    'en',
    transformer,
  );
  const resized = createChartComponent(
    'pie',
    feature,
    400,
    300,
    supersetTheme,
    'en',
    transformer,
  );

  expect(transformer).toHaveBeenNthCalledWith(1, {
    ...feature.properties,
    width: 200,
    height: 200,
    theme: supersetTheme,
  });
  expect(transformer).toHaveBeenNthCalledWith(2, {
    ...feature.properties,
    width: 400,
    height: 300,
    theme: supersetTheme,
  });
  expect(initial?.props.chartConfig.properties).toMatchObject({
    echartOptions: { series: [{ center: [100, 100] }] },
  });
  expect(resized?.props.chartConfig.properties).toMatchObject({
    echartOptions: { series: [{ center: [200, 150] }] },
  });
  expect(feature.properties.width).toBeNull();
});

test.each([
  [0, 100],
  [100, 0],
  [-1, 100],
  [NaN, 100],
  [100, Infinity],
])('skips transformation for invalid dimensions %s by %s', (width, height) => {
  const transformer = jest.fn();
  const feature: ChartConfigFeature = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [0, 0] },
    properties: {},
  };
  expect(
    createChartComponent(
      'pie',
      feature,
      width,
      height,
      supersetTheme,
      'en',
      transformer,
    ),
  ).toBeNull();
  expect(transformer).not.toHaveBeenCalled();
});

test('keeps a failed chart transformation from breaking map rendering', () => {
  const transformer = jest.fn(() => {
    throw new Error('Invalid chart');
  });
  const feature: ChartConfigFeature = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [0, 0] },
    properties: {},
  };
  expect(
    createChartComponent(
      'pie',
      feature,
      200,
      200,
      supersetTheme,
      'en',
      transformer,
    ),
  ).toBeNull();
  expect(transformer).toHaveBeenCalledTimes(1);
});

test('compares circular chart context without serializing it', () => {
  const context: Record<string, unknown> = {};
  context.self = context;
  const config: ChartConfig = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [0, 0] },
        properties: { context },
      },
    ],
  };
  expect(isChartConfigEqual(config, structuredClone(config))).toBe(true);
});

test('detects changed callbacks while ignoring outer chart dimensions', () => {
  const onContextMenu = jest.fn();
  const makeConfig = (
    width: number,
    callback: typeof onContextMenu,
  ): ChartConfig => ({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [0, 0] },
        properties: { width, hooks: { onContextMenu: callback } },
      },
    ],
  });
  expect(
    isChartConfigEqual(
      makeConfig(100, onContextMenu),
      makeConfig(200, onContextMenu),
    ),
  ).toBe(true);
  expect(
    isChartConfigEqual(
      makeConfig(100, onContextMenu),
      makeConfig(100, jest.fn()),
    ),
  ).toBe(false);
});

describe('chartUtil', () => {
  const configA: ChartConfig = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [],
        },
        properties: {
          refs: 'foo',
        },
      },
    ],
  };

  const configB: ChartConfig = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [],
        },
        properties: {
          refs: 'foo',
          foo: 'bar',
        },
      },
    ],
  };

  describe('simplifyConfig', () => {
    test('removes the refs property from a feature', () => {
      const simplifiedConfig = simplifyConfig(configA);
      const propKeys = Object.keys(simplifiedConfig.features[0].properties);

      expect(propKeys).toHaveLength(0);
    });
  });

  describe('isChartConfigEqual', () => {
    test('returns true, if configurations are equal', () => {
      const isEqual = isChartConfigEqual(configA, structuredClone(configA));
      expect(isEqual).toBe(true);
    });

    test('returns false if configurations are not equal', () => {
      const isEqual = isChartConfigEqual(configA, configB);
      expect(isEqual).toBe(false);
    });
  });
});
