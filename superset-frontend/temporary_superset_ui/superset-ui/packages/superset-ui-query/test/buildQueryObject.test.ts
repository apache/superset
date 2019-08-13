import { buildQueryObject, QueryObject } from '../src';

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
    expect(query.metrics).toEqual([{ label: 'sum__num' }]);
  });

  it('should build limit', () => {
    const limit = 2;
    query = buildQueryObject({
      datasource: '5__table',
      granularity_sqla: 'ds',
      viz_type: 'table',
      limit,
    });
    expect(query.timeseries_limit).toEqual(limit);
  });

  it('should build order_desc', () => {
    const orderDesc = false;
    query = buildQueryObject({
      datasource: '5__table',
      granularity_sqla: 'ds',
      viz_type: 'table',
      order_desc: orderDesc,
    });
    expect(query.order_desc).toEqual(orderDesc);
  });

  it('should build timeseries_limit_metric', () => {
    const metric = 'country';
    query = buildQueryObject({
      datasource: '5__table',
      granularity_sqla: 'ds',
      viz_type: 'table',
      timeseries_limit_metric: metric,
    });
    expect(query.timeseries_limit_metric).toEqual({ label: metric });
  });
});
