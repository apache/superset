import React from 'react';
import PropTypes from 'prop-types';

/* eslint react/forbid-prop-types: 0 */

const stringOrFunction = PropTypes.oneOfType([PropTypes.func, PropTypes.string]);
const makeValidElementType = (adapter) => {
  if (!adapter) {
    return stringOrFunction;
  }

  function validElementType(props, propName, ...args) {
    if (!adapter.isValidElementType) {
      return stringOrFunction(props, propName, ...args);
    }
    const propValue = props[propName];
    if (propValue == null || adapter.isValidElementType(propValue)) {
      return null;
    }
    return new TypeError(`${propName} must be a valid element type!`);
  }
  validElementType.isRequired = function validElementTypeRequired(props, propName, ...args) {
    if (!adapter.isValidElementType) {
      return stringOrFunction.isRequired(props, propName, ...args);
    }
    const propValue = props[propName]; // eslint-disable-line react/destructuring-assignment
    if (adapter.isValidElementType(propValue)) {
      return null;
    }
    return new TypeError(`${propName} must be a valid element type!`);
  };
  return validElementType;
};

/**
 * This is a utility component to wrap around the nodes we are
 * passing in to `mount()`. Theoretically, you could do everything
 * we are doing without this, but this makes it easier since
 * `renderIntoDocument()` doesn't really pass back a reference to
 * the DOM node it rendered to, so we can't really "re-render" to
 * pass new props in.
 */
export default function createMountWrapper(node, options = {}) {
  const { adapter } = options;

  class WrapperComponent extends React.Component {
    constructor(...args) {
      super(...args);
      const { props, context } = this.props;
      this.state = {
        mount: true,
        props,
        context,
      };
    }

    setChildProps(newProps, newContext, callback = undefined) {
      const { props: oldProps, context: oldContext } = this.state;
      const props = { ...oldProps, ...newProps };
      const context = { ...oldContext, ...newContext };
      this.setState({ props, context }, callback);
    }

    getInstance() {
      const component = this._reactInternalInstance._renderedComponent;
      const inst = component.getPublicInstance();
      if (inst === null) {
        return component._instance;
      }
      return inst;
    }

    getWrappedComponent() {
      const component = this._reactInternalInstance._renderedComponent;
      const inst = component.getPublicInstance();
      if (inst === null) {
        return component._instance;
      }
      return inst;
    }

    setChildContext(context) {
      return new Promise(resolve => this.setState({ context }, resolve));
    }

    render() {
      const { Component } = this.props;
      const { mount, props } = this.state;
      if (!mount) return null;
      return (
        <Component {...props} />
      );
    }
  }
  WrapperComponent.propTypes = {
    Component: makeValidElementType(adapter).isRequired,
    props: PropTypes.object.isRequired,
    context: PropTypes.object,
  };
  WrapperComponent.defaultProps = {
    context: null,
  };

  if (options.context && (node.type.contextTypes || options.childContextTypes)) {
    // For full rendering, we are using this wrapper component to provide context if it is
    // specified in both the options AND the child component defines `contextTypes` statically
    // OR the merged context types for all children (the node component or deeper children) are
    // specified in options parameter under childContextTypes.
    // In that case, we define both a `getChildContext()` function and a `childContextTypes` prop.
    const childContextTypes = {
      ...node.type.contextTypes,
      ...options.childContextTypes,
    };

    WrapperComponent.prototype.getChildContext = function getChildContext() {
      return this.state.context;
    };
    WrapperComponent.childContextTypes = childContextTypes;
  }
  return WrapperComponent;
}
