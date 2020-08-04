import { expect } from 'chai';
import { number, string } from 'prop-types';
import React from 'react';

import { childrenSequenceOf } from '..';

import callValidator from './_callValidator';

describe('childrenSequenceOf', () => {
  it('is a function', () => {
    expect(typeof childrenSequenceOf).to.equal('function');
  });

  function assertPasses(validator, element, propName) {
    const error = callValidator(validator, element, propName, '"childrenSequenceOf" passing test');
    expect(error).to.equal(null);
  }

  function assertFails(validator, element, propName) {
    const error = callValidator(validator, element, propName, '"childrenSequenceOf" failing test');
    expect(error).to.be.instanceOf(Error);
  }

  it('throws if not given at least one specifier', () => {
    expect(() => childrenSequenceOf()).to.throw(RangeError);
    expect(() => childrenSequenceOf(undefined)).to.throw(TypeError);
    expect(() => childrenSequenceOf(null)).to.throw(TypeError);
    expect(() => childrenSequenceOf([])).to.throw(TypeError);
    expect(() => childrenSequenceOf('')).to.throw(TypeError);
    expect(() => childrenSequenceOf(42)).to.throw(TypeError);
    expect(() => childrenSequenceOf(NaN)).to.throw(TypeError);
  });

  it('throws if given an invalid validator', () => {
    expect(() => childrenSequenceOf({ validator: null })).to.throw(TypeError);
    expect(() => childrenSequenceOf({ validator: undefined })).to.throw(TypeError);
    expect(() => childrenSequenceOf({ validator: false })).to.throw(TypeError);
    expect(() => childrenSequenceOf({ validator: [] })).to.throw(TypeError);
    expect(() => childrenSequenceOf({ validator: {} })).to.throw(TypeError);
    expect(() => childrenSequenceOf({ validator: '' })).to.throw(TypeError);
    expect(() => childrenSequenceOf({ validator: 3 })).to.throw(TypeError);
  });

  it('throws given a non-positive-integer min or max', () => {
    const validator = number;

    expect(() => childrenSequenceOf({ validator, min: -1 })).to.throw(TypeError);
    expect(() => childrenSequenceOf({ validator, max: -1 })).to.throw(TypeError);

    expect(() => childrenSequenceOf({ validator, min: -1.4 })).to.throw(TypeError);
    expect(() => childrenSequenceOf({ validator, max: -1.4 })).to.throw(TypeError);

    expect(() => childrenSequenceOf({ validator, min: NaN })).to.throw(TypeError);
    expect(() => childrenSequenceOf({ validator, max: NaN })).to.throw(TypeError);

    expect(() => childrenSequenceOf({ validator, min: Infinity })).to.throw(TypeError);
    expect(() => childrenSequenceOf({ validator, max: Infinity })).to.throw(TypeError);

    expect(() => childrenSequenceOf({ validator, min: -Infinity })).to.throw(TypeError);
    expect(() => childrenSequenceOf({ validator, max: -Infinity })).to.throw(TypeError);
  });

  it('throws given inverted "min"/"max"', () => {
    const validator = number;

    expect(() => childrenSequenceOf({ validator, min: 2, max: 1 })).to.throw(TypeError);
    expect(() => childrenSequenceOf({ validator, max: 1, min: 2 })).to.throw(TypeError);

    expect(() => childrenSequenceOf({ validator, min: 2, max: 0 })).to.throw(TypeError);
    expect(() => childrenSequenceOf({ validator, max: 0, min: 2 })).to.throw(TypeError);

    expect(() => childrenSequenceOf({ validator, min: 1, max: 0 })).to.throw(TypeError);
    expect(() => childrenSequenceOf({ validator, max: 0, min: 1 })).to.throw(TypeError);

    // "min" defaults to 1
    expect(() => childrenSequenceOf({ validator, max: 0 })).to.throw(TypeError);
  });

  it('returns a function', () => {
    expect(typeof childrenSequenceOf({ validator: number })).to.equal('function');
  });

  it('fails on a non-children prop', () => {
    const validator = childrenSequenceOf({ validator: number });
    assertFails(validator, (<div />), 'cousins');
    assertFails(validator.isRequired, (<div />), 'cousins');
  });

  it('passes with null/undefined when optional', () => {
    const validator = childrenSequenceOf({ validator: number });

    assertPasses(validator, (<div />), 'children');
    assertPasses(validator, (<div>{null}</div>), 'children');
    assertPasses(validator, (<div>{undefined}</div>), 'children');
  });

  it('fails with null/undefined when required', () => {
    const validator = childrenSequenceOf({ validator: number }).isRequired;

    assertFails(validator, (<div />), 'children');
    assertFails(validator, (<div>{null}</div>), 'children');
    assertFails(validator, (<div>{undefined}</div>), 'children');
  });

  it('works with specifiers without "max"/"min"', () => {
    const validator = childrenSequenceOf({ validator: number });

    assertPasses(validator, (<div>{1}</div>), 'children');
    assertPasses(validator.isRequired, (<div>{1}</div>), 'children');

    assertPasses(validator, (<div>{NaN}</div>), 'children');
    assertFails(validator.isRequired, (<div>{NaN}</div>), 'children');

    assertPasses(validator, (<div>{-0}</div>), 'children');
    assertPasses(validator.isRequired, (<div>{-0}</div>), 'children');

    assertPasses(validator, (<div>{Infinity}</div>), 'children');
    assertPasses(validator.isRequired, (<div>{Infinity}</div>), 'children');

    assertFails(validator, (
      <div>
        {1}
        {2}
        {null}
        <span />
        {() => {}}
      </div>
    ), 'children');
    assertFails(validator, (<div>1</div>), 'children');
    assertFails(
      validator,
      <div>
        1
        {2}
      </div>,
      'children',
    );
  });

  it('works with specifiers only providing "min"', () => {
    const optional = childrenSequenceOf({ validator: number, min: 0 });
    const twoPlus = childrenSequenceOf({ validator: number, min: 2 });

    assertPasses(optional, (<div />), 'children');
    assertFails(optional.isRequired, (<div />), 'children');

    assertPasses(twoPlus, (<div />), 'children');
    assertFails(twoPlus.isRequired, (<div />), 'children');

    assertFails(twoPlus, (<div>{1}</div>), 'children');
    assertPasses(
      twoPlus,
      <div>
        {1}
        {2}
      </div>,
      'children',
    );
    assertPasses(
      twoPlus,
      <div>
        {1}
        {2}
        {3}
      </div>,
      'children',
    );

    assertFails(twoPlus, (<div>1</div>), 'children');
    assertFails(
      twoPlus,
      <div>
        1
        {2}
      </div>,
      'children',
    );
    assertFails(
      twoPlus,
      <div>
        {1}
        2
        {3}
      </div>,
      'children',
    );
  });

  it('works with specifiers only providing "max"', () => {
    const optional = childrenSequenceOf({ validator: number, max: 1 });
    const twoOrLess = childrenSequenceOf({ validator: number, max: 2 });

    assertPasses(optional, (<div />), 'children');
    assertFails(optional.isRequired, (<div />), 'children');
    assertPasses(twoOrLess, (<div />), 'children');
    assertFails(twoOrLess.isRequired, (<div />), 'children');

    assertPasses(twoOrLess, (<div>{1}</div>), 'children');
    assertPasses(
      twoOrLess,
      <div>
        {1}
        {2}
      </div>,
      'children',
    );

    assertFails(
      twoOrLess,
      <div>
        {1}
        {2}
        {3}
      </div>,
      'children',
    );
    assertFails(twoOrLess, (<div>1</div>), 'children');
    assertFails(
      twoOrLess,
      <div>
        1
        {2}
      </div>,
      'children',
    );
    assertFails(
      twoOrLess,
      <div>
        {1}
        2
        {3}
      </div>,
      'children',
    );
  });

  it('works with specifiers with both "min" and "max"', () => {
    const twoOrThree = childrenSequenceOf({ validator: number, min: 2, max: 3 });
    const oneOrTwo = childrenSequenceOf({ validator: number, max: 2, min: 1 });

    assertFails(twoOrThree, (<div>{1}</div>), 'children');
    assertPasses(
      twoOrThree,
      <div>
        {1}
        {2}
      </div>,
      'children',
    );
    assertPasses(
      twoOrThree,
      <div>
        {1}
        {2}
        {3}
      </div>,
      'children',
    );
    assertFails(
      twoOrThree,
      <div>
        {1}
        {2}
        {3}
        {4}
      </div>,
      'children',
    );

    assertFails(oneOrTwo.isRequired, (<div />), 'children');
    assertPasses(oneOrTwo, (<div>{1}</div>), 'children');
    assertPasses(
      oneOrTwo,
      <div>
        {1}
        {2}
      </div>,
      'children',
    );
    assertFails(
      oneOrTwo,
      <div>
        {1}
        {2}
        {3}
      </div>,
      'children',
    );
  });

  it('works with an optional unmet, and a required met, specifier', () => {
    const validator = childrenSequenceOf(
      { validator: string, min: 0 },
      { validator: number },
    );

    assertPasses(
      validator,
      <div>
        a
        {1}
      </div>,
      'children',
    );
    assertPasses(validator, (<div>{1}</div>), 'children');
    assertFails(validator, (<div>a</div>), 'children');
    assertFails(
      validator,
      <div>
        a
        {'b'}
      </div>,
      'children',
    );
    assertFails(
      validator,
      <div>
        {1}
        {2}
      </div>,
      'children',
    );
  });
});
