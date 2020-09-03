import { convertFilter } from '@superset-ui/core/src/query';

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
        operator: '==',
        comparator: 'grass jelly',
      }),
    ).toEqual({
      col: 'topping',
      op: '==',
      val: 'grass jelly',
    });
  });

  it('should convert set filter', () => {
    expect(
      convertFilter({
        expressionType: 'SIMPLE',
        clause: 'WHERE',
        subject: 'toppings',
        operator: 'IN',
        comparator: ['boba', 'grass jelly'],
      }),
    ).toEqual({
      col: 'toppings',
      op: 'IN',
      val: ['boba', 'grass jelly'],
    });
  });
});
