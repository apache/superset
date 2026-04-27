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

interface H3Feature {
  hexagon: string;
  elevation?: number;
  [key: string]: unknown;
}

jest.mock('../spatialUtils', () => ({
  ...jest.requireActual('../spatialUtils'),
  getMapboxApiKey: jest.fn(() => 'mock-mapbox-key'),
}));

const baseMockChartProps: Partial<ChartProps> = {
  rawFormData: {
    h3_index: 'h3_col',
    viewport: {},
  },
  queriesData: [
    {
      data: [
        { h3_col: '891f1d48177ffff', count: 42 },
        { h3_col: '891f1d48163ffff', count: 100 },
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

test('H3 transformProps should transform records into features with hexagon field', () => {
  const result = transformProps(baseMockChartProps as ChartProps);
  const features = result.payload.data.features as H3Feature[];

  expect(features).toHaveLength(2);
  expect(features[0].hexagon).toBe('891f1d48177ffff');
  expect(features[1].hexagon).toBe('891f1d48163ffff');
});

test('H3 transformProps should include metric as elevation', () => {
  const props = {
    ...baseMockChartProps,
    rawFormData: {
      ...baseMockChartProps.rawFormData,
      metric: 'count',
    },
  };

  const result = transformProps(props as ChartProps);
  const features = result.payload.data.features as H3Feature[];

  expect(features[0].elevation).toBe(42);
  expect(features[1].elevation).toBe(100);
});

test('H3 transformProps should not set elevation when no metric is specified', () => {
  const result = transformProps(baseMockChartProps as ChartProps);
  const features = result.payload.data.features as H3Feature[];

  expect(features[0].elevation).toBeUndefined();
});

test('H3 transformProps should handle h3_index as array', () => {
  const props = {
    ...baseMockChartProps,
    rawFormData: {
      ...baseMockChartProps.rawFormData,
      h3_index: ['h3_col'],
    },
  };

  const result = transformProps(props as ChartProps);
  const features = result.payload.data.features as H3Feature[];

  expect(features).toHaveLength(2);
  expect(features[0].hexagon).toBe('891f1d48177ffff');
});

test('H3 transformProps should resolve adhoc column object using its label', () => {
  const adhocColumn = {
    label: 'h3_col',
    sqlExpression: "h3_index('foo')",
    expressionType: 'SQL',
  };
  const props = {
    ...baseMockChartProps,
    rawFormData: {
      ...baseMockChartProps.rawFormData,
      h3_index: adhocColumn,
    },
  };

  const result = transformProps(props as ChartProps);
  const features = result.payload.data.features as H3Feature[];

  expect(features).toHaveLength(2);
  expect(features[0].hexagon).toBe('891f1d48177ffff');
});

test('H3 transformProps should auto-detect H3 column when h3_index is not specified', () => {
  const props = {
    ...baseMockChartProps,
    rawFormData: {
      ...baseMockChartProps.rawFormData,
      h3_index: undefined,
    },
    queriesData: [
      {
        data: [{ h3_resolution_7: '871f1d481ffffff', value: 10 }],
      },
    ],
  };

  const result = transformProps(props as ChartProps);
  const features = result.payload.data.features as H3Feature[];

  expect(features).toHaveLength(1);
  expect(features[0].hexagon).toBe('871f1d481ffffff');
});

test('H3 transformProps should auto-detect column with "hex" in name', () => {
  const props = {
    ...baseMockChartProps,
    rawFormData: {
      ...baseMockChartProps.rawFormData,
      h3_index: undefined,
    },
    queriesData: [
      {
        data: [{ hex_id: '891f1d48177ffff', metric: 5 }],
      },
    ],
  };

  const result = transformProps(props as ChartProps);
  const features = result.payload.data.features as H3Feature[];

  expect(features[0].hexagon).toBe('891f1d48177ffff');
});

test('H3 transformProps should include js_columns in features', () => {
  const props = {
    ...baseMockChartProps,
    rawFormData: {
      ...baseMockChartProps.rawFormData,
      js_columns: ['count'],
    },
    queriesData: [
      {
        data: [{ h3_col: '891f1d48177ffff', count: 42 }],
      },
    ],
  };

  const result = transformProps(props as ChartProps);
  const features = result.payload.data.features as H3Feature[];

  expect(features[0].count).toBe(42);
});

test('H3 transformProps should copy extra record fields into features', () => {
  const props = {
    ...baseMockChartProps,
    queriesData: [
      {
        data: [{ h3_col: '891f1d48177ffff', city: 'SF', population: 800000 }],
      },
    ],
  };

  const result = transformProps(props as ChartProps);
  const features = result.payload.data.features as H3Feature[];

  expect(features[0].city).toBe('SF');
  expect(features[0].population).toBe(800000);
});

test('H3 transformProps should handle empty query data', () => {
  const props = {
    ...baseMockChartProps,
    queriesData: [{ data: [] }],
  };

  const result = transformProps(props as ChartProps);
  const features = result.payload.data.features as H3Feature[];

  expect(features).toHaveLength(0);
});

test('H3 transformProps should handle null H3 values gracefully', () => {
  const props = {
    ...baseMockChartProps,
    queriesData: [
      {
        data: [{ h3_col: null, count: 5 }],
      },
    ],
  };

  const result = transformProps(props as ChartProps);
  const features = result.payload.data.features as H3Feature[];

  expect(features).toHaveLength(1);
  expect(features[0].hexagon).toBe('');
});

test('H3 transformProps should parse string metric values as numbers', () => {
  const props = {
    ...baseMockChartProps,
    rawFormData: {
      ...baseMockChartProps.rawFormData,
      metric: 'value',
    },
    queriesData: [
      {
        data: [{ h3_col: '891f1d48177ffff', value: '123.45' }],
      },
    ],
  };

  const result = transformProps(props as ChartProps);
  const features = result.payload.data.features as H3Feature[];

  expect(features[0].elevation).toBe(123.45);
});

test('H3 transformProps should handle non-numeric metric values', () => {
  const props = {
    ...baseMockChartProps,
    rawFormData: {
      ...baseMockChartProps.rawFormData,
      metric: 'value',
    },
    queriesData: [
      {
        data: [{ h3_col: '891f1d48177ffff', value: 'not-a-number' }],
      },
    ],
  };

  const result = transformProps(props as ChartProps);
  const features = result.payload.data.features as H3Feature[];

  expect(features[0].elevation).toBeUndefined();
});

test('H3 transformProps should include metricLabels in payload', () => {
  const props = {
    ...baseMockChartProps,
    rawFormData: {
      ...baseMockChartProps.rawFormData,
      metric: 'count',
    },
  };

  const result = transformProps(props as ChartProps);

  expect(result.payload.data.metricLabels).toEqual(['count']);
});

test('H3 transformProps should have empty metricLabels when no metric', () => {
  const result = transformProps(baseMockChartProps as ChartProps);

  expect(result.payload.data.metricLabels).toEqual([]);
});

test('H3 transformProps should set viewport dimensions from chartProps', () => {
  const result = transformProps(baseMockChartProps as ChartProps);

  expect(result.viewport.height).toBe(400);
  expect(result.viewport.width).toBe(600);
});
