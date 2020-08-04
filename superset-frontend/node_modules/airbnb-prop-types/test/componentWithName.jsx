/* eslint
  react/no-multi-comp: 0,
  react/prefer-stateless-function: 0
*/

import React from 'react';
import { expect } from 'chai';

import { componentWithName } from '..';

import callValidator from './_callValidator';

function SFC() {}

function SFCwithName() {}
SFCwithName.displayName = 'SFC with a display name!';

class Component extends React.Component {}

class ComponentWithName extends React.Component {}
ComponentWithName.displayName = 'Component with a display name!';

class ComponentWithHOCs extends React.Component {}
ComponentWithHOCs.displayName = 'withA(withB(withC(Connect(X))))';

const describeIfForwardRefs = React.forwardRef ? describe : describe.skip;

describe('componentWithName', () => {
  it('returns a function', () => {
    expect(typeof componentWithName('name')).to.equal('function');
  });

  it('throws when not given a string or a regex', () => {
    expect(() => componentWithName()).to.throw(TypeError);
    expect(() => componentWithName(null)).to.throw(TypeError);
    expect(() => componentWithName(undefined)).to.throw(TypeError);
    expect(() => componentWithName(true)).to.throw(TypeError);
    expect(() => componentWithName(false)).to.throw(TypeError);
    expect(() => componentWithName(42)).to.throw(TypeError);
    expect(() => componentWithName(NaN)).to.throw(TypeError);
    expect(() => componentWithName([])).to.throw(TypeError);
    expect(() => componentWithName({})).to.throw(TypeError);
  });

  it('throws when given unknown options', () => {
    expect(() => componentWithName('Foo', {})).not.to.throw();
    expect(() => componentWithName('Foo', { stripHOCS: 'typo in the last "s"' })).to.throw(TypeError);
    expect(() => componentWithName('Foo', { stripHOCs: [], extra: true })).to.throw(TypeError);
  });

  it('throws when given names of HOCs to strip that are not strings', () => {
    const notStrings = [null, undefined, true, false, 42, NaN, [], {}, () => {}];
    notStrings.forEach((notString) => {
      expect(() => componentWithName('Foo', { stripHOCs: [notString] })).to.throw(TypeError);
    });
  });

  it('throws when given names of HOCs to strip that have parens', () => {
    expect(() => componentWithName('Foo', { stripHOCs: ['with()Foo'] })).to.throw(TypeError);
  });

  it('throws when given names of HOCs to strip that are not in camelCase', () => {
    expect(() => componentWithName('Foo', { stripHOCs: ['with_foo'] })).to.throw(TypeError);
  });

  function assertPasses(validator, element, propName) {
    expect(callValidator(validator, element, propName)).to.equal(null);
  }

  function assertFails(validator, element, propName) {
    expect(callValidator(validator, element, propName)).to.be.instanceOf(Error);
  }

  describe('with a single child of the specified name', () => {
    it('passes with an SFC', () => assertPasses(
      componentWithName('SFC'),
      (<div><SFC default="Foo" /></div>),
      'children',
    ));

    it('passes with an SFC + displayName', () => assertPasses(
      componentWithName(SFCwithName.displayName),
      (<div><SFCwithName default="Foo" /></div>),
      'children',
    ));

    it('passes with a Component', () => assertPasses(
      componentWithName('Component'),
      (<div><Component default="Foo" /></div>),
      'children',
    ));

    it('passes with a Component + displayName', () => assertPasses(
      componentWithName(ComponentWithName.displayName),
      (<div><ComponentWithName default="Foo" /></div>),
      'children',
    ));

    it('passes with a component with HOCs', () => {
      assertPasses(
        componentWithName('X', { stripHOCs: ['withA', 'withB', 'withC', 'Connect'] }),
        (<div><ComponentWithHOCs default="Foo" /></div>),
        'children',
      );

      assertPasses(
        componentWithName('withC(Connect(X))', { stripHOCs: ['withA', 'withB'] }),
        (<div><ComponentWithHOCs default="Foo" /></div>),
        'children',
      );

      assertPasses(
        componentWithName('withB(withC(Connect(X)))', { stripHOCs: ['withA', 'withC'] }),
        (<div><ComponentWithHOCs default="Foo" /></div>),
        'children',
      );
    });
  });

  describe('with multiple children of the specified name', () => {
    it('passes with an SFC', () => assertPasses(
      componentWithName('SFC'),
      (
        <div>
          <SFC default="Foo" />
          <SFC default="Foo" />
          <SFC default="Foo" />
          <SFC default="Foo" />
        </div>
      ),
      'children',
    ));

    it('passes with an SFC + displayName', () => assertPasses(
      componentWithName(SFCwithName.displayName),
      (
        <div>
          <SFCwithName default="Foo" />
          <SFCwithName default="Foo" />
          <SFCwithName default="Foo" />
          <SFCwithName default="Foo" />
        </div>
      ),
      'children',
    ));

    it('passes with a Component', () => assertPasses(
      componentWithName('Component'),
      (
        <div>
          <Component default="Foo" />
          <Component default="Foo" />
          <Component default="Foo" />
          <Component default="Foo" />
        </div>
      ),
      'children',
    ));

    it('passes with a Component + displayName', () => assertPasses(
      componentWithName(ComponentWithName.displayName),
      (
        <div>
          <ComponentWithName default="Foo" />
          <ComponentWithName default="Foo" />
          <ComponentWithName default="Foo" />
          <ComponentWithName default="Foo" />
        </div>
      ),
      'children',
    ));

    it('passes with a component with HOCs', () => {
      assertPasses(
        componentWithName('X', { stripHOCs: ['withA', 'withB', 'withC', 'Connect'] }),
        (
          <div>
            <ComponentWithHOCs default="Foo" />
            <ComponentWithHOCs default="Foo" />
            <ComponentWithHOCs default="Foo" />
            <ComponentWithHOCs default="Foo" />
          </div>
        ),
        'children',
      );

      assertPasses(
        componentWithName('withC(Connect(X))', { stripHOCs: ['withA', 'withB'] }),
        (
          <div>
            <ComponentWithHOCs default="Foo" />
            <ComponentWithHOCs default="Foo" />
            <ComponentWithHOCs default="Foo" />
            <ComponentWithHOCs default="Foo" />
          </div>
        ),
        'children',
      );

      assertPasses(
        componentWithName('withB(withC(Connect(X)))', { stripHOCs: ['withA', 'withC'] }),
        (
          <div>
            <ComponentWithHOCs default="Foo" />
            <ComponentWithHOCs default="Foo" />
            <ComponentWithHOCs default="Foo" />
            <ComponentWithHOCs default="Foo" />
          </div>
        ),
        'children',
      );
    });
  });

  describe('with children of the specified names passed as an array', () => {
    it('passes with an SFC', () => assertPasses(
      componentWithName('SFC'),
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
    ));

    it('passes with an SFC + displayName', () => assertPasses(
      componentWithName(SFCwithName.displayName),
      (
        <div>
          {[
            <SFCwithName key="one" default="Foo" />,
            <SFCwithName key="two" default="Foo" />,
            <SFCwithName key="three" default="Foo" />,
          ]}
        </div>
      ),
      'children',
    ));

    it('passes with a Component', () => assertPasses(
      componentWithName('Component'),
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
    ));

    it('passes with a Component + displayName', () => assertPasses(
      componentWithName(ComponentWithName.displayName),
      (
        <div>
          {[
            <ComponentWithName key="one" default="Foo" />,
            <ComponentWithName key="two" default="Foo" />,
            <ComponentWithName key="three" default="Foo" />,
          ]}
        </div>
      ),
      'children',
    ));

    it('passes with a component with HOCs', () => {
      assertPasses(
        componentWithName('X', { stripHOCs: ['withA', 'withB', 'withC', 'Connect'] }),
        (
          <div>
            {[
              <ComponentWithHOCs key="one" default="Foo" />,
              <ComponentWithHOCs key="two" default="Foo" />,
              <ComponentWithHOCs key="three" default="Foo" />,
              <ComponentWithHOCs key="four" default="Foo" />,
            ]}
          </div>
        ),
        'children',
      );

      assertPasses(
        componentWithName('withC(Connect(X))', { stripHOCs: ['withA', 'withB'] }),
        (
          <div>
            {[
              <ComponentWithHOCs key="one" default="Foo" />,
              <ComponentWithHOCs key="two" default="Foo" />,
              <ComponentWithHOCs key="three" default="Foo" />,
              <ComponentWithHOCs key="four" default="Foo" />,
            ]}
          </div>
        ),
        'children',
      );

      assertPasses(
        componentWithName('withB(withC(Connect(X)))', { stripHOCs: ['withA', 'withC'] }),
        (
          <div>
            {[
              <ComponentWithHOCs key="one" default="Foo" />,
              <ComponentWithHOCs key="two" default="Foo" />,
              <ComponentWithHOCs key="three" default="Foo" />,
              <ComponentWithHOCs key="four" default="Foo" />,
            ]}
          </div>
        ),
        'children',
      );
    });
  });

  describe('when an unspecified name is provided as a child', () => {
    it('fails with an SFC', () => assertFails(
      componentWithName('SFC'),
      (
        <div>
          <SFC default="Foo" />
          <section>No way.</section>
        </div>
      ),
      'children',
    ));

    it('fails with an SFC + displayName', () => assertFails(
      componentWithName(SFCwithName.displayName),
      (
        <div>
          <SFCwithName default="Foo" />
          <section>No way.</section>
        </div>
      ),
      'children',
    ));

    it('fails with a Component', () => assertFails(
      componentWithName('Component'),
      (
        <div>
          <Component default="Foo" />
          <section>No way.</section>
        </div>
      ),
      'children',
    ));

    it('fails with a Component + displayName', () => assertFails(
      componentWithName(ComponentWithName.displayName),
      (
        <div>
          <ComponentWithName default="Foo" />
          <section>No way.</section>
        </div>
      ),
      'children',
    ));

    it('fails with a component with HOCs', () => {
      assertFails(
        componentWithName('X', { stripHOCs: ['withA', 'withB', 'withC', 'Connect'] }),
        (
          <div>
            <ComponentWithHOCs default="Foo" />
            <section>No way.</section>
          </div>
        ),
        'children',
      );

      assertFails(
        componentWithName('withC(Connect(X))', { stripHOCs: ['withA', 'withB'] }),
        (
          <div>
            <ComponentWithHOCs default="Foo" />
            <section>No way.</section>
          </div>
        ),
        'children',
      );

      assertFails(
        componentWithName('withB(withC(Connect(X)))', { stripHOCs: ['withA', 'withC'] }),
        (
          <div>
            <ComponentWithHOCs default="Foo" />
            <section>No way.</section>
          </div>
        ),
        'children',
      );
    });
  });

  describe('when a regex value is provided instead of a string', () => {
    it('passes with an SFC', () => assertPasses(
      componentWithName(/FC$/),
      (
        <div><SFC default="Foo" /></div>
      ),
      'children',
    ));

    it('passes with an SFC + displayName', () => assertPasses(
      componentWithName(/display name/),
      (
        <div><SFCwithName default="Foo" /></div>
      ),
      'children',
    ));

    it('passes with a Component', () => assertPasses(
      componentWithName(/^Comp/),
      (<div><Component default="Foo" /></div>),
      'children',
    ));

    it('passes with a Component + displayName', () => assertPasses(
      componentWithName(/display name/),
      (<div><ComponentWithName default="Foo" /></div>),
      'children',
    ));

    it('passes with a component with HOCs', () => {
      assertPasses(
        componentWithName(/^X$/, { stripHOCs: ['withA', 'withB', 'withC', 'Connect'] }),
        (<div><ComponentWithHOCs default="Foo" /></div>),
        'children',
      );

      assertPasses(
        componentWithName(/^withC\(Connect\(X\)\)$/, { stripHOCs: ['withA', 'withB'] }),
        (<div><ComponentWithHOCs default="Foo" /></div>),
        'children',
      );

      assertPasses(
        componentWithName(/^withB\(withC\(Connect\(X\)\)\)$/, { stripHOCs: ['withA', 'withC'] }),
        (<div><ComponentWithHOCs default="Foo" /></div>),
        'children',
      );
    });

    it('fails when SFC name does not match the regex provided', () => assertFails(
      componentWithName(/foobar/),
      (<div><SFC default="Foo" /></div>),
      'children',
    ));

    it('fails when Component name does not match the regex provided', () => assertFails(
      componentWithName(/foobar/),
      (<div><Component default="Foo" /></div>),
      'children',
    ));

    it('fails with a component with HOCs that does not match the regex', () => {
      assertFails(
        componentWithName(/^zX$/, { stripHOCs: ['withA', 'withB', 'withC'] }),
        (<div><ComponentWithHOCs default="Foo" /></div>),
        'children',
      );

      assertFails(
        componentWithName(/^zwithC\(X\)$/, { stripHOCs: ['withA', 'withB'] }),
        (<div><ComponentWithHOCs default="Foo" /></div>),
        'children',
      );

      assertFails(
        componentWithName(/^zwithB\(withC\(X\)\)$/, { stripHOCs: ['withA', 'withC'] }),
        (<div><ComponentWithHOCs default="Foo" /></div>),
        'children',
      );
    });
  });

  it('fails when the provided prop is not a component', () => assertFails(
    componentWithName('SFC'),
    (
      <div>
        Blah blah blah.
      </div>
    ),
    'children',
  ));

  it('passes when the prop is null', () => assertPasses(
    componentWithName('SFC'),
    (
      <div a={null} />
    ),
    'a',
  ));

  it('passes when the prop is absent', () => assertPasses(
    componentWithName('SFC'),
    (
      <div />
    ),
    'a',
  ));

  describe('when the prop is required', () => {
    it('fails when the prop is null', () => assertFails(
      componentWithName('SFC').isRequired,
      (<div a={null} />),
      'a',
    ));

    it('passes when the prop is the right component', () => assertPasses(
      componentWithName('SFC').isRequired,
      (<div a={<SFC />} />),
      'a',
    ));
  });

  describeIfForwardRefs('Forward Refs', () => {
    it('passes on a forward ref', () => {
      const Reffy = React.forwardRef(() => <main />);
      Reffy.displayName = 'Reffy Name';
      assertPasses(
        componentWithName('Reffy Name').isRequired,
        (<div a={<Reffy />} />),
        'a',
      );
    });
  });
});
