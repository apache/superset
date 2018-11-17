import NumberFormatter from '../../src/NumberFormatter';
import SiAtMostNDigitFormatter from '../../src/formatters/SiAtMostNDigitFormatter';

describe('SiAtMostNDigitFormatter', () => {
  describe('new SiAtMostNDigitFormatter(n)', () => {
    it('creates an instance of NumberFormatter', () => {
      const formatter = new SiAtMostNDigitFormatter(3);
      expect(formatter).toBeInstanceOf(NumberFormatter);
    });
    it('when n is specified, it formats number in SI format with at most n significant digits', () => {
      const formatter = new SiAtMostNDigitFormatter(2);
      expect(formatter(10)).toBe('10');
      expect(formatter(1)).toBe('1');
      expect(formatter(1.0)).toBe('1');
      expect(formatter(10.0)).toBe('10');
      expect(formatter(10001)).toBe('10k');
      expect(formatter(10100)).toBe('10k');
      expect(formatter(111000000)).toBe('110M');
      expect(formatter(0.23)).toBe('230m');
      expect(formatter(0)).toBe('0');
      expect(formatter(-10)).toBe('-10');
      expect(formatter(-1)).toBe('-1');
      expect(formatter(-1.0)).toBe('-1');
      expect(formatter(-10.0)).toBe('-10');
      expect(formatter(-10001)).toBe('-10k');
      expect(formatter(-10101)).toBe('-10k');
      expect(formatter(-111000000)).toBe('-110M');
      expect(formatter(-0.23)).toBe('-230m');
    });
    it('when n is not specified, it defaults to n=3', () => {
      const formatter = new SiAtMostNDigitFormatter(3);
      expect(formatter(10)).toBe('10');
      expect(formatter(1)).toBe('1');
      expect(formatter(1.0)).toBe('1');
      expect(formatter(10.0)).toBe('10');
      expect(formatter(10001)).toBe('10.0k');
      expect(formatter(10100)).toBe('10.1k');
      expect(formatter(111000000)).toBe('111M');
      expect(formatter(0.23)).toBe('230m');
      expect(formatter(0)).toBe('0');
      expect(formatter(-10)).toBe('-10');
      expect(formatter(-1)).toBe('-1');
      expect(formatter(-1.0)).toBe('-1');
      expect(formatter(-10.0)).toBe('-10');
      expect(formatter(-10001)).toBe('-10.0k');
      expect(formatter(-10101)).toBe('-10.1k');
      expect(formatter(-111000000)).toBe('-111M');
      expect(formatter(-0.23)).toBe('-230m');
    });
  });
});
