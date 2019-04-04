import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';

import { prefix } from './utils/bootstrapUtils';
import createChainedFunction from './utils/createChainedFunction';

var propTypes = {
  onClick: PropTypes.func,
  /**
   * The toggle content, if left empty it will render the default toggle (seen above).
   */
  children: PropTypes.node
};

var contextTypes = {
  $bs_navbar: PropTypes.shape({
    bsClass: PropTypes.string,
    expanded: PropTypes.bool,
    onToggle: PropTypes.func.isRequired
  })
};

var NavbarToggle = function (_React$Component) {
  _inherits(NavbarToggle, _React$Component);

  function NavbarToggle() {
    _classCallCheck(this, NavbarToggle);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  NavbarToggle.prototype.render = function render() {
    var _props = this.props,
        onClick = _props.onClick,
        className = _props.className,
        children = _props.children,
        props = _objectWithoutProperties(_props, ['onClick', 'className', 'children']);

    var navbarProps = this.context.$bs_navbar || { bsClass: 'navbar' };

    var buttonProps = _extends({
      type: 'button'
    }, props, {
      onClick: createChainedFunction(onClick, navbarProps.onToggle),
      className: classNames(className, prefix(navbarProps, 'toggle'), !navbarProps.expanded && 'collapsed')
    });

    if (children) {
      return React.createElement(
        'button',
        buttonProps,
        children
      );
    }

    return React.createElement(
      'button',
      buttonProps,
      React.createElement(
        'span',
        { className: 'sr-only' },
        'Toggle navigation'
      ),
      React.createElement('span', { className: 'icon-bar' }),
      React.createElement('span', { className: 'icon-bar' }),
      React.createElement('span', { className: 'icon-bar' })
    );
  };

  return NavbarToggle;
}(React.Component);

NavbarToggle.propTypes = propTypes;
NavbarToggle.contextTypes = contextTypes;

export default NavbarToggle;