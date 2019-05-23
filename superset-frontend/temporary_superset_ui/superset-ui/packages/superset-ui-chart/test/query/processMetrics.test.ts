import { ColumnType } from '../../src/types/Column';
import processMetrics from '../../src/query/processMetrics';

describe('processMetrics', () => {
  const formData = {
    datasource: '5__table',
    granularity_sqla: 'ds',
    viz_type: 'word_cloud',
  };

  it('should handle single metric', () => {
    const metrics = processMetrics({
      ...formData,
      metric: 'sum__num',
    });
    expect(metrics).toEqual([{ label: 'sum__num' }]);
  });

  it('should handle an array of metrics', () => {
    const metrics = processMetrics({
      ...formData,
      metrics: ['sum__num'],
    });
    expect(metrics).toEqual([{ label: 'sum__num' }]);
  });

  it('should handle multiple types of metrics', () => {
    const metrics = processMetrics({
      ...formData,
      metrics: [
        'sum__num',
        {
          aggregate: 'AVG',
          column: {
            columnName: 'sum_girls',
            id: 5,
            type: ColumnType.BIGINT,
          },
          expressionType: 'SIMPLE',
        },
        {
          expressionType: 'SQL',
          sqlExpression: 'COUNT(sum_girls)',
        },
      ],
    });
    expect(metrics).toEqual([
      { label: 'sum__num' },
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
      {
        expressionType: 'SQL',
        label: 'COUNT(sum_girls)',
        sqlExpression: 'COUNT(sum_girls)',
      },
    ]);
  });
});
