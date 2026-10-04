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
import { logging } from '@apache-superset/core/utils';
import transformProps, {
  filterDrawableGeographicPoints,
} from './transformProps';

interface ScatterFeature {
  position: [number, number];
  radius?: number;
  metric?: number;
  cat_color?: string;
  extraProps?: Record<string, unknown>;
}

jest.mock('../spatialUtils', () => ({
  ...jest.requireActual('../spatialUtils'),
  getMapboxApiKey: jest.fn(() => 'mock-mapbox-key'),
}));

const mockChartProps: Partial<ChartProps> = {
  rawFormData: {
    spatial: {
      type: 'latlong',
      latCol: 'LATITUDE',
      lonCol: 'LONGITUDE',
    },
    viewport: {},
  },
  queriesData: [
    {
      data: [
        {
          LATITUDE: 37.8,
          LONGITUDE: -122.4,
          population: 50000,
          'AVG(radius_value)': 100,
        },
        {
          LATITUDE: 37.9,
          LONGITUDE: -122.3,
          population: 75000,
          'AVG(radius_value)': 200,
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

test('Scatter transformProps should use fixed radius value when point_radius_fixed type is "fix"', () => {
  const fixedProps = {
    ...mockChartProps,
    rawFormData: {
      ...mockChartProps.rawFormData,
      point_radius_fixed: {
        type: 'fix',
        value: '1000',
      },
    },
  };

  const result = transformProps(fixedProps as ChartProps);
  const features = result.payload.data.features as ScatterFeature[];

  expect(features).toHaveLength(2);
  expect(features[0]?.radius).toBe(1000);
  expect(features[1]?.radius).toBe(1000);
  // metric should not be set for fixed radius
  expect(features[0]?.metric).toBeUndefined();
  expect(features[1]?.metric).toBeUndefined();
});

test('Scatter transformProps should use metric value for radius when point_radius_fixed type is "metric"', () => {
  const metricProps = {
    ...mockChartProps,
    rawFormData: {
      ...mockChartProps.rawFormData,
      point_radius_fixed: {
        type: 'metric',
        value: 'AVG(radius_value)',
      },
    },
  };

  const result = transformProps(metricProps as ChartProps);
  const features = result.payload.data.features as ScatterFeature[];

  expect(features).toHaveLength(2);
  expect(features[0]?.radius).toBe(100);
  expect(features[0]?.metric).toBe(100);
  expect(features[1]?.radius).toBe(200);
  expect(features[1]?.metric).toBe(200);
});

test('Scatter transformProps should handle numeric fixed radius value', () => {
  const fixedProps = {
    ...mockChartProps,
    rawFormData: {
      ...mockChartProps.rawFormData,
      point_radius_fixed: {
        type: 'fix',
        value: 500, // numeric value
      },
    },
  };

  const result = transformProps(fixedProps as ChartProps);
  const features = result.payload.data.features as ScatterFeature[];

  expect(features).toHaveLength(2);
  expect(features[0]?.radius).toBe(500);
  expect(features[1]?.radius).toBe(500);
});

test('Scatter transformProps should handle missing point_radius_fixed', () => {
  const propsWithoutRadius = {
    ...mockChartProps,
    rawFormData: {
      ...mockChartProps.rawFormData,
      // no point_radius_fixed
    },
  };

  const result = transformProps(propsWithoutRadius as ChartProps);
  const features = result.payload.data.features as ScatterFeature[];

  expect(features).toHaveLength(2);
  // radius should not be set
  expect(features[0]?.radius).toBeUndefined();
  expect(features[1]?.radius).toBeUndefined();
});

test('Scatter transformProps should handle dimension for category colors', () => {
  const propsWithDimension = {
    ...mockChartProps,
    rawFormData: {
      ...mockChartProps.rawFormData,
      dimension: 'category',
      point_radius_fixed: {
        type: 'fix',
        value: '1000',
      },
    },
    queriesData: [
      {
        data: [
          {
            LATITUDE: 37.8,
            LONGITUDE: -122.4,
            category: 'A',
          },
          {
            LATITUDE: 37.9,
            LONGITUDE: -122.3,
            category: 'B',
          },
        ],
      },
    ],
  };

  const result = transformProps(propsWithDimension as ChartProps);
  const features = result.payload.data.features as ScatterFeature[];

  expect(features).toHaveLength(2);
  expect(features[0]?.cat_color).toBe('A');
  expect(features[1]?.cat_color).toBe('B');
});

test('Scatter transformProps should not include metric labels for fixed radius', () => {
  const fixedProps = {
    ...mockChartProps,
    rawFormData: {
      ...mockChartProps.rawFormData,
      point_radius_fixed: {
        type: 'fix',
        value: '1000',
      },
    },
  };

  const result = transformProps(fixedProps as ChartProps);

  // metricLabels should be empty for fixed radius
  expect(result.payload.data.metricLabels).toEqual([]);
});

test('Scatter transformProps should include metric labels for metric-based radius', () => {
  const metricProps = {
    ...mockChartProps,
    rawFormData: {
      ...mockChartProps.rawFormData,
      point_radius_fixed: {
        type: 'metric',
        value: 'AVG(radius_value)',
      },
    },
  };

  const result = transformProps(metricProps as ChartProps);

  // metricLabels should include the metric name
  expect(result.payload.data.metricLabels).toContain('AVG(radius_value)');
});

test('Scatter transformProps should handle no records', () => {
  const noDataProps = {
    ...mockChartProps,
    queriesData: [{ data: [] }],
    rawFormData: {
      ...mockChartProps.rawFormData,
      point_radius_fixed: {
        type: 'fix',
        value: '1000',
      },
    },
  };

  const result = transformProps(noDataProps as ChartProps);
  const features = result.payload.data.features as ScatterFeature[];

  expect(features).toHaveLength(0);
});

test('Scatter transformProps should handle missing spatial configuration gracefully', () => {
  const noSpatialProps = {
    ...mockChartProps,
    rawFormData: {
      ...mockChartProps.rawFormData,
      spatial: undefined,
      point_radius_fixed: {
        type: 'fix',
        value: '1000',
      },
    },
  };

  const result = transformProps(noSpatialProps as ChartProps);
  const features = result.payload.data.features as ScatterFeature[];

  expect(features).toHaveLength(0);
});

test('Scatter transformProps should preserve extra properties from records', () => {
  const propsWithExtraData = {
    ...mockChartProps,
    rawFormData: {
      ...mockChartProps.rawFormData,
      point_radius_fixed: {
        type: 'fix',
        value: '1000',
      },
    },
    queriesData: [
      {
        data: [
          {
            LATITUDE: 37.8,
            LONGITUDE: -122.4,
            custom_field: 'value1',
            another_field: 123,
          },
        ],
      },
    ],
  };

  const result = transformProps(propsWithExtraData as ChartProps);
  const features = result.payload.data.features as ScatterFeature[];

  expect(features).toHaveLength(1);
  expect(features[0]).toMatchObject({
    custom_field: 'value1',
    another_field: 123,
  });
});

test.each([91, -91, Number.NaN, Number.POSITIVE_INFINITY, '37.8', null])(
  'typed geographic points skip invalid latitude %s',
  latitude => {
    const props = {
      ...mockChartProps,
      rawFormData: {
        ...mockChartProps.rawFormData,
        mcp_geographic: true,
        point_radius_fixed: { type: 'fix', value: 1000 },
      },
      queriesData: [{ data: [{ LATITUDE: latitude, LONGITUDE: -122.4 }] }],
    } as ChartProps;
    expect(transformProps(props).payload.data.features).toEqual([]);
  },
);

test('typed geographic points preserve longitude-latitude ordering and metric radius', () => {
  const props = {
    ...mockChartProps,
    rawFormData: {
      ...mockChartProps.rawFormData,
      mcp_geographic: true,
      point_radius_fixed: { type: 'metric', value: 'population' },
    },
  } as ChartProps;
  expect(transformProps(props).payload.data.features[0]).toMatchObject({
    position: [-122.4, 37.8],
    radius: 50000,
  });
});

test.each([undefined, null, 'missing', '10', Number.NaN, Infinity, -1])(
  'typed geographic points skip sparse/non-numeric radius %s',
  population => {
    const sparse = { LATITUDE: 37.8, LONGITUDE: -122.4 };
    const data = [
      population === undefined ? sparse : { ...sparse, population },
      { LATITUDE: 37.9, LONGITUDE: -122.3, population: 0 },
      { LATITUDE: 38, LONGITUDE: -122, population: 10 },
    ];
    const original = data.map(row => ({ ...row }));
    const props = {
      ...mockChartProps,
      rawFormData: {
        ...mockChartProps.rawFormData,
        mcp_geographic: true,
        point_radius_fixed: { type: 'metric', value: 'population' },
      },
      queriesData: [{ data }],
    } as ChartProps;
    expect(transformProps(props).payload.data.features).toMatchObject([
      { position: [-122.3, 37.9], radius: 0 },
      { position: [-122, 38], radius: 10 },
    ]);
    expect(data).toEqual(original);
  },
);

test('typed geographic points log how many points were skipped', () => {
  const warn = jest.spyOn(logging, 'warn').mockImplementation(() => {});
  try {
    const props = {
      ...mockChartProps,
      rawFormData: {
        ...mockChartProps.rawFormData,
        mcp_geographic: true,
        point_radius_fixed: { type: 'metric', value: 'population' },
      },
      queriesData: [
        {
          data: [
            { LATITUDE: 91, LONGITUDE: -122.4, population: 1 },
            { LATITUDE: 37.8, LONGITUDE: -122.4, population: null },
            { LATITUDE: 38, LONGITUDE: -122, population: 10 },
          ],
        },
      ],
    } as ChartProps;
    expect(transformProps(props).payload.data.features).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Skipped 2 of 3 geographic points'),
    );
  } finally {
    warn.mockRestore();
  }
});

test('filterDrawableGeographicPoints keeps valid points without logging', () => {
  const warn = jest.spyOn(logging, 'warn').mockImplementation(() => {});
  try {
    const records = [
      { LATITUDE: 90, LONGITUDE: -180 },
      { LATITUDE: -90, LONGITUDE: 180 },
    ];
    expect(
      filterDrawableGeographicPoints(records, {
        type: 'latlong',
        latCol: 'LATITUDE',
        lonCol: 'LONGITUDE',
      }),
    ).toEqual(records);
    expect(warn).not.toHaveBeenCalled();
  } finally {
    warn.mockRestore();
  }
});

test.each([
  { type: 'geohash', geohashCol: 'location' },
  { type: 'delimited', lonlatCol: 'location' },
])(
  'MCP points remain drawable after switching spatial format to $type',
  spatial => {
    const props = {
      ...mockChartProps,
      rawFormData: {
        ...mockChartProps.rawFormData,
        mcp_geographic: true,
        spatial,
        point_radius_fixed: { type: 'metric', value: 'population' },
      },
      queriesData: [
        {
          data: [
            {
              location: spatial.type === 'geohash' ? '9q8yy' : '-122.4,37.8',
              population: 10,
            },
            {
              location: spatial.type === 'geohash' ? '9q8yy' : '-122.4,37.8',
              population: -1,
            },
          ],
        },
      ],
    } as ChartProps;
    const features = transformProps(props).payload.data
      .features as ScatterFeature[];
    expect(features).toHaveLength(1);
    expect(features[0].position[0]).toBeCloseTo(-122.4, 1);
    expect(features[0].position[1]).toBeCloseTo(37.8, 1);
    expect(features[0].radius).toBe(10);
  },
);

test.each(['position', 'weight', 'extraProps'])(
  'typed scatter skips radius alias %s rather than corrupting native spatial fields',
  label => {
    const props = {
      ...mockChartProps,
      rawFormData: {
        ...mockChartProps.rawFormData,
        mcp_geographic: true,
        point_radius_fixed: { type: 'metric', value: label },
      },
      queriesData: [
        {
          data: [{ LATITUDE: 37.8, LONGITUDE: -122.4, [label]: 10 }],
        },
      ],
    } as ChartProps;
    expect(transformProps(props).payload.data.features).toEqual([]);
  },
);

test.each(['position', 'weight', 'extraProps'])(
  'fixed-radius scatter keeps coordinates when dimension is %s',
  dimension => {
    const props = {
      ...mockChartProps,
      rawFormData: {
        ...mockChartProps.rawFormData,
        mcp_geographic: true,
        dimension,
        point_radius_fixed: { type: 'fix', value: 100 },
      },
      queriesData: [
        { data: [{ LATITUDE: 37.8, LONGITUDE: -122.4, [dimension]: 'A' }] },
      ],
    };
    const result = transformProps(props as ChartProps);
    const features = result.payload.data.features as ScatterFeature[];
    expect(features).toHaveLength(1);
    expect(features[0].position).toEqual([-122.4, 37.8]);
    expect(features[0].cat_color).toBe('A');
    expect(features[0].radius).toBe(100);
  },
);

test('legacy scatter reads a weight radius from the source without replacing geometry', () => {
  const props = {
    ...mockChartProps,
    rawFormData: {
      ...mockChartProps.rawFormData,
      point_radius_fixed: { type: 'metric', value: 'weight' },
    },
    queriesData: [
      { data: [{ LATITUDE: 37.8, LONGITUDE: -122.4, weight: 42 }] },
    ],
  };
  const features = transformProps(props as ChartProps).payload.data
    .features as ScatterFeature[];
  expect(features[0].position).toEqual([-122.4, 37.8]);
  expect(features[0].radius).toBe(42);
});

test.each(['constructor', 'toString', 'hasOwnProperty', 'valueOf'])(
  'scatter reads prototype-named radius metric %s from the source',
  label => {
    const props = {
      ...mockChartProps,
      rawFormData: {
        ...mockChartProps.rawFormData,
        mcp_geographic: true,
        point_radius_fixed: { type: 'metric', value: label },
      },
      queriesData: [
        { data: [{ LATITUDE: 37.8, LONGITUDE: -122.4, [label]: 42 }] },
      ],
    };
    const features = transformProps(props as ChartProps).payload.data
      .features as ScatterFeature[];
    expect(features).toHaveLength(1);
    expect(features[0]).toMatchObject({
      position: [-122.4, 37.8],
      radius: 42,
      metric: 42,
    });
  },
);

test.each(['constructor', 'toString', 'hasOwnProperty', 'valueOf'])(
  'scatter reads prototype-named dimension %s from the source',
  dimension => {
    const props = {
      ...mockChartProps,
      rawFormData: {
        ...mockChartProps.rawFormData,
        mcp_geographic: true,
        dimension,
        point_radius_fixed: { type: 'fix', value: 100 },
      },
      queriesData: [
        { data: [{ LATITUDE: 37.8, LONGITUDE: -122.4, [dimension]: 'A' }] },
      ],
    };
    const features = transformProps(props as ChartProps).payload.data
      .features as ScatterFeature[];
    expect(features).toHaveLength(1);
    expect(features[0]).toMatchObject({
      position: [-122.4, 37.8],
      radius: 100,
      cat_color: 'A',
    });
  },
);
