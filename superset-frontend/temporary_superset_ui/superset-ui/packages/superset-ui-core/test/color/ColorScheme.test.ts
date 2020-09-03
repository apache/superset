import ColorScheme from '@superset-ui/core/src/color/ColorScheme';

describe('ColorScheme', () => {
  describe('new ColorScheme()', () => {
    it('returns an instance of ColorScheme', () => {
      const scheme = new ColorScheme({ id: 'test', colors: ['red', 'blue'] });
      expect(scheme).toBeInstanceOf(ColorScheme);
    });
  });
});
