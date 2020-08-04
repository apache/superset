import { expect } from 'chai';
import { number } from 'prop-types';
import React from 'react';

import { and, nonNegativeInteger } from '..';

import callValidator from './_callValidator';

describe('and', () => {
  it('returns a function', () => {
    expect(typeof and([number, nonNegativeInteger])).to.equal('function');
  });

  it('throws on non-array input', () => {
    expect(() => and()).to.throw(TypeError);
    expect(() => and(null)).to.throw(TypeError);
    expect(() => and(undefined)).to.throw(TypeError);
    expect(() => and({})).to.throw(TypeError);
    expect(() => and(() => {})).to.throw(TypeError);
    expect(() => and(true)).to.throw(TypeError);
    expect(() => and(42)).to.throw(TypeError);
    expect(() => and('')).to.throw(TypeError);
  });

  it('requires at least 2 validators', () => {
    expect(() => and([])).to.throw(RangeError);
    expect(() => and([() => {}])).to.throw(RangeError);
    expect(() => and([() => {}, () => {}])).not.to.throw();
  });

  function assertPasses(validator, element, propName) {
    const result = callValidator(validator, element, propName, '"and" test');
    expect(result).to.equal(null);
  }

  function assertFails(validator, element, propName) {
    const result = callValidator(validator, element, propName, '"and" test');
    expect(result).to.be.instanceOf(Error);
  }

  describe('validates both propTypes', () => {
    it('passes when expected', () => {
      const validatorNumber = and([number, nonNegativeInteger]);
      const validatorNonNegative = and([nonNegativeInteger, number]);

      assertPasses(validatorNumber, (<div a={1} />), 'a');
      assertPasses(validatorNonNegative, (<div a={1} />), 'a');
    });

    it('fails when expected', () => {
      const validatorNumber = and([number, nonNegativeInteger]);
      const validatorNonNegative = and([nonNegativeInteger, number]);
      const invalidElement = (<div a={-2} />);
      const prop = 'a';

      assertFails(validatorNumber, invalidElement, prop);
      assertFails(validatorNonNegative, invalidElement, prop);
    });

    it('fails in the right order', () => {
      const invalidElement = (<div a="b" />);
      const prop = 'a';
      const location = 'testing "and"';

      expect(callValidator(
        and([number, nonNegativeInteger]),
        invalidElement,
        prop,
        location,
      )).to.eql(callValidator(number, invalidElement, prop, location));

      const actual = callValidator(
        and([nonNegativeInteger, number]),
        invalidElement,
        prop,
        location,
      );
      const expected = callValidator(nonNegativeInteger, invalidElement, prop, location);
      expect(typeof actual).to.equal(typeof expected);
      expect(actual.name).to.equal(expected.name);
      expect(actual.message).to.equal(expected.message);
    });
  });

  describe('isRequired', () => {
    it('passes if not required', () => {
      const validatorNumber = and([number, nonNegativeInteger]);
      assertPasses(validatorNumber, (<div />), 'a');
    });

    it('fails if overarching one is required', () => {
      const validatorNumber = and([number, nonNegativeInteger]).isRequired;
      assertFails(validatorNumber, (<div />), 'a');
    });

    it('fails if an individual validator is required', () => {
      const validatorNumber = and([number, nonNegativeInteger.isRequired]);
      assertFails(validatorNumber, (<div />), 'a');
    });
  });
});
