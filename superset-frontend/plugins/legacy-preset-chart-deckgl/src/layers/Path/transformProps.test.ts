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

interface PathFeature {
  path: [number, number][];
  width?: number;
  metric?: number;
  cat_color?: string;
  extraProps?: Record<string, unknown>;
  [key: string]: unknown;
}

const samplePath1 = JSON.stringify([
  [-122.4, 37.8],
  [-122.3, 37.9],
]);
const samplePath2 = JSON.stringify([
  [-122.5, 37.7],
  [-122.4, 37.8],
]);
const samplePath3 = JSON.stringify([
  [-122.6, 37.6],
  [-122.5, 37.7],
]);

const mockChartProps: Partial<ChartProps> = {
  rawFormData: {
    line_column: 'path_json',
    line_type: 'json',
    viewport: {},
  },
  queriesData: [
    {
      data: [
        {
          path_json: samplePath1,
          'AVG(weight)': 100,
          'SUM(distance)': 500,
          route_type: 'express',
        },
        {
          path_json: samplePath2,
          'AVG(weight)': 200,
          'SUM(distance)': 1000,
          route_type: 'local',
        },
        {
          path_json: samplePath3,
          'AVG(weight)': 50,
          'SUM(distance)': 250,
          route_type: 'express',
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

test('Path transformProps should parse JSON paths correctly', () => {
  const result = transformProps(mockChartProps as ChartProps);
  const features = result.payload.data.features as PathFeature[];

  expect(features.length).toBe(3);
  features.forEach(f => {
    expect(f.path).toBeDefined();
    expect(Array.isArray(f.path)).toBe(true);
    expect(f.path.length).toBeGreaterThan(0);
  });
});

test('Path transformProps should handle empty records', () => {
  const props = {
    ...mockChartProps,
    queriesData: [{ data: [] }],
  };

  const result = transformProps(props as ChartProps);
  const features = result.payload.data.features as PathFeature[];

  expect(features).toHaveLength(0);
});

test('Path transformProps should handle missing line_column', () => {
  const props = {
    ...mockChartProps,
    rawFormData: {
      ...mockChartProps.rawFormData,
      line_column: undefined,
    },
  };

  const result = transformProps(props as ChartProps);
  const features = result.payload.data.features as PathFeature[];

  expect(features).toHaveLength(0);
});

test('Path transformProps should handle invalid JSON path data', () => {
  const props = {
    ...mockChartProps,
    queriesData: [
      {
        data: [{ path_json: 'not valid json' }, { path_json: '12345' }],
      },
    ],
  };

  const result = transformProps(props as ChartProps);
  const features = result.payload.data.features as PathFeature[];

  expect(features.length).toBe(2);
  // Should not throw, paths should be empty arrays
  features.forEach(f => {
    expect(Array.isArray(f.path)).toBe(true);
  });
});

test('Path transformProps should use fixed width value when line_width type is "fix"', () => {
  const props = {
    ...mockChartProps,
    rawFormData: {
      ...mockChartProps.rawFormData,
      line_width: {
        type: 'fix',
        value: 5,
      },
    },
  };

  const result = transformProps(props as ChartProps);
  const features = result.payload.data.features as PathFeature[];

  expect(features.length).toBe(3);
  features.forEach(f => {
    expect(f.width).toBe(5);
  });
});

test('Path transformProps should use fixed width with string value', () => {
  const props = {
    ...mockChartProps,
    rawFormData: {
      ...mockChartProps.rawFormData,
      line_width: {
        type: 'fix',
        value: '10',
      },
    },
  };

  const result = transformProps(props as ChartProps);
  const features = result.payload.data.features as PathFeature[];

  features.forEach(f => {
    expect(f.width).toBe(10);
  });
});

test('Path transformProps should not set width when line_width is missing', () => {
  const props = {
    ...mockChartProps,
    rawFormData: {
      ...mockChartProps.rawFormData,
      line_width: undefined,
    },
  };

  const result = transformProps(props as ChartProps);
  const features = result.payload.data.features as PathFeature[];

  features.forEach(f => {
    expect(f.width).toBeUndefined();
  });
});

test('Path transformProps should use metric value for width when line_width type is "metric"', () => {
  const props = {
    ...mockChartProps,
    rawFormData: {
      ...mockChartProps.rawFormData,
      line_width: {
        type: 'metric',
        value: 'AVG(weight)',
      },
    },
  };

  const result = transformProps(props as ChartProps);
  const features = result.payload.data.features as PathFeature[];

  expect(features).toHaveLength(3);
  expect(features[0]?.width).toBe(50);
});

test('Path transformProps should include metric from breakpoint_metric', () => {
  const props = {
    ...mockChartProps,
    rawFormData: {
      ...mockChartProps.rawFormData,
      breakpoint_metric: 'AVG(weight)',
    },
  };

  const result = transformProps(props as ChartProps);
  const features = result.payload.data.features as PathFeature[];

  const metrics = features.map(f => f.metric).sort((a, b) => a - b);
  expect(metrics).toEqual([50, 100, 200]);
});

test('Path transformProps should fall back to base metric when breakpoint_metric is missing', () => {
  const props = {
    ...mockChartProps,
    rawFormData: {
      ...mockChartProps.rawFormData,
      metric: 'AVG(weight)',
      breakpoint_metric: undefined,
    },
  };

  const result = transformProps(props as ChartProps);
  const features = result.payload.data.features as PathFeature[];

  const metrics = features.map(f => f.metric).sort((a, b) => a - b);
  expect(metrics).toEqual([50, 100, 200]);
});

test('Path transformProps should include both breakpoint_metric and width metrics if they are different', () => {
  const props = {
    ...mockChartProps,
    rawFormData: {
      ...mockChartProps.rawFormData,
      breakpoint_metric: 'AVG(weight)',
      line_width: {
        type: 'metric',
        value: 'SUM(distance)',
      },
    },
  };

  const result = transformProps(props as ChartProps);
  const features = result.payload.data.features as PathFeature[];

  expect(features).toHaveLength(3);
  expect(result.payload.data.metricLabels).toEqual([
    'AVG(weight)',
    'SUM(distance)',
  ]);
});

test('Path transformProps should not include both breakpoint_metric and width metrics if they are the same', () => {
  const props = {
    ...mockChartProps,
    rawFormData: {
      ...mockChartProps.rawFormData,
      breakpoint_metric: 'SUM(distance)',
      line_width: {
        type: 'metric',
        value: 'SUM(distance)',
      },
    },
  };

  const result = transformProps(props as ChartProps);

  expect(result.payload.data.metricLabels).toEqual(['SUM(distance)']);
});

test('Path transformProps should set cat_color from dimension column', () => {
  const props = {
    ...mockChartProps,
    rawFormData: {
      ...mockChartProps.rawFormData,
      dimension: 'route_type',
    },
  };

  const result = transformProps(props as ChartProps);
  const features = result.payload.data.features as PathFeature[];

  expect(features).toHaveLength(3);
  expect(features[0]?.cat_color).toBe('express');
  expect(features[1]?.cat_color).toBe('local');
  expect(features[2]?.cat_color).toBe('express');
});

test('Path transformProps should include metric labels when breakpoint_metric is set', () => {
  const props = {
    ...mockChartProps,
    rawFormData: {
      ...mockChartProps.rawFormData,
      breakpoint_metric: 'AVG(weight)',
    },
  };

  const result = transformProps(props as ChartProps);

  expect(result.payload.data.metricLabels).toContain('AVG(weight)');
});

test('Path transformProps should include metric labels from base metric', () => {
  const props = {
    ...mockChartProps,
    rawFormData: {
      ...mockChartProps.rawFormData,
      metric: 'SUM(distance)',
    },
  };

  const result = transformProps(props as ChartProps);

  expect(result.payload.data.metricLabels).toContain('SUM(distance)');
});

test('Path transformProps should have empty metric labels when no metric is set', () => {
  const props = {
    ...mockChartProps,
    rawFormData: {
      ...mockChartProps.rawFormData,
      metric: undefined,
      breakpoint_metric: undefined,
    },
  };

  const result = transformProps(props as ChartProps);

  expect(result.payload.data.metricLabels).toEqual([]);
});

// add breakpoint color test
