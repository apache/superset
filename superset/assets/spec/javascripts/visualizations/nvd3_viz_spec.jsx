import { expect } from 'chai';

import { formatLabel } from '../../../src/visualizations/nvd3_vis';

describe('nvd3 viz', () => {
  const verboseMap = {
    foo: 'Foo',
    bar: 'Bar',
  };
  describe('formatLabel', () => {
    it('formats simple labels', () => {
      expect(formatLabel('foo')).to.equal('foo');
      expect(formatLabel(['foo'])).to.equal('foo');
      expect(formatLabel(['foo', 'bar'])).to.equal('foo, bar');
    });
    it('formats simple labels with lookups', () => {
      expect(formatLabel('foo', verboseMap)).to.equal('Foo');
      expect(formatLabel('baz', verboseMap)).to.equal('baz');
      expect(formatLabel(['foo'], verboseMap)).to.equal('Foo');
      expect(formatLabel(['foo', 'bar', 'baz'], verboseMap)).to.equal('Foo, Bar, baz');
    });
    it('deals with time shift properly', () => {
      expect(formatLabel(['foo', '1 hour offset'], verboseMap)).to.equal('Foo, 1 hour offset');
      expect(formatLabel(['foo', 'bar', 'baz', '2 hours offset'], verboseMap)).to.equal('Foo, Bar, baz, 2 hours offset');
    });
  });
});
