import { expect } from 'chai';
import React from 'react';

import { nonNegativeNumber } from '..';

import callValidator from './_callValidator';

describe('nonNegativeNumber', () => {
  it('returns a function', () => {
    expect(typeof nonNegativeNumber()).to.equal('function');
  });

  function assertPasses(validator, element, propName) {
    expect(callValidator(validator, element, propName, 'nonNegativeNumber test')).to.equal(null);
  }

  function assertFails(validator, element, propName) {
    expect(callValidator(validator, element, propName, 'nonNegativeNumber test')).to.be.instanceOf(Error);
  }

  it('passes on nil values', () => {
    assertPasses(nonNegativeNumber(), <div a={undefined} />, 'a');
    assertPasses(nonNegativeNumber(), <div a={null} />, 'a');
  });

  it('passes on zero', () => assertPasses(
    nonNegativeNumber(),
    (<div a={0} />),
    'a',
  ));

  it('passes on positive numbers', () => {
    const validator = nonNegativeNumber();

    assertPasses(validator, <div a={1} />, 'a');
    assertPasses(validator.isRequired, <div a={1} />, 'a');

    assertPasses(validator, <div a={42} />, 'a');
    assertPasses(validator.isRequired, <div a={42} />, 'a');
  });

  it('fails on negative numbers', () => {
    const validator = nonNegativeNumber();

    assertFails(validator, <div a={-1} />, 'a');
    assertFails(validator.isRequired, <div a={-1} />, 'a');

    assertFails(validator, <div a={-42} />, 'a');
    assertFails(validator.isRequired, <div a={-42} />, 'a');
  });

  it('passes on positive non-integers', () => {
    assertPasses(nonNegativeNumber(), <div a={1.5} />, 'a');
    assertPasses(nonNegativeNumber(), <div a={1.999999} />, 'a');
    assertPasses(nonNegativeNumber(), <div a={(0.1 + 0.2) * 10} />, 'a');
  });

  it('fails on negative non-integers', () => {
    assertFails(nonNegativeNumber(), <div a={-1.5} />, 'a');
    assertFails(nonNegativeNumber(), <div a={-1.999999} />, 'a');
    assertFails(nonNegativeNumber(), <div a={-(0.1 + 0.2) * 10} />, 'a');
  });

  it('fails on number edge cases', () => {
    assertFails(nonNegativeNumber(), <div a={-Infinity} />, 'a');
    assertFails(nonNegativeNumber(), <div a={Infinity} />, 'a');
    assertFails(nonNegativeNumber(), <div a={NaN} />, 'a');
  });

  it('fails on negative zero', () => {
    assertFails(nonNegativeNumber(), <div a={-0} />, 'a');
  });

  describe('isRequired', () => {
    it('passes when not required', () => assertPasses(
      nonNegativeNumber(),
      (<div />),
      'a',
    ));

    it('fails when required', () => assertFails(
      nonNegativeNumber().isRequired,
      (<div />),
      'a',
    ));
  });
});
