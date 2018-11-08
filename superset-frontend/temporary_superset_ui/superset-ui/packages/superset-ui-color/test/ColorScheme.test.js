import ColorScheme from '../src/ColorScheme';

describe('ColorScheme', () => {
  describe('new ColorScheme()', () => {
    it('requires name and color', () => {
      expect(() => new ColorScheme()).toThrow();
      expect(() => new ColorScheme({ name: 'test' })).toThrow();
      expect(() => new ColorScheme({ colors: ['red', 'blue'] })).toThrow();
    });
    it('returns an instance of ColorScheme', () => {
      const scheme = new ColorScheme({ name: 'test', colors: ['red', 'blue'] });
      expect(scheme).toBeInstanceOf(ColorScheme);
    });
  });
});
