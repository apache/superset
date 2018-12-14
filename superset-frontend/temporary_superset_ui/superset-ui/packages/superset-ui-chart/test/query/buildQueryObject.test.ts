import { buildQueryObject, QueryObject } from '../../src/query/buildQueryObject';

describe('queryObjectBuilder', () => {
  let query: QueryObject;

  it('should build granularity for sql alchemy datasources', () => {
    query = buildQueryObject({
      datasource: '5__table',
      granularity_sqla: 'ds',
      viz_type: 'table',
    });
    expect(query.granularity).toEqual('ds');
  });

  it('should build granularity for sql druid datasources', () => {
    query = buildQueryObject({
      datasource: '5__druid',
      granularity: 'ds',
      viz_type: 'table',
    });
    expect(query.granularity).toEqual('ds');
  });

  it('should build metrics', () => {
    query = buildQueryObject({
      datasource: '5__table',
      granularity_sqla: 'ds',
      viz_type: 'table',
      metric: 'sum__num',
    });
    expect(query.metrics).toEqual([
      {
        label: 'sum__num',
        expressionType: 'BUILTIN',
      },
    ]);
  });
});
