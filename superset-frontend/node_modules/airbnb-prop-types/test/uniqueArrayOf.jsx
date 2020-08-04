import { expect } from 'chai';
import { array, number } from 'prop-types';
import React from 'react';

import { uniqueArrayOf } from '..';

import callValidator from './_callValidator';

describe('uniqueArrayOf', () => {
  it('is a function', () => {
    expect(typeof uniqueArrayOf).to.equal('function');
  });

  function assertPasses(validator, element, propName) {
    expect(callValidator(validator, element, propName, '"uniqueArrayOf" test')).to.equal(null);
  }

  function assertFails(validator, element, propName) {
    expect(callValidator(validator, element, propName, '"uniqueArrayOf" test')).to.be.instanceOf(Error);
  }

  function identityMapper(element) { return element; }
  function constantMapper(element) { return element ** 0; }
  function arrayMapper(element) { return element[0]; }

  it('throws if not given a type function', () => {
    expect(() => uniqueArrayOf()).to.throw(TypeError);
    expect(() => uniqueArrayOf(undefined)).to.throw(TypeError);
    expect(() => uniqueArrayOf(null)).to.throw(TypeError);
    expect(() => uniqueArrayOf([])).to.throw(TypeError);
    expect(() => uniqueArrayOf({})).to.throw(TypeError);
    expect(() => uniqueArrayOf('')).to.throw(TypeError);
    expect(() => uniqueArrayOf(42)).to.throw(TypeError);
    expect(() => uniqueArrayOf(NaN)).to.throw(TypeError);
  });

  it('throws if given multiple mapping functions', () => {
    expect(() => uniqueArrayOf(() => {}, () => {}, () => {})).to.throw(TypeError);
  });

  it('throws if given multiple name strings', () => {
    expect(() => uniqueArrayOf(() => {}, 'test', 'test')).to.throw(TypeError);
  });

  it('throws if given more than 2 ...rest parameters', () => {
    expect(() => uniqueArrayOf(() => {}, 'test', 'test', 'test')).to.throw(TypeError);
  });

  it('throws if ordering of [String, Function]', () => {
    expect(() => uniqueArrayOf(() => {}, 'test', arrayMapper)).to.throw(TypeError);
  });

  it('throws if non string or function input', () => {
    expect(() => uniqueArrayOf(() => {}, 4)).to.throw(TypeError);
  });

  it('returns a function', () => {
    expect(typeof uniqueArrayOf(() => {})).to.equal('function');
  });

  it('requires an array', () => assertFails(
    uniqueArrayOf(() => {}),
    (<div foo="bar" />),
    'foo',
  ));

  it('is not required by default', () => assertPasses(
    uniqueArrayOf(() => {}),
    (<div foo="bar" />),
    'missing',
  ));

  it('is required with .isRequired', () => assertFails(
    uniqueArrayOf(() => {}).isRequired,
    (<div foo="bar" />),
    'missing',
  ));

  it('allows custom name', () => assertPasses(
    uniqueArrayOf(() => {}, 'test').isRequired,
    (<div foo={[1]} />),
    'foo',
  ));

  it('enforces the provided validator', () => {
    assertFails(
      uniqueArrayOf(number),
      (<div foo={[1, 2, '3', 4]} />),
      'foo',
    );
    assertPasses(
      uniqueArrayOf(number),
      (<div foo={[1, 2, 3, 4]} />),
      'foo',
    );
  });

  it('enforces uniqueness', () => {
    assertFails(
      uniqueArrayOf(number),
      (<div foo={[3, 1, 2, 3, 4]} />),
      'foo',
    );
    assertPasses(
      uniqueArrayOf(number),
      (<div foo={[1, 2, 3, 4]} />),
      'foo',
    );
  });

  it('enforces uniqueness of objects too', () => {
    const arr = [1];

    assertFails(
      uniqueArrayOf(array),
      (<div foo={[[1], arr, arr]} />),
      'foo',
    );
    assertPasses(
      uniqueArrayOf(array),
      (<div foo={[[1], arr, [1]]} />),
      'foo',
    );
  });

  describe('with mapper function', () => {
    it('requires an array', () => assertFails(
      uniqueArrayOf(() => {}, identityMapper),
      (<div foo="bar" />),
      'foo',
    ));

    it('is not required by default', () => assertPasses(
      uniqueArrayOf(() => {}, identityMapper),
      (<div foo={[1, 2]} />),
      'missing',
    ));

    it('is required with .isRequired', () => {
      assertFails(
        uniqueArrayOf(() => {}, identityMapper).isRequired,
        (<div foo="bar" />),
        'missing',
      );
      assertPasses(
        uniqueArrayOf(() => {}, identityMapper).isRequired,
        (<div foo={[1, 2, 3, 4]} />),
        'foo',
      );
    });

    it('enforces the provided validator', () => {
      assertFails(
        uniqueArrayOf(number, identityMapper),
        (<div foo={[1, 2, '3', 4]} />),
        'foo',
      );
      assertPasses(
        uniqueArrayOf(number, identityMapper),
        (<div foo={[1, 2, 3, 4]} />),
        'foo',
      );
    });

    it('enforces uniqueness', () => {
      assertFails(
        uniqueArrayOf(number, identityMapper),
        (<div foo={[3, 1, 2, 3, 4]} />),
        'foo',
      );
      assertPasses(
        uniqueArrayOf(number, identityMapper),
        (<div foo={[1, 2, 3, 4]} />),
        'foo',
      );
      assertFails(
        uniqueArrayOf(number, constantMapper),
        (<div foo={[1, 2, 3, 4]} />),
        'foo',
      );
    });

    it('enforces uniqueness of objects too', () => {
      assertFails(
        uniqueArrayOf(array, arrayMapper),
        (<div foo={[[1, 2], [1, 3]]} />),
        'foo',
      );
      assertFails(
        uniqueArrayOf(array, arrayMapper),
        (<div foo={[[1, 2], [1, 3]]} />),
        'foo',
      );
      assertPasses(
        uniqueArrayOf(array, arrayMapper),
        (<div foo={[[1, 2], [2, 2]]} />),
        'foo',
      );
      assertPasses(
        uniqueArrayOf(array, arrayMapper),
        (<div foo={[[1, 2], [2, 2]]} />),
        'foo',
      );
    });
  });

  describe('with mapper function and name', () => {
    it('enforces uniqueness of objects too', () => {
      assertFails(
        uniqueArrayOf(array, arrayMapper, 'test'),
        (<div foo={[[1, 2], [1, 3]]} />),
        'foo',
      );
      assertPasses(
        uniqueArrayOf(array, arrayMapper, 'test'),
        (<div foo={[[1, 2], [2, 2]]} />),
        'foo',
      );
    });
  });
});
