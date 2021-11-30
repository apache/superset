import getPointsFromPolygon from '../../src/utils/getPointsFromPolygon';

describe('getPointsFromPolygon', () => {
  it('handle original input', () => {
    expect(
      getPointsFromPolygon({
        polygon: [
          [1, 2],
          [3, 4],
        ],
      }),
    ).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });
  it('handle geojson features', () => {
    expect(
      getPointsFromPolygon({
        polygon: {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [1, 2],
                [3, 4],
              ],
            ],
          },
        },
      }),
    ).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });
});
