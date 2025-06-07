import { QueryFormData } from '@superset-ui/core';
import buildQuery from '../../src/Timeline/buildQuery';

describe('Timeline buildQuery', () => {
  const formData: QueryFormData = {
    datasource: '1__table',
    viz_type: 'echarts_timeline',
    start_time: 'start_time',
    end_time: 'end_time',
    y_axis: {
      label: 'Y Axis',
      sqlExpression: 'SELECT 1',
      expressionType: 'SQL',
    },
    series: 'series',
    tooltip_metrics: ['tooltip_metric'],
    tooltip_columns: ['tooltip_column'],
    order_by_cols: [
      JSON.stringify(['start_time', true]),
      JSON.stringify(['order_col', false]),
    ],
  };

  it('should build query', () => {
    const queryContext = buildQuery(formData);
    const [query] = queryContext.queries;
    expect(query.metrics).toStrictEqual(['tooltip_metric']);
    expect(query.columns).toStrictEqual([
      'start_time',
      'end_time',
      {
        label: 'Y Axis',
        sqlExpression: 'SELECT 1',
        expressionType: 'SQL',
      },
      'series',
      'tooltip_column',
      'order_col',
    ]);
    expect(query.series_columns).toStrictEqual(['series']);
    expect(query.orderby).toStrictEqual([
      ['start_time', true],
      ['order_col', false],
    ]);
  });
});
