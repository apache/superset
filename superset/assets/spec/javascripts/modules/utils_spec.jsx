import {
  formatSelectOptionsForRange,
  mainMetric,
  roundDecimal,
} from '../../../src/modules/utils';

describe('utils', () => {
  describe('formatSelectOptionsForRange', () => {
    it('returns an array of arrays for the range specified (inclusive)', () => {
      expect(formatSelectOptionsForRange(0, 4)).toEqual([
        [0, '0'],
        [1, '1'],
        [2, '2'],
        [3, '3'],
        [4, '4'],
      ]);
      expect(formatSelectOptionsForRange(1, 2)).toEqual([
        [1, '1'],
        [2, '2'],
      ]);
    });
  });

  describe('mainMetric', () => {
    it('is null when no options', () => {
      expect(mainMetric([])).toBeUndefined();
      expect(mainMetric(null)).toBeUndefined();
    });
    it('prefers the "count" metric when first', () => {
      const metrics = [
        { metric_name: 'count' },
        { metric_name: 'foo' },
      ];
      expect(mainMetric(metrics)).toBe('count');
    });
    it('prefers the "count" metric when not first', () => {
      const metrics = [
        { metric_name: 'foo' },
        { metric_name: 'count' },
      ];
      expect(mainMetric(metrics)).toBe('count');
    });
    it('selects the first metric when "count" is not an option', () => {
      const metrics = [
        { metric_name: 'foo' },
        { metric_name: 'not_count' },
      ];
      expect(mainMetric(metrics)).toBe('foo');
    });
  });
  describe('roundDecimal', () => {
    it('rounding method to limit the number of decimal digits', () => {
      expect(roundDecimal(1.139, 2)).toBe(1.14);
      expect(roundDecimal(1.13929, 3)).toBe(1.139);
      expect(roundDecimal(1.13929)).toBe(1);
    });
  });
});
