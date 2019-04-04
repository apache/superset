import React from 'react';
import PropTypes from 'prop-types';
import { expect } from 'chai';
import { shallow } from 'enzyme';
import deepmerge from 'deepmerge';
import sinon from 'sinon-sandbox';

import ThemedStyleSheet from '../src/ThemedStyleSheet';
import { css, withStyles } from '../src/withStyles';

describe('withStyles()', () => {
  const defaultTheme = {
    color: {
      red: '#990000',
    },
  };

  let testInterface;

  beforeEach(() => {
    testInterface = {
      create() {},
      resolve() {},
      flush: sinon.spy(),
    };
    sinon.stub(testInterface, 'create', styleHash => styleHash);
    sinon.stub(testInterface, 'resolve', styles => ({
      style: styles.reduce((result, style) => Object.assign(result, style)),
    }));

    ThemedStyleSheet.registerDefaultTheme(defaultTheme);
    ThemedStyleSheet.registerInterface(testInterface);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('without a styleFn', () => {
    it('returns the HOC function', () => {
      expect(typeof withStyles()).to.equal('function');
    });

    it('does not create styles', () => {
      withStyles();
      expect(testInterface.create.callCount).to.equal(0);
    });
  });

  it('returns the HOC function', () => {
    expect(typeof withStyles(() => ({}))).to.equal('function');
  });

  it('creates the styles', () => {
    withStyles(() => ({}));
    expect(testInterface.create.callCount).to.equal(1);
  });

  describe('HOC', () => {
    it('has a wrapped displayName', () => {
      function MyComponent() {
        return null;
      }

      const result = withStyles(() => ({}))(MyComponent);
      expect(result.displayName).to.equal('withStyles(MyComponent)');
    });

    it('passes the theme to the wrapped component', () => {
      function MyComponent({ theme }) {
        expect(theme).to.eql(defaultTheme);
        return null;
      }

      const Wrapped = withStyles(() => ({}))(MyComponent);
      shallow(<Wrapped />).dive();
    });

    it('allows the theme prop name to be customized', () => {
      function MyComponent({ foo }) {
        expect(foo).to.eql(defaultTheme);
        return null;
      }

      const Wrapped = withStyles(() => ({}), { themePropName: 'foo' })(MyComponent);
      shallow(<Wrapped />).dive();
    });

    it('passes processed styles to wrapped component', () => {
      function MyComponent({ styles }) {
        expect(styles).to.eql({ foo: { color: '#990000' } });
        return null;
      }

      const Wrapped = withStyles(({ color }) => ({
        foo: {
          color: color.red,
        },
      }))(MyComponent);
      shallow(<Wrapped />).dive();
    });

    it('passes an empty styles object without a styleFn', () => {
      function MyComponent({ styles }) {
        expect(styles).to.eql({});
        return null;
      }

      const Wrapped = withStyles()(MyComponent);
      shallow(<Wrapped />).dive();
    });

    it('uses the theme from context', () => {
      const tropicalTheme = {
        color: {
          red: 'yellow',
        },
      };
      ThemedStyleSheet.registerTheme('tropical', tropicalTheme);

      function MyComponent({ styles }) {
        expect(styles).to.eql({ foo: { color: 'yellow' } });
        return null;
      }

      const Wrapped = withStyles(({ color }) => ({
        foo: {
          color: color.red,
        },
      }))(MyComponent);
      shallow(<Wrapped />, { context: { themeName: 'tropical' } }).dive();
    });

    it('allows the styles prop name to be customized', () => {
      function MyComponent({ bar }) {
        expect(bar).to.eql({ foo: { color: '#ff0000' } });
        return null;
      }

      const Wrapped = withStyles(() => ({
        foo: {
          color: '#ff0000',
        },
      }), { stylesPropName: 'bar' })(MyComponent);
      shallow(<Wrapped />).dive();
    });

    it('does not flush styles before rendering', () => {
      function MyComponent() {
        return null;
      }

      const Wrapped = withStyles(() => ({}))(MyComponent);
      shallow(<Wrapped />);
      expect(testInterface.flush.callCount).to.equal(0);
    });

    it('with the flushBefore option set, flushes styles before rendering', () => {
      function MyComponent() {
        return null;
      }

      const Wrapped = withStyles(() => ({}), { flushBefore: true })(MyComponent);
      shallow(<Wrapped />);
      expect(testInterface.flush.callCount).to.equal(1);
    });

    it('hoists statics', () => {
      function MyComponent() {
        return null;
      }
      MyComponent.foo = 'bar';

      const Wrapped = withStyles(() => ({}), { flushBefore: true })(MyComponent);
      expect(Wrapped.foo).to.equal('bar');
    });

    it('works with css()', () => {
      function MyComponent({ styles }) {
        return <div {...css(styles.foo)} />;
      }
      MyComponent.propTypes = {
        styles: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
      };

      const Wrapped = withStyles(({ color }) => ({
        foo: {
          color: color.red,
        },
      }))(MyComponent);
      const wrapper = shallow(<Wrapped />).dive();

      expect(wrapper.prop('style')).to.eql({ color: '#990000' });
    });

    it('copies over non-withStyles propTypes and defaultProps', () => {
      function MyComponent({ styles, theme }) {
        return <div {...css(styles.foo)}>{theme.color.default}</div>;
      }
      MyComponent.propTypes = {
        styles: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
        theme: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
        foo: PropTypes.number,
      };
      MyComponent.defaultProps = {
        foo: 3,
      };

      const Wrapped = withStyles(({ color }) => ({
        foo: {
          color: color.red,
        },
      }))(MyComponent);

      // copied
      const expectedPropTypes = deepmerge({}, MyComponent.propTypes);
      delete expectedPropTypes.styles;
      delete expectedPropTypes.theme;
      expect(Wrapped.propTypes).to.eql(expectedPropTypes);
      expect(MyComponent.propTypes).to.include.keys('styles', 'theme');

      expect(Wrapped.defaultProps).to.eql(MyComponent.defaultProps);

      // cloned
      expect(Wrapped.propTypes).not.to.equal(MyComponent.propTypes);
      expect(Wrapped.defaultProps).not.to.equal(MyComponent.defaultProps);
    });

    it('extends React.Component', () => {
      function MyComponent() {
        return null;
      }

      const Wrapped = withStyles(() => ({}))(MyComponent);
      expect(Object.getPrototypeOf(Wrapped)).to.equal(React.Component);
      expect(Object.getPrototypeOf(Wrapped.prototype)).to.equal(React.Component.prototype);
      expect(Object.getPrototypeOf(Wrapped)).not.to.equal(React.PureComponent);
      expect(Object.getPrototypeOf(Wrapped.prototype)).not.to.equal(React.PureComponent.prototype);
    });

    it('with the pureComponent option set, extends React.PureComponent', () => {
      function MyComponent() {
        return null;
      }

      const Wrapped = withStyles(() => ({}), { pureComponent: true })(MyComponent);
      expect(Object.getPrototypeOf(Wrapped)).not.to.equal(React.Component);
      expect(Object.getPrototypeOf(Wrapped.prototype)).not.to.equal(React.Component.prototype);
      expect(Object.getPrototypeOf(Wrapped)).to.equal(React.PureComponent);
      expect(Object.getPrototypeOf(Wrapped.prototype)).to.equal(React.PureComponent.prototype);
    });
  });
});
