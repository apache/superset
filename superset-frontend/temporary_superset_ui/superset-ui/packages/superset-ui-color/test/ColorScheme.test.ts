import ColorScheme from '../src/ColorScheme';

describe('ColorScheme', () => {
  describe('new ColorScheme()', () => {
    it('returns an instance of ColorScheme', () => {
      const scheme = new ColorScheme({ id: 'test', colors: ['red', 'blue'] });
      expect(scheme).toBeInstanceOf(ColorScheme);
    });
  });
});
