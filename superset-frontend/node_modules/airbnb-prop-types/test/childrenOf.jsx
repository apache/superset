import { expect } from 'chai';
import { node, number, string } from 'prop-types';
import React from 'react';

import { childrenOf, elementType, or } from '..';

import callValidator from './_callValidator';

function SFC() {}
class Component extends React.Component {} // eslint-disable-line react/prefer-stateless-function

describe('childrenOf', () => {
  function assertPasses(validator, element, propName, componentName) {
    expect(callValidator(validator, element, propName, componentName)).to.equal(null);
  }

  function assertFails(validator, element, propName, componentName) {
    expect(callValidator(validator, element, propName, componentName)).to.be.instanceOf(Error);
  }

  it('fails on a non-children prop', () => {
    const validator = childrenOf(node);

    assertFails(
      validator,
      (<div />),
      'foo',
      'non-children optional',
    );

    assertFails(
      validator.isRequired,
      (<div />),
      'foo',
      'non-children optional',
    );
  });

  describe('with no children', () => {
    it('passes when optional', () => {
      assertPasses(
        childrenOf(node),
        (<div />),
        'children',
        'optional empty',
      );


      assertPasses(
        childrenOf(node),
        (<div>{[]}</div>),
        'children',
        'optional empty array',
      );
    });

    it('fails when required', () => assertFails(
      childrenOf(node).isRequired,
      (<div />),
      'children',
      'optional empty',
    ));
  });

  describe('with non-element children', () => {
    it('passes with multiple numbers', () => assertPasses(
      childrenOf(number),
      (
        <div>
          {1}
          {2}
          {3}
        </div>
      ),
      'children',
      'numbers',
    ));

    it('passes with multiple numbers when required', () => assertPasses(
      childrenOf(number).isRequired,
      (
        <div>
          {1}
          {2}
          {3}
        </div>
      ),
      'children',
      'numbers',
    ));

    it('passes with multiple strings', () => assertPasses(
      childrenOf(string),
      (
        <div>
          a
          b
          c
        </div>
      ),
      'children',
      'strings',
    ));

    it('passes with multiple strings when required', () => assertPasses(
      childrenOf(string).isRequired,
      (
        <div>
          a
          b
          c
        </div>
      ),
      'children',
      'strings',
    ));

    it('passes with strings and numbers', () => assertPasses(
      childrenOf(or([string, number])),
      (
        <div>
          a
          b
          c
          {1}
          {2}
          {3}
        </div>
      ),
      'children',
      'strings + numbers',
    ));

    it('passes with strings and numbers when required', () => assertPasses(
      childrenOf(or([string, number])).isRequired,
      (
        <div>
          a
          b
          c
          {1}
          {2}
          {3}
        </div>
      ),
      'children',
      'strings + numbers',
    ));
  });

  describe('with a single child of the specified type', () => {
    it('passes with a DOM element', () => assertPasses(
      childrenOf(elementType('span')),
      (<div><span /></div>),
      'children',
      'span!',
    ));

    it('passes with an SFC', () => assertPasses(
      childrenOf(elementType(SFC)),
      (<div><SFC default="Foo" /></div>),
      'children',
      'SFC!',
    ));

    it('passes with a Component', () => assertPasses(
      childrenOf(elementType(Component)),
      (<div><Component default="Foo" /></div>),
      'children',
      'Component!',
    ));
  });

  describe('with multiple children of the specified type', () => {
    it('passes with a DOM element', () => assertPasses(
      childrenOf(elementType('span')),
      (
        <div>
          <span />
          <span />
          <span />
          <span />
        </div>
      ),
      'children',
      'span!',
    ));

    it('passes with an SFC', () => assertPasses(
      childrenOf(elementType(SFC)),
      (
        <div>
          <SFC default="Foo" />
          <SFC default="Foo" />
          <SFC default="Foo" />
          <SFC default="Foo" />
        </div>
      ),
      'children',
      'SFC!',
    ));

    it('passes with a Component', () => assertPasses(
      childrenOf(elementType(Component)),
      (
        <div>
          <Component default="Foo" />
          <Component default="Foo" />
          <Component default="Foo" />
          <Component default="Foo" />
        </div>
      ),
      'children',
      'Component!',
    ));
  });

  describe('with children of the specified types passed as an array', () => {
    it('passes with a DOM element', () => assertPasses(
      childrenOf(elementType('span')),
      (
        <div>
          {[
            <span key="one" />,
            <span key="two" />,
            <span key="three" />,
          ]}
        </div>
      ),
      'children',
      'span!',
    ));

    it('passes with an SFC', () => assertPasses(
      childrenOf(elementType(SFC)),
      (
        <div>
          {[
            <SFC key="one" default="Foo" />,
            <SFC key="two" default="Foo" />,
            <SFC key="three" default="Foo" />,
          ]}
        </div>
      ),
      'children',
      'SFC!',
    ));

    it('passes with a Component', () => assertPasses(
      childrenOf(elementType(Component)),
      (
        <div>
          {[
            <Component key="one" default="Foo" />,
            <Component key="two" default="Foo" />,
            <Component key="three" default="Foo" />,
          ]}
        </div>
      ),
      'children',
      'Component!',
    ));
  });

  describe('when an unspecified type is provided as a child', () => {
    it('fails expecting a DOM element', () => assertFails(
      childrenOf(elementType('span')),
      (
        <div>
          <span />
          <section>No way.</section>
        </div>
      ),
      'children',
      'span!',
    ));

    it('fails expecting an SFC', () => assertFails(
      childrenOf(elementType(SFC)),
      (
        <div>
          <SFC default="Foo" />
          <section>No way.</section>
        </div>
      ),
      'children',
      'SFC!',
    ));

    it('fails expecting a Component', () => assertFails(
      childrenOf(elementType(Component)),
      (
        <div>
          <Component default="Foo" />
          <section>No way.</section>
        </div>
      ),
      'children',
      'Component!',
    ));
  });
});
