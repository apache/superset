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

import { ChartProps, DatasourceType } from '@superset-ui/core';
import transformProps from './transformProps';
import { NULL_CATEGORY_KEY } from '../../utils';

interface ArcFeature {
  sourcePosition: [number, number];
  targetPosition: [number, number];
  cat_color?: string;
  extraProps?: Record<string, unknown>;
}

jest.mock('../spatialUtils', () => ({
  ...jest.requireActual('../spatialUtils'),
  getMapboxApiKey: jest.fn(() => 'mock-mapbox-key'),
}));

const mockChartProps: Partial<ChartProps> = {
  rawFormData: {
    start_spatial: {
      type: 'latlong',
      latCol: 'START_LAT',
      lonCol: 'START_LON',
    },
    end_spatial: {
      type: 'latlong',
      latCol: 'END_LAT',
      lonCol: 'END_LON',
    },
    viewport: {},
  },
  queriesData: [
    {
      data: [
        {
          START_LAT: 37.8,
          START_LON: -122.4,
          END_LAT: 37.9,
          END_LON: -122.3,
        },
        {
          START_LAT: 38.0,
          START_LON: -122.2,
          END_LAT: 38.1,
          END_LON: -122.1,
        },
      ],
    },
  ],
  datasource: {
    type: DatasourceType.Table,
    id: 1,
    name: 'test_datasource',
    columns: [],
    metrics: [],
  },
  height: 400,
  width: 600,
  hooks: {},
  filterState: {},
  emitCrossFilters: false,
};

test('Arc transformProps should set cat_color when dimension is configured', () => {
  const propsWithDimension = {
    ...mockChartProps,
    rawFormData: {
      ...mockChartProps.rawFormData,
      dimension: 'category',
    },
    queriesData: [
      {
        data: [
          {
            START_LAT: 37.8,
            START_LON: -122.4,
            END_LAT: 37.9,
            END_LON: -122.3,
            category: 'A',
          },
          {
            START_LAT: 38.0,
            START_LON: -122.2,
            END_LAT: 38.1,
            END_LON: -122.1,
            category: 'B',
          },
        ],
      },
    ],
  };

  const result = transformProps(propsWithDimension as ChartProps);
  const features = result.payload.data.features as ArcFeature[];

  expect(features).toHaveLength(2);
  expect(features[0]?.cat_color).toBe('A');
  expect(features[1]?.cat_color).toBe('B');
});

test('Arc transformProps should assign NULL_CATEGORY_KEY cat_color for null/undefined dimension values', () => {
  const propsWithNullCategory = {
    ...mockChartProps,
    rawFormData: {
      ...mockChartProps.rawFormData,
      dimension: 'category',
    },
    queriesData: [
      {
        data: [
          {
            START_LAT: 37.8,
            START_LON: -122.4,
            END_LAT: 37.9,
            END_LON: -122.3,
            category: 'A',
          },
          {
            START_LAT: 38.0,
            START_LON: -122.2,
            END_LAT: 38.1,
            END_LON: -122.1,
            category: null,
          },
          {
            START_LAT: 38.2,
            START_LON: -122.0,
            END_LAT: 38.3,
            END_LON: -121.9,
            category: undefined,
          },
        ],
      },
    ],
  };

  const result = transformProps(propsWithNullCategory as ChartProps);
  const features = result.payload.data.features as ArcFeature[];

  expect(features).toHaveLength(3);
  expect(features[0]?.cat_color).toBe('A');
  expect(features[1]?.cat_color).toBe(NULL_CATEGORY_KEY);
  expect(features[2]?.cat_color).toBe(NULL_CATEGORY_KEY);
});

test('Arc transformProps should not set cat_color when dimension is not configured', () => {
  const result = transformProps(mockChartProps as ChartProps);
  const features = result.payload.data.features as ArcFeature[];

  expect(features).toHaveLength(2);
  expect(features[0]?.cat_color).toBeUndefined();
  expect(features[1]?.cat_color).toBeUndefined();
});

test('Arc transformProps should handle no records', () => {
  const noDataProps = {
    ...mockChartProps,
    queriesData: [{ data: [] }],
  };

  const result = transformProps(noDataProps as ChartProps);
  const features = result.payload.data.features as ArcFeature[];

  expect(features).toHaveLength(0);
});
