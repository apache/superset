import { expect } from 'chai';
import React from 'react';

import { object } from '..';

import callValidator from './_callValidator';

describe('object', () => {
  it('returns a function', () => {
    expect(typeof object()).to.equal('function');
  });

  function assertPasses(validator, element, propName) {
    expect(callValidator(validator, element, propName, '"object" test')).to.equal(null);
  }

  function assertFails(validator, element, propName) {
    expect(callValidator(validator, element, propName, '"object" test')).to.be.instanceOf(Error);
  }

  it('passes on null/undefined', () => {
    const validator = object();

    assertPasses(validator, (<div foo={null} />), 'foo');
    assertPasses(validator, (<div foo={undefined} />), 'foo');
  });

  it('fails on null/undefined when required', () => {
    const validator = object().isRequired;

    assertFails(validator, (<div foo={null} />), 'foo');
    assertFails(validator, (<div foo={undefined} />), 'foo');
  });

  it('fails on arrays and functions', () => {
    const validator = object();

    assertFails(validator, (<div foo={[]} />), 'foo');
    assertFails(validator.isRequired, (<div foo={[]} />), 'foo');

    assertFails(validator, (<div foo={() => {}} />), 'foo');
    assertFails(validator.isRequired, (<div foo={() => {}} />), 'foo');
  });

  it('fails on any other value', () => {
    assertFails(object(), (<div foo={false} />), 'foo');
    assertFails(object(), (<div foo />), 'foo');
    assertFails(object(), (<div foo={NaN} />), 'foo');
    assertFails(object(), (<div foo="" />), 'foo');
    assertFails(object(), (<div foo="foo" />), 'foo');
  });

  it('passes on non-array non-function objects', () => {
    const validator = object();

    assertPasses(validator, (<div foo={{}} />), 'foo');
    assertPasses(validator.isRequired, (<div foo={{}} />), 'foo');

    assertPasses(validator, (<div foo={/a/g} />), 'foo');
    assertPasses(validator.isRequired, (<div foo={/a/g} />), 'foo');
  });
});
