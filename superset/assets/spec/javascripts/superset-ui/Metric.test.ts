import { AdhocMetric, Aggregate, ExpressionType, Metrics } from 'src/query/Metric';

describe('Metrics', () => {
  let metrics: Metrics;
  const formData = {
    datasource: '5__table',
    granularity_sqla: 'ds',
  };

  it('should build metrics for built-in metric keys', () => {
    metrics = new Metrics({
      ...formData,
      metric: 'sum__num',
    });
    expect(metrics.getMetrics()).toEqual([{label: 'sum__num'}]);
    expect(metrics.getLabels()).toEqual(['sum__num']);
  });

  it('should build metrics for simple adhoc metrics', () => {
    const adhocMetric: AdhocMetric = {
      aggregate: Aggregate.AVG,
      column: {
        columnName: 'sum_girls',
        id: 5,
        type: 'BIGINT',
      },
      expressionType: ExpressionType.SIMPLE,
    };
    metrics = new Metrics({
      ...formData,
      metric: adhocMetric,
    });
    expect(metrics.getMetrics()).toEqual([{
      aggregate: 'AVG',
      column: {
        columnName: 'sum_girls',
        id: 5,
        type: 'BIGINT',
      },
      expressionType: 'SIMPLE',
      label: 'AVG(sum_girls)',
    }]);
    expect(metrics.getLabels()).toEqual(['AVG(sum_girls)']);
  });

  it('should build metrics for SQL adhoc metrics', () => {
    const adhocMetric: AdhocMetric = {
      expressionType: ExpressionType.SQL,
      sqlExpression: 'COUNT(sum_girls)',
    };
    metrics = new Metrics({
      ...formData,
      metric: adhocMetric,
    });
    expect(metrics.getMetrics()).toEqual([{
      expressionType: 'SQL',
      label: 'COUNT(sum_girls)',
      sqlExpression: 'COUNT(sum_girls)',
    }]);
    expect(metrics.getLabels()).toEqual(['COUNT(sum_girls)']);
  });

  it('should build metrics for adhoc metrics with custom labels', () => {
    const adhocMetric: AdhocMetric = {
      expressionType: ExpressionType.SQL,
      label: 'foo',
      sqlExpression: 'COUNT(sum_girls)',
    };
    metrics = new Metrics({
      ...formData,
      metric: adhocMetric,
    });
    expect(metrics.getMetrics()).toEqual([{
      expressionType: 'SQL',
      label: 'foo',
      sqlExpression: 'COUNT(sum_girls)',
    }]);
    expect(metrics.getLabels()).toEqual(['foo']);
  });

  it('should truncate labels if they are too long', () => {
    const adhocMetric: AdhocMetric = {
      expressionType: ExpressionType.SQL,
      sqlExpression: 'COUNT(verrrrrrrrry_loooooooooooooooooooooong_string)',
    };
    metrics = new Metrics({
      ...formData,
      metric: adhocMetric,
    });
    expect(metrics.getLabels()).toEqual(['COUNT(verrrrrrrrry_loooooooooooooooooooo...']);
  });
});
