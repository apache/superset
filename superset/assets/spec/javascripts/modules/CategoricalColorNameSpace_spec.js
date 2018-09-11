import { it, describe, before } from 'mocha';
import { expect } from 'chai';
import CategoricalColorNamespace, {
  getNamespace,
  getScale,
  getColor,
  DEFAULT_NAMESPACE,
} from '../../../src/modules/CategoricalColorNamespace';
import { registerScheme } from '../../../src/modules/ColorSchemeManager';

describe('CategoricalColorNamespace', () => {
  before(() => {
    registerScheme('testColors', ['red', 'green', 'blue']);
    registerScheme('testColors2', ['red', 'green', 'blue']);
  });
  it('The class constructor cannot be accessed directly', () => {
    expect(CategoricalColorNamespace).to.not.be.a('Function');
  });
  describe('static getNamespace()', () => {
    it('returns default namespace if name is not specified', () => {
      const namespace = getNamespace();
      expect(namespace !== undefined).to.equal(true);
      expect(namespace.name).to.equal(DEFAULT_NAMESPACE);
    });
    it('returns namespace with specified name', () => {
      const namespace = getNamespace('myNamespace');
      expect(namespace !== undefined).to.equal(true);
      expect(namespace.name).to.equal('myNamespace');
    });
    it('returns existing instance if the name already exists', () => {
      const ns1 = getNamespace('myNamespace');
      const ns2 = getNamespace('myNamespace');
      expect(ns1).to.equal(ns2);
      const ns3 = getNamespace();
      const ns4 = getNamespace();
      expect(ns3).to.equal(ns4);
    });
  });
  describe('.getScale()', () => {
    it('returns a CategoricalColorScale from given scheme name', () => {
      const namespace = getNamespace('test-get-scale1');
      const scale = namespace.getScale('testColors');
      expect(scale).to.not.equal(undefined);
      expect(scale.getColor('dog')).to.not.equal(undefined);
    });
    it('returns same scale if the scale with that name already exists in this namespace', () => {
      const namespace = getNamespace('test-get-scale2');
      const scale1 = namespace.getScale('testColors');
      const scale2 = namespace.getScale('testColors2');
      const scale3 = namespace.getScale('testColors2');
      const scale4 = namespace.getScale('testColors');
      expect(scale1).to.equal(scale4);
      expect(scale2).to.equal(scale3);
    });
  });
  describe('.setColor()', () => {
    it('overwrites color for all CategoricalColorScales in this namespace', () => {
      const namespace = getNamespace('test-set-scale1');
      namespace.setColor('dog', 'black');
      const scale = namespace.getScale('testColors');
      expect(scale.getColor('dog')).to.equal('black');
      expect(scale.getColor('boy')).to.not.equal('black');
    });
    it('can override forcedColors in each scale', () => {
      const namespace = getNamespace('test-set-scale2');
      namespace.setColor('dog', 'black');
      const scale = namespace.getScale('testColors');
      scale.setColor('dog', 'pink');
      expect(scale.getColor('dog')).to.equal('black');
      expect(scale.getColor('boy')).to.not.equal('black');
    });
    it('does not affect scales in other namespaces', () => {
      const ns1 = getNamespace('test-set-scale3.1');
      ns1.setColor('dog', 'black');
      const scale1 = ns1.getScale('testColors');
      const ns2 = getNamespace('test-set-scale3.2');
      const scale2 = ns2.getScale('testColors');
      expect(scale1.getColor('dog')).to.equal('black');
      expect(scale2.getColor('dog')).to.not.equal('black');
    });
    it('returns the namespace instance', () => {
      const ns1 = getNamespace('test-set-scale3.1');
      const ns2 = ns1.setColor('dog', 'black');
      expect(ns1).to.equal(ns2);
    });
  });
  describe('static getScale()', () => {
    it('getScale() returns a CategoricalColorScale with default scheme in default namespace', () => {
      const scale = getScale();
      expect(scale).to.not.equal(undefined);
      const scale2 = getNamespace().getScale();
      expect(scale).to.equal(scale2);
    });
    it('getScale(scheme) returns a CategoricalColorScale with specified scheme in default namespace', () => {
      const scale = getScale('testColors');
      expect(scale).to.not.equal(undefined);
      const scale2 = getNamespace().getScale('testColors');
      expect(scale).to.equal(scale2);
    });
    it('getScale(scheme, namespace) returns a CategoricalColorScale with specified scheme in specified namespace', () => {
      const scale = getScale('testColors', 'test-getScale');
      expect(scale).to.not.equal(undefined);
      const scale2 = getNamespace('test-getScale').getScale('testColors');
      expect(scale).to.equal(scale2);
    });
  });
  describe('static getColor()', () => {
    it('getColor(value) returns a color from default scheme in default namespace', () => {
      const value = 'dog';
      const color = getColor(value);
      const color2 = getNamespace().getScale().getColor(value);
      expect(color).to.equal(color2);
    });
    it('getColor(value, scheme) returns a color from specified scheme in default namespace', () => {
      const value = 'dog';
      const scheme = 'testColors';
      const color = getColor(value, scheme);
      const color2 = getNamespace().getScale(scheme).getColor(value);
      expect(color).to.equal(color2);
    });
    it('getColor(value, scheme, namespace) returns a color from specified scheme in specified namespace', () => {
      const value = 'dog';
      const scheme = 'testColors';
      const namespace = 'test-getColor';
      const color = getColor(value, scheme, namespace);
      const color2 = getNamespace(namespace).getScale(scheme).getColor(value);
      expect(color).to.equal(color2);
    });
  });
});
