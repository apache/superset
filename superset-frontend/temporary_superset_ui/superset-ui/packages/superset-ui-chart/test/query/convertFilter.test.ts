import convertFilter from '../../src/query/convertFilter';

describe('convertFilter', () => {
  it('should handle unary filter', () => {
    expect(
      convertFilter({
        expressionType: 'SIMPLE',
        clause: 'WHERE',
        subject: 'topping',
        operator: 'IS NOT NULL',
      }),
    ).toEqual({
      col: 'topping',
      op: 'IS NOT NULL',
    });
  });

  it('should convert binary filter', () => {
    expect(
      convertFilter({
        expressionType: 'SIMPLE',
        clause: 'WHERE',
        subject: 'topping',
        operator: '=',
        comparator: 'grass jelly',
      }),
    ).toEqual({
      col: 'topping',
      op: '=',
      val: 'grass jelly',
    });
  });

  it('should convert set filter', () => {
    expect(
      convertFilter({
        expressionType: 'SIMPLE',
        clause: 'WHERE',
        subject: 'toppings',
        operator: 'in',
        comparator: ['boba', 'grass jelly'],
      }),
    ).toEqual({
      col: 'toppings',
      op: 'in',
      val: ['boba', 'grass jelly'],
    });
  });
});
