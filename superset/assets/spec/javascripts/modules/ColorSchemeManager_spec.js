import ColorSchemeManager, {
  getInstance,
  getScheme,
  getAllSchemes,
  getDefaultSchemeName,
  setDefaultSchemeName,
  registerScheme,
  registerMultipleSchemes,
} from '../../../src/modules/ColorSchemeManager';

describe('ColorSchemeManager', () => {
  beforeEach(() => {
    const m = getInstance();
    m.clearScheme();
    m.registerScheme('test', ['red', 'green', 'blue']);
    m.registerScheme('test2', ['orange', 'yellow', 'pink']);
    m.setDefaultSchemeName('test');
  });
  it('The class constructor cannot be accessed directly', () => {
    expect(typeof ColorSchemeManager).not.toBe('Function');
  });
  describe('static getInstance()', () => {
    it('returns a singleton instance', () => {
      const m1 = getInstance();
      const m2 = getInstance();
      expect(m1).toBeDefined();
      expect(m1).toBe(m2);
    });
  });
  describe('.getScheme()', () => {
    it('.getScheme() returns default color scheme', () => {
      const scheme = getInstance().getScheme();
      expect(scheme).toEqual(['red', 'green', 'blue']);
    });
    it('.getScheme(name) returns color scheme with specified name', () => {
      const scheme = getInstance().getScheme('test2');
      expect(scheme).toEqual(['orange', 'yellow', 'pink']);
    });
  });
  describe('.getAllSchemes()', () => {
    it('returns all registered schemes', () => {
      const schemes = getInstance().getAllSchemes();
      expect(schemes).toEqual({
        test: ['red', 'green', 'blue'],
        test2: ['orange', 'yellow', 'pink'],
      });
    });
  });
  describe('.getDefaultSchemeName()', () => {
    it('returns default scheme name', () => {
      const name = getInstance().getDefaultSchemeName();
      expect(name).toBe('test');
    });
  });
  describe('.setDefaultSchemeName()', () => {
    it('set default scheme name', () => {
      getInstance().setDefaultSchemeName('test2');
      const name = getInstance().getDefaultSchemeName();
      expect(name).toBe('test2');
      getInstance().setDefaultSchemeName('test');
    });
    it('returns the ColorSchemeManager instance', () => {
      const instance = getInstance().setDefaultSchemeName('test');
      expect(instance).toBe(getInstance());
    });
  });
  describe('.registerScheme(name, colors)', () => {
    it('sets schemename and color', () => {
      getInstance().registerScheme('test3', ['cyan', 'magenta']);
      const scheme = getInstance().getScheme('test3');
      expect(scheme).toEqual(['cyan', 'magenta']);
    });
    it('returns the ColorSchemeManager instance', () => {
      const instance = getInstance().registerScheme('test3', ['cyan', 'magenta']);
      expect(instance).toBe(getInstance());
    });
  });
  describe('.registerMultipleSchemes(object)', () => {
    it('sets multiple schemes at once', () => {
      getInstance().registerMultipleSchemes({
        test4: ['cyan', 'magenta'],
        test5: ['brown', 'purple'],
      });
      const scheme1 = getInstance().getScheme('test4');
      expect(scheme1).toEqual(['cyan', 'magenta']);
      const scheme2 = getInstance().getScheme('test5');
      expect(scheme2).toEqual(['brown', 'purple']);
    });
    it('returns the ColorSchemeManager instance', () => {
      const instance = getInstance().registerMultipleSchemes({
        test4: ['cyan', 'magenta'],
        test5: ['brown', 'purple'],
      });
      expect(instance).toBe(getInstance());
    });
  });
  describe('static getScheme()', () => {
    it('is equivalent to getInstance().getScheme()', () => {
      expect(getInstance().getScheme()).toBe(getScheme());
    });
  });
  describe('static getAllSchemes()', () => {
    it('is equivalent to getInstance().getAllSchemes()', () => {
      expect(getInstance().getAllSchemes()).toBe(getAllSchemes());
    });
  });
  describe('static getDefaultSchemeName()', () => {
    it('is equivalent to getInstance().getDefaultSchemeName()', () => {
      expect(getInstance().getDefaultSchemeName()).toBe(getDefaultSchemeName());
    });
  });
  describe('static setDefaultSchemeName()', () => {
    it('is equivalent to getInstance().setDefaultSchemeName()', () => {
      setDefaultSchemeName('test2');
      const name = getInstance().getDefaultSchemeName();
      expect(name).toBe('test2');
      setDefaultSchemeName('test');
    });
  });
  describe('static registerScheme()', () => {
    it('is equivalent to getInstance().registerScheme()', () => {
      registerScheme('test3', ['cyan', 'magenta']);
      const scheme = getInstance().getScheme('test3');
      expect(scheme).toEqual(['cyan', 'magenta']);
    });
  });
  describe('static registerMultipleSchemes()', () => {
    it('is equivalent to getInstance().registerMultipleSchemes()', () => {
      registerMultipleSchemes({
        test4: ['cyan', 'magenta'],
        test5: ['brown', 'purple'],
      });
      const scheme1 = getInstance().getScheme('test4');
      expect(scheme1).toEqual(['cyan', 'magenta']);
      const scheme2 = getInstance().getScheme('test5');
      expect(scheme2).toEqual(['brown', 'purple']);
    });
  });
});
