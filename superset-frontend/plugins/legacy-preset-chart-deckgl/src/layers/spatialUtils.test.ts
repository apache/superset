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
import {
  ChartProps,
  DatasourceType,
  QueryObjectFilterClause,
  SupersetTheme,
} from '@superset-ui/core';
import { decode } from 'ngeohash';

import {
  getSpatialColumns,
  addSpatialNullFilters,
  buildSpatialQuery,
  processSpatialData,
  transformSpatialProps,
  SpatialFormData,
} from './spatialUtils';

jest.mock('ngeohash', () => ({
  decode: jest.fn(),
}));

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  buildQueryContext: jest.fn(),
  getMetricLabel: jest.fn(),
  ensureIsArray: jest.fn(arr => arr || []),
  normalizeOrderBy: jest.fn(({ orderby }) => ({ orderby })),
}));

// Mock DOM element for bootstrap data
const mockBootstrapData = {
  common: {
    conf: {
      MAPBOX_API_KEY: 'test_api_key',
    },
  },
};

Object.defineProperty(document, 'getElementById', {
  value: jest.fn().mockReturnValue({
    getAttribute: jest.fn().mockReturnValue(JSON.stringify(mockBootstrapData)),
  }),
  writable: true,
});

const mockDecode = decode as jest.MockedFunction<typeof decode>;

