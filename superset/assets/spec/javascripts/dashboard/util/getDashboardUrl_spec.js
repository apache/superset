import getDashboardUrl from '../../../../src/dashboard/util/getDashboardUrl';

describe('getChartIdsFromLayout', () => {
  it('should encode filters', () => {
    const filters = {
      35: {
        key: ['value1'],
      },
      45: {
        key: ['value2'],
        __time_grain: 'PT1H',
      },
    };

    const expectedFilters = encodeURIComponent(
      '{"45":{"__time_grain":"PT1H"},"key":["value1","value2"]}',
    );
    const url = getDashboardUrl('path', filters);
    expect(url).toBe(`path?preselect_filters=${expectedFilters}`);
  });
});
