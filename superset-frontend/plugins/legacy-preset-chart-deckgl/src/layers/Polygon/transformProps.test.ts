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
import transformProps from './transformProps';

interface PolygonFeature {
  polygon?: number[][];
  elevation?: number;
  extraProps?: Record<string, unknown>;
  metrics?: Record<string, number | string>;
}

jest.mock('../spatialUtils', () => ({
  ...jest.requireActual('../spatialUtils'),
  getMapboxApiKey: jest.fn(() => 'mock-mapbox-key'),
}));

describe('Polygon transformProps', () => {
  const mockChartProps: Partial<ChartProps> = {
    rawFormData: {
      line_column: 'geom',
      line_type: 'json',
      viewport: {},
    },
    queriesData: [
      {
        data: [
          {
            geom: JSON.stringify([
              [-122.4, 37.8],
              [-122.3, 37.8],
              [-122.3, 37.9],
              [-122.4, 37.9],
            ]),
            'AVG(elevation)': 150.5,
            population: 50000,
          },
        ],
      },
    ],
    datasource: { type: 'table' as const, id: 1 },
    height: 400,
    width: 600,
    hooks: {},
    filterState: {},
    emitCrossFilters: false,
  };

  test('should use constant elevation value when point_radius_fixed type is "fix"', () => {
    const fixProps = {
      ...mockChartProps,
      rawFormData: {
        ...mockChartProps.rawFormData,
        point_radius_fixed: {
          type: 'fix',
          value: '1000',
        },
      },
    };

    const result = transformProps(fixProps as ChartProps);

    const features = result.payload.data.features as PolygonFeature[];
    expect(features).toHaveLength(1);
    expect(features[0]?.elevation).toBe(1000);
  });

  test('should use database metric value for elevation when point_radius_fixed type is "metric"', () => {
    const metricProps = {
      ...mockChartProps,
      rawFormData: {
        ...mockChartProps.rawFormData,
        point_radius_fixed: {
          type: 'metric',
          value: {
            expressionType: 'SQL',
            sqlExpression: 'AVG(elevation)',
            label: 'AVG(elevation)',
          },
        },
      },
    };

    const result = transformProps(metricProps as ChartProps);

    const features = result.payload.data.features as PolygonFeature[];
    expect(features).toHaveLength(1);
    expect(features[0]?.elevation).toBe(150.5);
  });

  test('should use constant elevation value when point_radius_fixed has legacy structure', () => {
    const legacyProps = {
      ...mockChartProps,
      rawFormData: {
        ...mockChartProps.rawFormData,
        point_radius_fixed: {
          value: '750',
        },
      },
    };

    const result = transformProps(legacyProps as ChartProps);

    const features = result.payload.data.features as PolygonFeature[];
    expect(features).toHaveLength(1);
    expect(features[0]?.elevation).toBe(750);
  });

  test('should not set elevation when point_radius_fixed is not specified', () => {
    const noElevationProps = {
      ...mockChartProps,
      rawFormData: {
        ...mockChartProps.rawFormData,
      },
    };

    const result = transformProps(noElevationProps as ChartProps);

    const features = result.payload.data.features as PolygonFeature[];
    expect(features).toHaveLength(1);
    expect(features[0]?.elevation).toBeUndefined();
  });

  test('should use decimal constant elevation value when point_radius_fixed type is "fix"', () => {
    const decimalFixProps = {
      ...mockChartProps,
      rawFormData: {
        ...mockChartProps.rawFormData,
        point_radius_fixed: {
          type: 'fix',
          value: '500.75',
        },
      },
    };

    const result = transformProps(decimalFixProps as ChartProps);

    const features = result.payload.data.features as PolygonFeature[];
    expect(features).toHaveLength(1);
    expect(features[0]?.elevation).toBe(500.75);
  });

  test('should handle invalid numeric strings gracefully', () => {
    const invalidNumericProps = {
      ...mockChartProps,
      rawFormData: {
        ...mockChartProps.rawFormData,
        point_radius_fixed: {
          type: 'fix',
          value: 'not-a-number',
        },
      },
    };

    const result = transformProps(invalidNumericProps as ChartProps);

    const features = result.payload.data.features as PolygonFeature[];
    expect(features).toHaveLength(1);
    expect(features[0]?.elevation).toBeUndefined();
  });

  test('should handle empty string elevation values gracefully', () => {
    const emptyStringProps = {
      ...mockChartProps,
      rawFormData: {
        ...mockChartProps.rawFormData,
        point_radius_fixed: {
          type: 'fix',
          value: '',
        },
      },
    };

    const result = transformProps(emptyStringProps as ChartProps);

    const features = result.payload.data.features as PolygonFeature[];
    expect(features).toHaveLength(1);
    expect(features[0]?.elevation).toBeUndefined();
  });

  test('should handle null metric elevation values gracefully', () => {
    const nullMetricProps = {
      ...mockChartProps,
      rawFormData: {
        ...mockChartProps.rawFormData,
        point_radius_fixed: {
          type: 'metric',
          value: null,
        },
      },
    };

    const result = transformProps(nullMetricProps as ChartProps);

    const features = result.payload.data.features as PolygonFeature[];
    expect(features).toHaveLength(1);
    expect(features[0]?.elevation).toBeUndefined();
  });

  test('should handle invalid JSON in polygon data gracefully', () => {
    const invalidJsonProps = {
      ...mockChartProps,
      queriesData: [
        {
          data: [
            {
              geom: 'invalid-json-string',
            },
          ],
        },
      ],
    };

    const result = transformProps(invalidJsonProps as ChartProps);

    const features = result.payload.data.features as PolygonFeature[];
    expect(features).toHaveLength(0);
  });

  test('should handle legacy point_radius_fixed with invalid value gracefully', () => {
    const legacyInvalidProps = {
      ...mockChartProps,
      rawFormData: {
        ...mockChartProps.rawFormData,
        point_radius_fixed: {
          value: 'invalid-number',
        },
      },
    };

    const result = transformProps(legacyInvalidProps as ChartProps);

    const features = result.payload.data.features as PolygonFeature[];
    expect(features).toHaveLength(1);
    expect(features[0]?.elevation).toBeUndefined();
  });
});
