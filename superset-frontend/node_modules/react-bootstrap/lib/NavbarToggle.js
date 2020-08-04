"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _classnames = _interopRequireDefault(require("classnames"));

var _react = _interopRequireDefault(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

var _createChainedFunction = _interopRequireDefault(require("./utils/createChainedFunction"));

var propTypes = {
  onClick: _propTypes.default.func,

  /**
   * The toggle content, if left empty it will render the default toggle (seen above).
   */
  children: _propTypes.default.node
};
var contextTypes = {
  $bs_navbar: _propTypes.default.shape({
    bsClass: _propTypes.default.string,
    expanded: _propTypes.default.bool,
    onToggle: _propTypes.default.func.isRequired
  })
};

var NavbarToggle =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(NavbarToggle, _React$Component);

  function NavbarToggle() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = NavbarToggle.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        onClick = _this$props.onClick,
        className = _this$props.className,
        children = _this$props.children,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["onClick", "className", "children"]);
    var navbarProps = this.context.$bs_navbar || {
      bsClass: 'navbar'
    };
    var buttonProps = (0, _extends2.default)({
      type: 'button'
    }, props, {
      onClick: (0, _createChainedFunction.default)(onClick, navbarProps.onToggle),
      className: (0, _classnames.default)(className, (0, _bootstrapUtils.prefix)(navbarProps, 'toggle'), !navbarProps.expanded && 'collapsed')
    });

    if (children) {
      return _react.default.createElement("button", buttonProps, children);
    }

    return _react.default.createElement("button", buttonProps, _react.default.createElement("span", {
      className: "sr-only"
    }, "Toggle navigation"), _react.default.createElement("span", {
      className: "icon-bar"
    }), _react.default.createElement("span", {
      className: "icon-bar"
    }), _react.default.createElement("span", {
      className: "icon-bar"
    }));
  };

  return NavbarToggle;
}(_react.default.Component);

NavbarToggle.propTypes = propTypes;
NavbarToggle.contextTypes = contextTypes;
var _default = NavbarToggle;
exports.default = _default;
module.exports = exports["default"];