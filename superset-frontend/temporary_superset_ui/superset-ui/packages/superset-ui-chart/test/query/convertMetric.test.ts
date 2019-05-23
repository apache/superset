import { ColumnType } from '../../src/types/Column';
import convertMetric, { LABEL_MAX_LENGTH } from '../../src/query/convertMetric';

describe('convertMetric', () => {
  it('should handle string metric name', () => {
    expect(convertMetric('sum__num')).toEqual({ label: 'sum__num' });
  });

  it('should handle simple adhoc metrics', () => {
    expect(
      convertMetric({
        expressionType: 'SIMPLE',
        aggregate: 'AVG',
        column: {
          columnName: 'sum_girls',
          id: 5,
          type: ColumnType.BIGINT,
        },
      }),
    ).toEqual({
      aggregate: 'AVG',
      column: {
        columnName: 'sum_girls',
        id: 5,
        type: ColumnType.BIGINT,
      },
      expressionType: 'SIMPLE',
      label: 'AVG(sum_girls)',
    });
  });

  it('should handle SQL adhoc metrics', () => {
    expect(
      convertMetric({
        expressionType: 'SQL',
        sqlExpression: 'COUNT(sum_girls)',
      }),
    ).toEqual({
      expressionType: 'SQL',
      label: 'COUNT(sum_girls)',
      sqlExpression: 'COUNT(sum_girls)',
    });
  });

  it('should handle adhoc metrics with custom labels', () => {
    expect(
      convertMetric({
        expressionType: 'SQL',
        label: 'foo',
        sqlExpression: 'COUNT(sum_girls)',
      }),
    ).toEqual({
      expressionType: 'SQL',
      label: 'foo',
      sqlExpression: 'COUNT(sum_girls)',
    });
  });

  it('should truncate labels if they are too long', () => {
    expect(
      convertMetric({
        expressionType: 'SQL',
        sqlExpression: 'COUNT(verrrrrrrrry_loooooooooooooooooooooong_string)',
      }).label.length,
    ).toBeLessThanOrEqual(LABEL_MAX_LENGTH);
  });
});
