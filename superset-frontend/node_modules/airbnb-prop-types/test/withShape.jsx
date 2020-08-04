import { expect } from 'chai';
import { array, number, oneOf } from 'prop-types';
import React from 'react';

import { withShape, range } from '..';

import callValidator from './_callValidator';

describe('withShape', () => {
  it('is a function', () => {
    expect(typeof withShape).to.equal('function');
  });

  describe('errors', () => {
    it('throws if not given a function', () => {
      expect(() => withShape()).to.throw(TypeError);
      expect(() => withShape(undefined)).to.throw(TypeError);
      expect(() => withShape(null)).to.throw(TypeError);
      expect(() => withShape([])).to.throw(TypeError);
      expect(() => withShape({})).to.throw(TypeError);
      expect(() => withShape('')).to.throw(TypeError);
      expect(() => withShape(42)).to.throw(TypeError);
      expect(() => withShape(NaN)).to.throw(TypeError);
    });

    it('throws if not given a shape object', () => {
      const f = () => {};
      expect(() => withShape(f)).to.throw(TypeError);
      expect(() => withShape(f, undefined)).to.throw(TypeError);
      expect(() => withShape(f, null)).to.throw(TypeError);
      expect(() => withShape(f, [])).to.throw(TypeError);
      expect(() => withShape(f, '')).to.throw(TypeError);
      expect(() => withShape(f, 42)).to.throw(TypeError);
      expect(() => withShape(f, NaN)).to.throw(TypeError);
    });
  });

  describe('validator', () => {
    it('returns a function', () => {
      expect(typeof withShape(() => {}, {})).to.equal('function');
    });

    function assertPasses(validator, element, propName) {
      expect(callValidator(validator, element, propName, '"withShape" test')).to.equal(null);
    }

    function assertFails(validator, element, propName) {
      expect(callValidator(validator, element, propName, '"withShape" test')).to.be.instanceOf(Error);
    }

    it('enforces the provided type', () => {
      assertPasses(
        withShape(number, {}),
        (<div foo={3} />),
        'foo',
      );
      assertFails(
        withShape(number, {}),
        (<div foo="3" />),
        'foo',
      );
    });

    it('enforces the provided shape', () => {
      assertPasses(
        withShape(array, {
          length: oneOf([2]),
        }),
        (<div foo={[1, 2]} />),
        'foo',
      );
      assertPasses(
        withShape(array, {
          length: range(1, 4),
        }),
        (<div foo={[1, 2]} />),
        'foo',
      );
      assertFails(
        withShape(array, {
          length: oneOf([2]),
          missing: number.isRequired,
        }),
        (<div foo={[1, 2]} />),
        'foo',
      );
      assertFails(
        withShape(array, {
          length: oneOf([1]),
        }),
        (<div foo={[1, 2]} />),
        'foo',
      );
    });
  });
});
