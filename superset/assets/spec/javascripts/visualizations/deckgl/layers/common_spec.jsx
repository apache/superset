import { getAggFunc } from '../../../../../src/visualizations/deckgl/layers/common';
import { max } from 'd3-array';

describe('deckgl layers common', () => {
  it('getAggFunc', () => {
    const arr = [10, 0.5, 55, 128, -10];
    expect(getAggFunc('max')(arr)).toEqual(128);
    expect(getAggFunc('min')(arr)).toEqual(-10);
    expect(getAggFunc('count')(arr)).toEqual(5);
    expect(getAggFunc('median')(arr)).toEqual(10);
    expect(getAggFunc('mean')(arr)).toEqual(36.7);
  });
  it('getAggFunc with accessor', () => {
    const arr = [{ foo: 1 }, { foo: 2 }, { foo: 3 }];
    const accessor = o => o.foo;
    expect(getAggFunc('count')(arr, accessor)).toEqual(3);
    expect(max(arr, accessor)).toEqual(3);
    expect(getAggFunc('max', accessor)(arr)).toEqual(3);
    expect(getAggFunc('min', accessor)(arr)).toEqual(1);
    expect(getAggFunc('median', accessor)(arr)).toEqual(2);
    expect(getAggFunc('mean', accessor)(arr)).toEqual(2);
  });
});
