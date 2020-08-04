import test from 'tape';
import React from 'react';
import ownKeys from 'reflect.ownkeys';

import exact from '../';

import callValidator from './helpers/callValidator';

function stringSort(a, b) {
  if (typeof a !== 'string') {
    return 1;
  }
  if (typeof b !== 'string') {
    return -1;
  }
  return b.localeCompare(a);
}

test('exact', (t) => {
  const [specialProperty] = ownKeys(exact({}));

  function assertPasses(tt, validator, element, propName, componentName) {
    tt.equal(callValidator(validator, element, propName, componentName), null);
  }

  function assertFails(tt, validator, element, propName, componentName) {
    tt.equal(callValidator(validator, element, propName, componentName) instanceof Error, true);
  }

  t.test('throws when the given propTypes is not an object', (st) => {
    st['throws'](() => exact(), TypeError);
    st['throws'](() => exact(undefined), TypeError);
    st['throws'](() => exact(null), TypeError);
    st['throws'](() => exact(''), TypeError);
    st['throws'](() => exact(42), TypeError);
    st['throws'](() => exact(true), TypeError);
    st['throws'](() => exact(false), TypeError);
    st['throws'](() => exact(() => {}), TypeError);
    st.end();
  });

  t.test('throws when the given propTypes has the magic property', (st) => {
    st['throws'](() => exact({ [specialProperty]: true }), TypeError);
    st.end();
  });

  t.test('returns an object', (st) => {
    st.equal(typeof exact({}), 'object');
    st.end();
  });

  t.test('adds one extra key', (st) => {
    const propTypes = { a: 1, b: 2, c: 3 };
    const result = exact(propTypes);
    const resultOwnKeys = ownKeys(result).sort(stringSort);
    const propTypesOwnKeys = ownKeys(propTypes).concat(specialProperty).sort(stringSort);
    st.deepEqual(resultOwnKeys, propTypesOwnKeys);
    st.end();
  });

  t.test('allows for merging of propTypes that have been processed', (st) => {
    st.doesNotThrow(() => exact(exact({})));
    st.end();
  });

  t.test('exact()', (st) => {
    const knownProp = 'a';

    function setup() {
      const Component = class Component extends React.Component {}; // eslint-disable-line no-shadow
      // eslint-disable-next-line react/no-unused-prop-types, react/require-default-props
      Component.propTypes = exact({ [knownProp]() {} });
      const validator = Component.propTypes[specialProperty];
      return { validator, Component };
    }

    st.test('adds a function', (s2t) => {
      const { validator } = setup();
      s2t.equal(typeof validator, 'function');
      s2t.end();
    });

    st.test('passes via normal propTypes when given no props', (s2t) => {
      const { Component } = setup();
      s2t.doesNotThrow(() => <Component />);
      s2t.end();
    });

    st.test('passes when given no props', (s2t) => {
      const { validator } = setup();
      assertPasses(s2t, validator, <div />, knownProp, 'Foo div');
      s2t.end();
    });

    st.test('passes via normal propTypes when given only known props', (s2t) => {
      const { Component } = setup();
      s2t.doesNotThrow(() => <Component {...{ [knownProp]: true }} />);
      s2t.end();
    });

    st.test('passes when given only known props', (s2t) => {
      const { validator } = setup();
      assertPasses(s2t, validator, <div {...{ [knownProp]: true }} />, knownProp, 'Foo div');
      s2t.end();
    });

    st.test('fails via normal propTypes', (s2t) => {
      const { Component } = setup();
      s2t['throws'](
        // eslint-disable-next-line no-unused-expressions
        () => <Component unknown {...{ [knownProp]: true }} />,
        EvalError,
      );
      s2t.end();
    });

    st.test('fails when given an unknown prop', (s2t) => {
      const { validator } = setup();
      assertFails(s2t, validator, <div unknown {...{ [knownProp]: true }} />, knownProp, 'Foo div');
      s2t.end();
    });
  });

  t.end();
});
