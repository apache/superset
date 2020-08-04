"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _values = _interopRequireDefault(require("@babel/runtime-corejs2/core-js/object/values"));

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _classnames = _interopRequireDefault(require("classnames"));

var _react = _interopRequireDefault(require("react"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

var _StyleConfig = require("./utils/StyleConfig");

var Label =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(Label, _React$Component);

  function Label() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = Label.prototype;

  _proto.hasContent = function hasContent(children) {
    var result = false;

    _react.default.Children.forEach(children, function (child) {
      if (result) {
        return;
      }

      if (child || child === 0) {
        result = true;
      }
    });

    return result;
  };

  _proto.render = function render() {
    var _this$props = this.props,
        className = _this$props.className,
        children = _this$props.children,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["className", "children"]);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = (0, _extends2.default)({}, (0, _bootstrapUtils.getClassSet)(bsProps), {
      // Hack for collapsing on IE8.
      hidden: !this.hasContent(children)
    });
    return _react.default.createElement("span", (0, _extends2.default)({}, elementProps, {
      className: (0, _classnames.default)(className, classes)
    }), children);
  };

  return Label;
}(_react.default.Component);

var _default = (0, _bootstrapUtils.bsClass)('label', (0, _bootstrapUtils.bsStyles)((0, _values.default)(_StyleConfig.State).concat([_StyleConfig.Style.DEFAULT, _StyleConfig.Style.PRIMARY]), _StyleConfig.Style.DEFAULT, Label));

exports.default = _default;
module.exports = exports["default"];