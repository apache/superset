import roundDecimal from '../../src/utils/roundDecimal';

describe('roundDecimal', () => {
  it('rounding method to limit the number of decimal digits', () => {
    expect(roundDecimal(1.139, 2)).toBe(1.14);
    expect(roundDecimal(1.13929, 3)).toBe(1.139);
    expect(roundDecimal(1.13929)).toBe(1);
  });
});
