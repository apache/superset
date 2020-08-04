import { expect } from 'chai';
import { number } from 'prop-types';
import React from 'react';

import { nChildren, childrenOfType } from '..';

import callValidator from './_callValidator';

describe('nChildren', () => {
  it('throws when not given a positive number', () => {
    expect(() => nChildren()).to.throw(TypeError);
    expect(() => nChildren(null)).to.throw(TypeError);
    expect(() => nChildren({})).to.throw(TypeError);
    expect(() => nChildren('1')).to.throw(TypeError);
    expect(() => nChildren([])).to.throw(TypeError);
    expect(() => nChildren(NaN)).to.throw(TypeError);
    expect(() => nChildren(-1)).to.throw(TypeError);
    expect(() => nChildren(-Infinity)).to.throw(TypeError);
  });

  it('returns a function', () => {
    expect(typeof nChildren(1)).to.equal('function');
  });

  function assertPasses(validator, element, propName) {
    expect(callValidator(validator, element, propName)).to.equal(null);
  }

  function assertFails(validator, element, propName) {
    expect(callValidator(validator, element, propName)).to.be.instanceOf(Error);
  }

  it('fails when run on a prop that is not "children"', () => {
    assertFails(nChildren(0), <div />, 'foo');
  });

  it('fails when the children are less than n', () => {
    const validator = nChildren(3);
    assertFails(validator, <div />, 'children');
    assertFails(validator, <div><i /></div>, 'children');
    assertFails(
      validator,
      <div>
        <i />
        <i />
      </div>,
      'children',
    );
  });

  it('passes when the children are equal to n', () => {
    const validator = nChildren(3);
    assertPasses(
      validator,
      <div>
        <i />
        <i />
        <i />
      </div>,
      'children',
    );
  });

  it('fails when the children are more than n', () => {
    const validator = nChildren(1);
    assertFails(
      validator,
      <div>
        <i />
        <i />
      </div>,
      'children',
    );
  });

  it('validates against the optionally provided propType', () => {
    assertFails(nChildren(1, number), <div><i /></div>, 'children');

    assertPasses(nChildren(1, childrenOfType('i')), <div><i /></div>, 'children');

    assertFails(nChildren(1, childrenOfType('span')), <div><i /></div>, 'children');
  });
});
