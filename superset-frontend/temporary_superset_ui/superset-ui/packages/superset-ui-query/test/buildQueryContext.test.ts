import { buildQueryContext } from '../src';

describe('buildQueryContext', () => {
  it('should build datasource for table sources', () => {
    const queryContext = buildQueryContext({
      datasource: '5__table',
      granularity_sqla: 'ds',
      viz_type: 'table',
    });
    expect(queryContext.datasource.id).toBe(5);
    expect(queryContext.datasource.type).toBe('table');
  });

  it('should build datasource for druid sources', () => {
    const queryContext = buildQueryContext({
      datasource: '5__druid',
      granularity: 'ds',
      viz_type: 'table',
    });
    expect(queryContext.datasource.id).toBe(5);
    expect(queryContext.datasource.type).toBe('druid');
  });
});
