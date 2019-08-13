import processFilters from '../src/processFilters';

describe('processFilters', () => {
  it('should handle non-array adhoc_filters', () => {
    expect(
      processFilters({
        granularity: 'something',
        viz_type: 'custom',
        datasource: 'boba',
      }),
    ).toEqual({});
  });

  it('should handle an empty array', () => {
    expect(
      processFilters({
        granularity: 'something',
        viz_type: 'custom',
        datasource: 'boba',
        adhoc_filters: [],
      }),
    ).toEqual({
      filters: [],
      having: '',
      having_filters: [],
      where: '',
    });
  });

  it('should put adhoc_filters into the correct group and format accordingly', () => {
    expect(
      processFilters({
        granularity: 'something',
        viz_type: 'custom',
        datasource: 'boba',
        adhoc_filters: [
          {
            expressionType: 'SIMPLE',
            clause: 'WHERE',
            subject: 'milk',
            operator: 'IS NOT NULL',
          },
          {
            expressionType: 'SIMPLE',
            clause: 'WHERE',
            subject: 'milk',
            operator: '=',
            comparator: 'almond',
          },
          {
            expressionType: 'SIMPLE',
            clause: 'HAVING',
            subject: 'sweetness',
            operator: '>',
            comparator: '0',
          },
          {
            expressionType: 'SIMPLE',
            clause: 'HAVING',
            subject: 'sweetness',
            operator: '<=',
            comparator: '50',
          },
          {
            expressionType: 'SQL',
            clause: 'WHERE',
            sqlExpression: 'tea = "jasmine"',
          },
          {
            expressionType: 'SQL',
            clause: 'WHERE',
            sqlExpression: 'cup = "large"',
          },
          {
            expressionType: 'SQL',
            clause: 'HAVING',
            sqlExpression: 'ice = 25 OR ice = 50',
          },
          {
            expressionType: 'SQL',
            clause: 'HAVING',
            sqlExpression: 'waitTime <= 180',
          },
        ],
      }),
    ).toEqual({
      filters: [
        {
          col: 'milk',
          op: 'IS NOT NULL',
        },
        {
          col: 'milk',
          op: '=',
          val: 'almond',
        },
      ],
      having: '(ice = 25 OR ice = 50) AND (waitTime <= 180)',
      having_filters: [
        {
          col: 'sweetness',
          op: '>',
          val: '0',
        },
        {
          col: 'sweetness',
          op: '<=',
          val: '50',
        },
      ],
      where: '(tea = "jasmine") AND (cup = "large")',
    });
  });
});
