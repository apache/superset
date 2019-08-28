import isEnabled from '../../src/utils/isEnabled';

describe('isEnabled(value)', () => {
  it('returns false when null or false', () => {
    expect(isEnabled(false)).toBeFalsy();
    expect(isEnabled(null)).toBeFalsy();
  });
  it('returns true otherwise', () => {
    expect(isEnabled(true)).toBeTruthy();
    expect(isEnabled(undefined)).toBeTruthy();
    expect(isEnabled({})).toBeTruthy();
  });
});
