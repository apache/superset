import { buildQueryContext } from '../src';

describe('buildQueryContext', () => {
  it('should build datasource for table sources and apply defaults', () => {
    const queryContext = buildQueryContext({
      datasource: '5__table',
      granularity_sqla: 'ds',
      viz_type: 'table',
    });
    expect(queryContext.datasource.id).toBe(5);
    expect(queryContext.datasource.type).toBe('table');
    expect(queryContext.force).toBe(false);
    expect(queryContext.force).toBe(false);
    expect(queryContext.result_format).toBe('json');
    expect(queryContext.result_type).toBe('full');
  });

  it('should build datasource for druid sources and set force to true', () => {
    const queryContext = buildQueryContext({
      datasource: '5__druid',
      granularity: 'ds',
      viz_type: 'table',
      force: true,
    });
    expect(queryContext.datasource.id).toBe(5);
    expect(queryContext.datasource.type).toBe('druid');
    expect(queryContext.force).toBe(true);
  });
});
