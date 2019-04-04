import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';

import { prefix } from './utils/bootstrapUtils';

var contextTypes = {
  $bs_navbar: PropTypes.shape({
    bsClass: PropTypes.string
  })
};

var NavbarBrand = function (_React$Component) {
  _inherits(NavbarBrand, _React$Component);

  function NavbarBrand() {
    _classCallCheck(this, NavbarBrand);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  NavbarBrand.prototype.render = function render() {
    var _props = this.props,
        className = _props.className,
        children = _props.children,
        props = _objectWithoutProperties(_props, ['className', 'children']);

    var navbarProps = this.context.$bs_navbar || { bsClass: 'navbar' };

    var bsClassName = prefix(navbarProps, 'brand');

    if (React.isValidElement(children)) {
      return React.cloneElement(children, {
        className: classNames(children.props.className, className, bsClassName)
      });
    }

    return React.createElement(
      'span',
      _extends({}, props, { className: classNames(className, bsClassName) }),
      children
    );
  };

  return NavbarBrand;
}(React.Component);

NavbarBrand.contextTypes = contextTypes;

export default NavbarBrand;