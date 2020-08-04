import { expect } from 'chai';
import { number, string } from 'prop-types';
import React from 'react';

import { sequenceOf } from '..';

import callValidator from './_callValidator';

describe('sequenceOf', () => {
  it('is a function', () => {
    expect(typeof sequenceOf).to.equal('function');
  });

  function assertPasses(validator, element, propName) {
    expect(callValidator(validator, element, propName, '"sequenceOf" passing test')).to.equal(null);
  }

  function assertFails(validator, element, propName) {
    expect(callValidator(validator, element, propName, '"sequenceOf" failing test')).to.be.instanceOf(Error);
  }

  it('throws if not given at least one specifier', () => {
    expect(() => sequenceOf()).to.throw(RangeError);
    expect(() => sequenceOf(undefined)).to.throw(TypeError);
    expect(() => sequenceOf(null)).to.throw(TypeError);
    expect(() => sequenceOf([])).to.throw(TypeError);
    expect(() => sequenceOf('')).to.throw(TypeError);
    expect(() => sequenceOf(42)).to.throw(TypeError);
    expect(() => sequenceOf(NaN)).to.throw(TypeError);
  });

  it('throws if given an invalid validator', () => {
    expect(() => sequenceOf({ validator: null })).to.throw(TypeError);
    expect(() => sequenceOf({ validator: undefined })).to.throw(TypeError);
    expect(() => sequenceOf({ validator: false })).to.throw(TypeError);
    expect(() => sequenceOf({ validator: [] })).to.throw(TypeError);
    expect(() => sequenceOf({ validator: {} })).to.throw(TypeError);
    expect(() => sequenceOf({ validator: '' })).to.throw(TypeError);
    expect(() => sequenceOf({ validator: 3 })).to.throw(TypeError);
  });

  it('throws given a non-positive-integer min or max', () => {
    const validator = number;

    expect(() => sequenceOf({ validator, min: -1 })).to.throw(TypeError);
    expect(() => sequenceOf({ validator, max: -1 })).to.throw(TypeError);

    expect(() => sequenceOf({ validator, min: -1.4 })).to.throw(TypeError);
    expect(() => sequenceOf({ validator, max: -1.4 })).to.throw(TypeError);

    expect(() => sequenceOf({ validator, min: NaN })).to.throw(TypeError);
    expect(() => sequenceOf({ validator, max: NaN })).to.throw(TypeError);

    expect(() => sequenceOf({ validator, min: Infinity })).to.throw(TypeError);
    expect(() => sequenceOf({ validator, max: Infinity })).to.throw(TypeError);

    expect(() => sequenceOf({ validator, min: -Infinity })).to.throw(TypeError);
    expect(() => sequenceOf({ validator, max: -Infinity })).to.throw(TypeError);
  });

  it('throws given inverted "min"/"max"', () => {
    const validator = number;

    expect(() => sequenceOf({ validator, min: 2, max: 1 })).to.throw(TypeError);
    expect(() => sequenceOf({ validator, max: 1, min: 2 })).to.throw(TypeError);

    expect(() => sequenceOf({ validator, min: 2, max: 0 })).to.throw(TypeError);
    expect(() => sequenceOf({ validator, max: 0, min: 2 })).to.throw(TypeError);

    expect(() => sequenceOf({ validator, min: 1, max: 0 })).to.throw(TypeError);
    expect(() => sequenceOf({ validator, max: 0, min: 1 })).to.throw(TypeError);

    expect(() => sequenceOf({ validator, max: 0 })).to.throw(TypeError); // "min" defaults to 1
  });

  it('returns a function', () => {
    expect(typeof sequenceOf({ validator: number })).to.equal('function');
  });

  it('passes with null/undefined when optional', () => {
    const validator = sequenceOf({ validator: number });

    assertPasses(validator, (<div />), 'a');
    assertPasses(validator, (<div a={null} />), 'a');
    assertPasses(validator, (<div a={undefined} />), 'a');
  });

  it('fails with null/undefined when required', () => {
    const validator = sequenceOf({ validator: number });

    assertFails(validator.isRequired, (<div />), 'a');
    assertFails(validator.isRequired, (<div a={null} />), 'a');
    assertFails(validator.isRequired, (<div a={undefined} />), 'a');
  });

  it('fails with non-arrays', () => {
    const validator = sequenceOf({ validator: number });

    assertFails(validator, (<div a={false} />), 'a');
    assertFails(validator, (<div a />), 'a');
    assertFails(validator, (<div a={42} />), 'a');
    assertFails(validator, (<div a="" />), 'a');
    assertFails(validator, (<div a={{}} />), 'a');
    assertFails(validator, (<div a={() => {}} />), 'a');
  });

  it('works with specifiers without "max"/"min"', () => {
    const validator = sequenceOf({ validator: number });

    assertPasses(validator, (<div a={[1]} />), 'a');
    assertPasses(validator, (<div a={[NaN]} />), 'a');
    assertPasses(validator, (<div a={[-0]} />), 'a');
    assertPasses(validator, (<div a={[Infinity]} />), 'a');

    assertFails(validator, (<div a={[1, 2, null, <span />, {}, () => {}]} />), 'a');
    assertFails(validator, (<div a={['1']} />), 'a');
    assertFails(validator, (<div a={['1', '2']} />), 'a');
  });

  it('works with specifiers only providing "min"', () => {
    const optional = sequenceOf({ validator: number, min: 0 });
    const twoPlus = sequenceOf({ validator: number, min: 2 });

    assertPasses(optional, (<div a={[]} />), 'a');
    assertFails(twoPlus, (<div a={[]} />), 'a');
    assertFails(twoPlus, (<div a={[1]} />), 'a');
    assertPasses(twoPlus, (<div a={[1, 2]} />), 'a');
    assertPasses(twoPlus, (<div a={[1, 2, 3]} />), 'a');

    assertFails(twoPlus, (<div a={['1']} />), 'a');
    assertFails(twoPlus, (<div a={['1', 2]} />), 'a');
    assertFails(twoPlus, (<div a={[1, '2', 3]} />), 'a');
  });

  it('works with specifiers only providing "max"', () => {
    const optional = sequenceOf({ validator: number, max: 1 });
    const twoOrLess = sequenceOf({ validator: number, max: 2 });

    assertFails(optional, (<div a={[]} />), 'a');
    assertFails(twoOrLess, (<div a={[]} />), 'a');

    assertPasses(twoOrLess, (<div a={[1]} />), 'a');
    assertPasses(twoOrLess, (<div a={[1, 2]} />), 'a');

    assertFails(twoOrLess, (<div a={[1, 2, 3]} />), 'a');
    assertFails(twoOrLess, (<div a={['1']} />), 'a');
    assertFails(twoOrLess, (<div a={['1', 2]} />), 'a');
    assertFails(twoOrLess, (<div a={[1, '2', 3]} />), 'a');
  });

  it('works with specifiers with both "min" and "max"', () => {
    const twoOrThree = sequenceOf({ validator: number, min: 2, max: 3 });
    const oneOrTwo = sequenceOf({ validator: number, max: 2, min: 1 });

    assertFails(twoOrThree, (<div a={[1]} />), 'a');
    assertPasses(twoOrThree, (<div a={[1, 2]} />), 'a');
    assertPasses(twoOrThree, (<div a={[1, 2, 3]} />), 'a');
    assertFails(twoOrThree, (<div a={[1, 2, 3, 4]} />), 'a');

    assertFails(oneOrTwo.isRequired, (<div a={[]} />), 'a');
    assertPasses(oneOrTwo, (<div a={[1]} />), 'a');
    assertPasses(oneOrTwo, (<div a={[1, 2]} />), 'a');
    assertFails(oneOrTwo, (<div a={[1, 2, 3]} />), 'a');
  });

  it('works with an optional unmet, and a required met, specifier', () => {
    const validator = sequenceOf(
      { validator: string, min: 0 },
      { validator: number },
    );

    assertPasses(validator, (<div a={['a', 1]} />), 'a');
    assertPasses(validator, (<div a={[1]} />), 'a');
    assertFails(validator, (<div a={['a']} />), 'a');
    assertFails(validator, (<div a={['a', 'b']} />), 'a');
    assertFails(validator, (<div a={[1, 2]} />), 'a');
  });
});
