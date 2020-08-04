import { expect } from 'chai';
import { number } from 'prop-types';
import React from 'react';

import { valuesOf } from '..';

import callValidator from './_callValidator';

describe('valuesOf', () => {
  it('returns a function', () => {
    expect(typeof valuesOf(() => {})).to.equal('function');
  });

  it('throws when not given a function', () => {
    expect(() => valuesOf()).to.throw(TypeError);
    expect(() => valuesOf(null)).to.throw(TypeError);
    expect(() => valuesOf(undefined)).to.throw(TypeError);
    expect(() => valuesOf([])).to.throw(TypeError);
    expect(() => valuesOf({})).to.throw(TypeError);
    expect(() => valuesOf('')).to.throw(TypeError);
    expect(() => valuesOf(42)).to.throw(TypeError);
    expect(() => valuesOf(true)).to.throw(TypeError);
  });

  function assertPasses(validator, element, propName) {
    expect(callValidator(validator, element, propName, '"valuesOf" passing test')).to.equal(null);
  }

  function assertFails(validator, element, propName) {
    expect(callValidator(validator, element, propName, '"valuesOf" failing test')).to.be.instanceOf(Error);
  }

  it('passes on null/undefined', () => {
    const validator = valuesOf(() => {});

    assertPasses(validator, (<div foo={null} />), 'foo');
    assertPasses(validator, (<div foo={undefined} />), 'foo');
  });

  it('fails on null/undefined when required', () => {
    const validator = valuesOf(() => {}).isRequired;

    assertFails(validator, (<div foo={null} />), 'foo');
    assertFails(validator, (<div foo={undefined} />), 'foo');
  });

  it('passes when the validator passes on all values', () => {
    const validator = valuesOf(number);

    assertPasses(
      validator,
      (
        <div
          foo={{
            a: 3,
            b: NaN,
            c: Infinity,
            d: -0,
          }}
        />
      ),
      'foo',
    );
  });

  it('behaves on null values', () => {
    assertPasses(
      valuesOf(number),
      (<div foo={{ a: 3, b: null }} />),
      'foo',
    );
    assertPasses(
      valuesOf(number).isRequired,
      (<div foo={{ a: 3, b: null }} />),
      'foo',
    );

    assertFails(
      valuesOf(number.isRequired),
      (<div foo={{ a: 3, b: null }} />),
      'foo',
    );
    assertFails(
      valuesOf(number.isRequired).isRequired,
      (<div foo={{ a: 3, b: null }} />),
      'foo',
    );
  });

  it('fails when any value fails', () => {
    const validator = valuesOf(number);

    assertFails(
      validator,
      (<div foo={{ a: 3, b: 'not a number' }} />),
      'foo',
    );

    assertFails(
      validator.isRequired,
      (<div foo={{ a: 3, b: 'not a number' }} />),
      'foo',
    );
  });

  it('passes on non-nullary primitives', () => {
    const validator = valuesOf(number.isRequired);

    assertPasses(validator, (<div a={3} />), 'a');
    assertPasses(validator, (<div a={NaN} />), 'a');
    assertPasses(validator, (<div a="" />), 'a');
    assertPasses(validator, (<div a="foo" />), 'a');
    assertPasses(validator, (<div a />), 'a');
    assertPasses(validator, (<div a={false} />), 'a');

    assertPasses(validator.isRequired, (<div a={3} />), 'a');
    assertPasses(validator.isRequired, (<div a={NaN} />), 'a');
    assertPasses(validator.isRequired, (<div a="" />), 'a');
    assertPasses(validator.isRequired, (<div a="foo" />), 'a');
    assertPasses(validator.isRequired, (<div a />), 'a');
    assertPasses(validator.isRequired, (<div a={false} />), 'a');
  });

  it('passes on functions and arrays', () => {
    const validator = valuesOf(number.isRequired);

    assertPasses(validator, (<div a={() => {}} />), 'a');
    assertPasses(validator, (<div a={[]} />), 'a');

    assertPasses(validator.isRequired, (<div a={() => {}} />), 'a');
    assertPasses(validator.isRequired, (<div a={[]} />), 'a');
  });
});
