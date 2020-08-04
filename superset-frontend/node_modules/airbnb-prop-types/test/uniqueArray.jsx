import { expect } from 'chai';
import React from 'react';

import { uniqueArray } from '..';

import callValidator from './_callValidator';

describe('uniqueArray', () => {
  it('returns a function', () => {
    expect(typeof uniqueArray()).to.equal('function');
  });

  function assertPasses(validator, element, propName) {
    expect(callValidator(validator, element, propName, '"uniqueArray" test')).to.equal(null);
  }

  function assertFails(validator, element, propName) {
    expect(callValidator(validator, element, propName, '"uniqueArray" test')).to.be.instanceOf(Error);
  }
  it('requires an array', () => assertFails(
    uniqueArray(),
    (<div foo="bar" />),
    'foo',
  ));

  it('is not required by default', () => assertPasses(
    uniqueArray(),
    (<div foo="bar" />),
    'missing',
  ));

  it('is required with .isRequired', () => assertFails(
    uniqueArray().isRequired,
    (<div foo="bar" />),
    'missing',
  ));

  it('enforces uniqueness', () => {
    assertFails(
      uniqueArray(),
      (<div foo={[3, 1, 2, 3, 4]} />),
      'foo',
    );
    assertPasses(
      uniqueArray(),
      (<div foo={[1, 2, 3, 4]} />),
      'foo',
    );
  });

  it('enforces uniqueness of objects too', () => {
    const arr = [1];

    assertFails(
      uniqueArray(),
      (<div foo={[[1], arr, arr]} />),
      'foo',
    );
    assertPasses(
      uniqueArray(),
      (<div foo={[[1], arr, [1]]} />),
      'foo',
    );
  });
});
