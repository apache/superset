import { d3FormatPreset, formatLabel, tryNumify } from '../../../../src/visualizations/nvd3/utils';

describe('nvd3/utils', () => {
  const verboseMap = {
    foo: 'Foo',
    bar: 'Bar',
  };

  describe('d3FormatPreset', () => {
    it('is a function', () => {
      expect(typeof d3FormatPreset).toBe('function');
    });
    it('returns a working formatter', () => {
      expect(d3FormatPreset('.3s')(3000000)).toBe('3.00M');
    });
  });

  describe('formatLabel()', () => {
    it('formats simple labels', () => {
      expect(formatLabel('foo')).toBe('foo');
      expect(formatLabel(['foo'])).toBe('foo');
      expect(formatLabel(['foo', 'bar'])).toBe('foo, bar');
    });
    it('formats simple labels with lookups', () => {
      expect(formatLabel('foo', verboseMap)).toBe('Foo');
      expect(formatLabel('baz', verboseMap)).toBe('baz');
      expect(formatLabel(['foo'], verboseMap)).toBe('Foo');
      expect(formatLabel(['foo', 'bar', 'baz'], verboseMap)).toBe('Foo, Bar, baz');
    });
    it('deals with time shift properly', () => {
      expect(formatLabel(['foo', '1 hour offset'], verboseMap)).toBe('Foo, 1 hour offset');
      expect(formatLabel(['foo', 'bar', 'baz', '2 hours offset'], verboseMap)).toBe('Foo, Bar, baz, 2 hours offset');
    });
  });

  describe('tryNumify()', () => {
    it('tryNumify works as expected', () => {
      expect(tryNumify(5)).toBe(5);
      expect(tryNumify('5')).toBe(5);
      expect(tryNumify('5.1')).toBe(5.1);
      expect(tryNumify('a string')).toBe('a string');
    });
  });
});
