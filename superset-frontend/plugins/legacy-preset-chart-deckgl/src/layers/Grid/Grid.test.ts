import { TimeGranularity } from '@superset-ui/core';
import { PickingInfo } from '@deck.gl/core';
import { getCrossFilterDataMask } from './Grid';

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
  viewport: {},
  layer: {},
  x: 172,
  y: 116.484375,
} as unknown as PickingInfo;

jest.mock('@deck.gl/aggregation-layers', () => ({}));
jest.mock('@deck.gl/react', () => ({}));

describe('Deck.gl Grid', () => {
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
                  hasCustomLabel: true,
                  label: 'LON,LAT',
                  sqlExpression: 'LON',
                },
                op: '==',
                val: -122.4205965,
              },
              {
                col: {
                  expressionType: 'SQL',
                  hasCustomLabel: true,
                  label: 'LON,LAT',
                  sqlExpression: 'LAT',
                },
                op: '==',
                val: 37.8054735,
              },
            ],
          },
          filterState: {
            value: '-122.4205965,37.8054735',
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
                col: delimitedFormData.spatial.lonlatCol,
                op: '==',
                val: `-122.4205965,37.8054735`,
              },
            ],
          },
          filterState: {
            value: `-122.4205965,37.8054735`,
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
                col: geohashFormData.spatial.geohashCol,
                op: '==',
                val: `9q8zn620c751`,
              },
            ],
          },
          filterState: {
            value: '9q8zn620c751',
          },
        },
        isCurrentValueSelected: false,
      };

      expect(dataMask).toStrictEqual(expected);
    });
  });
});
