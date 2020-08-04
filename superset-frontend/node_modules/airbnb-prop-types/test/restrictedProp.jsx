import { expect } from 'chai';
import React from 'react';

import { restrictedProp } from '..';

import callValidator from './_callValidator';

describe('restrictedProp', () => {
  it('returns a function', () => {
    expect(typeof restrictedProp()).to.equal('function');
  });

  function assertPasses(validator, element, propName, location) {
    expect(callValidator(validator, element, propName, '"restrictedProp" test', location)).to.equal(null);
  }

  function assertFails(validator, element, propName, location) {
    expect(callValidator(validator, element, propName, '"restrictedProp" test', location)).to.be.instanceOf(Error);
  }

  it('passes on null/undefined', () => {
    assertPasses(restrictedProp(), (<div foo={null} />), 'foo', 'prop');
    assertPasses(restrictedProp(), (<div foo={undefined} />), 'foo', 'prop');
  });

  it('fails on any other value', () => {
    assertFails(restrictedProp(), (<div foo={false} />), 'foo', 'prop');
    assertFails(restrictedProp(), (<div foo />), 'foo', 'prop');
    assertFails(restrictedProp(), (<div foo={NaN} />), 'foo', 'prop');
    assertFails(restrictedProp(), (<div foo={[]} />), 'foo', 'prop');
    assertFails(restrictedProp(), (<div foo={{}} />), 'foo', 'prop');
    assertFails(restrictedProp(), (<div foo="" />), 'foo', 'prop');
    assertFails(restrictedProp(), (<div foo="foo" />), 'foo', 'prop');
    assertFails(restrictedProp(), (<div foo={() => {}} />), 'foo', 'prop');
    assertFails(restrictedProp(), (<div foo={/a/g} />), 'foo', 'prop');
  });

  it('allows for custom error message', () => {
    assertPasses(restrictedProp(() => new TypeError('Custom Error')), (<div />), 'foo', 'prop');
    assertPasses(restrictedProp(() => new TypeError('Custom Error')), (<div foo={undefined} />), 'foo', 'prop');
    assertPasses(restrictedProp(() => new TypeError('Custom Error')), (<div foo={null} />), 'foo', 'prop');

    assertFails(restrictedProp(() => new TypeError('Custom Error')), (<div foo="foo" />), 'foo', 'prop');
    const messageFunction = (props, propName, componentName, location) => `[custom message] The ${propName} ${location} on ${componentName} is not allowed.`;
    expect(callValidator(restrictedProp(messageFunction), (<div foo="foo" />), 'foo', '"restrictedProp" test', 'prop')).to.exist
      .and.be.instanceof(Error)
      .and.have.property('message', '[custom message] The foo prop on "restrictedProp" test is not allowed.');
  });
});
