"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _react = _interopRequireDefault(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _classnames = _interopRequireDefault(require("classnames"));

var _Button = _interopRequireDefault(require("./Button"));

var _SafeAnchor = _interopRequireDefault(require("./SafeAnchor"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

var propTypes = {
  noCaret: _propTypes.default.bool,
  open: _propTypes.default.bool,
  title: _propTypes.default.string,
  useAnchor: _propTypes.default.bool
};
var defaultProps = {
  open: false,
  useAnchor: false,
  bsRole: 'toggle'
};

var DropdownToggle =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(DropdownToggle, _React$Component);

  function DropdownToggle() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = DropdownToggle.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        noCaret = _this$props.noCaret,
        open = _this$props.open,
        useAnchor = _this$props.useAnchor,
        bsClass = _this$props.bsClass,
        className = _this$props.className,
        children = _this$props.children,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["noCaret", "open", "useAnchor", "bsClass", "className", "children"]);
    delete props.bsRole;
    var Component = useAnchor ? _SafeAnchor.default : _Button.default;
    var useCaret = !noCaret; // This intentionally forwards bsSize and bsStyle (if set) to the
    // underlying component, to allow it to render size and style variants.
    // FIXME: Should this really fall back to `title` as children?

    return _react.default.createElement(Component, (0, _extends2.default)({}, props, {
      role: "button",
      className: (0, _classnames.default)(className, bsClass),
      "aria-haspopup": true,
      "aria-expanded": open
    }), children || props.title, useCaret && ' ', useCaret && _react.default.createElement("span", {
      className: "caret"
    }));
  };

  return DropdownToggle;
}(_react.default.Component);

DropdownToggle.propTypes = propTypes;
DropdownToggle.defaultProps = defaultProps;

var _default = (0, _bootstrapUtils.bsClass)('dropdown-toggle', DropdownToggle);

exports.default = _default;
module.exports = exports["default"];