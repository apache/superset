import { expect } from 'chai';
import React from 'react';

import { numericString } from '..';

import callValidator from './_callValidator';

describe('numericString', () => {
  it('returns a function', () => {
    expect(typeof numericString()).to.equal('function');
  });

  function assertPasses(validator, element, propName) {
    expect(callValidator(validator, element, propName, '"numericString" test')).to.equal(null);
  }

  function assertFails(validator, element, propName) {
    expect(callValidator(validator, element, propName, '"numericString" test')).to.be.instanceOf(Error);
  }

  it('behaves when absent', () => {
    const validator = numericString();
    assertPasses(validator, (<div />), 'a');
    assertFails(validator.isRequired, (<div />), 'a');
  });

  it('fails when not a string', () => {
    assertFails(numericString(), (<div a />), 'a');
    assertFails(numericString(), (<div a={false} />), 'a');
    assertFails(numericString(), (<div a={42} />), 'a');
    assertFails(numericString(), (<div a={[]} />), 'a');
    assertFails(numericString(), (<div a={{}} />), 'a');
    assertFails(numericString(), (<div a={() => {}} />), 'a');
  });

  it('passes on the zeroes', () => {
    const validator = numericString();

    assertPasses(validator, (<div a="0" />), 'a');
    assertPasses(validator.isRequired, (<div a="0" />), 'a');
    assertPasses(validator, (<div a="-0" />), 'a');
    assertPasses(validator.isRequired, (<div a="-0" />), 'a');
    assertPasses(validator, (<div a="+0" />), 'a');
    assertPasses(validator.isRequired, (<div a="+0" />), 'a');
  });

  it('passes when a numeric string', () => {
    assertPasses(numericString(), (<div a="123" />), 'a');
    assertPasses(numericString(), (<div a="-123" />), 'a');
    assertPasses(numericString(), (<div a="+123" />), 'a');

    assertPasses(numericString(), (<div a="123.456" />), 'a');
    assertPasses(numericString(), (<div a="-123.456" />), 'a');
    assertPasses(numericString(), (<div a="+123.456" />), 'a');

    assertPasses(numericString(), (<div a="0.45" />), 'a');
    assertPasses(numericString(), (<div a="-0.45" />), 'a');
    assertPasses(numericString(), (<div a="+0.45" />), 'a');
  });

  it('fails when not a numeric string', () => {
    assertFails(numericString(), (<div a="123a" />), 'a');
    assertFails(numericString(), (<div a="123.456.789" />), 'a');
    assertFails(numericString(), (<div a="1,234.567" />), 'a');
  });

  it('fails on edge cases', () => {
    const validator = numericString();

    assertFails(validator, (<div a="NaN" />), 'a');
    assertFails(validator, (<div a="-NaN" />), 'a');
    assertFails(validator, (<div a="+NaN" />), 'a');

    assertFails(validator, (<div a="Infinity" />), 'a');
    assertFails(validator, (<div a="-Infinity" />), 'a');
    assertFails(validator, (<div a="+Infinity" />), 'a');
  });

  it('fails on edge cases when required', () => {
    const validator = numericString().isRequired;

    assertFails(validator, (<div a="NaN" />), 'a');
    assertFails(validator, (<div a="-NaN" />), 'a');
    assertFails(validator, (<div a="+NaN" />), 'a');

    assertFails(validator, (<div a="Infinity" />), 'a');
    assertFails(validator, (<div a="-Infinity" />), 'a');
    assertFails(validator, (<div a="+Infinity" />), 'a');
  });
});
