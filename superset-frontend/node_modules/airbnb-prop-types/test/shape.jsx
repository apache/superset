import { expect } from 'chai';
import {
  bool,
  func,
  oneOf,
  number,
} from 'prop-types';
import React from 'react';

import { shape } from '..';

import callValidator from './_callValidator';

describe('shape', () => {
  it('is a function', () => {
    expect(typeof shape).to.equal('function');
  });

  describe('errors', () => {
    it('throws if not given a shape object', () => {
      expect(() => shape()).to.throw(TypeError);
      expect(() => shape(undefined)).to.throw(TypeError);
      expect(() => shape(null)).to.throw(TypeError);
      expect(() => shape([])).to.throw(TypeError);
      expect(() => shape('')).to.throw(TypeError);
      expect(() => shape(42)).to.throw(TypeError);
      expect(() => shape(NaN)).to.throw(TypeError);
    });
  });

  describe('validator', () => {
    it('returns a function', () => {
      expect(typeof shape({})).to.equal('function');
    });

    function assertPasses(validator, element, propName) {
      expect(callValidator(validator, element, propName, '"shape" test')).to.equal(null);
    }

    function assertFails(validator, element, propName) {
      expect(callValidator(validator, element, propName, '"shape" test')).to.be.instanceOf(Error);
    }

    it('behaves when nullary', () => {
      const validator = shape({ toFixed: func.isRequired });

      assertPasses(validator, (<div />), 'a');
      assertPasses(validator, (<div a={null} />), 'a');
      assertPasses(validator, (<div a={undefined} />), 'a');

      assertFails(validator.isRequired, (<div />), 'a');
      assertFails(validator.isRequired, (<div a={null} />), 'a');
      assertFails(validator.isRequired, (<div a={undefined} />), 'a');
    });

    it('enforces the provided type', () => {
      assertPasses(
        shape({ toFixed: func.isRequired }),
        (<div foo={3} />),
        'foo',
      );
      assertFails(
        shape({ missing: bool.isRequired }),
        (<div foo="3" />),
        'foo',
      );
    });

    it('enforces the provided shape', () => {
      assertPasses(
        shape({
          length: oneOf([2]),
        }),
        (<div foo={[1, 2]} />),
        'foo',
      );
      assertFails(
        shape({
          length: oneOf([2]),
          missing: number.isRequired,
        }),
        (<div foo={[1, 2]} />),
        'foo',
      );
      assertFails(
        shape({
          length: oneOf([1]),
        }),
        (<div foo={[1, 2]} />),
        'foo',
      );
    });

    it('skips falsy shape keys', () => {
      assertPasses(
        shape({ toFixed: func.isRequired, missing: null, nope: false }),
        (<div foo={3} />),
        'foo',
      );
    });
  });
});
