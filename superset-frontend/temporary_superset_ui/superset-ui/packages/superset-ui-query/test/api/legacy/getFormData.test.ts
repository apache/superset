import fetchMock from 'fetch-mock';
import setupClientForTest from '../setupClientForTest';
import { getFormData } from '../../../src/api/legacy';

describe('getFormData()', () => {
  beforeAll(setupClientForTest);

  afterEach(fetchMock.restore);

  const mockData = {
    datasource: '1__table',
    viz_type: 'sankey',
    slice_id: 1,
    url_params: {},
    granularity_sqla: null,
    time_grain_sqla: 'P1D',
    time_range: 'Last week',
    groupby: ['source', 'target'],
    metric: 'sum__value',
    adhoc_filters: [],
    row_limit: 1000,
  };

  it('returns formData for given slice id', () => {
    fetchMock.get(`glob:*/api/v1/form_data/?slice_id=1`, mockData);

    return expect(
      getFormData({
        sliceId: 1,
      }),
    ).resolves.toEqual(mockData);
  });

  it('overrides formData when overrideFormData is specified', () => {
    fetchMock.get(`glob:*/api/v1/form_data/?slice_id=1`, mockData);

    return expect(
      getFormData({
        sliceId: 1,
        overrideFormData: {
          metric: 'avg__value',
        },
      }),
    ).resolves.toEqual({
      ...mockData,
      metric: 'avg__value',
    });
  });
});
