import fetchMock from 'fetch-mock';
import { SupersetClient } from '@superset-ui/connection';
import { LOGIN_GLOB } from '../fixtures/constants';
import { postChartData, buildQueryContext } from '../../../src';

describe('postChartData()', () => {
  beforeAll(() => {
    fetchMock.get(LOGIN_GLOB, { csrf_token: '1234' });
    SupersetClient.reset();
    SupersetClient.configure().init();
  });

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
