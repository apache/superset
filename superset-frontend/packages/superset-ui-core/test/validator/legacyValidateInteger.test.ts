import { legacyValidateInteger } from '@superset-ui/core/src';
import './setup';

describe('legacyValidateInteger()', () => {
  it('returns the warning message if invalid', () => {
    expect(legacyValidateInteger(10.1)).toBeTruthy();
    expect(legacyValidateInteger('abc')).toBeTruthy();
    expect(legacyValidateInteger(Infinity)).toBeTruthy();
  });
  it('returns false if the input is valid', () => {
    // superset seems to operate on this incorrect behavior at the moment
    expect(legacyValidateInteger(NaN)).toBeFalsy();
    expect(legacyValidateInteger(undefined)).toBeFalsy();
    expect(legacyValidateInteger(null)).toBeFalsy();
    expect(legacyValidateInteger('')).toBeFalsy();

    expect(legacyValidateInteger(0)).toBeFalsy();
    expect(legacyValidateInteger(10)).toBeFalsy();
    expect(legacyValidateInteger('10')).toBeFalsy();
  });
});
