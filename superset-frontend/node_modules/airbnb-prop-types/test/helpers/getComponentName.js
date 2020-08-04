import React from 'react';
import { expect } from 'chai';
import ifReact from 'enzyme-adapter-react-helper/build/ifReact';
import getComponentName from '../../build/helpers/getComponentName';

const itIfReact = (version, ...args) => ifReact(version, () => it(...args), () => it.skip(...args));

describe('getComponentName', () => {
  it('given a string, returns the string', () => {
    expect(getComponentName('foo')).to.equal('foo');
  });

  it('given a function, returns displayName or name', () => {
    function Foo() {}

    expect(getComponentName(Foo)).to.equal(Foo.name);

    Foo.displayName = 'Bar';
    expect(getComponentName(Foo)).to.equal(Foo.displayName);
  });

  itIfReact('>= 16.6', 'given a memo, returns the name or displayName', () => {
    function Foo() {}
    const FooMemo = React.memo(Foo);
    expect(getComponentName(FooMemo)).to.equal('Foo');

    Foo.displayName = 'Bar';
    const NamedFooMemo = React.memo(Foo);
    expect(getComponentName(NamedFooMemo)).to.equal('Bar');

    const AnonymousFoo = () => {};
    const AnonymousFooMemo = React.memo(AnonymousFoo);
    expect(getComponentName(AnonymousFooMemo)).to.equal('AnonymousFoo');
  });

  it('given anything else, returns null', () => {
    expect(getComponentName()).to.equal(null);
    expect(getComponentName(null)).to.equal(null);
    expect(getComponentName(undefined)).to.equal(null);
    expect(getComponentName([])).to.equal(null);
    expect(getComponentName({})).to.equal(null);
    expect(getComponentName(42)).to.equal(null);
    expect(getComponentName(true)).to.equal(null);
  });
});
