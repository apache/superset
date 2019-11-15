import { scaleLinear } from 'd3-scale';
import applyZero from '../../../src/parsers/scale/applyZero';

describe('applyZero()', () => {
  describe('zero = true', () => {
    it('positive domain', () => {
      const scale = scaleLinear().domain([2, 10]);
      applyZero({ type: 'linear', zero: true }, scale);
      expect(scale.domain()).toEqual([0, 10]);
    });
    it('negative domain', () => {
      const scale = scaleLinear().domain([-10, -2]);
      applyZero({ type: 'linear', zero: true }, scale);
      expect(scale.domain()).toEqual([-10, 0]);
    });
    it('domain contains zero', () => {
      const scale = scaleLinear().domain([-5, 5]);
      applyZero({ type: 'linear', zero: true }, scale);
      expect(scale.domain()).toEqual([-5, 5]);
    });
    it('descending domain', () => {
      const scale = scaleLinear().domain([5, 1]);
      applyZero({ type: 'linear', zero: true }, scale);
      expect(scale.domain()).toEqual([5, 0]);
    });
    it('descending negative domain', () => {
      const scale = scaleLinear().domain([-1, -5]);
      applyZero({ type: 'linear', zero: true }, scale);
      expect(scale.domain()).toEqual([0, -5]);
    });
  });

  it('zero = false', () => {
    const scale = scaleLinear().domain([2, 10]);
    applyZero({ type: 'linear', zero: false }, scale);
    expect(scale.domain()).toEqual([2, 10]);
  });
});
