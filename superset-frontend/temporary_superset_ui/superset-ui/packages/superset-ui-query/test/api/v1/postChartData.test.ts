import fetchMock from 'fetch-mock';
import { buildQueryContext } from '../../../src';
import { postChartData } from '../../../src/api/v1';
import setupClientForTest from '../setupClientForTest';

describe('postChartData()', () => {
  beforeAll(setupClientForTest);

  afterEach(fetchMock.restore);

  it('returns a promise of ChartDataResponse', () => {
    fetchMock.post('glob:*/api/v1/chart/data', {
      result: [
        {
          field1: 'abc',
          field2: 'def',
        },
      ],
    });

    return expect(
      postChartData({
        queryContext: buildQueryContext({
          granularity: 'minute',
          viz_type: 'word_cloud',
          datasource: '1__table',
        }),
      }),
    ).resolves.toEqual({
      result: [
        {
          field1: 'abc',
          field2: 'def',
        },
      ],
    });
  });
});
