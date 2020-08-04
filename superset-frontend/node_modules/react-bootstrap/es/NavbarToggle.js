import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
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

var NavbarToggle =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(NavbarToggle, _React$Component);

  function NavbarToggle() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = NavbarToggle.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        onClick = _this$props.onClick,
        className = _this$props.className,
        children = _this$props.children,
        props = _objectWithoutPropertiesLoose(_this$props, ["onClick", "className", "children"]);

    var navbarProps = this.context.$bs_navbar || {
      bsClass: 'navbar'
    };

    var buttonProps = _extends({
      type: 'button'
    }, props, {
      onClick: createChainedFunction(onClick, navbarProps.onToggle),
      className: classNames(className, prefix(navbarProps, 'toggle'), !navbarProps.expanded && 'collapsed')
    });

    if (children) {
      return React.createElement("button", buttonProps, children);
    }

    return React.createElement("button", buttonProps, React.createElement("span", {
      className: "sr-only"
    }, "Toggle navigation"), React.createElement("span", {
      className: "icon-bar"
    }), React.createElement("span", {
      className: "icon-bar"
    }), React.createElement("span", {
      className: "icon-bar"
    }));
  };

  return NavbarToggle;
}(React.Component);

NavbarToggle.propTypes = propTypes;
NavbarToggle.contextTypes = contextTypes;
export default NavbarToggle;