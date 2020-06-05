import fetchMock from 'fetch-mock';
import setupClientForTest from '../setupClientForTest';
import { getDatasourceMetadata } from '../../../src/api/legacy';

describe('getFormData()', () => {
  beforeAll(setupClientForTest);

  afterEach(fetchMock.restore);

  it('returns datasource metadata for given datasource key', () => {
    const mockData = {
      field1: 'abc',
      field2: 'def',
    };

    fetchMock.get('glob:*/superset/fetch_datasource_metadata?datasourceKey=1__table', mockData);

    return expect(
      getDatasourceMetadata({
        datasourceKey: '1__table',
      }),
    ).resolves.toEqual(mockData);
  });
});
