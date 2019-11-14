import combineContinuousDomains from '../../src/utils/combineContinuousDomains';

describe('combineContinuousDomains()', () => {
  it('uses the fixedDomain if all values are defined', () => {
    expect(combineContinuousDomains([1, 2, 3], [4, 5, 6])).toEqual([1, 2, 3]);
    expect(combineContinuousDomains([1, 2], [4, 5])).toEqual([1, 2]);
  });
  describe('if both fixedDomain and inputDomain are of length two, uses the fixedDomain as boundary', () => {
    describe('min only', () => {
      it('exceeds bound', () => {
        expect(combineContinuousDomains([1, null], [0, 10])).toEqual([1, 10]);
      });
      it('is within bound', () => {
        expect(combineContinuousDomains([1, null], [2, 10])).toEqual([2, 10]);
      });
    });
    describe('max only', () => {
      it('exceeds bound', () => {
        expect(combineContinuousDomains([null, 5], [0, 10])).toEqual([0, 5]);
      });
      it('is within bound', () => {
        expect(combineContinuousDomains([null, 5], [2, 4])).toEqual([2, 4]);
      });
    });
  });
  it('returns inputDomain for invalid bound', () => {
    expect(combineContinuousDomains([null, null], [2, 10])).toEqual([2, 10]);
    expect(combineContinuousDomains([], [2, 10])).toEqual([2, 10]);
  });
  it('returns undefined if there is also no inputDomain', () => {
    expect(combineContinuousDomains([null, null])).toBeUndefined();
  });
});
