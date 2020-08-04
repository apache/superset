import { expect } from 'chai';
import { any, bool } from 'prop-types';
import React from 'react';

import { disallowedIf } from '..';

import callValidator from './_callValidator';

describe('disallowedIf', () => {
  it('throws when not given proper arguments', () => {
    expect(() => disallowedIf(null, 'other', any)).to.throw(TypeError);
    expect(() => disallowedIf(any, 'other')).to.throw(TypeError);
    expect(() => disallowedIf(any, null, any)).to.throw(TypeError);
  });

  it('returns a function', () => {
    expect(typeof disallowedIf(any, 'other', any)).to.equal('function');
  });

  function assertPasses(validator, element, propName) {
    expect(callValidator(validator, element, propName)).to.equal(null);
  }

  function assertFails(validator, element, propName) {
    expect(callValidator(validator, element, propName)).to.be.instanceOf(Error);
  }

  it('passes when the other prop is null or undefined', () => {
    assertPasses(
      disallowedIf(bool, 'b', any),
      (<div a />),
      'a',
    );
  });

  it('passes when the other prop does not match the specified type', () => {
    assertPasses(
      disallowedIf(bool, 'b', bool),
      (<div a b="string" />),
      'a',
    );
  });

  it('passes when the other prop matches the specified type and the prop is not provided', () => {
    assertPasses(
      disallowedIf(bool, 'b', bool),
      (<div b="string" />),
      'a',
    );
  });

  it('fails when the other prop matches the specified type', () => {
    assertFails(
      disallowedIf(bool, 'b', bool),
      (<div a b={false} />),
      'a',
    );
  });

  it('fails when the provided propType fails', () => {
    assertFails(
      disallowedIf(bool, 'b', bool),
      (<div a="string" b="other string" />),
      'a',
    );
  });

  it('fails when required and not provided', () => {
    assertFails(
      disallowedIf(bool, 'b', bool).isRequired,
      (<div b="other string" />),
      'a',
    );
  });
});
