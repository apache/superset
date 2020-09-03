import { validateNumber } from '@superset-ui/core/src';
import './setup';

describe('validateNumber()', () => {
  it('returns the warning message if invalid', () => {
    expect(validateNumber(NaN)).toBeTruthy();
    expect(validateNumber(Infinity)).toBeTruthy();
    expect(validateNumber(undefined)).toBeTruthy();
    expect(validateNumber(null)).toBeTruthy();
    expect(validateNumber('abc')).toBeTruthy();
    expect(validateNumber('')).toBeTruthy();
  });
  it('returns false if the input is valid', () => {
    expect(validateNumber(0)).toBeFalsy();
    expect(validateNumber(10.1)).toBeFalsy();
    expect(validateNumber(10)).toBeFalsy();
    expect(validateNumber('10')).toBeFalsy();
  });
});
