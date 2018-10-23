import ColorSchemeRegistry from '../../../../src/modules/colors/ColorSchemeRegistry';
import CategoricalScheme from '../../../../src/modules/colors/CategoricalScheme';

describe('ColorSchemeRegistry', () => {
  const registry = new ColorSchemeRegistry();
  const SCHEME1 = new CategoricalScheme({
    name: 'test',
    colors: ['red', 'green', 'blue'],
  });
  const SCHEME2 = new CategoricalScheme({
    name: 'test2',
    colors: ['orange', 'yellow', 'pink'],
  });
  const SCHEME3 = new CategoricalScheme({
    name: 'test3',
    colors: ['cyan', 'magenta'],
  });

  beforeEach(() => {
    registry.clear();
    registry.registerValue('test', SCHEME1);
    registry.registerValue('test2', SCHEME2);
    registry.setDefaultSchemeName('test');
  });
  describe('.get()', () => {
    it('.get() returns default color scheme', () => {
      const scheme = registry.get();
      expect(scheme).toEqual(SCHEME1);
    });
    it('.get(name) returns color scheme with specified name', () => {
      const scheme = registry.get('test2');
      expect(scheme).toEqual(SCHEME2);
    });
  });
  describe('.getDefaultSchemeName()', () => {
    it('returns default scheme name', () => {
      const name = registry.getDefaultSchemeName();
      expect(name).toBe('test');
    });
  });
  describe('.setDefaultSchemeName()', () => {
    it('set default scheme name', () => {
      registry.setDefaultSchemeName('test2');
      const name = registry.getDefaultSchemeName();
      expect(name).toBe('test2');
      registry.setDefaultSchemeName('test');
    });
    it('returns the ColorSchemeRegistry instance', () => {
      const instance = registry.setDefaultSchemeName('test');
      expect(instance).toBe(registry);
    });
  });
  describe('.registerValue(name, colors)', () => {
    it('sets schemename and color', () => {
      registry.registerValue('test3', SCHEME3);
      const scheme = registry.get('test3');
      expect(scheme).toEqual(SCHEME3);
    });
    it('returns the ColorSchemeRegistry instance', () => {
      const instance = registry.registerValue('test3', SCHEME3);
      expect(instance).toBe(registry);
    });
  });
});
