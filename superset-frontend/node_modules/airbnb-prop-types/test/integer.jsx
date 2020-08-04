import { expect } from 'chai';
import React from 'react';

import { integer } from '..';

import callValidator from './_callValidator';

describe('integer', () => {
  it('returns a function', () => {
    expect(typeof integer()).to.equal('function');
  });

  function assertPasses(validator, element, propName) {
    expect(callValidator(validator, element, propName, 'integer test')).to.equal(null);
  }

  function assertFails(validator, element, propName) {
    expect(callValidator(validator, element, propName, 'integer test')).to.be.instanceOf(Error);
  }

  it('passes on nil values', () => {
    assertPasses(integer(), <div a={undefined} />, 'a');
    assertPasses(integer(), <div a={null} />, 'a');
  });

  it('passes on zero', () => assertPasses(
    integer(),
    (<div a={0} />),
    'a',
  ));

  it('passes on positive numbers', () => {
    assertPasses(integer(), <div a={1} />, 'a');
    assertPasses(integer(), <div a={42} />, 'a');
  });

  it('passes on negative numbers', () => {
    assertPasses(integer(), <div a={-1} />, 'a');
    assertPasses(integer(), <div a={-42} />, 'a');
  });

  it('fails on non-integers', () => {
    assertFails(integer(), <div a={1.5} />, 'a');
    assertFails(integer(), <div a={1.999999} />, 'a');
    assertFails(integer(), <div a={(0.1 + 0.2) * 10} />, 'a');
  });

  it('fails on number edge cases', () => {
    assertFails(integer(), <div a={-Infinity} />, 'a');
    assertFails(integer(), <div a={Infinity} />, 'a');
    assertFails(integer(), <div a={NaN} />, 'a');
  });

  it('passes on negative zero', () => {
    assertPasses(integer(), <div a={-0} />, 'a');
  });

  describe('isRequired', () => {
    it('passes when not required', () => assertPasses(
      integer(),
      (<div />),
      'a',
    ));

    it('fails when required', () => assertFails(
      integer().isRequired,
      (<div />),
      'a',
    ));
  });
});
