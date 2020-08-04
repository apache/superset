import { expect } from 'chai';
import React from 'react';

import { childrenOfType } from '..';

import callValidator from './_callValidator';

function SFC() {}
class Component extends React.Component {} // eslint-disable-line react/prefer-stateless-function

describe('childrenOfType', () => {
  it('throws when not given a type', () => {
    expect(() => childrenOfType()).to.throw(TypeError);
  });

  function assertPasses(validator, element, propName, componentName) {
    expect(callValidator(validator, element, propName, componentName)).to.equal(null);
  }

  function assertFails(validator, element, propName, componentName) {
    expect(callValidator(validator, element, propName, componentName)).to.be.instanceOf(Error);
  }

  describe('with no children', () => {
    it('passes when optional', () => {
      assertPasses(
        childrenOfType('span'),
        (<div />),
        'children',
        'empty',
      );
    });

    it('fails when required', () => {
      assertFails(
        childrenOfType('span').isRequired,
        (<div />),
        'children',
        'empty required',
      );
    });
  });

  describe('with a single child of the specified type', () => {
    it('passes with *', () => assertPasses(
      childrenOfType('*'),
      (<div><span /></div>),
      'children',
      '*!',
    ));

    it('passes with * when required', () => assertPasses(
      childrenOfType('*').isRequired,
      (<div><span /></div>),
      'children',
      '*! required',
    ));

    it('passes with a DOM element', () => assertPasses(
      childrenOfType('span'),
      (<div><span /></div>),
      'children',
      'span!',
    ));

    it('passes with a DOM element when required', () => assertPasses(
      childrenOfType('span').isRequired,
      (<div><span /></div>),
      'children',
      'span! required',
    ));

    it('passes with an SFC', () => assertPasses(
      childrenOfType(SFC),
      (<div><SFC default="Foo" /></div>),
      'children',
      'SFC!',
    ));

    it('passes with an SFC when required', () => assertPasses(
      childrenOfType(SFC).isRequired,
      (<div><SFC default="Foo" /></div>),
      'children',
      'SFC! required',
    ));

    it('passes with a Component', () => assertPasses(
      childrenOfType(Component),
      (<div><Component default="Foo" /></div>),
      'children',
      'Component!',
    ));

    it('passes with a Component when required', () => assertPasses(
      childrenOfType(Component).isRequired,
      (<div><Component default="Foo" /></div>),
      'children',
      'Component! required',
    ));
  });

  describe('with multiple children of the specified type', () => {
    it('passes with *', () => assertPasses(
      childrenOfType('*'),
      (
        <div>
          <span />
          <SFC />
          <Component />
        </div>
      ),
      'children',
      '*!',
    ));

    it('passes with * when required', () => assertPasses(
      childrenOfType('*').isRequired,
      (
        <div>
          <span />
          <SFC />
          <Component />
        </div>
      ),
      'children',
      '*! required',
    ));

    it('passes with a DOM element', () => assertPasses(
      childrenOfType('span'),
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

    it('passes with a DOM element when required', () => assertPasses(
      childrenOfType('span').isRequired,
      (
        <div>
          <span />
          <span />
          <span />
          <span />
        </div>
      ),
      'children',
      'span! required',
    ));

    it('passes with an SFC', () => assertPasses(
      childrenOfType(SFC),
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

    it('passes with an SFC when required', () => assertPasses(
      childrenOfType(SFC).isRequired,
      (
        <div>
          <SFC default="Foo" />
          <SFC default="Foo" />
          <SFC default="Foo" />
          <SFC default="Foo" />
        </div>
      ),
      'children',
      'SFC! required',
    ));

    it('passes with a Component', () => assertPasses(
      childrenOfType(Component),
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

    it('passes with a Component when required', () => assertPasses(
      childrenOfType(Component).isRequired,
      (
        <div>
          <Component default="Foo" />
          <Component default="Foo" />
          <Component default="Foo" />
          <Component default="Foo" />
        </div>
      ),
      'children',
      'Component! required',
    ));
  });

  describe('with children of the specified types passed as an array', () => {
    it('passes with *', () => assertPasses(
      childrenOfType('*').isRequired,
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
      '*!',
    ));

    it('passes with *', () => assertPasses(
      childrenOfType('*').isRequired,
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
      '*! required',
    ));

    it('passes with a DOM element', () => assertPasses(
      childrenOfType('span'),
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
      childrenOfType(SFC),
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
      childrenOfType(Component),
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

    it('passes with multiple types', () => assertPasses(
      childrenOfType(SFC, Component, 'span'),
      (
        <div>
          {[
            <span key="one" default="Foo" />,
            <Component key="two" default="Foo" />,
            <SFC key="three" default="Foo" />,
          ]}
        </div>
      ),
      'children',
      'all three',
    ));

    it('passes with multiple types when required', () => assertPasses(
      childrenOfType(SFC, Component, 'span').isRequired,
      (
        <div>
          {[
            <span key="one" default="Foo" />,
            <Component key="two" default="Foo" />,
            <SFC key="three" default="Foo" />,
          ]}
        </div>
      ),
      'children',
      'all three required',
    ));

    it('passes with multiple types including *', () => assertPasses(
      childrenOfType(SFC, '*'),
      (
        <div>
          {[
            <span key="one" default="Foo" />,
            <Component key="two" default="Foo" />,
            <SFC key="three" default="Foo" />,
            'text children',
          ]}
        </div>
      ),
      'children',
      'SFC and *',
    ));

    it('passes with multiple types including * when required', () => assertPasses(
      childrenOfType(SFC, '*').isRequired,
      (
        <div>
          {[
            <span key="one" default="Foo" />,
            <Component key="two" default="Foo" />,
            <SFC key="three" default="Foo" />,
            'text children',
          ]}
        </div>
      ),
      'children',
      'SFC and *',
    ));
  });

  describe('when an unspecified type is provided as a child', () => {
    it('fails expecting a DOM element', () => assertFails(
      childrenOfType('span'),
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
      childrenOfType(SFC),
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
      childrenOfType(Component),
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
