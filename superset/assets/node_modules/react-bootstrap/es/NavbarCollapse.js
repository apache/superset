import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import React from 'react';
import PropTypes from 'prop-types';

import Collapse from './Collapse';
import { prefix } from './utils/bootstrapUtils';

var contextTypes = {
  $bs_navbar: PropTypes.shape({
    bsClass: PropTypes.string,
    expanded: PropTypes.bool
  })
};

var NavbarCollapse = function (_React$Component) {
  _inherits(NavbarCollapse, _React$Component);

  function NavbarCollapse() {
    _classCallCheck(this, NavbarCollapse);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  NavbarCollapse.prototype.render = function render() {
    var _props = this.props,
        children = _props.children,
        props = _objectWithoutProperties(_props, ['children']);

    var navbarProps = this.context.$bs_navbar || { bsClass: 'navbar' };

    var bsClassName = prefix(navbarProps, 'collapse');

    return React.createElement(
      Collapse,
      _extends({ 'in': navbarProps.expanded }, props),
      React.createElement(
        'div',
        { className: bsClassName },
        children
      )
    );
  };

  return NavbarCollapse;
}(React.Component);

NavbarCollapse.contextTypes = contextTypes;

export default NavbarCollapse;