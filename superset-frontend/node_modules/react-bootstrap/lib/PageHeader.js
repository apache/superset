"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _classnames = _interopRequireDefault(require("classnames"));

var _react = _interopRequireDefault(require("react"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

var PageHeader =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(PageHeader, _React$Component);

  function PageHeader() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = PageHeader.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        className = _this$props.className,
        children = _this$props.children,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["className", "children"]);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = (0, _bootstrapUtils.getClassSet)(bsProps);
    return _react.default.createElement("div", (0, _extends2.default)({}, elementProps, {
      className: (0, _classnames.default)(className, classes)
    }), _react.default.createElement("h1", null, children));
  };

  return PageHeader;
}(_react.default.Component);

var _default = (0, _bootstrapUtils.bsClass)('page-header', PageHeader);

exports.default = _default;
module.exports = exports["default"];