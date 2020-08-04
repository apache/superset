import { expect } from 'chai';
import React from 'react';

import { childrenHavePropXorChildren } from '..';

import callValidator from './_callValidator';

describe('childrenHavePropXorChildren', () => {
  it('returns a function', () => {
    expect(typeof childrenHavePropXorChildren('foo')).to.equal('function');
  });

  it('throws with an invalid prop name', () => {
    expect(() => childrenHavePropXorChildren()).to.throw(TypeError);
    expect(() => childrenHavePropXorChildren(null)).to.throw(TypeError);
    expect(() => childrenHavePropXorChildren({})).to.throw(TypeError);
    expect(() => childrenHavePropXorChildren([])).to.throw(TypeError);
    expect(() => childrenHavePropXorChildren(() => {})).to.throw(TypeError);
    expect(() => childrenHavePropXorChildren(/a/g)).to.throw(TypeError);
  });

  function assertPasses(validator, element, propName, componentName) {
    expect(callValidator(validator, element, propName, componentName)).to.equal(null);
  }

  function assertFails(validator, element, propName, componentName) {
    expect(callValidator(validator, element, propName, componentName)).to.be.an.instanceOf(Error);
  }

  describe('with a property', () => {
    const prop = 'foo';

    it('passes when all children have children', () => assertPasses(
      childrenHavePropXorChildren(prop),
      (
        <header>
          <div>a</div>
          <div>b</div>
          <div>c</div>
        </header>
      ),
      'abc',
      'ComponentName',
    ));

    it('passes when all children have neither the prop nor children', () => assertPasses(
      childrenHavePropXorChildren(prop),
      (
        <header>
          <div />
          <div />
          <div />
        </header>
      ),
      'abc',
      'ComponentName',
    ));

    it('passes when all children have the prop and no children', () => assertPasses(
      childrenHavePropXorChildren(prop),
      (
        <header>
          <div {...{ [prop]: 1 }} />
          <div {...{ [prop]: 2 }} />
        </header>
      ),
      'abc',
      'ComponentName',
    ));

    it('passes when falsy children are present and non-falsy children passes validator', () => assertPasses(
      childrenHavePropXorChildren(prop),
      (
        <header>
          <div />
          <div />
          {null}
          {false}
          {''}
        </header>
      ),
      'abc',
      'ComponentName',
    ));

    it('fails when there is a mix of children and no children', () => assertFails(
      childrenHavePropXorChildren(prop),
      (
        <header>
          <div />
          <div>b</div>
          <div />
        </header>
      ),
      'abc',
      'ComponentName',
    ));

    it('fails when there is a mix of children and the prop', () => assertFails(
      childrenHavePropXorChildren(prop),
      (
        <header>
          <div>b</div>
          <div {...{ [prop]: true }} />
        </header>
      ),
      'abc',
      'ComponentName',
    ));

    it('fails when there is a mix of no prop and the prop', () => assertFails(
      childrenHavePropXorChildren(prop),
      (
        <header>
          <div />
          <div {...{ [prop]: true }} />
        </header>
      ),
      'abc',
      'ComponentName',
    ));

    it('fails when falsy children are present and non-falsy children fails validator', () => assertFails(
      childrenHavePropXorChildren(prop),
      (
        <header>
          <div />
          <div {...{ [prop]: true }} />
          {null}
          {false}
          {''}
        </header>
      ),
      'abc',
      'ComponentName',
    ));
  });
});
