"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _assertThisInitialized2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/assertThisInitialized"));

var _classnames = _interopRequireDefault(require("classnames"));

var _react = _interopRequireDefault(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _SafeAnchor = _interopRequireDefault(require("./SafeAnchor"));

var _createChainedFunction = _interopRequireDefault(require("./utils/createChainedFunction"));

var propTypes = {
  active: _propTypes.default.bool,
  disabled: _propTypes.default.bool,
  role: _propTypes.default.string,
  href: _propTypes.default.string,
  onClick: _propTypes.default.func,
  onSelect: _propTypes.default.func,
  eventKey: _propTypes.default.any
};
var defaultProps = {
  active: false,
  disabled: false
};

var NavItem =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(NavItem, _React$Component);

  function NavItem(props, context) {
    var _this;

    _this = _React$Component.call(this, props, context) || this;
    _this.handleClick = _this.handleClick.bind((0, _assertThisInitialized2.default)((0, _assertThisInitialized2.default)(_this)));
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
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["active", "disabled", "onClick", "className", "style"]);
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

    return _react.default.createElement("li", {
      role: "presentation",
      className: (0, _classnames.default)(className, {
        active: active,
        disabled: disabled
      }),
      style: style
    }, _react.default.createElement(_SafeAnchor.default, (0, _extends2.default)({}, props, {
      disabled: disabled,
      onClick: (0, _createChainedFunction.default)(onClick, this.handleClick)
    })));
  };

  return NavItem;
}(_react.default.Component);

NavItem.propTypes = propTypes;
NavItem.defaultProps = defaultProps;
var _default = NavItem;
exports.default = _default;
module.exports = exports["default"];