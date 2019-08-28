import getScaleCategoryFromScaleType from '../../../src/parsers/scale/getScaleCategoryFromScaleType';

describe('getScaleCategoryFromScaleType(scaleType)', () => {
  it('handles continuous types', () => {
    expect(getScaleCategoryFromScaleType('linear')).toEqual('continuous');
    expect(getScaleCategoryFromScaleType('pow')).toEqual('continuous');
    expect(getScaleCategoryFromScaleType('sqrt')).toEqual('continuous');
    expect(getScaleCategoryFromScaleType('symlog')).toEqual('continuous');
    expect(getScaleCategoryFromScaleType('log')).toEqual('continuous');
    expect(getScaleCategoryFromScaleType('time')).toEqual('continuous');
    expect(getScaleCategoryFromScaleType('utc')).toEqual('continuous');
  });
  it('handles discrete types', () => {
    expect(getScaleCategoryFromScaleType('band')).toEqual('discrete');
    expect(getScaleCategoryFromScaleType('point')).toEqual('discrete');
    expect(getScaleCategoryFromScaleType('ordinal')).toEqual('discrete');
  });
  it('handles discretizing types', () => {
    expect(getScaleCategoryFromScaleType('bin-ordinal')).toEqual('discretizing');
    expect(getScaleCategoryFromScaleType('quantile')).toEqual('discretizing');
    expect(getScaleCategoryFromScaleType('threshold')).toEqual('discretizing');
  });
  it('handles unknown types', () => {
    // @ts-ignore
    expect(getScaleCategoryFromScaleType('surprise!')).toBeUndefined();
  });
});
