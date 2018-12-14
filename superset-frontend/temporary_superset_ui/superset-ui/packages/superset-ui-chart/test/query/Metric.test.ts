import { ColumnType } from '../../src/query/Column';
import {
  FormDataMetric,
  Aggregate,
  ExpressionType,
  LABEL_MAX_LENGTH,
  Metrics,
} from '../../src/query/Metric';

describe('Metrics', () => {
  let metrics: Metrics;
  const formData = {
    datasource: '5__table',
    granularity_sqla: 'ds',
    viz_type: 'word_cloud',
  };

  it('should build metrics for built-in metric keys', () => {
    metrics = new Metrics({
      ...formData,
      metric: 'sum__num',
    });
    expect(metrics.getMetrics()).toEqual([
      {
        label: 'sum__num',
        expressionType: 'BUILTIN',
      },
    ]);
    expect(metrics.getLabels()).toEqual(['sum__num']);
  });

  it('should build metrics for simple adhoc metrics', () => {
    const adhocMetric: FormDataMetric = {
      aggregate: Aggregate.AVG,
      column: {
        columnName: 'sum_girls',
        id: 5,
        type: ColumnType.BIGINT,
      },
      expressionType: ExpressionType.SIMPLE,
    };
    metrics = new Metrics({
      ...formData,
      metric: adhocMetric,
    });
    expect(metrics.getMetrics()).toEqual([
      {
        aggregate: 'AVG',
        column: {
          columnName: 'sum_girls',
          id: 5,
          type: ColumnType.BIGINT,
        },
        expressionType: 'SIMPLE',
        label: 'AVG(sum_girls)',
      },
    ]);
    expect(metrics.getLabels()).toEqual(['AVG(sum_girls)']);
  });

  it('should build metrics for SQL adhoc metrics', () => {
    const adhocMetric: FormDataMetric = {
      expressionType: ExpressionType.SQL,
      sqlExpression: 'COUNT(sum_girls)',
    };
    metrics = new Metrics({
      ...formData,
      metric: adhocMetric,
    });
    expect(metrics.getMetrics()).toEqual([
      {
        expressionType: 'SQL',
        label: 'COUNT(sum_girls)',
        sqlExpression: 'COUNT(sum_girls)',
      },
    ]);
    expect(metrics.getLabels()).toEqual(['COUNT(sum_girls)']);
  });

  it('should build metrics for adhoc metrics with custom labels', () => {
    const adhocMetric: FormDataMetric = {
      expressionType: ExpressionType.SQL,
      label: 'foo',
      sqlExpression: 'COUNT(sum_girls)',
    };
    metrics = new Metrics({
      ...formData,
      metric: adhocMetric,
    });
    expect(metrics.getMetrics()).toEqual([
      {
        expressionType: 'SQL',
        label: 'foo',
        sqlExpression: 'COUNT(sum_girls)',
      },
    ]);
    expect(metrics.getLabels()).toEqual(['foo']);
  });

  it('should truncate labels if they are too long', () => {
    const adhocMetric: FormDataMetric = {
      expressionType: ExpressionType.SQL,
      sqlExpression: 'COUNT(verrrrrrrrry_loooooooooooooooooooooong_string)',
    };
    metrics = new Metrics({
      ...formData,
      metric: adhocMetric,
    });
    expect(metrics.getLabels()[0].length).toBeLessThanOrEqual(LABEL_MAX_LENGTH);
  });

  it('should handle metrics arrays in form data', () => {
    metrics = new Metrics({
      ...formData,
      metrics: ['sum__num'],
    });
    expect(metrics.getMetrics()).toEqual([
      {
        label: 'sum__num',
        expressionType: 'BUILTIN',
      },
    ]);
    expect(metrics.getLabels()).toEqual(['sum__num']);
  });
});
