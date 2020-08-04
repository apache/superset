import { expect } from 'chai';
import React from 'react';

import { stringEndsWith } from '..';

import callValidator from './_callValidator';

describe('stringEndsWith', () => {
  it('returns a function', () => {
    expect(typeof stringEndsWith(' ')).to.equal('function');
  });

  it('throws when given a non-string', () => {
    expect(() => stringEndsWith()).to.throw(TypeError);
    expect(() => stringEndsWith(null)).to.throw(TypeError);
    expect(() => stringEndsWith(true)).to.throw(TypeError);
    expect(() => stringEndsWith(false)).to.throw(TypeError);
    expect(() => stringEndsWith({})).to.throw(TypeError);
    expect(() => stringEndsWith([])).to.throw(TypeError);
  });

  it('throws when given an empty string', () => {
    expect(() => stringEndsWith('')).to.throw(TypeError);
  });

  function assertPasses(validator, element, propName) {
    expect(callValidator(validator, element, propName, '"stringEndsWith" test')).to.equal(null);
  }

  function assertFails(validator, element, propName) {
    expect(callValidator(validator, element, propName, '"stringEndsWith" test')).to.be.instanceOf(Error);
  }

  it('behaves when absent', () => {
    const validator = stringEndsWith('.png');
    assertPasses(validator, (<div />), 'a');
    assertFails(validator.isRequired, (<div />), 'a');
  });

  it('fails when not a string', () => {
    const validator = stringEndsWith('.png');
    assertFails(validator, (<div a />), 'a');
    assertFails(validator, (<div a={false} />), 'a');
    assertFails(validator, (<div a={42} />), 'a');
    assertFails(validator, (<div a={[]} />), 'a');
    assertFails(validator, (<div a={{}} />), 'a');
    assertFails(validator, (<div a={() => {}} />), 'a');
  });

  it('passes when the string ends with the requested substring', () => {
    const validator = stringEndsWith('foo');
    assertPasses(validator, (<div a="afoo" />), 'a');
    assertPasses(validator, (<div a="barfoo" />), 'a');
    assertPasses(validator, (<div a="bar foo" />), 'a');
  });

  it('fails when the string does not end with the requested substring', () => {
    const validator = stringEndsWith('.png');
    assertFails(validator, (<div a="IMAGE.PNG" />), 'a');
    assertFails(validator, (<div a="png.PNG" />), 'a');
    assertFails(validator, (<div a="image.jpg" />), 'a');
    assertFails(validator, (<div a=".pn" />), 'a');
    assertFails(validator.isRequired, (<div a="IMAGE.PNG" />), 'a');
    assertFails(validator.isRequired, (<div a="png.PNG" />), 'a');
    assertFails(validator.isRequired, (<div a="image.jpg" />), 'a');
    assertFails(validator.isRequired, (<div a=".pn" />), 'a');
  });

  it('fails when the string matches the requested substring', () => {
    const validator = stringEndsWith('.png');
    assertFails(validator, (<div a=".png" />), 'a');
    assertFails(validator.isRequired, (<div a=".png" />), 'a');
  });
});
