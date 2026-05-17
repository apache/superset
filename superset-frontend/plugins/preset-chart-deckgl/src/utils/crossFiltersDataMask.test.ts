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
import { TimeGranularity } from '@superset-ui/core';
import { PickingInfo } from '@deck.gl/core';
import {
  getCrossFilterDataMask,
  LayerFormData,
  SpatialData,
} from './crossFiltersDataMask';

const formData: LayerFormData = {
  metric: 'value',
  colorPicker: {
    r: 0,
    g: 122,
    b: 135,
    a: 1,
  },
  compareLag: 1,
  timeGrainSqla: TimeGranularity.QUARTER,
  granularitySqla: 'ds',
  compareSuffix: 'over last quarter',
  viz_type: 'deck_grid',
  yAxisFormat: '.3s',
  datasource: 'test_datasource',
};

const pickingData = {
  color: [],
  index: 1,
  coordinate: [-122.40138935788005, 37.77785781376027],
  devicePixel: [345, 428],
  pixel: [172, 116.484375],
  pixelRatio: 2,
  picked: true,
  sourceLayer: {},
  viewport: { zoom: 10 },
  layer: {},
  x: 172,
  y: 116.484375,
} as unknown as PickingInfo;

describe('getCrossFilterDataMask', () => {
  test('handles latlong type', () => {
    const latlongFormData = {
      ...formData,
      spatial: {
        latCol: 'LAT',
        lonCol: 'LON',
        type: 'latlong',
      } as SpatialData,
    };

    const latlongPickingData = {
      ...pickingData,
      object: {
        col: 14,
        row: 34,
        colorValue: 1369,
        elevationValue: 1369,
        count: 5,
        pointIndices: [2, 1425, 4107, 4410, 4737],
        points: [
          {
            position: [-122.4205965, 37.8054735],
            weight: 1349,
          },
          {
            position: [-122.4215375, 37.8058583],
            weight: 8,
          },
        ],
      },
    };

    const dataMask = getCrossFilterDataMask({
      formData: latlongFormData,
      data: latlongPickingData,
      filterState: {},
    });

    const expected = {
      dataMask: {
        extraFormData: {
          filters: [
            {
              col: 'LON',
              op: 'IN',
              val: [-122.4205965, -122.4215375],
            },
            {
              col: 'LAT',
              op: 'IN',
              val: [37.8054735, 37.8058583],
            },
          ],
        },
        filterState: {
          value: [
            [-122.4205965, 37.8054735],
            [-122.4215375, 37.8058583],
          ],
          customColumnLabel: 'LON, LAT',
        },
      },
      isCurrentValueSelected: false,
    };

    expect(dataMask).toStrictEqual(expected);
  });

  test('handles latlong type with active filters', () => {
    const latlongFormData = {
      ...formData,
      spatial: {
        latCol: 'LAT',
        lonCol: 'LON',
        type: 'latlong',
      } as SpatialData,
    };

    const latlongPickingData = {
      ...pickingData,
      object: {
        col: 14,
        row: 34,
        colorValue: 1369,
        elevationValue: 1369,
        count: 5,
        pointIndices: [2, 1425, 4107, 4410, 4737],
        points: [
          {
            position: [-122.4205965, 37.8054735],
            weight: 1349,
          },
          {
            position: [-122.4215375, 37.8058583],
            weight: 8,
          },
        ],
      },
    };

    const dataMask = getCrossFilterDataMask({
      formData: latlongFormData,
      data: latlongPickingData,
      filterState: {
        value: [
          [-122.4205965, 37.8054735],
          [-122.4215375, 37.8058583],
        ],
      },
    });

    const expected = {
      dataMask: {
        extraFormData: {
          filters: [],
        },
        filterState: {
          value: null,
        },
      },
      isCurrentValueSelected: true,
    };

    expect(dataMask).toStrictEqual(expected);
  });

  test('handles delimited type', () => {
    const delimitedFormData = {
      ...formData,
      spatial: {
        lonlatCol: 'LONLAT',
        delimiter: ',',
        type: 'delimited',
      } as SpatialData,
    };

    const delimitedPickingData = {
      ...pickingData,
      object: {
        points: [
          {
            position: [-122.4205965, 37.8054735],
            weight: 1349,
          },
          {
            position: [-122.4215375, 37.8058583],
            weight: 8,
          },
        ],
      },
    };

    const dataMask = getCrossFilterDataMask({
      formData: delimitedFormData,
      data: delimitedPickingData,
      filterState: {},
    });

    const expected = {
      dataMask: {
        extraFormData: {
          filters: [
            {
              col: 'LONLAT',
              op: 'IN',
              val: [`-122.4205965,37.8054735`, `-122.4215375,37.8058583`],
            },
          ],
        },
        filterState: {
          value: [`-122.4205965,37.8054735`, `-122.4215375,37.8058583`],
        },
      },
      isCurrentValueSelected: false,
    };

    expect(dataMask).toStrictEqual(expected);
  });

  test('handles delimited type with reversed lon/lat', () => {
    const delimitedFormData = {
      ...formData,
      spatial: {
        lonlatCol: 'LONLAT',
        delimiter: ',',
        type: 'delimited',
        reverseCheckbox: true,
      } as SpatialData,
    };

    const delimitedPickingData = {
      ...pickingData,
      object: {
        points: [
          {
            position: [-122.4205965, 37.8054735],
            weight: 1349,
          },
          {
            position: [-122.4215375, 37.8058583],
            weight: 8,
          },
        ],
      },
    };

    const dataMask = getCrossFilterDataMask({
      formData: delimitedFormData,
      data: delimitedPickingData,
      filterState: {},
    });

    const expected = {
      dataMask: {
        extraFormData: {
          filters: [
            {
              col: 'LONLAT',
              op: 'IN',
              val: [`37.8054735,-122.4205965`, `37.8058583,-122.4215375`],
            },
          ],
        },
        filterState: {
          value: [`37.8054735,-122.4205965`, `37.8058583,-122.4215375`],
        },
      },
      isCurrentValueSelected: false,
    };

    expect(dataMask).toStrictEqual(expected);
  });

  test('handles geohash type', () => {
    const geohashFormData = {
      ...formData,
      spatial: {
        geohashCol: 'geohash',
        reverseCheckbox: false,
        type: 'geohash',
      } as SpatialData,
    };

    const geohashPickingData = {
      ...pickingData,
      object: {
        points: [
          {
            position: [-122.42059646174312, 37.805473459884524],
            weight: 1349,
          },
        ],
      },
    };

    const dataMask = getCrossFilterDataMask({
      formData: geohashFormData,
      data: geohashPickingData,
      filterState: {},
    });

    const expected = {
      dataMask: {
        extraFormData: {
          filters: [
            {
              col: 'geohash',
              op: 'IN',
              val: [`9q8zn620c751`],
            },
          ],
        },
        filterState: {
          value: ['9q8zn620c751'],
        },
      },
      isCurrentValueSelected: false,
    };

    expect(dataMask).toStrictEqual(expected);
  });

  test('handles start and end postions (Arc Chart)', () => {
    const arcFormData = {
      ...formData,
      start_spatial: {
        geohashCol: 'geohash',
        reverseCheckbox: false,
        type: 'geohash',
      } as SpatialData,
      end_spatial: {
        latCol: 'LAT_DEST',
        lonCol: 'LON_DEST',
        type: 'latlong',
      } as SpatialData,
    };

    const arkPickingData = {
      ...pickingData,
      object: {
        sourcePosition: [-122.42059646174312, 37.805473459884524],
        targetPosition: [-122.4215375, 37.8058583],
      },
    };

    const dataMask = getCrossFilterDataMask({
      formData: arcFormData,
      data: arkPickingData,
      filterState: {},
    });

    const expected = {
      dataMask: {
        extraFormData: {
          filters: [
            {
              col: 'geohash',
              op: '==',
              val: `9q8zn620c751`,
            },
            {
              col: 'LON_DEST',
              op: '==',
              val: -122.4215375,
            },
            {
              col: 'LAT_DEST',
              op: '==',
              val: 37.8058583,
            },
          ],
        },
        filterState: {
          value: [['9q8zn620c751'], [-122.4215375, 37.8058583]],
          customColumnLabel: 'Start geohash end LAT_DEST, LON_DEST',
        },
      },
      isCurrentValueSelected: false,
    };

    expect(dataMask).toStrictEqual(expected);
  });

  test('deck_polygon with cross_filter_column emits dimension filter (top-level)', () => {
    const polygonFormData = {
      ...formData,
      line_column: 'geojson',
      cross_filter_column: 'sa3_name',
    };

    const polygonPickingData = {
      ...pickingData,
      object: {
        polygon: [
          [-122.42, 37.8],
          [-122.42, 37.81],
          [-122.41, 37.81],
          [-122.41, 37.8],
          [-122.42, 37.8],
        ],
        sa3_name: 'Christchurch West',
        extraProps: {},
      },
    };

    const dataMask = getCrossFilterDataMask({
      formData: polygonFormData,
      data: polygonPickingData,
      filterState: {},
    });

    expect(dataMask).toStrictEqual({
      dataMask: {
        extraFormData: {
          filters: [
            {
              col: 'sa3_name',
              op: '==',
              val: 'Christchurch West',
            },
          ],
        },
        filterState: {
          value: ['Christchurch West'],
        },
      },
      isCurrentValueSelected: false,
    });
  });

  test('deck_polygon with cross_filter_column reads from extraProps fallback', () => {
    const polygonFormData = {
      ...formData,
      line_column: 'geojson',
      cross_filter_column: 'region_id',
    };

    const polygonPickingData = {
      ...pickingData,
      object: {
        polygon: [
          [-122.42, 37.8],
          [-122.42, 37.81],
          [-122.41, 37.81],
          [-122.41, 37.8],
          [-122.42, 37.8],
        ],
        extraProps: { region_id: 42 },
      },
    };

    const dataMask = getCrossFilterDataMask({
      formData: polygonFormData,
      data: polygonPickingData,
      filterState: {},
    });

    expect(dataMask).toStrictEqual({
      dataMask: {
        extraFormData: {
          filters: [
            {
              col: 'region_id',
              op: '==',
              val: 42,
            },
          ],
        },
        filterState: {
          value: [42],
        },
      },
      isCurrentValueSelected: false,
    });
  });

  test('deck_polygon throws when cross_filter_column value missing on feature', () => {
    const polygonFormData = {
      ...formData,
      line_column: 'geojson',
      cross_filter_column: 'sa3_name',
    };

    const polygonPickingData = {
      ...pickingData,
      object: {
        polygon: 'POLYGON_PATH_STRING',
        // sa3_name intentionally absent (e.g. chart was saved before the column
        // was added to the query)
        extraProps: {},
      },
    };

    expect(() =>
      getCrossFilterDataMask({
        formData: polygonFormData,
        data: polygonPickingData,
        filterState: {},
      }),
    ).toThrow(/Cross-filter column "sa3_name" not present/);
  });

  test('deck_geojson throws when cross_filter_column value missing on feature properties', () => {
    const geojsonFormData = {
      ...formData,
      geojson: 'shape',
      cross_filter_column: 'sa3_name',
    };

    const geojsonPickingData = {
      ...pickingData,
      object: {
        type: 'Feature',
        properties: { other: 'value' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-122.42, 37.8],
              [-122.42, 37.81],
            ],
          ],
        },
      },
    };

    expect(() =>
      getCrossFilterDataMask({
        formData: geojsonFormData,
        data: geojsonPickingData,
        filterState: {},
      }),
    ).toThrow(/Cross-filter column "sa3_name" not present/);
  });

  test('deck_polygon without cross_filter_column falls back to legacy geometry filter', () => {
    const polygonFormData = {
      ...formData,
      line_column: 'geojson',
    };

    const polygonPickingData = {
      ...pickingData,
      object: {
        polygon: 'POLYGON_PATH_STRING',
      },
    };

    const dataMask = getCrossFilterDataMask({
      formData: polygonFormData,
      data: polygonPickingData,
      filterState: {},
    });

    expect(dataMask).toStrictEqual({
      dataMask: {
        extraFormData: {
          filters: [
            {
              col: {
                expressionType: 'SQL',
                sqlExpression: "REPLACE(geojson, ' ', '')",
                label: 'geojson',
              },
              op: '==',
              val: '"POLYGON_PATH_STRING"',
            },
          ],
        },
        filterState: {
          value: ['"POLYGON_PATH_STRING"'],
        },
      },
      isCurrentValueSelected: false,
    });
  });

  test('deck_geojson with cross_filter_column emits filter from feature.properties', () => {
    const geojsonFormData = {
      ...formData,
      geojson: 'shape',
      cross_filter_column: 'sa3_name',
    };

    const geojsonPickingData = {
      ...pickingData,
      object: {
        type: 'Feature',
        properties: { sa3_name: 'Christchurch West', sa3_code: '301' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-122.42, 37.8],
              [-122.42, 37.81],
              [-122.41, 37.81],
              [-122.41, 37.8],
              [-122.42, 37.8],
            ],
          ],
        },
      },
    };

    const dataMask = getCrossFilterDataMask({
      formData: geojsonFormData,
      data: geojsonPickingData,
      filterState: {},
    });

    expect(dataMask).toStrictEqual({
      dataMask: {
        extraFormData: {
          filters: [
            {
              col: 'sa3_name',
              op: '==',
              val: 'Christchurch West',
            },
          ],
        },
        filterState: {
          value: ['Christchurch West'],
        },
      },
      isCurrentValueSelected: false,
    });
  });

  test('deck_geojson without cross_filter_column falls back to legacy LIKE filter', () => {
    const geojsonFormData = {
      ...formData,
      geojson: 'shape',
    };

    const coords = [
      [
        [-122.42, 37.8],
        [-122.42, 37.81],
      ],
    ];

    const geojsonPickingData = {
      ...pickingData,
      object: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: coords },
      },
    };

    const dataMask = getCrossFilterDataMask({
      formData: geojsonFormData,
      data: geojsonPickingData,
      filterState: {},
    });

    expect(dataMask).toStrictEqual({
      dataMask: {
        extraFormData: {
          filters: [
            {
              col: {
                expressionType: 'SQL',
                sqlExpression: "REPLACE(shape, ' ', '')",
                label: 'shape',
              },
              op: 'LIKE',
              val: `%${JSON.stringify(coords)}%`,
            },
          ],
        },
        filterState: {
          value: [coords],
        },
      },
      isCurrentValueSelected: false,
    });
  });

  test('handles Charts with GPU aggregation', () => {
    const latlongGPUFormData = {
      ...formData,
      spatial: {
        latCol: 'LAT',
        lonCol: 'LON',
        type: 'latlong',
      } as SpatialData,
    };

    const latlongGPUPickingData = {
      ...pickingData,
      object: {
        col: 14,
        row: 34,
        colorValue: 1369,
        elevationValue: 1369,
        count: 5,
        pointIndices: [2, 1425, 4107, 4410, 4737],
      },
    };

    const dataMask = getCrossFilterDataMask({
      formData: latlongGPUFormData,
      data: latlongGPUPickingData,
      filterState: {},
    });

    const expected = {
      dataMask: {
        extraFormData: {
          filters: [
            {
              col: 'LON',
              op: '>=',
              val: -122.41076435788005,
            },
            {
              col: 'LAT',
              op: '>=',
              val: 37.76848281376027,
            },
            {
              col: 'LON',
              op: '<=',
              val: -122.39201435788004,
            },
            {
              col: 'LAT',
              op: '<=',
              val: 37.78723281376027,
            },
          ],
        },
        filterState: {
          value: [
            [-122.41076435788005, 37.76848281376027],
            [-122.39201435788004, 37.78723281376027],
          ],
          customColumnLabel: 'From LON, LAT to LON, LAT',
        },
      },
      isCurrentValueSelected: false,
    };

    expect(dataMask).toStrictEqual(expected);
  });
});
