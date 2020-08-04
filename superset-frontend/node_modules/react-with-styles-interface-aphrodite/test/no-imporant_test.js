import { expect } from 'chai';
import React from 'react';
import { css, StyleSheetServer, StyleSheetTestUtils } from 'aphrodite/no-important';
import ReactDOMServer from 'react-dom/server';
import aphroditeInterface from '../src/no-important';

describe('no-important', () => {
  beforeEach(() => {
    StyleSheetTestUtils.suppressStyleInjection();
  });

  afterEach(() => {
    StyleSheetTestUtils.clearBufferAndResumeStyleInjection();
  });

  it('is an interface', () => {
    expect(typeof aphroditeInterface.create).to.equal('function');
    expect(typeof aphroditeInterface.resolve).to.equal('function');
  });

  it('does not use !important', () => {
    const styles = aphroditeInterface.create({
      foo: {
        color: 'red',
      },
    });
    const result = StyleSheetServer.renderStatic(() => (
      ReactDOMServer.renderToString(React.createElement('div', { className: css(styles.foo) }))
    ));
    expect(result.css.content.includes('!important')).to.equal(false);
  });
});
