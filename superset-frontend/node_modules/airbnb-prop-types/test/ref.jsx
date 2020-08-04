import { expect } from 'chai';
import React from 'react';
import ifReact from 'enzyme-adapter-react-helper/build/ifReact';

import { ref } from '..';

import callValidator from './_callValidator';

const itIfReact = (version, ...args) => ifReact(version, () => it(...args), () => it.skip(...args));

describe('ref', () => {
  it('is a function', () => {
    expect(typeof ref).to.equal('function');
  });

  function assertPasses(validator, element, propName) {
    expect(callValidator(validator, element, propName, '"ref" test')).to.equal(null);
  }

  function assertFails(validator, element, propName) {
    expect(callValidator(validator, element, propName, '"ref" test')).to.be.instanceOf(Error);
  }

  describe('not required', () => {
    const validator = ref();

    it('passes on null or undefined', () => {
      assertPasses(validator, <div someRef={undefined} />, 'someRef');
      assertPasses(validator, <div someRef={null} />, 'someRef');
    });

    it('passes when not present', () => {
      assertPasses(validator, <div />, 'someRef');
    });

    it('passes with callback refs', () => {
      assertPasses(validator, <div someRef={() => {}} />, 'someRef');
    });

    itIfReact('>= 16.3', 'passes with ref objects', () => {
      assertPasses(validator, <div someRef={React.createRef()} />, 'someRef');
    });

    it('fails with React components', () => {
      class A extends React.Component {
        constructor(props) {} // eslint-disable-line
      }
      assertFails(validator, <div someRef={A} />, 'someRef');
    });

    itIfReact('>= 15.2', 'fails with React pure components', () => {
      class B extends React.PureComponent {
        constructor(props) {} // eslint-disable-line
      }
      assertFails(validator, <div someRef={B} />, 'someRef');
    });

    it('fails with other non-refs', () => {
      assertFails(validator, <div someRef={666} />, 'someRef');
    });
  });

  describe('required', () => {
    const validator = ref().isRequired;

    it('fails on null or undefined', () => {
      assertFails(validator, <div someRef={undefined} />, 'someRef');
      assertFails(validator, <div someRef={null} />, 'someRef');
    });

    it('fails when not present', () => {
      assertFails(validator, <div />, 'someRef');
    });

    it('passes with callback refs', () => {
      assertPasses(validator, <div someRef={() => {}} />, 'someRef');
    });

    itIfReact('>= 16.3', 'passes with ref objects', () => {
      assertPasses(validator, <div someRef={React.createRef()} />, 'someRef');
    });

    it('fails with React components', () => {
      class A extends React.Component {
        constructor(props) {} // eslint-disable-line
      }
      assertFails(validator, <div someRef={A} />, 'someRef');
    });

    itIfReact('>= 15.2', 'fails with React pure components', () => {
      class B extends React.PureComponent {
        constructor(props) {} // eslint-disable-line
      }
      assertFails(validator, <div someRef={B} />, 'someRef');
    });

    it('fails with other non-refs', () => {
      assertFails(validator, <div someRef={666} />, 'someRef');
    });
  });
});
