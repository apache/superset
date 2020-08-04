import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import _assertThisInitialized from "@babel/runtime-corejs2/helpers/esm/assertThisInitialized";
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import SafeAnchor from './SafeAnchor';
import createChainedFunction from './utils/createChainedFunction';
var propTypes = {
  active: PropTypes.bool,
  disabled: PropTypes.bool,
  role: PropTypes.string,
  href: PropTypes.string,
  onClick: PropTypes.func,
  onSelect: PropTypes.func,
  eventKey: PropTypes.any
};
var defaultProps = {
  active: false,
  disabled: false
};

var NavItem =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(NavItem, _React$Component);

  function NavItem(props, context) {
    var _this;

    _this = _React$Component.call(this, props, context) || this;
    _this.handleClick = _this.handleClick.bind(_assertThisInitialized(_assertThisInitialized(_this)));
    return _this;
  }

  var _proto = NavItem.prototype;

  _proto.handleClick = function handleClick(e) {
    if (this.props.disabled) {
      e.preventDefault();
      return;
    }

    if (this.props.onSelect) {
      this.props.onSelect(this.props.eventKey, e);
    }
  };

  _proto.render = function render() {
    var _this$props = this.props,
        active = _this$props.active,
        disabled = _this$props.disabled,
        onClick = _this$props.onClick,
        className = _this$props.className,
        style = _this$props.style,
        props = _objectWithoutPropertiesLoose(_this$props, ["active", "disabled", "onClick", "className", "style"]);

    delete props.onSelect;
    delete props.eventKey; // These are injected down by `<Nav>` for building `<SubNav>`s.

    delete props.activeKey;
    delete props.activeHref;

    if (!props.role) {
      if (props.href === '#') {
        props.role = 'button';
      }
    } else if (props.role === 'tab') {
      props['aria-selected'] = active;
    }

    return React.createElement("li", {
      role: "presentation",
      className: classNames(className, {
        active: active,
        disabled: disabled
      }),
      style: style
    }, React.createElement(SafeAnchor, _extends({}, props, {
      disabled: disabled,
      onClick: createChainedFunction(onClick, this.handleClick)
    })));
  };

  return NavItem;
}(React.Component);

NavItem.propTypes = propTypes;
NavItem.defaultProps = defaultProps;
export default NavItem;