import { expect } from 'chai';
import React from 'react';

import { range } from '..';

import callValidator from './_callValidator';

describe('range', () => {
  it('returns a function', () => {
    expect(typeof range(0, 1)).to.equal('function');
  });

  it('throws with invalid lengths', () => {
    expect(() => range(NaN, 2)).to.throw(RangeError);
    expect(() => range(2, NaN)).to.throw(RangeError);
    expect(() => range(Infinity, 2)).to.throw(RangeError);
    expect(() => range(2, Infinity)).to.throw(RangeError);
    expect(() => range(-Infinity, 2)).to.throw(RangeError);
    expect(() => range(2, -Infinity)).to.throw(RangeError);
    expect(() => range(0.5, 2)).to.throw(RangeError);
    expect(() => range(2, 0.5)).to.throw(RangeError);
  });

  it('throws when the min/max are the same', () => {
    expect(() => range(2, 2)).to.throw(RangeError);
  });

  function assertPasses(validator, element, propName) {
    expect(callValidator(validator, element, propName, '"range" test')).to.equal(null);
  }

  function assertFails(validator, element, propName) {
    expect(callValidator(validator, element, propName, '"range" test')).to.be.instanceOf(Error);
  }

  it('passes when inside the range', () => {
    assertPasses(range(-1, 2), (<div a={-1} />), 'a');
    assertPasses(range(-1, 2), (<div a={-0} />), 'a');
    assertPasses(range(-1, 2), (<div a={0} />), 'a');
    assertPasses(range(-1, 2), (<div a={1} />), 'a');
  });

  it('fails when outside the range', () => {
    assertFails(range(-1, 2), (<div a={2} />), 'a');
    assertFails(range(-1, 2), (<div a={-2} />), 'a');
    assertFails(range(-1, 2), (<div a={1.5} />), 'a');
    assertFails(range(-1, 2), (<div a={-0.5} />), 'a');
  });
});
