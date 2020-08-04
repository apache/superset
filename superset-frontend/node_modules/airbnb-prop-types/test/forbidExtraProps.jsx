import { expect } from 'chai';
import React from 'react';
import ownKeys from 'reflect.ownkeys';

import { forbidExtraProps } from '..';

import callValidator from './_callValidator';

describe('forbidExtraProps', () => {
  let specialProperty;
  beforeEach(() => {
    [specialProperty] = ownKeys(forbidExtraProps({}));
  });

  function assertPasses(validator, element, propName, componentName) {
    expect(callValidator(validator, element, propName, componentName)).to.equal(null);
  }

  function assertFails(validator, element, propName, componentName) {
    expect(callValidator(validator, element, propName, componentName)).to.be.instanceOf(Error);
  }

  it('throws when the given propTypes is not an object', () => {
    expect(() => forbidExtraProps()).to.throw(TypeError);
    expect(() => forbidExtraProps(undefined)).to.throw(TypeError);
    expect(() => forbidExtraProps(null)).to.throw(TypeError);
    expect(() => forbidExtraProps('')).to.throw(TypeError);
    expect(() => forbidExtraProps(42)).to.throw(TypeError);
    expect(() => forbidExtraProps(true)).to.throw(TypeError);
    expect(() => forbidExtraProps(false)).to.throw(TypeError);
    expect(() => forbidExtraProps(() => {})).to.throw(TypeError);
  });

  it('throws when the given propTypes has the magic property', () => {
    expect(() => forbidExtraProps({ [specialProperty]: true })).to.throw(TypeError);
  });

  it('returns an object', () => {
    expect(typeof forbidExtraProps({})).to.equal('object');
  });

  it('adds one extra key', () => {
    const propTypes = { a: 1, b: 2, c: 3 };
    const result = forbidExtraProps(propTypes);
    expect(ownKeys(result)).to.eql(ownKeys(propTypes).concat(specialProperty));
  });

  it('allows for merging of propTypes that have been processed', () => {
    expect(() => forbidExtraProps(forbidExtraProps({}))).not.to.throw();
  });

  describe('forbid()', () => {
    const knownProp = 'a';

    let validator;
    beforeEach(() => {
      validator = forbidExtraProps({ [knownProp]() {} })[specialProperty];
    });

    it('adds a function', () => {
      expect(typeof validator).to.equal('function');
    });

    it('passes when given no props', () => {
      assertPasses(validator, <div />, specialProperty, 'Foo');
    });

    it('passes when given only known props', () => {
      assertPasses(validator, <div {...{ [knownProp]: true }} />, specialProperty, 'Foo');
    });

    it('fails when given an unknown prop', () => {
      assertFails(validator, <div unknown {...{ [knownProp]: true }} />, specialProperty, 'Foo');
    });
  });
});
