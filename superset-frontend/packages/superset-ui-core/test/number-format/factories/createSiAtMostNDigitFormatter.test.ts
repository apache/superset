import {
  NumberFormatter,
  createSiAtMostNDigitFormatter,
} from '@superset-ui/core/src/number-format';

describe('createSiAtMostNDigitFormatter({ n })', () => {
  it('creates an instance of NumberFormatter', () => {
    const formatter = createSiAtMostNDigitFormatter({ n: 4 });
    expect(formatter).toBeInstanceOf(NumberFormatter);
  });
  it('when n is specified, it formats number in SI format with at most n significant digits', () => {
    const formatter = createSiAtMostNDigitFormatter({ n: 2 });
    expect(formatter(10)).toBe('10');
    expect(formatter(1)).toBe('1');
    expect(formatter(1)).toBe('1');
    expect(formatter(10)).toBe('10');
    expect(formatter(10001)).toBe('10k');
    expect(formatter(10100)).toBe('10k');
    expect(formatter(111000000)).toBe('110M');
    expect(formatter(0.23)).toBe('230m');
    expect(formatter(0)).toBe('0');
    expect(formatter(-10)).toBe('-10');
    expect(formatter(-1)).toBe('-1');
    expect(formatter(-1)).toBe('-1');
    expect(formatter(-10)).toBe('-10');
    expect(formatter(-10001)).toBe('-10k');
    expect(formatter(-10101)).toBe('-10k');
    expect(formatter(-111000000)).toBe('-110M');
    expect(formatter(-0.23)).toBe('-230m');
  });
  it('when n is not specified, it defaults to n=3', () => {
    const formatter = createSiAtMostNDigitFormatter();
    expect(formatter(10)).toBe('10');
    expect(formatter(1)).toBe('1');
    expect(formatter(1)).toBe('1');
    expect(formatter(10)).toBe('10');
    expect(formatter(10001)).toBe('10.0k');
    expect(formatter(10100)).toBe('10.1k');
    expect(formatter(111000000)).toBe('111M');
    expect(formatter(0.23)).toBe('230m');
    expect(formatter(0)).toBe('0');
    expect(formatter(-10)).toBe('-10');
    expect(formatter(-1)).toBe('-1');
    expect(formatter(-1)).toBe('-1');
    expect(formatter(-10)).toBe('-10');
    expect(formatter(-10001)).toBe('-10.0k');
    expect(formatter(-10101)).toBe('-10.1k');
    expect(formatter(-111000000)).toBe('-111M');
    expect(formatter(-0.23)).toBe('-230m');
  });
});
