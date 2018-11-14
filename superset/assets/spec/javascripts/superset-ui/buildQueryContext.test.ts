import * as datasourceBuilder from 'src/query/buildDatasource';
import * as queryObjectBuilder from 'src/query/buildQueries';
import build from 'src/query/buildQueryContext';

describe('queryContextBuilder', () => {
  const formData = {
    datasource: '5__table',
    granularity_sqla: 'ds',
  };

  it('should call datasourceBuilder to build datasource', () => {
    const buildDatasourceSpy = jest.spyOn(datasourceBuilder, 'default');
    build(formData);
    expect(buildDatasourceSpy).toHaveBeenCalledTimes(1);
  });

  it('should call queryObjectBuilder to build queries', () => {
    const buildQueryObjectSpy = jest.spyOn(queryObjectBuilder, 'default');
    build(formData);
    expect(buildQueryObjectSpy).toHaveBeenCalledTimes(1);
  });
});
