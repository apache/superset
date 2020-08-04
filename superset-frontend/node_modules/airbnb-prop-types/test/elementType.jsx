import { expect } from 'chai';
import React from 'react';

import { elementType } from '..';

import callValidator from './_callValidator';

function SFC() {}
class Component extends React.Component {} // eslint-disable-line react/prefer-stateless-function

describe('elementType', () => {
  it('returns a function', () => {
    expect(typeof elementType('')).to.equal('function');
  });

  it('throws on an invalid type', () => {
    expect(() => elementType()).to.throw(TypeError);
    expect(() => elementType(null)).to.throw(TypeError);
    expect(() => elementType(undefined)).to.throw(TypeError);
    expect(() => elementType(42)).to.throw(TypeError);
    expect(() => elementType(true)).to.throw(TypeError);
    expect(() => elementType([])).to.throw(TypeError);
    expect(() => elementType({})).to.throw(TypeError);
  });

  function assertPasses(validator, element, propName, componentName) {
    expect(callValidator(validator, element, propName, componentName)).to.equal(null);
  }

  function assertFails(validator, element, propName, componentName) {
    expect(callValidator(validator, element, propName, componentName)).to.be.instanceOf(Error);
  }

  describe('a single child', () => {
    it('passes with a DOM element', () => assertPasses(
      elementType('span'),
      (<div><span /></div>),
      'children',
      'span!',
    ));

    it('passes with an SFC', () => assertPasses(
      elementType(SFC),
      (<div><SFC default="Foo" /></div>),
      'children',
      'SFC!',
    ));

    it('passes with a Component', () => assertPasses(
      elementType(Component),
      (<div><Component default="Foo" /></div>),
      'children',
      'Component!',
    ));

    it('fails expecting a DOM element', () => assertFails(
      elementType('span'),
      (<div><section>No way.</section></div>),
      'children',
      'span!',
    ));

    it('fails expecting an SFC', () => assertFails(
      elementType(SFC),
      (<div><section>No way.</section></div>),
      'children',
      'SFC!',
    ));

    it('fails expecting a Component', () => assertFails(
      elementType(Component),
      (<div><section>No way.</section></div>),
      'children',
      'Component!',
    ));
  });

  describe('a prop', () => {
    it('passes expecting a DOM element', () => assertPasses(
      elementType('span'),
      (<div a={<span />} />),
      'a',
      'span!',
    ));

    it('passes expecting an SFC', () => assertPasses(
      elementType(SFC),
      (<div a={<SFC />} />),
      'a',
      'SFC!',
    ));

    it('passes expecting a Component', () => assertPasses(
      elementType(Component),
      (<div a={<Component />} />),
      'a',
      'Component!',
    ));

    it('fails expecting a DOM element', () => assertFails(
      elementType('span'),
      (<div a={<section>No way.</section>} />),
      'a',
      'span!',
    ));

    it('fails expecting an SFC', () => assertFails(
      elementType(SFC),
      (<div a={<section>No way.</section>} />),
      'a',
      'SFC!',
    ));

    it('fails expecting a Component', () => assertFails(
      elementType(Component),
      (<div a={<section>No way.</section>} />),
      'a',
      'Component!',
    ));
  });

  describe('*', () => {
    it('allows a DOM element as a child', () => assertPasses(
      elementType('*'),
      (<div><span /></div>),
      'children',
      'span!',
    ));

    it('allows a DOM element as a prop', () => assertPasses(
      elementType('*'),
      (<div a={<span />} />),
      'a',
      'span!',
    ));

    it('allows a Component as a child', () => assertPasses(
      elementType('*'),
      (<div><Component /></div>),
      'children',
      'Component!',
    ));

    it('allows a Component as a prop', () => assertPasses(
      elementType('*'),
      (<div a={<Component />} />),
      'a',
      'Component!',
    ));

    it('allows an SFC as a child', () => assertPasses(
      elementType('*'),
      (<div><SFC /></div>),
      'children',
      'SFC!',
    ));

    it('allows an SFC as a prop', () => assertPasses(
      elementType('*'),
      (<div a={<SFC />} />),
      'a',
      'SFC!',
    ));

    describe('with a nonelement child', () => {
      it('fails with a string', () => assertFails(
        elementType('*'),
        (<div>foo</div>),
        'children',
        'string',
      ));

      it('fails with a number', () => assertFails(
        elementType('*'),
        (<div>{3}</div>),
        'children',
        'number',
      ));

      it('fails with true', () => assertFails(
        elementType('*'),
        (<div>{true}</div>),
        'children',
        'true',
      ));

      it('fails with false', () => assertFails(
        elementType('*'),
        (<div>{false}</div>),
        'children',
        'false',
      ));

      it('fails with an array', () => assertFails(
        elementType('*'),
        (<div>{[]}</div>),
        'children',
        'array',
      ));
    });

    describe('with a nonelement prop', () => {
      it('passes with undefined', () => assertPasses(
        elementType('*'),
        (<div a={undefined} />),
        'a',
        'undefined',
      ));

      it('fails with undefined when required', () => assertFails(
        elementType('*').isRequired,
        (<div a={undefined} />),
        'a',
        'undefined required',
      ));

      it('passes with null', () => {
        assertPasses(
          elementType('*'),
          (<div a={null} />),
          'a',
          'null *',
        );
        assertPasses(
          elementType('span'),
          (<div a={null} />),
          'a',
          'null span',
        );
      });

      it('fails with null when required', () => {
        assertFails(
          elementType('*').isRequired,
          (<div a={null} />),
          'a',
          'null required *',
        );
        assertFails(
          elementType('span').isRequired,
          (<div a={null} />),
          'a',
          'null required span',
        );
      });

      it('fails with a string', () => assertFails(
        elementType('*'),
        (<div a="foo" />),
        'a',
        'string',
      ));

      it('fails with a number', () => assertFails(
        elementType('*'),
        (<div a={3} />),
        'a',
        'number',
      ));

      it('fails with true', () => assertFails(
        elementType('*'),
        (<div a />),
        'a',
        'true',
      ));

      it('fails with false', () => assertFails(
        elementType('*'),
        (<div a={false} />),
        'a',
        'false',
      ));

      it('fails with an array', () => assertFails(
        elementType('*'),
        (<div a={[]} />),
        'a',
        'array',
      ));
    });

    (React.forwardRef ? describe : describe.skip)('React.forwardRef', () => {
      const MyForwardRef = React.forwardRef && React.forwardRef((props, ref) => <div ref={ref} />);

      it('passes with * and a forwardRef', () => assertPasses(
        elementType('*'),
        (<div a={<MyForwardRef />} />),
        'a',
        '* + forwardRef',
      ));

      it('passes with matching forwardRef', () => assertPasses(
        elementType(MyForwardRef),
        (<div a={<MyForwardRef />} />),
        'a',
        'forwardRef + forwardRef',
      ));

      it('fails with a string and a forwardRef', () => assertFails(
        elementType('div'),
        (<div a={<MyForwardRef />} />),
        'a',
        'div + forwardRef',
      ));
    });

    (React.createContext ? describe : describe.skip)('React.createContext', () => {
      const { Provider, Consumer } = React.createContext ? React.createContext('test') : {};

      it('passes with * and a Provider', () => assertPasses(
        elementType('*'),
        (<div a={<Provider />} />),
        'a',
        '* + Provider',
      ));

      it('passes with * and a Consumer', () => assertPasses(
        elementType('*'),
        (<div a={<Consumer />} />),
        'a',
        '* + Consumer',
      ));

      it('passes with matching Provider', () => assertPasses(
        elementType(Provider),
        (<div a={<Provider />} />),
        'a',
        'Provider + Provider',
      ));

      it('passes with matching Consumer', () => assertPasses(
        elementType(Consumer),
        (<div a={<Consumer />} />),
        'a',
        'Consumer + Consumer',
      ));

      it('fails with a string and a Provider', () => assertFails(
        elementType('div'),
        (<div a={<Provider />} />),
        'a',
        'div + Provider',
      ));

      it('fails with a string and a Consumer', () => assertFails(
        elementType('div'),
        (<div a={<Consumer />} />),
        'a',
        'div + Consumer',
      ));
    });
  });
});
