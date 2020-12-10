import buildQuery from '../src/buildQuery';

describe('TableVis buildQuery', () => {
  const formData = {
    datasource: '5__table',
    granularity_sqla: 'ds',
    series: 'foo',
    viz_type: 'table',
    all_columns: ['a', 'b', 'c'],
    percent_metrics: ['a'],
    include_time: false,
    order_by_cols: [],
  };

  it('should build groupby with series in form data', () => {
    const queryContext = buildQuery(formData);
    const [query] = queryContext.queries;
    expect(query.metrics![0].label).toEqual('a');
    expect(query.groupby).toHaveLength(0);
  });
});
