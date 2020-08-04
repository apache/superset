import { expect } from 'chai';
import React from 'react';

import { booleanSome } from '..';

import callValidator from './_callValidator';

describe('booleanSome', () => {
  it('throws when given non-strings', () => {
    expect(() => booleanSome()).to.throw(TypeError);
    expect(() => booleanSome(null)).to.throw(TypeError);
    expect(() => booleanSome({})).to.throw(TypeError);
    expect(() => booleanSome([])).to.throw(TypeError);
  });

  it('throws when given 0 props', () => {
    expect(() => booleanSome()).to.throw(TypeError);
  });

  it('returns a function', () => {
    expect(typeof booleanSome('a', 'b')).to.equal('function');
  });

  function assertPasses(validator, element, propName) {
    expect(callValidator(validator, element, propName)).to.equal(null);
  }

  function assertFails(validator, element, propName) {
    expect(callValidator(validator, element, propName)).to.be.instanceOf(Error);
  }

  it('passes with all true', () => {
    const validator = booleanSome('a', 'b');
    assertPasses(validator, (<div a b />), 'a');
    assertPasses(validator, (<div a b />), 'b');
    assertPasses(validator.isRequired, (<div a b />), 'a');
    assertPasses(validator.isRequired, (<div a b />), 'b');
  });

  it('behaves with one true', () => {
    const validator = booleanSome('a', 'b');
    assertPasses(validator, (<div a />), 'a');
    assertPasses(validator, (<div a />), 'b');
    assertPasses(validator, (<div b />), 'a');
    assertPasses(validator, (<div b />), 'b');
    assertPasses(validator.isRequired, (<div a />), 'a');
    assertFails(validator.isRequired, (<div a />), 'b');
    assertPasses(validator.isRequired, (<div b />), 'b');
    assertFails(validator.isRequired, (<div b />), 'a');
  });

  it('passes with one false', () => {
    const validator = booleanSome('a', 'b');
    assertPasses(validator, (<div a={false} />), 'a');
    assertPasses(validator, (<div a={false} />), 'b');
    assertPasses(validator, (<div b={false} />), 'a');
    assertPasses(validator, (<div b={false} />), 'b');
    assertPasses(validator.isRequired, (<div a={false} b />), 'a');
    assertPasses(validator.isRequired, (<div a={false} b />), 'b');
    assertPasses(validator.isRequired, (<div a b={false} />), 'a');
    assertPasses(validator.isRequired, (<div a b={false} />), 'b');
  });

  it('fails with all false', () => {
    const validator = booleanSome('a', 'b');
    assertFails(validator, (<div a={false} b={false} />), 'a');
    assertFails(validator, (<div a={false} b={false} />), 'b');
    assertFails(validator.isRequired, (<div a={false} b={false} />), 'a');
    assertFails(validator.isRequired, (<div b={false} />), 'a');
    assertFails(validator.isRequired, (<div a={false} b={false} />), 'b');
    assertFails(validator.isRequired, (<div a={false} />), 'b');
  });

  it('passes when one of the boolean props is null/undefined', () => {
    const prop1 = 'foo';
    const prop2 = 'bar';
    const validator = booleanSome(prop1, prop2);

    assertPasses(validator, (<div foo bar={null} />), prop1);
    assertPasses(validator, (<div foo bar={null} />), prop2);
    assertPasses(validator, (<div bar foo={null} />), prop1);
    assertPasses(validator, (<div bar foo={null} />), prop2);
  });

  it('fails when required, and one of the exclusive props is null/undefined', () => {
    const prop1 = 'foo';
    const prop2 = 'bar';
    const validator = booleanSome(prop1, prop2).isRequired;

    assertFails(validator, (<div foo bar={null} />), prop2);
    assertFails(validator, (<div bar foo={null} />), prop1);
    assertFails(validator, (<div foo bar={undefined} />), prop2);
    assertFails(validator, (<div bar foo={undefined} />), prop1);
  });
});