describe('spatialUtils', () => {
  test('getSpatialColumns returns correct columns for latlong type', () => {
    const spatial: SpatialFormData['spatial'] = {
      type: 'latlong',
      lonCol: 'longitude',
      latCol: 'latitude',
    };

    const result = getSpatialColumns(spatial);
    expect(result).toEqual(['longitude', 'latitude']);
  });

  test('getSpatialColumns returns correct columns for delimited type', () => {
    const spatial: SpatialFormData['spatial'] = {
      type: 'delimited',
      lonlatCol: 'coordinates',
    };

    const result = getSpatialColumns(spatial);
    expect(result).toEqual(['coordinates']);
  });

  test('getSpatialColumns returns correct columns for geohash type', () => {
    const spatial: SpatialFormData['spatial'] = {
      type: 'geohash',
      geohashCol: 'geohash_code',
    };

    const result = getSpatialColumns(spatial);
    expect(result).toEqual(['geohash_code']);
  });

  test('getSpatialColumns throws error when spatial is null', () => {
    expect(() => getSpatialColumns(null as any)).toThrow('Bad spatial key');
  });

  test('getSpatialColumns throws error when spatial type is missing', () => {
    const spatial = {} as SpatialFormData['spatial'];
    expect(() => getSpatialColumns(spatial)).toThrow('Bad spatial key');
  });

  test('getSpatialColumns throws error when latlong columns are missing', () => {
    const spatial: SpatialFormData['spatial'] = {
      type: 'latlong',
    };
    expect(() => getSpatialColumns(spatial)).toThrow(
      'Longitude and latitude columns are required for latlong type',
    );
  });

  test('getSpatialColumns throws error when delimited column is missing', () => {
    const spatial: SpatialFormData['spatial'] = {
      type: 'delimited',
    };
    expect(() => getSpatialColumns(spatial)).toThrow(
      'Longitude/latitude column is required for delimited type',
    );
  });

  test('getSpatialColumns throws error when geohash column is missing', () => {
    const spatial: SpatialFormData['spatial'] = {
      type: 'geohash',
    };
    expect(() => getSpatialColumns(spatial)).toThrow(
      'Geohash column is required for geohash type',
    );
  });

  test('getSpatialColumns throws error for unknown spatial type', () => {
    const spatial = {
      type: 'unknown',
    } as any;
    expect(() => getSpatialColumns(spatial)).toThrow(
      'Unknown spatial type: unknown',
    );
  });

  test('addSpatialNullFilters adds null filters for spatial columns', () => {
    const spatial: SpatialFormData['spatial'] = {
      type: 'latlong',
      lonCol: 'longitude',
      latCol: 'latitude',
    };
    const existingFilters: QueryObjectFilterClause[] = [
      { col: 'other_col', op: '==', val: 'test' },
    ];

    const result = addSpatialNullFilters(spatial, existingFilters);

    expect(result).toEqual([
      { col: 'other_col', op: '==', val: 'test' },
      { col: 'longitude', op: 'IS NOT NULL', val: null },
      { col: 'latitude', op: 'IS NOT NULL', val: null },
    ]);
  });

  test('addSpatialNullFilters returns original filters when spatial is null', () => {
    const existingFilters: QueryObjectFilterClause[] = [
      { col: 'test_col', op: '==', val: 'test' },
    ];

    const result = addSpatialNullFilters(null as any, existingFilters);
    expect(result).toBe(existingFilters);
  });

  test('addSpatialNullFilters works with empty filters array', () => {
    const spatial: SpatialFormData['spatial'] = {
      type: 'delimited',
      lonlatCol: 'coordinates',
    };

    const result = addSpatialNullFilters(spatial, []);

    expect(result).toEqual([
      { col: 'coordinates', op: 'IS NOT NULL', val: null },
    ]);
  });

  test('buildSpatialQuery throws error when spatial is missing', () => {
    const formData = {} as SpatialFormData;

    expect(() => buildSpatialQuery(formData)).toThrow(
      'Spatial configuration is required for this chart',
    );
  });

  test('buildSpatialQuery calls buildQueryContext with correct parameters', () => {
    const mockBuildQueryContext =
      jest.requireMock('@superset-ui/core').buildQueryContext;
    const formData: SpatialFormData = {
      spatial: {
        type: 'latlong',
        lonCol: 'longitude',
        latCol: 'latitude',
      },
      size: 'count',
      js_columns: ['extra_col'],
    } as SpatialFormData;

    buildSpatialQuery(formData);

    expect(mockBuildQueryContext).toHaveBeenCalledWith(formData, {
      buildQuery: expect.any(Function),
    });
  });

  test('processSpatialData processes latlong data correctly', () => {
    const records = [
      { longitude: -122.4, latitude: 37.8, count: 10, extra: 'test1' },
      { longitude: -122.5, latitude: 37.9, count: 20, extra: 'test2' },
    ];
    const spatial: SpatialFormData['spatial'] = {
      type: 'latlong',
      lonCol: 'longitude',
      latCol: 'latitude',
    };
    const metricLabel = 'count';
    const jsColumns = ['extra'];

    const result = processSpatialData(records, spatial, metricLabel, jsColumns);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      position: [-122.4, 37.8],
      weight: 10,
      extraProps: { extra: 'test1' },
    });
    expect(result[1]).toEqual({
      position: [-122.5, 37.9],
      weight: 20,
      extraProps: { extra: 'test2' },
    });
  });

  test('processSpatialData processes delimited data correctly', () => {
    const records = [
      { coordinates: '-122.4,37.8', count: 15 },
      { coordinates: '-122.5,37.9', count: 25 },
    ];
    const spatial: SpatialFormData['spatial'] = {
      type: 'delimited',
      lonlatCol: 'coordinates',
    };

    const result = processSpatialData(records, spatial, 'count');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      position: [-122.4, 37.8],
      weight: 15,
      extraProps: {},
    });
  });

  test('processSpatialData processes geohash data correctly', () => {
    mockDecode.mockReturnValue({
      latitude: 37.8,
      longitude: -122.4,
      error: {
        latitude: 0,
        longitude: 0,
      },
    });

    const records = [{ geohash: 'dr5regw3p', count: 30 }];
    const spatial: SpatialFormData['spatial'] = {
      type: 'geohash',
      geohashCol: 'geohash',
    };

    const result = processSpatialData(records, spatial, 'count');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      position: [-122.4, 37.8],
      weight: 30,
      extraProps: {},
    });
    expect(mockDecode).toHaveBeenCalledWith('dr5regw3p');
  });

  test('processSpatialData reverses coordinates when reverseCheckbox is true', () => {
    const records = [{ longitude: -122.4, latitude: 37.8, count: 10 }];
    const spatial: SpatialFormData['spatial'] = {
      type: 'latlong',
      lonCol: 'longitude',
      latCol: 'latitude',
      reverseCheckbox: true,
    };

    const result = processSpatialData(records, spatial, 'count');

    expect(result[0].position).toEqual([37.8, -122.4]);
  });

  test('processSpatialData handles invalid coordinates', () => {
    const records = [
      { longitude: 'invalid', latitude: 37.8, count: 10 },
      { longitude: -122.4, latitude: NaN, count: 20 },
      // 'latlong' spatial type expects longitude/latitude fields
      // so records with 'coordinates' should be filtered out
      { coordinates: 'invalid,coords', count: 30 },
      { coordinates: '-122.4,invalid', count: 40 },
    ];
    const spatial: SpatialFormData['spatial'] = {
      type: 'latlong',
      lonCol: 'longitude',
      latCol: 'latitude',
    };

    const result = processSpatialData(records, spatial, 'count');

    expect(result).toHaveLength(0);
  });

  test('processSpatialData handles missing metric values', () => {
    const records = [
      { longitude: -122.4, latitude: 37.8, count: null },
      { longitude: -122.5, latitude: 37.9 },
      { longitude: -122.6, latitude: 38.0, count: 'invalid' },
    ];
    const spatial: SpatialFormData['spatial'] = {
      type: 'latlong',
      lonCol: 'longitude',
      latCol: 'latitude',
    };

    const result = processSpatialData(records, spatial, 'count');

    expect(result).toHaveLength(3);
    expect(result[0].weight).toBe(1);
    expect(result[1].weight).toBe(1);
    expect(result[2].weight).toBe(1);
  });

  test('processSpatialData returns empty array for empty records', () => {
    const spatial: SpatialFormData['spatial'] = {
      type: 'latlong',
      lonCol: 'longitude',
      latCol: 'latitude',
    };

    const result = processSpatialData([], spatial);

    expect(result).toEqual([]);
  });

  test('processSpatialData returns empty array when spatial is null', () => {
    const records = [{ longitude: -122.4, latitude: 37.8 }];

    const result = processSpatialData(records, null as any);

    expect(result).toEqual([]);
  });

  test('processSpatialData handles delimited coordinate edge cases', () => {
    const records = [
      { coordinates: '', count: 10 },
      { coordinates: null, count: 20 },
      { coordinates: undefined, count: 30 },
      { coordinates: '-122.4', count: 40 }, // only one coordinate
      { coordinates: 'a,b', count: 50 }, // non-numeric
      { coordinates: '  -122.4  ,  37.8  ', count: 60 }, // with spaces
    ];
    const spatial: SpatialFormData['spatial'] = {
      type: 'delimited',
      lonlatCol: 'coordinates',
    };

    const result = processSpatialData(records, spatial, 'count');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      position: [-122.4, 37.8],
      weight: 60,
      extraProps: {},
    });
  });

  test('processSpatialData copies additional properties correctly', () => {
    const records = [
      {
        longitude: -122.4,
        latitude: 37.8,
        count: 10,
        category: 'A',
        description: 'Test location',
        extra_col: 'extra_value',
      },
    ];
    const spatial: SpatialFormData['spatial'] = {
      type: 'latlong',
      lonCol: 'longitude',
      latCol: 'latitude',
    };
    const jsColumns = ['extra_col'];

    const result = processSpatialData(records, spatial, 'count', jsColumns);

    expect(result[0]).toEqual({
      position: [-122.4, 37.8],
      weight: 10,
      extraProps: { extra_col: 'extra_value' },
      category: 'A',
      description: 'Test location',
    });

    expect(result[0]).not.toHaveProperty('longitude');
    expect(result[0]).not.toHaveProperty('latitude');
    expect(result[0]).not.toHaveProperty('count');
    expect(result[0]).not.toHaveProperty('extra_col');
  });

  test('transformSpatialProps transforms chart props correctly', () => {
    const mockGetMetricLabel =
      jest.requireMock('@superset-ui/core').getMetricLabel;
    mockGetMetricLabel.mockReturnValue('count_label');

    const chartProps: ChartProps = {
      datasource: {
        id: 1,
        type: DatasourceType.Table,
        columns: [],
        name: '',
        metrics: [],
      },
      height: 400,
      width: 600,
      hooks: {
        onAddFilter: jest.fn(),
        onContextMenu: jest.fn(),
        setControlValue: jest.fn(),
        setDataMask: jest.fn(),
      },
      queriesData: [
        {
          data: [
            { longitude: -122.4, latitude: 37.8, count: 10 },
            { longitude: -122.5, latitude: 37.9, count: 20 },
          ],
        },
      ],
      rawFormData: {
        spatial: {
          type: 'latlong',
          lonCol: 'longitude',
          latCol: 'latitude',
        },
        size: 'count',
        js_columns: [],
        viewport: {
          zoom: 10,
          latitude: 37.8,
          longitude: -122.4,
        },
      } as unknown as SpatialFormData,
      filterState: {},
      emitCrossFilters: true,
      annotationData: {},
      rawDatasource: {},
      initialValues: {},
      formData: {
        spatial: {
          type: 'latlong',
          lonCol: 'longitude',
          latCol: 'latitude',
        },
        size: 'count',
        js_columns: [],
        viewport: {
          zoom: 10,
          latitude: 37.8,
          longitude: -122.4,
        },
      },
      ownState: {},
      behaviors: [],
      theme: {} as unknown as SupersetTheme,
    };

    const result = transformSpatialProps(chartProps);

    expect(result).toMatchObject({
      datasource: chartProps.datasource,
      emitCrossFilters: chartProps.emitCrossFilters,
      formData: chartProps.rawFormData,
      height: 400,
      width: 600,
      filterState: {},
      onAddFilter: chartProps.hooks.onAddFilter,
      onContextMenu: chartProps.hooks.onContextMenu,
      setControlValue: chartProps.hooks.setControlValue,
      setDataMask: chartProps.hooks.setDataMask,
      viewport: {
        zoom: 10,
        latitude: 37.8,
        longitude: -122.4,
        height: 400,
        width: 600,
      },
    });

    expect(result.payload.data.features).toHaveLength(2);
    expect(result.payload.data.mapboxApiKey).toBe('test_api_key');
    expect(result.payload.data.metricLabels).toEqual(['count_label']);
  });

  test('transformSpatialProps handles missing hooks gracefully', () => {
    const chartProps: ChartProps = {
      datasource: {
        id: 1,
        type: DatasourceType.Table,
        columns: [],
        name: '',
        metrics: [],
      },
      height: 400,
      width: 600,
      hooks: {},
      queriesData: [{ data: [] }],
      rawFormData: {
        spatial: {
          type: 'latlong',
          lonCol: 'longitude',
          latCol: 'latitude',
        },
      } as SpatialFormData,
      filterState: {},
      emitCrossFilters: true,
      annotationData: {},
      rawDatasource: {},
      initialValues: {},
      formData: {
        spatial: {
          type: 'latlong',
          lonCol: 'longitude',
          latCol: 'latitude',
        },
      },
      ownState: {},
      behaviors: [],
      theme: {} as unknown as SupersetTheme,
    };

    const result = transformSpatialProps(chartProps);

    expect(typeof result.onAddFilter).toBe('function');
    expect(typeof result.onContextMenu).toBe('function');
    expect(typeof result.setControlValue).toBe('function');
    expect(typeof result.setDataMask).toBe('function');
    expect(typeof result.setTooltip).toBe('function');
  });

  test('transformSpatialProps handles missing metric', () => {
    const mockGetMetricLabel =
      jest.requireMock('@superset-ui/core').getMetricLabel;
    mockGetMetricLabel.mockReturnValue(undefined);

    const chartProps: ChartProps = {
      datasource: {
        id: 1,
        type: DatasourceType.Table,
        columns: [],
        name: '',
        metrics: [],
      },
      height: 400,
      width: 600,
      hooks: {},
      queriesData: [{ data: [] }],
      rawFormData: {
        spatial: {
          type: 'latlong',
          lonCol: 'longitude',
          latCol: 'latitude',
        },
      } as SpatialFormData,
      filterState: {},
      emitCrossFilters: true,
      annotationData: {},
      rawDatasource: {},
      initialValues: {},
      formData: {
        spatial: {
          type: 'latlong',
          lonCol: 'longitude',
          latCol: 'latitude',
        },
      },
      ownState: {},
      behaviors: [],
      theme: {} as unknown as SupersetTheme,
    };

    const result = transformSpatialProps(chartProps);

    expect(result.payload.data.metricLabels).toEqual([]);
  });
});
