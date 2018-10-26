import { max } from 'd3-array';
import { getAggFunc } from '../../../../../src/visualizations/deckgl/layers/common';

describe('deckgl layers common', () => {
  it('getAggFunc', () => {
    const arr = [10, 0.5, 55, 128, -10];
    expect(getAggFunc('max')(arr)).toEqual(128);
    expect(getAggFunc('min')(arr)).toEqual(-10);
    expect(getAggFunc('count')(arr)).toEqual(5);
    expect(getAggFunc('median')(arr)).toEqual(10);
    expect(getAggFunc('mean')(arr)).toEqual(36.7);
    expect(getAggFunc('p1')(arr)).toEqual(-9.58);
    expect(getAggFunc('p5')(arr)).toEqual(-7.9);
    expect(getAggFunc('p95')(arr)).toEqual(113.39999999999998);
    expect(getAggFunc('p99')(arr)).toEqual(125.08);
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
    expect(getAggFunc('p1', accessor)(arr)).toEqual(1.02);
    expect(getAggFunc('p5', accessor)(arr)).toEqual(1.1);
    expect(getAggFunc('p95', accessor)(arr)).toEqual(2.9);
    expect(getAggFunc('p99', accessor)(arr)).toEqual(2.98);
  });
});
