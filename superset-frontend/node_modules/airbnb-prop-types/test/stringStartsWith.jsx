import { expect } from 'chai';
import React from 'react';

import { stringStartsWith } from '..';

import callValidator from './_callValidator';

describe('stringStartsWith', () => {
  it('returns a function', () => {
    expect(typeof stringStartsWith(' ')).to.equal('function');
  });

  it('throws when given a non-string', () => {
    expect(() => stringStartsWith()).to.throw(TypeError);
    expect(() => stringStartsWith(null)).to.throw(TypeError);
    expect(() => stringStartsWith(true)).to.throw(TypeError);
    expect(() => stringStartsWith(false)).to.throw(TypeError);
    expect(() => stringStartsWith({})).to.throw(TypeError);
    expect(() => stringStartsWith([])).to.throw(TypeError);
  });

  it('throws when given an empty string', () => {
    expect(() => stringStartsWith('')).to.throw(TypeError);
  });

  function assertPasses(validator, element, propName) {
    expect(callValidator(validator, element, propName, '"stringStartsWith" test')).to.equal(null);
  }

  function assertFails(validator, element, propName) {
    expect(callValidator(validator, element, propName, '"stringStartsWith" test')).to.be.instanceOf(Error);
  }

  it('behaves when absent', () => {
    const validator = stringStartsWith('foo');
    assertPasses(validator, (<div />), 'a');
    assertFails(validator.isRequired, (<div />), 'a');
  });

  it('fails when not a string', () => {
    const validator = stringStartsWith('foo');
    assertFails(validator, (<div a />), 'a');
    assertFails(validator, (<div a={false} />), 'a');
    assertFails(validator, (<div a={42} />), 'a');
    assertFails(validator, (<div a={[]} />), 'a');
    assertFails(validator, (<div a={{}} />), 'a');
    assertFails(validator, (<div a={() => {}} />), 'a');
  });

  it('passes when the string starts with the requested substring', () => {
    const validator = stringStartsWith('foo');
    assertPasses(validator, (<div a="food" />), 'a');
    assertPasses(validator, (<div a="foobar" />), 'a');
    assertPasses(validator, (<div a="foo bar" />), 'a');
  });

  it('fails when the string does not start with the requested substring', () => {
    const validator = stringStartsWith('foo');
    assertFails(validator, (<div a="Food" />), 'a');
    assertFails(validator, (<div a="Foobar" />), 'a');
    assertFails(validator, (<div a="bar baz" />), 'a');
    assertFails(validator, (<div a="fo" />), 'a');
    assertFails(validator.isRequired, (<div a="Food" />), 'a');
    assertFails(validator.isRequired, (<div a="Foobar" />), 'a');
    assertFails(validator.isRequired, (<div a="bar baz" />), 'a');
    assertFails(validator.isRequired, (<div a="fo" />), 'a');
  });

  it('fails when the string matches the requested substring', () => {
    const validator = stringStartsWith('foo');
    assertFails(validator, (<div a="foo" />), 'a');
    assertFails(validator.isRequired, (<div a="foo" />), 'a');
  });
});
