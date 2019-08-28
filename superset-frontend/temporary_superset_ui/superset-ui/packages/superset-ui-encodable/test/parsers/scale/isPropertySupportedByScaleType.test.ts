import isPropertySupportedByScaleType from '../../../src/parsers/scale/isPropertySupportedByScaleType';

describe('isPropertySupportedByScaleType(property, scaleType)', () => {
  it('returns true for compatible pairs', () => {
    expect(isPropertySupportedByScaleType('scheme', 'ordinal')).toBeTruthy();
  });
  it('returns false otherwise', () => {
    expect(isPropertySupportedByScaleType('zero', 'log')).toBeFalsy();
  });
});
