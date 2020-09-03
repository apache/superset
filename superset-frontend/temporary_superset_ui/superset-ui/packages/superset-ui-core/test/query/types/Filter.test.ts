import {
  isUnaryAdhocFilter,
  isBinaryAdhocFilter,
  isSetAdhocFilter,
} from '@superset-ui/core/src/query/types/Filter';

describe('Filter type guards', () => {
  describe('isUnaryAdhocFilter', () => {
    it('should return true when it is the correct type', () => {
      expect(
        isUnaryAdhocFilter({
          expressionType: 'SIMPLE',
          clause: 'WHERE',
          subject: 'tea',
          operator: 'IS NOT NULL',
        }),
      ).toEqual(true);
    });
    it('should return false otherwise', () => {
      expect(
        isUnaryAdhocFilter({
          expressionType: 'SIMPLE',
          clause: 'WHERE',
          subject: 'tea',
          operator: '==',
          comparator: 'matcha',
        }),
      ).toEqual(false);
    });
  });

  describe('isBinaryAdhocFilter', () => {
    it('should return true when it is the correct type', () => {
      expect(
        isBinaryAdhocFilter({
          expressionType: 'SIMPLE',
          clause: 'WHERE',
          subject: 'tea',
          operator: '!=',
          comparator: 'matcha',
        }),
      ).toEqual(true);
    });
    it('should return false otherwise', () => {
      expect(
        isBinaryAdhocFilter({
          expressionType: 'SIMPLE',
          clause: 'WHERE',
          subject: 'tea',
          operator: 'IS NOT NULL',
        }),
      ).toEqual(false);
    });
  });

  describe('isSetAdhocFilter', () => {
    it('should return true when it is the correct type', () => {
      expect(
        isSetAdhocFilter({
          expressionType: 'SIMPLE',
          clause: 'WHERE',
          subject: 'tea',
          operator: 'IN',
          comparator: ['hojicha', 'earl grey'],
        }),
      ).toEqual(true);
    });
    it('should return false otherwise', () => {
      expect(
        isSetAdhocFilter({
          expressionType: 'SIMPLE',
          clause: 'WHERE',
          subject: 'tea',
          operator: 'IS NOT NULL',
        }),
      ).toEqual(false);
    });
  });
});
