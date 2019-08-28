import isDisabled from '../../src/utils/isDisabled';

describe('isDisabled(value)', () => {
  it('returns true when null or false', () => {
    expect(isDisabled(false)).toBeTruthy();
    expect(isDisabled(null)).toBeTruthy();
  });
  it('returns false otherwise', () => {
    expect(isDisabled(true)).toBeFalsy();
    expect(isDisabled(undefined)).toBeFalsy();
    expect(isDisabled({})).toBeFalsy();
  });
});
