import build from 'src/query/buildQueryContext';
import * as queryObjectBuilder from 'src/query/buildQueryObject';

describe('queryContextBuilder', () => {
  it('should build datasource for table sources', () => {
    const queryContext = build({ datasource: '5__table', granularity_sqla: 'ds'});
    expect(queryContext.datasource.id).toBe(5);
    expect(queryContext.datasource.type).toBe('table');
  });

  it('should build datasource for druid sources', () => {
    const queryContext = build({ datasource: '5__druid', granularity: 'ds'});
    expect(queryContext.datasource.id).toBe(5);
    expect(queryContext.datasource.type).toBe('druid');
  });

  it('should call queryObjectBuilder to build queries', () => {
    const buildQueryObjectSpy = jest.spyOn(queryObjectBuilder, 'default');
    build({ datasource: '5__table', granularity_sqla: 'ds'});
    expect(buildQueryObjectSpy).toHaveBeenCalledTimes(1);
  });
});
