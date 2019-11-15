import { scaleLinear, scaleOrdinal } from 'd3-scale';
import applyDomain from '../../../src/parsers/scale/applyDomain';
import { HasToString } from '../../../src/types/Base';

describe('applyDomain()', () => {
  describe('with scale.domain', () => {
    describe('with domainFromDataset', () => {
      it('continuous domain', () => {
        const scale = scaleLinear();
        applyDomain({ type: 'linear', domain: [null, 10] }, scale, [1, 20]);
        expect(scale.domain()).toEqual([1, 10]);
      });
      it('discrete domain', () => {
        const scale = scaleOrdinal<HasToString, string>();
        applyDomain(
          { type: 'ordinal', domain: ['a', 'c'], range: ['red', 'green', 'blue'] },
          scale,
          ['a', 'b', 'c'],
        );
        expect(scale.domain()).toEqual(['a', 'c', 'b']);
      });
      it('continuous domain (reverse)', () => {
        const scale = scaleLinear();
        applyDomain({ type: 'linear', domain: [null, 10], reverse: true }, scale, [1, 20]);
        expect(scale.domain()).toEqual([10, 1]);
      });
      it('discrete domain (reverse)', () => {
        const scale = scaleOrdinal<HasToString, string>();
        applyDomain(
          { type: 'ordinal', domain: ['a', 'c'], range: ['red', 'green', 'blue'], reverse: true },
          scale,
          ['a', 'b', 'c'],
        );
        expect(scale.domain()).toEqual(['b', 'c', 'a']);
      });
    });
    describe('without domainFromDataset', () => {
      it('continuous domain', () => {
        const scale = scaleLinear();
        applyDomain({ type: 'linear', domain: [1, 10] }, scale);
        expect(scale.domain()).toEqual([1, 10]);
      });
      it('discrete domain', () => {
        const scale = scaleOrdinal<HasToString, string>();
        applyDomain(
          { type: 'ordinal', domain: ['a', 'c'], range: ['red', 'green', 'blue'] },
          scale,
        );
        expect(scale.domain()).toEqual(['a', 'c']);
      });
    });
  });
  describe('with domainFromDataset only', () => {
    it('continuous domain', () => {
      const scale = scaleLinear();
      applyDomain({ type: 'linear' }, scale, [1, 20]);
      expect(scale.domain()).toEqual([1, 20]);
    });
    it('discrete domain', () => {
      const scale = scaleOrdinal<HasToString, string>();
      applyDomain({ type: 'ordinal', range: ['red', 'green', 'blue'] }, scale, ['a', 'b', 'c']);
      expect(scale.domain()).toEqual(['a', 'b', 'c']);
    });
  });
  it('uses default domain if none is specified', () => {
    const scale = scaleLinear();
    applyDomain({ type: 'linear' }, scale);
    expect(scale.domain()).toEqual([0, 1]);
  });
});
