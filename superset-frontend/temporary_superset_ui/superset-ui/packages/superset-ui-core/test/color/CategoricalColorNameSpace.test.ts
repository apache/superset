import CategoricalColorNamespace, {
  getNamespace,
  getScale,
  getColor,
  DEFAULT_NAMESPACE,
} from '@superset-ui/core/src/color/CategoricalColorNamespace';
import getCategoricalSchemeRegistry from '@superset-ui/core/src/color/CategoricalSchemeRegistrySingleton';
import CategoricalScheme from '@superset-ui/core/src/color/CategoricalScheme';

describe('CategoricalColorNamespace', () => {
  beforeAll(() => {
    getCategoricalSchemeRegistry()
      .registerValue(
        'testColors',
        new CategoricalScheme({
          id: 'testColors',
          colors: ['red', 'green', 'blue'],
        }),
      )
      .registerValue(
        'testColors2',
        new CategoricalScheme({
          id: 'testColors2',
          colors: ['red', 'green', 'blue'],
        }),
      );
  });
  it('The class constructor cannot be accessed directly', () => {
    expect(typeof CategoricalColorNamespace).not.toBe('Function');
  });
  describe('static getNamespace()', () => {
    it('returns default namespace if name is not specified', () => {
      const namespace = getNamespace();
      expect(namespace !== undefined).toBe(true);
      expect(namespace.name).toBe(DEFAULT_NAMESPACE);
    });
    it('returns namespace with specified name', () => {
      const namespace = getNamespace('myNamespace');
      expect(namespace !== undefined).toBe(true);
      expect(namespace.name).toBe('myNamespace');
    });
    it('returns existing instance if the name already exists', () => {
      const ns1 = getNamespace('myNamespace');
      const ns2 = getNamespace('myNamespace');
      expect(ns1).toBe(ns2);
      const ns3 = getNamespace();
      const ns4 = getNamespace();
      expect(ns3).toBe(ns4);
    });
  });
  describe('.getScale()', () => {
    it('returns a CategoricalColorScale from given scheme name', () => {
      const namespace = getNamespace('test-get-scale1');
      const scale = namespace.getScale('testColors');
      expect(scale).toBeDefined();
      expect(scale.getColor('dog')).toBeDefined();
    });
    it('returns a scale when a schemeId is not specified and there is no default key', () => {
      getCategoricalSchemeRegistry().clearDefaultKey();
      const namespace = getNamespace('new-space');
      const scale = namespace.getScale();
      expect(scale).toBeDefined();
      getCategoricalSchemeRegistry().setDefaultKey('testColors');
    });
    it('returns same scale if the scale with that name already exists in this namespace', () => {
      const namespace = getNamespace('test-get-scale2');
      const scale1 = namespace.getScale('testColors');
      const scale2 = namespace.getScale('testColors2');
      const scale3 = namespace.getScale('testColors2');
      const scale4 = namespace.getScale('testColors');
      expect(scale1).toBe(scale4);
      expect(scale2).toBe(scale3);
    });
  });
  describe('.setColor()', () => {
    it('overwrites color for all CategoricalColorScales in this namespace', () => {
      const namespace = getNamespace('test-set-scale1');
      namespace.setColor('dog', 'black');
      const scale = namespace.getScale('testColors');
      expect(scale.getColor('dog')).toBe('black');
      expect(scale.getColor('boy')).not.toBe('black');
    });
    it('can override forcedColors in each scale', () => {
      const namespace = getNamespace('test-set-scale2');
      namespace.setColor('dog', 'black');
      const scale = namespace.getScale('testColors');
      scale.setColor('dog', 'pink');
      expect(scale.getColor('dog')).toBe('black');
      expect(scale.getColor('boy')).not.toBe('black');
    });
    it('does not affect scales in other namespaces', () => {
      const ns1 = getNamespace('test-set-scale3.1');
      ns1.setColor('dog', 'black');
      const scale1 = ns1.getScale('testColors');
      const ns2 = getNamespace('test-set-scale3.2');
      const scale2 = ns2.getScale('testColors');
      expect(scale1.getColor('dog')).toBe('black');
      expect(scale2.getColor('dog')).not.toBe('black');
    });
    it('returns the namespace instance', () => {
      const ns1 = getNamespace('test-set-scale3.1');
      const ns2 = ns1.setColor('dog', 'black');
      expect(ns1).toBe(ns2);
    });
  });
  describe('static getScale()', () => {
    it('getScale() returns a CategoricalColorScale with default scheme in default namespace', () => {
      const scale = getScale();
      expect(scale).toBeDefined();
      const scale2 = getNamespace().getScale();
      expect(scale).toBe(scale2);
    });
    it('getScale(scheme) returns a CategoricalColorScale with specified scheme in default namespace', () => {
      const scale = getScale('testColors');
      expect(scale).toBeDefined();
      const scale2 = getNamespace().getScale('testColors');
      expect(scale).toBe(scale2);
    });
    it('getScale(scheme, namespace) returns a CategoricalColorScale with specified scheme in specified namespace', () => {
      const scale = getScale('testColors', 'test-getScale');
      expect(scale).toBeDefined();
      const scale2 = getNamespace('test-getScale').getScale('testColors');
      expect(scale).toBe(scale2);
    });
  });
  describe('static getColor()', () => {
    it('getColor(value) returns a color from default scheme in default namespace', () => {
      const value = 'dog';
      const color = getColor(value);
      const color2 = getNamespace().getScale().getColor(value);
      expect(color).toBe(color2);
    });
    it('getColor(value, scheme) returns a color from specified scheme in default namespace', () => {
      const value = 'dog';
      const scheme = 'testColors';
      const color = getColor(value, scheme);
      const color2 = getNamespace().getScale(scheme).getColor(value);
      expect(color).toBe(color2);
    });
    it('getColor(value, scheme, namespace) returns a color from specified scheme in specified namespace', () => {
      const value = 'dog';
      const scheme = 'testColors';
      const namespace = 'test-getColor';
      const color = getColor(value, scheme, namespace);
      const color2 = getNamespace(namespace).getScale(scheme).getColor(value);
      expect(color).toBe(color2);
    });
  });
});
