import ColorSchemeRegistry from '../../../src/modules/colors/ColorSchemeRegistry';
import CategoricalScheme from '../../../src/modules/colors/CategoricalScheme';

describe('ColorSchemeRegistry', () => {
  const manager = new ColorSchemeRegistry();
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
    manager.clear();
    manager.registerValue('test', SCHEME1);
    manager.registerValue('test2', SCHEME2);
    manager.setDefaultSchemeName('test');
  });
  describe('.get()', () => {
    it('.get() returns default color scheme', () => {
      const scheme = manager.get();
      expect(scheme).toEqual(SCHEME1);
    });
    it('.get(name) returns color scheme with specified name', () => {
      const scheme = manager.get('test2');
      expect(scheme).toEqual(SCHEME2);
    });
  });
  describe('.getDefaultSchemeName()', () => {
    it('returns default scheme name', () => {
      const name = manager.getDefaultSchemeName();
      expect(name).toBe('test');
    });
  });
  describe('.setDefaultSchemeName()', () => {
    it('set default scheme name', () => {
      manager.setDefaultSchemeName('test2');
      const name = manager.getDefaultSchemeName();
      expect(name).toBe('test2');
      manager.setDefaultSchemeName('test');
    });
    it('returns the ColorSchemeRegistry instance', () => {
      const instance = manager.setDefaultSchemeName('test');
      expect(instance).toBe(manager);
    });
  });
  describe('.registerValue(name, colors)', () => {
    it('sets schemename and color', () => {
      manager.registerValue('test3', SCHEME3);
      const scheme = manager.get('test3');
      expect(scheme).toEqual(SCHEME3);
    });
    it('returns the ColorSchemeRegistry instance', () => {
      const instance = manager.registerValue('test3', SCHEME3);
      expect(instance).toBe(manager);
    });
  });
});
