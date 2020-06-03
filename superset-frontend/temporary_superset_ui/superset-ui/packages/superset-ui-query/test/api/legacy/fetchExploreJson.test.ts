import fetchMock from 'fetch-mock';
import { SupersetClient } from '@superset-ui/connection';
import { LOGIN_GLOB } from '../fixtures/constants';
import { fetchExploreJson } from '../../../src';

describe('fetchExploreJson()', () => {
  beforeAll(() => {
    fetchMock.get(LOGIN_GLOB, { csrf_token: '1234' });
    SupersetClient.reset();
    SupersetClient.configure().init();
  });

  afterEach(fetchMock.restore);

  it('returns a promise of LegacyChartDataResponse', () => {
    fetchMock.post('glob:*/superset/explore_json/', {
      field1: 'abc',
      field2: 'def',
    });

    return expect(
      fetchExploreJson({
        formData: {
          granularity: 'minute',
          viz_type: 'word_cloud',
          datasource: '1__table',
        },
      }),
    ).resolves.toEqual({
      field1: 'abc',
      field2: 'def',
    });
  });
  it('uses GET when specified', () => {
    fetchMock.get('glob:*/superset/explore_json/', {
      field1: 'abc',
      field2: 'def',
    });

    return expect(
      fetchExploreJson({
        method: 'GET',
        formData: {
          granularity: 'minute',
          viz_type: 'word_cloud',
          datasource: '1__table',
        },
      }),
    ).resolves.toEqual({
      field1: 'abc',
      field2: 'def',
    });
  });
});
