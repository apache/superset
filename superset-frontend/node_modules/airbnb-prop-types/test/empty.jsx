import { expect } from 'chai';
import React from 'react';
import inspect from 'object-inspect';

import { empty } from '..';

import callValidator from './_callValidator';

describe('empty', () => {
  it('returns a function', () => {
    expect(typeof empty()).to.equal('function');
  });

  function assertPasses(validator, element, propName) {
    const e = callValidator(validator, element, propName, '"empty" test');
    expect(e && e.message).to.equal(null);
  }

  function assertFails(validator, element, propName) {
    expect(callValidator(validator, element, propName, '"empty" test')).to.be.instanceOf(Error);
  }

  const emptyRenderValues = [null, undefined, '', false, []];
  const nonEmptyRenderValues = [true, 'foo', 0, Infinity, {}];

  emptyRenderValues.forEach((emptyValue) => {
    it(`passes on empty render values: ${inspect(emptyValue)}`, () => {
      const validator = empty();

      assertPasses(validator, (<div foo={emptyValue} />), 'foo');
      if (typeof emptyValue !== 'undefined') {
        assertPasses(validator.isRequired, (<div foo={emptyValue} />), 'foo');
      }
    });

    it(`passes on arrays of empty render values: ${inspect(emptyValue)}`, () => {
      const validator = empty();

      assertPasses(validator, (<div foo={[emptyValue]} />), 'foo');
      assertPasses(validator.isRequired, (<div foo={[emptyValue]} />), 'foo');
    });
  });

  nonEmptyRenderValues.forEach((nonEmptyValue) => {
    it(`fails on non-empty render values: ${inspect(nonEmptyValue)}`, () => {
      const validator = empty();

      assertFails(validator, (<div foo={nonEmptyValue} />), 'foo');
      assertFails(validator.isRequired, (<div foo={nonEmptyValue} />), 'foo');
    });

    it(`fails on arrays of non-empty render values: ${inspect(nonEmptyValue)}`, () => {
      const validator = empty();

      assertFails(validator, (<div foo={[nonEmptyValue]} />), 'foo');
      assertFails(validator.isRequired, (<div foo={[nonEmptyValue]} />), 'foo');
    });
  });
});
