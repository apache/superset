import { TimeGranularity } from '@superset-ui/core';
import { PickingInfo } from '@deck.gl/core';
import { getCrossFilterDataMask } from './crossFiltersDataMask';

const formData = {
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
  it('handles latlong type', () => {
    const latlongFormData = {
      ...formData,
      spatial: {
        latCol: 'LAT',
        lonCol: 'LON',
        type: 'latlong',
      },
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
              col: {
                expressionType: 'SQL',
                label: 'LON, LAT',
                sqlExpression: '"LON"',
              },
              op: '==',
              val: -122.4205965,
            },
            {
              col: {
                expressionType: 'SQL',
                label: 'LON, LAT',
                sqlExpression: '"LAT"',
              },
              op: '==',
              val: 37.8054735,
            },
          ],
        },
        filterState: {
          value: [-122.4205965, 37.8054735],
        },
      },
      isCurrentValueSelected: false,
    };

    expect(dataMask).toStrictEqual(expected);
  });

  it('handles delimited type', () => {
    const delimitedFormData = {
      ...formData,
      spatial: {
        lonlatCol: 'LONLAT',
        delimiter: ',',
        type: 'delimited',
      },
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
              col: {
                expressionType: 'SQL',
                label: 'LONLAT',
                sqlExpression: '"LONLAT"',
              },
              op: '==',
              val: `-122.4205965,37.8054735`,
            },
          ],
        },
        filterState: {
          value: [`-122.4205965,37.8054735`],
        },
      },
      isCurrentValueSelected: false,
    };

    expect(dataMask).toStrictEqual(expected);
  });

  it('handles geohash type', () => {
    const geohashFormData = {
      ...formData,
      spatial: {
        geohashCol: 'geohash',
        reverseCheckbox: false,
        type: 'geohash',
      },
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
              col: {
                expressionType: 'SQL',
                label: 'geohash',
                sqlExpression: '"geohash"',
              },
              op: '==',
              val: `9q8zn620c751`,
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

  it('handles start and end postions (Arc Chart)', () => {
    const arcFormData = {
      ...formData,
      start_spatial: {
        geohashCol: 'geohash',
        reverseCheckbox: false,
        type: 'geohash',
      },
      end_spatial: {
        latCol: 'LAT_DEST',
        lonCol: 'LON_DEST',
        type: 'latlong',
      },
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
              col: {
                expressionType: 'SQL',
                label: 'Start geohash end LAT_DEST, LON_DEST',
                sqlExpression: '"geohash"',
              },
              op: '==',
              val: `9q8zn620c751`,
            },
            {
              col: {
                expressionType: 'SQL',
                label: 'Start geohash end LAT_DEST, LON_DEST',
                sqlExpression: '"LON_DEST"',
              },
              op: '==',
              val: -122.4215375,
            },
            {
              col: {
                expressionType: 'SQL',
                label: 'Start geohash end LAT_DEST, LON_DEST',
                sqlExpression: '"LAT_DEST"',
              },
              op: '==',
              val: 37.8058583,
            },
          ],
        },
        filterState: {
          value: [['9q8zn620c751'], [-122.4215375, 37.8058583]],
        },
      },
      isCurrentValueSelected: false,
    };

    expect(dataMask).toStrictEqual(expected);
  });

  it('handles Charts with GPU aggregation', () => {
    const latlongGPUFormData = {
      ...formData,
      spatial: {
        latCol: 'LAT',
        lonCol: 'LON',
        type: 'latlong',
      },
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
              col: {
                expressionType: 'SQL',
                label: 'From LON, LAT to LON, LAT',
                sqlExpression: '"LON"',
              },
              op: '>=',
              val: -122.40170185788006,
            },
            {
              col: {
                expressionType: 'SQL',
                label: 'From LON, LAT to LON, LAT',
                sqlExpression: '"LAT"',
              },
              op: '>=',
              val: 37.77754531376027,
            },
            {
              col: {
                expressionType: 'SQL',
                label: 'From LON, LAT to LON, LAT',
                sqlExpression: '"LON"',
              },
              op: '<=',
              val: -122.40107685788004,
            },
            {
              col: {
                expressionType: 'SQL',
                label: 'From LON, LAT to LON, LAT',
                sqlExpression: '"LAT"',
              },
              op: '<=',
              val: 37.77817031376027,
            },
          ],
        },
        filterState: {
          value: [
            [-122.40170185788006, 37.77754531376027],
            [-122.40107685788004, 37.77817031376027],
          ],
        },
      },
      isCurrentValueSelected: false,
    };

    expect(dataMask).toStrictEqual(expected);
  });
});
