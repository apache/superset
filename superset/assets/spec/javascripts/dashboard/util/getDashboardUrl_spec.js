import getDashboardUrl from '../../../../src/dashboard/util/getDashboardUrl';

describe('getChartIdsFromLayout', () => {
  it('should encode filters', () => {
    const filters = { 35: { key: ['value'] } };
    const url = getDashboardUrl('path', filters);
    expect(url).toBe(
      'path?preselect_filters=%7B%2235%22%3A%7B%22key%22%3A%5B%22value%22%5D%7D%7D',
    );
  });
});
