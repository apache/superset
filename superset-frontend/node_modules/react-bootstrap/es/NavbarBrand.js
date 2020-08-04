import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import { prefix } from './utils/bootstrapUtils';
var contextTypes = {
  $bs_navbar: PropTypes.shape({
    bsClass: PropTypes.string
  })
};

var NavbarBrand =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(NavbarBrand, _React$Component);

  function NavbarBrand() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = NavbarBrand.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        className = _this$props.className,
        children = _this$props.children,
        props = _objectWithoutPropertiesLoose(_this$props, ["className", "children"]);

    var navbarProps = this.context.$bs_navbar || {
      bsClass: 'navbar'
    };
    var bsClassName = prefix(navbarProps, 'brand');

    if (React.isValidElement(children)) {
      return React.cloneElement(children, {
        className: classNames(children.props.className, className, bsClassName)
      });
    }

    return React.createElement("span", _extends({}, props, {
      className: classNames(className, bsClassName)
    }), children);
  };

  return NavbarBrand;
}(React.Component);

NavbarBrand.contextTypes = contextTypes;
export default NavbarBrand;