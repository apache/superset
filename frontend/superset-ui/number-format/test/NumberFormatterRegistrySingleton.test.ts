import getNumberFormatterRegistry, {
  getNumberFormatter,
  formatNumber,
} from '../src/NumberFormatterRegistrySingleton';
import NumberFormatterRegistry from '../src/NumberFormatterRegistry';

describe('NumberFormatterRegistrySingleton', () => {
  describe('getNumberFormatterRegistry()', () => {
    it('returns a NumberFormatterRegisry', () => {
      expect(getNumberFormatterRegistry()).toBeInstanceOf(NumberFormatterRegistry);
    });
  });
  describe('getNumberFormatter(format)', () => {
    it('returns a format function', () => {
      const format = getNumberFormatter('.3s');
      expect(format(12345)).toEqual('12.3k');
    });
    it('returns a format function even given invalid format', () => {
      const format = getNumberFormatter('xkcd');
      expect(format(12345)).toEqual('12345 (Invalid format: xkcd)');
    });
  });
  describe('formatNumber(format, value)', () => {
    it('format the given number using the specified format', () => {
      const output = formatNumber('.3s', 12345);
      expect(output).toEqual('12.3k');
    });
  });
});
