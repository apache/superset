import { expect } from 'chai';
import React from 'react';

import { nonNegativeInteger } from '..';

import callValidator from './_callValidator';

describe('nonNegativeInteger', () => {
  it('is a function', () => {
    expect(typeof nonNegativeInteger).to.equal('function');
  });

  function assertPasses(validator, element, propName) {
    expect(callValidator(validator, element, propName, 'nonNegativeInteger test')).to.equal(null);
  }

  function assertFails(validator, element, propName) {
    expect(callValidator(validator, element, propName, 'nonNegativeInteger test')).to.be.instanceOf(Error);
  }

  it('passes on nil values', () => {
    assertPasses(nonNegativeInteger, <div a={undefined} />, 'a');
    assertPasses(nonNegativeInteger, <div a={null} />, 'a');
  });

  it('passes on zero', () => assertPasses(
    nonNegativeInteger,
    (<div a={0} />),
    'a',
  ));

  it('passes on positive numbers', () => {
    assertPasses(nonNegativeInteger, <div a={1} />, 'a');
    assertPasses(nonNegativeInteger, <div a={42} />, 'a');
  });

  it('fails on negative numbers', () => {
    assertFails(nonNegativeInteger, <div a={-1} />, 'a');
    assertFails(nonNegativeInteger, <div a={-42} />, 'a');
  });

  it('fails on non-integers', () => {
    assertFails(nonNegativeInteger, <div a={1.5} />, 'a');
    assertFails(nonNegativeInteger, <div a={1.999999} />, 'a');
    assertFails(nonNegativeInteger, <div a={(0.1 + 0.2) * 10} />, 'a');
  });

  it('fails on number edge cases', () => {
    assertFails(nonNegativeInteger, <div a={-Infinity} />, 'a');
    assertFails(nonNegativeInteger, <div a={Infinity} />, 'a');
    assertFails(nonNegativeInteger, <div a={NaN} />, 'a');
  });

  it('fails on negative zero', () => {
    assertFails(nonNegativeInteger, <div a={-0} />, 'a');
  });

  describe('isRequired', () => {
    it('passes when not required', () => assertPasses(
      nonNegativeInteger,
      (<div />),
      'a',
    ));

    it('fails when required', () => assertFails(
      nonNegativeInteger.isRequired,
      (<div />),
      'a',
    ));
  });
});
