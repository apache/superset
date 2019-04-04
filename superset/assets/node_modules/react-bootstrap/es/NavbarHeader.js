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

var NavbarHeader = function (_React$Component) {
  _inherits(NavbarHeader, _React$Component);

  function NavbarHeader() {
    _classCallCheck(this, NavbarHeader);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  NavbarHeader.prototype.render = function render() {
    var _props = this.props,
        className = _props.className,
        props = _objectWithoutProperties(_props, ['className']);

    var navbarProps = this.context.$bs_navbar || { bsClass: 'navbar' };

    var bsClassName = prefix(navbarProps, 'header');

    return React.createElement('div', _extends({}, props, { className: classNames(className, bsClassName) }));
  };

  return NavbarHeader;
}(React.Component);

NavbarHeader.contextTypes = contextTypes;

export default NavbarHeader;